/* ============================================================
   Vessie Script Language — Biblioteca http
   Cliente HTTP otimizado com:
   - Connection pooling (keep-alive)
   - Retry com exponential backoff + jitter
   - Timeout + AbortController
   - Cache de respostas com TTL
   ============================================================ */
'use strict';

const http = require('http');
const https = require('https');
const { URL } = require('url');
const utils = require('./utils');

/**
 * Pool de conexões persistentes (keep-alive)
 * Reuse sockets entre requisições para reduzir latência.
 */
class ConnectionPool {
  constructor(opts = {}) {
    this.agents = new Map();
    this.opts = {
      keepAlive: opts.keepAlive !== false,
      keepAliveMsecs: opts.keepAliveMsecs || 1000,
      maxSockets: opts.maxSockets || 50,
      maxFreeSockets: opts.maxFreeSockets || 10,
      timeout: opts.timeout || 60000,
      ...opts
    };
  }

  getAgent(urlStr) {
    const key = urlStr;
    if (!this.agents.has(key)) {
      const isHttps = urlStr.startsWith('https');
      const agent = isHttps
        ? new https.Agent(this.opts)
        : new http.Agent(this.opts);
      this.agents.set(key, agent);
    }
    return this.agents.get(key);
  }

  /** Fecha todos os sockets do pool */
  destroyAll() {
    for (const agent of this.agents.values()) {
      agent.destroy();
    }
    this.agents.clear();
  }
}

/** Cache simples com TTL (Time-To-Live) */
class ResponseCache {
  constructor(opts = {}) {
    this.ttl = opts.ttl || 300000;
    this.maxEntries = opts.maxEntries || 100;
    this.cache = new Map();
  }

  _key(method, url) {
    return `${method}:${url}`;
  }

  set(method, url, data) {
    const key = this._key(method, url);
    if (this.cache.size >= this.maxEntries) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    this.cache.set(key, { data, ts: Date.now() });
  }

  get(method, url) {
    const entry = this.cache.get(this._key(method, url));
    if (!entry) return null;
    if (Date.now() - entry.ts > this.ttl) {
      this.cache.delete(this._key(method, url));
      return null;
    }
    return entry.data;
  }

  clear() {
    this.cache.clear();
  }
}

/**
 * Cliente HTTP otimizado
 * Características:
 * - Reutiliza conexões via ConnectionPool
 * - Retry automático com exponential backoff
 * - Cache de respostas GET (TTL configurável)
 * - AbortController para cancelamento
 */
class VessieHTTP {
  constructor(opts = {}) {
    this.config = {
      baseUrl: opts.baseUrl || 'http://localhost:1234/v1',
      timeout: opts.timeout || 30000,
      maxRetries: opts.maxRetries || 3,
      retryBaseDelay: opts.retryBaseDelay || 500,
      retryMaxDelay: opts.retryMaxDelay || 5000,
      cacheTTL: opts.cacheTTL || 300000,
      cacheMaxEntries: opts.cacheMaxEntries || 100,
      ...opts
    };
    this.pool = new ConnectionPool(opts.connection || {});
    this.cache = new ResponseCache({
      ttl: this.config.cacheTTL,
      maxEntries: this.config.cacheMaxEntries
    });
    this.logger = opts.logger || new utils.Logger({ level: 'info' });
  }

  /** Delay com exponential backoff + jitter */
  _delay(attempt) {
    const expo = Math.pow(2, attempt) * this.config.retryBaseDelay;
    const capped = Math.min(expo, this.config.retryMaxDelay);
    const jitter = Math.random() * 0.3 + 0.85; // 0.85-1.15
    return Math.round(capped * jitter);
  }

  /** Faz uma requisição HTTP com retry */
  async request(method, urlPath, body = null, opts = {}) {
    const fullUrl = urlPath.startsWith('http') ? urlPath : this.config.baseUrl.replace(/\/+$/, '') + urlPath;
    const parsed = new URL(fullUrl);
    const agent = this.pool.getAgent(parsed.origin);

    // Cache apenas para GET sem body
    if (method === 'GET' && !opts.noCache) {
      const cached = this.cache.get(method, fullUrl);
      if (cached) {
        this.logger.debug('Cache HIT', { url: fullUrl });
        return cached;
      }
    }

    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...opts.headers
    };

    if (opts.stream) {
      return this._streamRequest(fullUrl, body, headers, agent, opts);
    }

    let lastError = null;
    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), opts.timeout || this.config.timeout);

      try {
        const res = await fetch(fullUrl, {
          method,
          headers,
          body: body ? JSON.stringify(body) : undefined,
          signal: controller.signal
        });
        clearTimeout(timeout);

        if (!res.ok) {
          const errText = await res.text().catch(() => '');
          let detail = '';
          try { detail = JSON.parse(errText)?.error?.message || ''; } catch {}
          const errMsg = `HTTP ${res.status}${detail ? ' — ' + detail : ''}`;

          if (res.status >= 500 && attempt < this.config.maxRetries) {
            const wait = this._delay(attempt);
            this.logger.warn(`Retry ${attempt + 1}/${this.config.maxRetries} após ${wait}ms`, { url: fullUrl, status: res.status });
            await new Promise(r => setTimeout(r, wait));
            continue;
          }

          throw new Error(errMsg);
        }

        const data = await res.json();
        clearTimeout(timeout);

        // Armazena no cache
        if (method === 'GET') {
          this.cache.set(method, fullUrl, data);
        }

        return data;

      } catch (err) {
        clearTimeout(timeout);
        lastError = err;

        if (err.name === 'AbortError') {
          this.logger.error('Request abortado (timeout)', { url: fullUrl, attempt });
        } else if (attempt < this.config.maxRetries) {
          const wait = this._delay(attempt);
          this.logger.warn(`Retry ${attempt + 1}/${this.config.maxRetries} após ${wait}ms`, { url: fullUrl, error: err.message });
          await new Promise(r => setTimeout(r, wait));
        }
      }
    }

    throw lastError || new Error('Falha na requisição após todos os retries');
  }

  /** Requisição streaming (SSE) */
  async _streamRequest(fullUrl, body, headers, agent, opts) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), opts.timeout || this.config.timeout);

    const res = await fetch(fullUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: controller.signal
    });

    if (!res.ok) {
      clearTimeout(timeout);
      const errText = await res.text().catch(() => '');
      let detail = '';
      try { detail = JSON.parse(errText)?.error?.message || ''; } catch {}
      throw new Error(`HTTP ${res.status}${detail ? ' — ' + detail : ''}`);
    }

    return {
      ok: true,
      status: res.status,
      reader: res.body.getReader(),
      controller,
      clear: () => clearTimeout(timeout)
    };
  }

  /** Convenience: POST */
  async post(url, body, opts) {
    return this.request('POST', url, body, opts);
  }

  /** Convenience: GET */
  async get(url, opts = {}) {
    return this.request('GET', url, null, opts);
  }

  /** Fecha o pool de conexões */
  async close() {
    this.pool.destroyAll();
    this.cache.clear();
  }
}

module.exports = { VessieHTTP, ConnectionPool, ResponseCache };

