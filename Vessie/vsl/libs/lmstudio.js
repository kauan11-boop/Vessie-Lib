/* ============================================================
   Vessie Script Language — Biblioteca lmstudio
   Integração otimizada com a API do LM Studio (compatível OpenAI).

   Operações otimizadas:
   - Lista de modelos (com cache)
   - Chat completion (streaming e non-streaming)
   - Trim inteligente de histórico baseado em tokens
   - Retry automático com backoff
   - Connection pooling reutilizável

   API endpoints usados:
   - GET  /v1/models              → lista de modelos
   - POST /v1/chat/completions    → geração de resposta
   ============================================================ */
'use strict';

const { VessieHTTP } = require('./http');
const { SSEStreamParser } = require('./stream');
const tokens = require('./tokens');
const utils = require('./utils');

/** Cliente otimizado para LM Studio */
class LMStudioClient {
  constructor(opts = {}) {
    this.config = {
      baseUrl: opts.baseUrl || 'http://localhost:1234/v1',
      model: opts.model || '',
      temperature: opts.temperature || 0.7,
      topP: opts.topP || 0.95,
      maxTokens: opts.maxTokens || -1,
      stream: opts.stream !== false,
      timeout: opts.timeout || 30000,
      maxRetries: opts.maxRetries || 3,
      retryBaseDelay: opts.retryBaseDelay || 500,
      contextLimit: opts.contextLimit || 4096,
      reserveForCompletion: opts.reserveForCompletion || 512,
      ...opts
    };
    this.http = new VessieHTTP({
      baseUrl: this.config.baseUrl,
      timeout: this.config.timeout,
      maxRetries: this.config.maxRetries,
      retryBaseDelay: this.config.retryBaseDelay,
      connection: opts.connection || {},
      logger: opts.logger || new utils.Logger({ level: 'info' })
    });
    this.logger = this.http.logger;
    this._modelCache = null;
    this._modelCacheTs = 0;
    this._modelCacheTtl = 30000; // 30s
  }

  /** Verifica se o modelo está online */
  async checkConnection() {
    const t0 = Date.now();
    try {
      const data = await this.http.get('/models', { noCache: true });
      const models = (data.data || []).map(m => m.id);
      return {
        ok: true,
        ms: Date.now() - t0,
        models,
        count: models.length
      };
    } catch (err) {
      return {
        ok: false,
        ms: Date.now() - t0,
        err: err.message
      };
    }
  }

  /** Lista modelos disponíveis (com cache de 30s) */
  async listModels(forceRefresh = false) {
    const now = Date.now();
    if (!forceRefresh && this._modelCache && (now - this._modelCacheTs < this._modelCacheTtl)) {
      this.logger.debug('Modelos do cache', { count: this._modelCache.length });
      return this._modelCache;
    }
    const data = await this.http.get('/models');
    const models = (data.data || []).map(m => ({
      id: m.id,
      name: m.id.replace(/^.*\//, ''),
      format: m.format || 'GGUF',
      size: m.size ? utils.formatBytes(m.size) : null
    }));
    this._modelCache = models;
    this._modelCacheTs = now;
    return models;
  }

  /**
   * Envia histórico de mensagens e recebe resposta.
   * Modo streaming: retorna um generator async de tokens.
   * Modo não-streaming: retorna a resposta completa.
   */
  async chat(messages, opts = {}) {
    const settings = { ...this.config, ...opts };
    const model = settings.model || settings.model || (await this.listModels())[0]?.id;

    // Trim inteligente baseado em tokens
    const trimmed = tokens.trimConversation(
      messages,
      settings.contextLimit,
      settings.reserveForCompletion
    );

    const stats = tokens.tokenStats(trimmed, settings.contextLimit);
    this.logger.debug('Estatísticas de tokens', stats);

    const body = {
      model,
      messages: trimmed,
      temperature: settings.temperature,
      top_p: settings.topP,
      max_tokens: settings.maxTokens > 0 ? settings.maxTokens : -1,
      stream: settings.stream
    };

    const t0 = Date.now();

    if (settings.stream) {
      return await this.chatStream(trimmed, opts.onToken || (() => {}), settings);
    }
    return await this._chatBlock(body, t0);
  }

  /** Chat em modo streaming (retorna generator async de tokens) */
  async *_chatStream(body) {
    const result = await this.http.request('POST', '/chat/completions', body, { stream: true });
    const parser = new SSEStreamParser({
      highWaterMark: this.config.stream?.highWaterMark,
      throttleMs: this.config.stream?.throttleMs || 30
    });

    let resolved = false;

    const onToken = (text) => { if (!resolved) { resolved = true; this._currentResolve?.(text); } };
    const onReason = (text) => { this._currentReasoning += text; };
    const onDone = (stats) => {
      if (!resolved) { this._currentResolve?.(null); }
      this._resolveStats?.(stats);
      this._resolveStats = null;
      this._currentResolve = null;
    };
    const onError = (err) => {
      if (!resolved) { this._currentError?.(err); }
      this._currentError = null;
      this._currentResolve = null;
    };

    parser.on('token', onToken);
    parser.on('reasoning', onReason);
    parser.on('done', onDone);
    parser.on('error', onError);

    // Processa stream em background
    const processing = parser.processReader(result.reader);

    // Yield tokens conforme recebidos
    while (true) {
      if (parser._stopped) break;
      const stats = await processing.catch(() => null);
      break;
    }

    result.clear();
    parser.stop();
  }

  /** Chat em modo não-streaming (retorna resposta única) */
  async _chatBlock(body, t0) {
    const data = await this.http.post('/chat/completions', body);

    const choice = data.choices?.[0];
    const message = choice?.message || {};

    const result = {
      content: message.content || '',
      reasoning: message.reasoning_content || '',
      role: message.role || 'assistant',
      finishReason: choice?.finish_reason || 'stop',
      usage: data.usage || null,
      model: data.model || body.model,
      stats: {
        duration: (Date.now() - t0) / 1000,
        inputTokens: data.usage?.prompt_tokens || 0,
        outputTokens: data.usage?.completion_tokens || 0,
        totalTokens: data.usage?.total_tokens || 0,
        tokenPerSec: data.usage
          ? Math.round((data.usage.completion_tokens / ((Date.now() - t0) / 1000)) * 100) / 100
          : 0
      }
    };

    this.logger.debug('Resposta recebida', {
      duration: result.stats.duration,
      outputTokens: result.stats.outputTokens
    });

    return result;
  }

  /** Envia mensagem e recebe resposta streaming via callback (modo mais prático) */
  async chatStream(messages, onToken, opts = {}) {
    const model = opts.model || this.config.model || (await this.listModels())[0]?.id;
    const trimmed = tokens.trimConversation(
      messages,
      opts.contextLimit || this.config.contextLimit,
      opts.reserveForCompletion || this.config.reserveForCompletion
    );

    const body = {
      model,
      messages: trimmed,
      temperature: opts.temperature ?? this.config.temperature,
      top_p: opts.topP ?? this.config.topP,
      max_tokens: (opts.maxTokens ?? this.config.maxTokens) > 0
        ? (opts.maxTokens ?? this.config.maxTokens)
        : -1,
      stream: true
    };

    const t0 = Date.now();
    this._tokenCount = 0;
    this._reasoningContent = '';
    this._content = '';

    const result = await this.http.request('POST', '/chat/completions', body, {
      stream: true,
      timeout: opts.timeout || this.config.timeout
    });

    const parser = new SSEStreamParser({
      highWaterMark: opts.highWaterMark || 65536,
      throttleMs: opts.throttleMs || 30,
      heartbeatMs: opts.heartbeatMs || 15000
    });

    return new Promise((resolve, reject) => {
      let settled = false;

      parser.on('token', (text) => {
        this._tokenCount++;
        this._content += text;
        onToken(text, { tokenCount: this._tokenCount });
      });

      parser.on('reasoning', (text) => {
        this._reasoningContent += text;
      });

      parser.on('done', (stats) => {
        if (settled) return;
        settled = true;
        result.clear();

        const duration = (Date.now() - t0) / 1000;
        resolve({
          content: this._content,
          reasoning: this._reasoningContent,
          tokenCount: this._tokenCount,
          usage: stats.usage,
          stats: {
            duration,
            outputTokens: this._tokenCount,
            tokenPerSec: Math.round(this._tokenCount / duration * 100) / 100
          }
        });
      });

      parser.on('error', (err) => {
        if (settled) return;
        settled = true;
        result.clear();
        parser.stop();
        reject(err);
      });

      // Processa o stream
      parser.processReader(result.reader).catch(err => {
        if (settled) return;
        settled = true;
        parser.stop();
        result.clear();
        reject(err);
      });
    });
  }

  /** Envia uma mensagem única (conversa simples) */
  async sendMessage(message, opts = {}) {
    const messages = [];
    if (opts.systemPrompt) {
      messages.push({ role: 'system', content: opts.systemPrompt });
    }
    messages.push({ role: 'user', content: message });

    if (opts.stream !== false) {
      return await this.chatStream(messages, opts.onToken || (() => {}), opts);
    }

    return await this.chat(messages, { ...opts, stream: false });
  }

  /** Consulta múltiplos modelos em paralelo (batch) */
  async batchQuery(messages, modelIds, opts = {}) {
    const results = await Promise.allSettled(
      modelIds.map(modelId =>
        this.sendMessage(messages[0]?.content || '', {
          ...opts,
          model: modelId,
          stream: false
        })
      )
    );

    return results.map((r, i) => ({
      model: modelIds[i],
      status: r.status,
      result: r.status === 'fulfilled' ? r.value : null,
      error: r.status === 'rejected' ? r.reason.message : null
    }));
  }

  /** Fecha o cliente e libera recursos */
  async close() {
    await this.http.close();
  }
}

module.exports = { LMStudioClient };
