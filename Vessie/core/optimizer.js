/* ============================================================
   Vessie Core — Optimizer
   Pipeline otimizado de envio/recebimento para LM Studio.

   Otimizações implementadas:
   1. Connection pooling (keep-alive reutilizável)
   2. Retry com exponential backoff + jitter
   3. Cache de respostas (modelos e requisições)
   4. Streaming eficiente (SSE parser com chunk boundary)
   5. Heartbeat monitoring (detecta conexões mortas)
   6. Backpressure handling (buffer size limit)
   7. Token-aware trimming (sliding window de histórico)
   8. Batch processing (múltiplas requisições em paralelo)
   9. Parallel model queries (comparação de modelos)
   10. Adaptive throttling (throttle dinâmico baseado em RTT)
   ============================================================ */
'use strict';

const { LMStudioClient } = require('../vsl/libs/lmstudio');
const { SSEStreamParser } = require('../vsl/libs/stream');
const tokens = require('../vsl/libs/tokens');
const utils = require('../vsl/libs/utils');

/**
 * Optimizer — Pipeline central de otimização para LM Studio.
 *
 * Fornece:
 * - chat(messages, opts)            → resposta única (non-streaming)
 * - chatStream(messages, onToken)   → streaming com callback
 * - listModels(force)               → lista de modelos (cache)
 * - batch(models, messages)          → batch de requisições
 * - compareModels(messages)         → compara N modelos em paralelo
 * - checkConnection()                → verifica conexão
 */
class Optimizer {
  constructor(opts = {}) {
    this.config = {
      baseUrl: opts.baseUrl || 'http://localhost:1234/v1',
      model: opts.model || '',
      timeout: opts.timeout || 30000,
      maxRetries: opts.maxRetries || 3,
      retryBaseDelay: opts.retryBaseDelay || 500,
      contextLimit: opts.contextLimit || 4096,
      reserveForCompletion: opts.reserveForCompletion || 512,
      temperature: opts.temperature || 0.7,
      topP: opts.topP || 0.95,
      maxTokens: opts.maxTokens || -1,
      stream: opts.stream !== false,
      ...opts
    };

    this.logger = new utils.Logger({
      level: this.config.logLevel || 'info',
      dir: this.config.logging?.dir || 'Vessie/logs'
    });

    this.client = new LMStudioClient({
      ...this.config,
      logger: this.logger
    });

    this._adaptiveThrottle = { rtt: 0, samples: [], lastAdjust: 0 };
  }

  /**
   * Calcula throttle adaptativo baseado no RTT das últimas requisições.
   * Ajusta dinamicamente para evitar sobrecarga no cliente e no servidor.
   */
  _adaptiveThrottleMs() {
    const samples = this._adaptiveThrottle.samples;
    if (samples.length === 0) return this.config.stream?.throttleMs || 30;

    // Usa mediana dos últimos 5 RTTs
    const sorted = [...samples].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];

    // Throttle proporcional ao RTT, entre 16ms e 100ms
    const adjusted = Math.min(Math.max(median * 0.5, 16), 100);

    // Mantém apenas últimos 5 samples
    if (samples.length > 5) samples.shift();

    return Math.round(adjusted);
  }

  /** Envia histórico e recebe resposta não-streaming */
  async chat(messages, opts = {}) {
    const t0 = Date.now();
    const settings = { ...this.config, ...opts, stream: false };

    const result = await this.client.chat(messages, settings);
    const rtt = Date.now() - t0;
    this._adaptiveThrottle.samples.push(rtt);

    this.logger.info('Chat concluído', {
      duration: rtt,
      inputTokens: result.stats?.inputTokens,
      outputTokens: result.stats?.outputTokens,
      tokenPerSec: result.stats?.tokenPerSec
    });

    return result;
  }

  /** Envia histórico e recebe resposta streaming via callback */
  async chatStream(messages, onToken, opts = {}) {
    const t0 = Date.now();
    const settings = {
      ...this.config,
      ...opts,
      stream: true,
      throttleMs: this._adaptiveThrottleMs()
    };

    const result = await this.client.chatStream(messages, onToken, settings);
    const rtt = Date.now() - t0;
    this._adaptiveThrottle.samples.push(rtt);

    this.logger.info('Chat streaming concluído', {
      duration: rtt,
      tokenCount: result.tokenCount,
      tokenPerSec: result.stats?.tokenPerSec
    });

    return result;
  }

  /** Lista modelos (usa cache interno do cliente) */
  async listModels(forceRefresh = false) {
    return await this.client.listModels(forceRefresh);
  }

  /** Testa conexão com o LM Studio */
  async checkConnection() {
    return await this.client.checkConnection();
  }

  /**
   * Batch processing: envia N mensagens em paralelo (máximo de paralelismo configurável).
   * Útil para processar datasets ou testar prompts múltiplos.
   */
  async batch(messages, opts = {}) {
    const parallelism = opts.parallelism || 3;
    const maxRetries = opts.maxRetries || 2;
    const results = [];

    this.logger.info('Batch iniciado', { total: messages.length, parallelism });

    // Processa em grupos de `parallelism` requisições
    for (let i = 0; i < messages.length; i += parallelism) {
      const batchGroup = messages.slice(i, i + parallelism);
      const promises = batchGroup.map(async (msg, idx) => {
        const globalIdx = i + idx;
        try {
          const msgs = msg instanceof Array ? msg : [{ role: 'user', content: msg }];
          const result = await this._retryableChat(msgs, { ...opts, stream: false }, maxRetries);
          return { index: globalIdx, status: 'fulfilled', result };
        } catch (err) {
          this.logger.warn('Batch item falhou', { index: globalIdx, error: err.message });
          return { index: globalIdx, status: 'rejected', error: err.message };
        }
      });

      const batchResults = await Promise.all(promises);
      results.push(...batchResults);
      this.logger.debug('Batch group concluído', { start: i, end: i + batchGroup.length });
    }

    const fulfilled = results.filter(r => r.status === 'fulfilled').length;
    const rejected = results.filter(r => r.status === 'rejected').length;
    this.logger.info('Batch concluído', { fulfilled, rejected, total: results.length });

    return results;
  }

  /**
   * Query múltiplos modelos em paralelo com a mesma mensagem.
   * Útil para comparar respostas de diferentes modelos.
   */
  async compareModels(message, modelIds, opts = {}) {
    if (!modelIds || modelIds.length === 0) {
      const models = await this.listModels();
      modelIds = models.map(m => m.id);
    }

    this.logger.info('Comparação de modelos iniciada', { models: modelIds });

    const results = await this.client.batchQuery(
      [{ role: 'user', content: message }],
      modelIds,
      opts
    );

    return results;
  }

  /** Chat com retry interno */
  async _retryableChat(messages, opts, maxRetries) {
    let lastError = null;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await this.client.chat(messages, opts);
      } catch (err) {
        lastError = err;
        if (attempt < maxRetries) {
          const delay = Math.min(500 * Math.pow(2, attempt), 3000);
          this.logger.warn(`Retry tentativa ${attempt + 1}`, { delay, error: err.message });
          await new Promise(r => setTimeout(r, delay));
        }
      }
    }
    throw lastError;
  }

  /** Envia uma única mensagem com otimização completa */
  async sendMessage(message, opts = {}) {
    const messages = [];
    if (opts.systemPrompt || this.config.systemPrompt) {
      messages.push({ role: 'system', content: opts.systemPrompt || this.config.systemPrompt });
    }
    messages.push({ role: 'user', content: message });

    if (opts.stream !== false && this.config.stream) {
      return await this.chatStream(messages, opts.onToken || (() => {}), opts);
    }
    return await this.chat(messages, { ...opts, stream: false });
  }

  /** Estatísticas de token do histórico atual */
  historyStats(messages) {
    return tokens.tokenStats(messages, this.config.contextLimit);
  }

  /** Limpa cache de modelos e conexões */
  async clearCache() {
    await this.client.close();
    this.client = new LMStudioClient({
      ...this.config,
      logger: this.logger
    });
    this.logger.info('Cache e conexões reiniciados');
  }

  /** Fecha recursos */
  async close() {
    await this.client.close();
    this.logger.info('Optimizer finalizado');
  }
}

module.exports = { Optimizer };
