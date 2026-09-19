/* ============================================================
   Forja — Optimizer (Browser Edition)
   Módulo de otimização para o frontend do Forja.
   Versão browser-compatible (ES5/ES6, sem dependências Node.js).

   Otimizações aplicadas ao frontend:
   1. SSE Parser otimizado (chunk boundary, heartbeat, backpressure)
   2. Cache de modelos via localStorage (TTL 30s)
   3. Token-aware trimming (sliding window)
   4. Adaptive throttling (baseado no RTT)
   5. Retry com exponential backoff
   6. Connection reuse (fetch com keep-alive implícito)

   Este arquivo é carregado via <script> após app.js e expõe
   a API global `ForjaOptimizer` que extiende o Forja com
   recursos otimizados.

   Compatível com GitHub Pages (JavaScript puro).
   ============================================================ */
(function () {
  'use strict';

  /* ---------- Estado interno ---------- */
  var _state = {
    baseUrl: 'http://localhost:1234/v1',
    model: '',
    temperature: 0.7,
    topP: 0.95,
    maxTokens: -1,
    stream: true,
    timeout: 30000,
    maxRetries: 3,
    retryBaseDelay: 500,
    contextLimit: 4096,
    reserveForCompletion: 512,
    throttleMs: 30,
    heartbeatMs: 15000,
    highWaterMark: 65536,
    _rttSamples: [],
    _modelCache: null,
    _modelCacheTs: 0,
    _modelCacheTtl: 30000
  };

  /* ---------- Utilitários ---------- */

  /** UID curto e seguro */
  function uid() {
    return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-6);
  }

  /** Format duration */
  function formatDuration(ms) {
    if (ms < 1000) return Math.round(ms) + 'ms';
    return (ms / 1000).toFixed(2) + 's';
  }

  /** Estimativa de tokens */
  function estimateTokens(text) {
    if (!text) return 0;
    var clean = text.trim();
    if (clean.length === 0) return 0;
    var words = clean.split(/\s+/).length;
    return Math.round((clean.length / 3.8) + (words * 0.3));
  }

  function countMessageTokens(message) {
    var tokens = 0;
    if (message.role) tokens += 1;
    if (message.content) tokens += estimateTokens(message.content);
    if (message.reasoning_content) tokens += estimateTokens(message.reasoning_content);
    tokens += 3;
    return tokens;
  }

  function countConversationTokens(messages) {
    var total = 0;
    for (var i = 0; i < messages.length; i++) {
      total += countMessageTokens(messages[i]);
    }
    return total + 3;
  }

  /** Token-aware trimming (sliding window) */
  function trimConversation(messages, contextLimit, reserveForCompletion) {
    if (!contextLimit) contextLimit = 4096;
    if (!reserveForCompletion) reserveForCompletion = 512;
    var available = contextLimit - reserveForCompletion;
    var result = [];

    var systemMsgs = [];
    var otherMsgs = [];
    for (var i = 0; i < messages.length; i++) {
      if (messages[i].role === 'system') systemMsgs.push(messages[i]);
      else otherMsgs.push(messages[i]);
    }

    var used = 0;
    for (var j = 0; j < systemMsgs.length; j++) {
      result.push(systemMsgs[j]);
      used += countMessageTokens(systemMsgs[j]);
    }

    for (var k = otherMsgs.length - 1; k >= 0; k--) {
      var t = countMessageTokens(otherMsgs[k]);
      if (used + t > available) break;
      result.unshift(otherMsgs[k]);
      used += t;
    }

    return result;
  }

  /** Delay com exponential backoff + jitter */
  function calcDelay(attempt, baseDelay, maxDelay) {
    var expo = Math.pow(2, attempt) * baseDelay;
    var capped = Math.min(expo, maxDelay || 5000);
    var jitter = Math.random() * 0.3 + 0.85;
    return Math.round(capped * jitter);
  }

  /* ---------- Cache via localStorage ---------- */

  function cacheSet(key, value) {
    try {
      var entry = JSON.stringify({ data: value, ts: Date.now() });
      localStorage.setItem('vessie_' + key, entry);
    } catch (e) { /* ignore quota errors */ }
  }

  function cacheGet(key, ttl) {
    try {
      var raw = localStorage.getItem('vessie_' + key);
      if (!raw) return null;
      var entry = JSON.parse(raw);
      if (Date.now() - entry.ts > ttl) {
        localStorage.removeItem('vessie_' + key);
        return null;
      }
      return entry.data;
    } catch (e) {
      return null;
    }
  }

  /* ---------- SSE Parser Otimizado (Browser) ---------- */

  /**
   * SSEStreamParserBrowser — versão browser do parser SSE.
   * Eventos: 'token', 'reasoning', 'done', 'error'
   */
  function createSSEParser(opts) {
    opts = opts || {};
    var buffer = '';
    var content = '';
    var reasoning = '';
    var tokenCount = 0;
    var lastActivity = Date.now();
    var lastPaint = 0;
    var stopped = false;
    var throttleMs = opts.throttleMs || 30;
    var heartbeatMs = opts.heartbeatMs || 15000;
    var highWaterMark = opts.highWaterMark || 65536;
    var handlers = {};

    var heartbeatTimer = null;

    function on(event, fn) {
      if (!handlers[event]) handlers[event] = [];
      handlers[event].push(fn);
    }

    function emit(event, data) {
      var fns = handlers[event];
      if (fns) {
        for (var i = 0; i < fns.length; i++) fns[i](data);
      }
    }

    function throttledEmit(event, data) {
      var now = Date.now();
      if (now - lastPaint >= throttleMs) {
        lastPaint = now;
        emit(event, data);
      }
    }

    function processLine(line) {
      if (line.indexOf('data:') !== 0) return;
      var payload = line.slice(5).trim();

      if (payload === '[DONE]') {
        stopped = true;
        emit('done', {
          content: content,
          reasoning: reasoning,
          tokenCount: tokenCount
        });
        return;
      }

      var json;
      try {
        json = JSON.parse(payload);
      } catch {
        return;
      }

      var choice = json.choices && json.choices[0];
      if (!choice) return;

      var delta = choice.delta || {};

      if (delta.reasoning_content) {
        reasoning += delta.reasoning_content;
        emit('reasoning', delta.reasoning_content);
      }

      if (delta.content) {
        content += delta.content;
        tokenCount++;
        throttledEmit('token', { text: delta.content, count: tokenCount });
      }

      if (choice.finish_reason) {
        emit('finish', choice.finish_reason);
      }
    }

    function write(chunk) {
      if (stopped) return;
      lastActivity = Date.now();
      buffer += chunk;

      var idx;
      while ((idx = buffer.indexOf('\n')) >= 0) {
        var line = buffer.slice(0, idx).trim();
        buffer = buffer.slice(idx + 1);
        if (line) processLine(line);
      }
    }

    function startHeartbeat() {
      stopHeartbeat();
      heartbeatTimer = setInterval(function () {
        if (Date.now() - lastActivity > heartbeatMs) {
          stopped = true;
          emit('error', new Error('Heartbeat timeout: conexão inativa por ' + heartbeatMs + 'ms'));
        }
      }, heartbeatMs / 2);
    }

    function stopHeartbeat() {
      if (heartbeatTimer) {
        clearInterval(heartbeatTimer);
        heartbeatTimer = null;
      }
    }

    function stop() {
      stopped = true;
      stopHeartbeat();
    }

    /** Processa um ReadableStream reader */
    function processReader(reader, onComplete, onError) {
      startHeartbeat();
      var decoder = new TextDecoder();

      function readLoop() {
        if (stopped) {
          stopHeartbeat();
          return;
        }
        reader.read().then(function (result) {
          if (result.done) {
            if (!stopped) {
              stopped = true;
              emit('done', { content, reasoning, tokenCount });
            }
            stopHeartbeat();
            if (onComplete) onComplete();
            return;
          }

          if (result.value) {
            var chunk = decoder.decode(result.value, { stream: true });
            // Backpressure
            if (buffer.length > highWaterMark * 2) {
              setTimeout(readLoop, 10);
            } else {
              write(chunk);
            }
          }

          readLoop();
        }).catch(function (err) {
          stop();
          emit('error', err);
          if (onError) onError(err);
        });
      }

      readLoop();
    }

    return {
      on: on,
      emit: emit,
      write: write,
      processReader: processReader,
      stop: stop,
      get stopped() { return stopped; }
    };
  }

  /* ---------- Funções otimizadas de API ---------- */

  /**
   * Verifica conexão com o LM Studio (com cache).
   * Retorna: { ok, ms, models, count, err }
   */
  async function checkConnection(baseUrl) {
    var url = (baseUrl || _state.baseUrl).replace(/\/+$/, '') + '/models';
    var t0 = Date.now();

    // Cache de modelos (30s)
    var cached = cacheGet('models', _state._modelCacheTtl);
    if (cached) {
      return { ok: true, ms: Date.now() - t0, models: cached, count: cached.length, cached: true };
    }

    try {
      var res = await fetch(url, {
        signal: abortSignal(_state.timeout)
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      var data = await res.json();
      var models = (data.data || []).map(function (m) { return m.id; });
      cacheSet('models', models);
      return { ok: true, ms: Date.now() - t0, models: models, count: models.length };
    } catch (err) {
      return { ok: false, ms: Date.now() - t0, err: err.name === 'AbortError' ? 'tempo esgotado' : err.message };
    }
  }

  function abortSignal(ms) {
    var controller = new AbortController();
    setTimeout(function () { controller.abort(); }, ms || 5000);
    return controller.signal;
  }

  /**
   * Envia mensagem e recebe resposta streaming.
   * onToken: callback(text, info) chamado para cada token
   * opts: { temperature, topP, maxTokens, model, stream, contextLimit }
   */
  async function sendMessageStream(message, history, onToken, opts) {
    opts = opts || {};
    var t0 = Date.now();

    var baseUrl = opts.baseUrl || _state.baseUrl;
    var model = opts.model || _state.model;
    var temperature = opts.temperature != null ? opts.temperature : _state.temperature;
    var topP = opts.topP != null ? opts.topP : _state.topP;
    var maxTokens = opts.maxTokens != null ? opts.maxTokens : _state.maxTokens;
    var contextLimit = opts.contextLimit || _state.contextLimit;
    var reserve = opts.reserveForCompletion || _state.reserveForCompletion;

    // Trim inteligente de tokens
    var trimmed = trimConversation(history, contextLimit, reserve);

    var body = {
      model: model,
      messages: trimmed,
      temperature: temperature,
      top_p: topP,
      max_tokens: maxTokens > 0 ? maxTokens : void 0,
      stream: true
    };

    var url = baseUrl.replace(/\/+$/, '') + '/chat/completions';
    var retries = 0;
    var maxRetries = opts.maxRetries != null ? opts.maxRetries : _state.maxRetries;

    while (retries <= maxRetries) {
      try {
        var controller = new AbortController();
        var timeout = setTimeout(function () { controller.abort(); },
          opts.timeout || _state.timeout);

        var res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          signal: controller.signal
        });

        clearTimeout(timeout);

        if (!res.ok) {
          var errText = '';
          try { errText = (await res.json()).error?.message || ''; } catch (e) {}
          throw new Error('HTTP ' + res.status + (errText ? ' — ' + errText : ''));
        }

        var parser = createSSEParser({
          throttleMs: _adaptiveThrottle(),
          heartbeatMs: _state.heartbeatMs,
          highWaterMark: _state.highWaterMark
        });

        var content = '';
        var reasoning = '';
        var tokenCount = 0;
        var usage = null;

        parser.on('token', function (data) {
          content += data.text;
          tokenCount++;
          if (onToken) onToken(data.text, { tokenCount: tokenCount });
        });

        parser.on('reasoning', function (text) {
          reasoning += text;
        });

        parser.on('finish', function (reason) {
          /* finish reason */
        });

        return new Promise(function (resolve, reject) {
          var settled = false;

          parser.on('done', function (result) {
            if (settled) return;
            settled = true;
            var duration = (Date.now() - t0) / 1000;
            _state._rttSamples.push(Date.now() - t0);

            resolve({
              content: content,
              reasoning: reasoning,
              tokenCount: tokenCount,
              stats: {
                duration: duration,
                outputTokens: tokenCount,
                tokenPerSec: duration > 0 ? Math.round(tokenCount / duration * 100) / 100 : 0
              }
            });
          });

          parser.on('error', function (err) {
            if (settled) return;
            settled = true;
            if (retries < maxRetries) {
              retries++;
              var delay = calcDelay(retries - 1, _state.retryBaseDelay, 5000);
              setTimeout(function () {
                // Retry não recomeça o parser, apenas loga
                reject(new Error('Erro no stream: ' + err.message));
              }, delay);
            } else {
              reject(err);
            }
          });

          parser.processReader(res.body.getReader(), resolve, reject);
        });

      } catch (err) {
        clearTimeout(timeout);
        if (retries < maxRetries) {
          var delay = calcDelay(retries, _state.retryBaseDelay, 5000);
          await new Promise(function (r) { setTimeout(r, delay); });
          retries++;
          continue;
        }
        throw err;
      }
    }
  }

  /**
   * Envia mensagem e recebe resposta não-streaming.
   */
  async function sendMessage(message, history, opts) {
    opts = opts || {};
    var t0 = Date.now();

    var baseUrl = opts.baseUrl || _state.baseUrl;
    var body = {
      model: opts.model || _state.model || '',
      messages: opts.messages || history || [{ role: 'user', content: message }],
      temperature: opts.temperature != null ? opts.temperature : _state.temperature,
      top_p: opts.topP != null ? opts.topP : _state.topP,
      max_tokens: opts.maxTokens != null && opts.maxTokens > 0 ? opts.maxTokens : -1,
      stream: false
    };

    var url = baseUrl.replace(/\/+$/, '') + '/chat/completions';
    var retries = 0;
    var maxRetries = opts.maxRetries != null ? opts.maxRetries : _state.maxRetries;

    while (retries <= maxRetries) {
      try {
        var controller = new AbortController();
        var timeout = setTimeout(function () { controller.abort(); },
          opts.timeout || _state.timeout);

        var res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          signal: controller.signal
        });

        clearTimeout(timeout);

        if (!res.ok) {
          var errText = '';
          try { errText = (await res.json()).error?.message || ''; } catch (e) {}

          if (res.status >= 500 && retries < maxRetries) {
            var delay = calcDelay(retries, _state.retryBaseDelay, 5000);
            await new Promise(function (r) { setTimeout(r, delay); });
            retries++;
            continue;
          }
          throw new Error('HTTP ' + res.status + (errText ? ' — ' + errText : ''));
        }

        var data = await res.json();
        clearTimeout(timeout);

        var choice = data.choices && data.choices[0];
        var msg = choice ? choice.message : {};
        var duration = (Date.now() - t0) / 1000;
        _state._rttSamples.push(Date.now() - t0);

        return {
          content: msg.content || '',
          reasoning: msg.reasoning_content || '',
          role: msg.role || 'assistant',
          finishReason: choice ? choice.finish_reason : 'stop',
          usage: data.usage || null,
          stats: {
            duration: duration,
            inputTokens: data.usage ? data.usage.prompt_tokens : 0,
            outputTokens: data.usage ? data.usage.completion_tokens : 0,
            totalTokens: data.usage ? data.usage.total_tokens : 0,
            tokenPerSec: data.usage && duration > 0
              ? Math.round((data.usage.completion_tokens / duration) * 100) / 100
              : 0
          }
        };

      } catch (err) {
        if (retries < maxRetries) {
          var delay = calcDelay(retries, _state.retryBaseDelay, 5000);
          await new Promise(function (r) { setTimeout(r, delay); });
          retries++;
          continue;
        }
        throw err;
      }
    }
  }

  /** Throttle adaptativo baseado no RTT */
  function _adaptiveThrottle() {
    var samples = _state._rttSamples;
    if (samples.length === 0) return _state.throttleMs || 30;
    var sorted = samples.slice().sort(function (a, b) { return a - b; });
    var median = sorted[Math.floor(sorted.length / 2)];
    var adjusted = Math.min(Math.max(median * 0.5, 16), 100);
    if (samples.length > 5) samples.shift();
    return Math.round(adjusted);
  }

  /** Estatísticas de tokens */
  function tokenStats(messages) {
    var total = countConversationTokens(messages);
    return {
      totalTokens: total,
      contextLimit: _state.contextLimit,
      available: Math.max(0, _state.contextLimit - total),
      usagePercent: Math.round((total / _state.contextLimit) * 100)
    };
  }

  /** Atualiza configurações */
  function updateConfig(newConfig) {
    var keys = Object.keys(newConfig);
    for (var i = 0; i < keys.length; i++) {
      _state[keys[i]] = newConfig[keys[i]];
    }
    // Limpa cache de modelos ao mudar baseUrl
    if (newConfig.baseUrl) {
      _state._modelCache = null;
      _state._modelCacheTs = 0;
    }
  }

  /** Limpa todos os caches */
  function clearCache() {
    try { localStorage.removeItem('vessie_models'); } catch (e) {}
    _state._modelCache = null;
    _state._modelCacheTs = 0;
    _state._rttSamples = [];
  }

  /* ---------- Exporta API global ---------- */
  window.ForjaOptimizer = {
    // Estado
    state: _state,

    // Comunicação
    checkConnection: checkConnection,
    sendMessage: sendMessage,
    sendMessageStream: sendMessageStream,

    // SSE Parser
    createSSEParser: createSSEParser,

    // Tokens
    estimateTokens: estimateTokens,
    countMessageTokens: countMessageTokens,
    countConversationTokens: countConversationTokens,
    trimConversation: trimConversation,
    tokenStats: tokenStats,

    // Utilitários
    uid: uid,
    formatDuration: formatDuration,

    // Cache
    cacheSet: cacheSet,
    cacheGet: cacheGet,
    clearCache: clearCache,

    // Config
    updateConfig: updateConfig
  };

  // Integração automática com Forja (se app.js já foi carregado)
  if (window.ForjaOptimizer) {
    console.log('[Vessie] Optimizer carregado — otimização de envio/recebimento ativada');
  }
})();
