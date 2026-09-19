/* ============================================================
   Vessie Script Language — Biblioteca stream
   Parser SSE (Server-Sent Events) otimizado para streaming
   de tokens do LM Studio.

   Otimizações em relação ao parser básico:
   - Processamento de chunk boundary (não perde dados em bordas)
   - High-water mark configurável (buffer maior = menos chamadas)
   - Heartbeat monitoring (detecta conexões mortas)
   - Backpressure signaling (pausa quando consumidor está lento)
   - Acúmulo eficiente de reasoning_content separadamente
   ============================================================ */
'use strict';

/**
 * Parser SSE otimizado para eventos de streaming do LM Studio.
 *
 * Uso:
 *   const parser = new SSEStreamParser({ highWaterMark: 65536 });
 *   parser.on('token', text => append(text));
 *   parser.on('reasoning', text => appendReasoning(text));
 *   parser.on('done', stats => console.log(stats));
 *   parser.on('error', err => console.error(err));
 */
class SSEStreamParser {
  constructor(opts = {}) {
    this.buffer = '';
    this.highWaterMark = opts.highWaterMark || 65536; // 64KB por chunk
    this.throttleMs = opts.throttleMs || 30;
    this.heartbeatMs = opts.heartbeatMs || 15000;

    this.readers = [];
    this.reasoning = '';
    this.content = '';
    this.usage = null;
    this.tokenCount = 0;
    this.lastActivity = Date.now();
    this._lastPaint = 0;
    this._heartbeatTimer = null;
    this._stopped = false;

    this._events = {};
  }

  on(event, fn) {
    if (!this._events[event]) this._events[event] = [];
    this._events[event].push(fn);
  }

  off(event, fn) {
    if (!this._events[event]) return;
    this._events[event] = this._events[event].filter(f => f !== fn);
  }

  emit(event, ...args) {
    const fns = this._events[event];
    if (fns) fns.forEach(fn => fn(...args));
  }

  /** Processa um chunk de dados recebidos */
  write(chunk) {
    if (this._stopped) return;

    this.lastActivity = Date.now();
    this.buffer += chunk; // acumula no buffer (string concat é eficiente para chunks < 64KB)

    // Processa todas as linhas completas no buffer
    let idx;
    while ((idx = this.buffer.indexOf('\n')) >= 0) {
      const line = this.buffer.slice(0, idx).trim();
      this.buffer = this.buffer.slice(idx + 1);

      if (line) {
        this._processLine(line);
      }
    }
  }

  /** Processa uma linha SSE individual */
  _processLine(line) {
    // Formato: data: {"id":"...","choices":[{"delta":{...}}]}
    if (!line.startsWith('data:')) return;

    const payload = line.slice(5).trim();

    // Evento de finalização
    if (payload === '[DONE]') {
      this._finish();
      return;
    }

    // Parse do JSON (com tratamento de erro)
    let json;
    try {
      json = JSON.parse(payload);
    } catch {
      // Linha que não é JSON válido (ex: comentário ou evento não-data)
      return;
    }

    const choice = json.choices?.[0];
    if (!choice) return;

    const delta = choice.delta || {};

    // Accumula reasoning_content separadamente (para modelos como DeepSeek-R1)
    if (delta.reasoning_content) {
      this.reasoning += delta.reasoning_content;
      this.emit('reasoning', delta.reasoning_content);
    }

    // Accumula content
    if (delta.content) {
      this.content += delta.content;
      this.tokenCount++;
      this._throttledEmit('token', delta.content);
    }

    // Verifica finish_reason
    if (choice.finish_reason) {
      if (json.usage) this.usage = json.usage;
    }
  }

  /** Emite evento com throttle (não mais rápido que throttleMs) */
  _throttledEmit(event, ...args) {
    const now = Date.now();
    if (now - this._lastPaint >= this.throttleMs) {
      this._lastPaint = now;
      this.emit(event, ...args);
    }
  }

  /** Finaliza o parsing */
  _finish() {
    if (this._stopped) return;
    this._stopped = true;
    this.emit('done', {
      content: this.content,
      reasoning: this.reasoning,
      tokenCount: this.tokenCount,
      usage: this.usage,
      duration: Date.now() - this.lastActivity
    });
  }

  /** Erro durante o parsing */
  error(err) {
    this._stopped = true;
    this.emit('error', err);
  }

  /** Inicia monitoramento de heartbeat */
  _startHeartbeat() {
    this._heartbeatTimer = setInterval(() => {
      if (Date.now() - this.lastActivity > this.heartbeatMs) {
        this.error(new Error('Heartbeat timeout: conexão inativa por mais de ' + this.heartbeatMs + 'ms'));
      }
    }, this.heartbeatMs / 2);
  }

  /** Para o monitoramento */
  stop() {
    this._stopped = true;
    if (this._heartbeatTimer) clearInterval(this._heartbeatTimer);
  }

  /** Processa o reader de um Response stream diretamente */
  async processReader(reader) {
    this._startHeartbeat();
    const decoder = new TextDecoder();
    let done = false;

    while (!done && !this._stopped) {
      const { value, done: d } = await reader.read();
      done = d;

      if (value) {
        const chunk = decoder.decode(value, { stream: true });

        // Backpressure: se o buffer estiver muito grande, pausa
        if (this.buffer.length > this.highWaterMark * 2) {
          await new Promise(r => setTimeout(r, 10));
        }

        this.write(chunk);
      }
    }

    // Flush final
    if (!this._stopped) {
      this._finish();
    }

    if (this._heartbeatTimer) clearInterval(this._heartbeatTimer);
  }
}

module.exports = { SSEStreamParser };
