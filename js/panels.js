/* ============================================================
   FORJA — panels.js
   Lógica das abas que não são o chat:
   - preview : editor ao vivo + iframe (reutiliza FilePreview.buildSrcDoc)
   - settings: ferramentas de dados (exportar/apagar/uso de armazenamento)
   - metrics : leituras do ForjaOptimizer + estado

   Depende de: window.ForjaRouter, window.FilePreview (opcional),
               window.ForjaOptimizer (opcional).
   ============================================================ */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '\x26amp;', '<': '\x26lt;', '>': '\x26gt;', '"': '\x26quot;', "'": '\x26#39;' }[c];
    });
  };

  var TITLES = { chat: '', preview: 'Preview', settings: 'Configurações', metrics: 'Métricas' };
  var previewReady = false;

  /* ============================================================
     PREVIEW
     ============================================================ */
  var EXAMPLES = {
    html: '<!DOCTYPE html>\n<html lang="pt-BR">\n<head>\n  <meta charset="UTF-8">\n  <style>\n    body{font-family:system-ui;background:#0f0e0c;color:#ece6dc;\n         display:grid;place-items:center;height:100vh;margin:0}\n    .card{padding:32px 40px;border:1px solid #3a332a;border-radius:16px;\n          background:#1b1815;box-shadow:0 20px 50px rgba(0,0,0,.5)}\n    h1{margin:0 0 8px;font-size:22px}\n    button{margin-top:14px;padding:10px 18px;border-radius:9px;border:none;\n           background:#e08a3c;color:#1c1106;font-weight:700;cursor:pointer}\n  </style>\n</head>\n<body>\n  <div class="card">\n    <h1>Ola, Forja</h1>\n    <p>Edite este HTML e veja o resultado ao vivo.</p>\n    <button onclick="this.textContent=\'funciona!\'">Clique</button>\n  </div>\n</body>\n</html>',
    svg: '<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" width="320" height="320">\n  <defs>\n    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">\n      <stop offset="0" stop-color="#e08a3c"/>\n      <stop offset="1" stop-color="#d96a5b"/>\n    </linearGradient>\n  </defs>\n  <circle cx="100" cy="100" r="72" fill="url(#g)"/>\n  <circle cx="100" cy="100" r="46" fill="#0f0e0c"/>\n  <text x="100" y="112" text-anchor="middle" fill="#ece6dc"\n        font-family="system-ui" font-size="26" font-weight="700">VSL</text>\n</svg>',
    markdown: '# Titulo\n\n**negrito**, *italico* e `codigo`.\n\n- item um\n- item dois\n\n> citacao de exemplo\n\n```js\nconsole.log("ola");\n```\n\n| col | valor |\n|-----|-------|\n| a   | 1     |\n| b   | 2     |',
    xml: '<catalogo>\n  <livro id="1">\n    <titulo>Vessie</titulo>\n    <autor>LM Studio</autor>\n  </livro>\n</catalogo>',
    json: '{\n  "nome": "Vessie-Lib",\n  "versao": "1.0.0",\n  "recursos": ["preview", "rotas", "vsl"]\n}',
    css: 'body{background:#0f0e0c;color:#ece6dc;font-family:system-ui;padding:24px}\n.teste{border:2px dashed #e08a3c;border-radius:12px;padding:20px}',
    javascript: 'document.body.innerHTML = "<h2>Ola do JS</h2><p>Agora: " + new Date().toLocaleTimeString() + "</p>";\ndocument.body.style.fontFamily = "system-ui";',
    txt: 'Este e um arquivo de texto simples.\n\nA previa mostra o conteudo exatamente como esta,\nrespeitando os espacos e as quebras de linha.'
  };

  function buildSrcDoc(content, lang) {
    if (window.FilePreview && window.FilePreview.buildSrcDoc) {
      return window.FilePreview.buildSrcDoc(content, lang, 'preview.' + lang);
    }
    var t = (lang || '').toLowerCase();
    if (t === 'javascript' || t === 'json' || t === 'css' || t === 'xml' || t === 'txt') {
      return '<!DOCTYPE html><html><head><meta charset="UTF-8"><style>body{background:#0f0e0c;color:#ece6dc;font-family:ui-monospace,monospace;padding:16px;white-space:pre-wrap}</style></head><body>' + esc(content) + '</body></html>';
    }
    return content;
  }

  function renderPreview() {
    var ed = $('pvEditor'), frame = $('pvFrame'), langEl = $('pvLang');
    if (!ed || !frame) return;
    var lang = langEl ? langEl.value : 'html';
    var src = buildSrcDoc(ed.value, lang);
    if (lang === 'javascript') {
      src = '<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body style="background:#0f0e0c;color:#ece6dc;font-family:system-ui;padding:20px"></body><script>' + ed.value + '<\/script></html>';
    }
    frame.srcdoc = src;
  }

  function loadIntoEditor(content, lang) {
    var ed = $('pvEditor'), langEl = $('pvLang');
    if (!ed) return;
    ed.value = content;
    if (langEl && lang) {
      var found = false;
      for (var i = 0; i < langEl.options.length; i++) {
        if (langEl.options[i].value === lang) { langEl.selectedIndex = i; found = true; break; }
      }
      if (!found) {
        var opt = document.createElement('option');
        opt.value = lang; opt.textContent = lang;
        langEl.appendChild(opt); langEl.value = lang;
      }
    }
    renderPreview();
  }

  function bindPreview() {
    var ed = $('pvEditor'), langEl = $('pvLang');
    var openBtn = $('pvOpen'), dlBtn = $('pvDownload');
    var drop = $('pvDrop'), file = $('pvFile');

    if (ed) {
      ed.addEventListener('input', debounce(renderPreview, 220));
      ed.value = EXAMPLES.html;
      renderPreview();
    }
    if (langEl) langEl.addEventListener('change', function () {
      langEl.prevValue = langEl.value;
      renderPreview();
    });
    if (openBtn) openBtn.addEventListener('click', openInNewTab);
    if (dlBtn) dlBtn.addEventListener('click', downloadCurrent);

    var chips = $('pvChips');
    if (chips) {
      Object.keys(EXAMPLES).forEach(function (lang) {
        var b = document.createElement('button');
        b.type = 'button'; b.className = 'chip'; b.textContent = lang;
        b.addEventListener('click', function () { loadIntoEditor(EXAMPLES[lang], lang); });
        chips.appendChild(b);
      });
    }

    var fileHandler = function (f) {
      if (!f) return;
      var lang2 = extOf(f.name);
      var r = new FileReader();
      r.onload = function () { loadIntoEditor(String(r.result || ''), lang2); };
      r.onerror = function () { toast('Nao foi possivel ler o arquivo.', 'err'); };
      r.readAsText(f);
    };
    if (file) file.addEventListener('change', function () { if (file.files[0]) fileHandler(file.files[0]); });
    if (drop) {
      drop.addEventListener('dragover', function (e) { e.preventDefault(); drop.classList.add('over'); });
      drop.addEventListener('dragleave', function () { drop.classList.remove('over'); });
      drop.addEventListener('drop', function (e) {
        e.preventDefault(); drop.classList.remove('over');
        if (e.dataTransfer.files[0]) fileHandler(e.dataTransfer.files[0]);
      });
    }
    previewReady = true;
  }

  function currentContent() {
    var ed = $('pvEditor');
    var langEl = $('pvLang');
    return { content: ed ? ed.value : '', lang: langEl ? langEl.value : 'txt' };
  }
  function openInNewTab() {
    var c = currentContent();
    var blob = new Blob([buildSrcDoc(c.content, c.lang)], { type: 'text/html;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var w = window.open(url, '_blank');
    setTimeout(function () { URL.revokeObjectURL(url); }, 30000);
    if (!w) toast('O navegador bloqueou a nova aba.', 'warn');
  }
  function downloadCurrent() {
    var c = currentContent();
    var isText = ['txt', 'json', 'css', 'javascript', 'xml'].indexOf(c.lang) !== -1;
    var blob = new Blob([c.content], { type: (isText ? 'text/plain' : 'text/html') + ';charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'preview.' + (c.lang === 'markdown' ? 'md' : (c.lang === 'javascript' ? 'js' : c.lang));
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
  }

  /* ============================================================
     SETTINGS — ferramentas de dados
     ============================================================ */
  function bytes(n) {
    if (n < 1024) return n + ' B';
    if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
    return (n / 1024 / 1024).toFixed(2) + ' MB';
  }
  function storageBytes() {
    var total = 0;
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        total += (k.length + (localStorage.getItem(k) || '').length) * 2;
      }
    } catch (e) {}
    return total;
  }
  function countConvos() {
    try {
      var arr = JSON.parse(localStorage.getItem('forja.conversations') || '[]');
      return Array.isArray(arr) ? arr : [];
    } catch (e) { return []; }
  }

  function renderSettingsData() {
    var kv = $('dataKv');
    if (!kv) return;
    var convos = countConvos();
    var msgs = convos.reduce(function (a, c) { return a + ((c.messages && c.messages.length) || 0); }, 0);
    var rows = [
      ['Conversas salvas', String(convos.length)],
      ['Mensagens salvas', String(msgs)],
      ['Uso de armazenamento', bytes(storageBytes())],
      ['Chave de preferencias', 'forja.settings']
    ];
    kv.innerHTML = rows.map(function (r) {
      return '<dt>' + esc(r[0]) + '</dt><dd>' + esc(r[1]) + '</dd>';
    }).join('');
  }

  function bindSettingsTools() {
    var exp = $('dataExport'), clr = $('dataClearAll');
    if (exp) exp.addEventListener('click', function () {
      var dump = {};
      try {
        for (var i = 0; i < localStorage.length; i++) {
          var k = localStorage.key(i);
          dump[k] = localStorage.getItem(k);
        }
      } catch (e) {}
      var blob = new Blob([JSON.stringify(dump, null, 2)], { type: 'application/json;charset=utf-8' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'forja-dados.json';
      a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
      toast('Dados exportados', 'ok');
    });
    if (clr) clr.addEventListener('click', function () {
      if (!window.confirm('Apagar TODAS as conversas e preferencias deste navegador? Esta acao nao pode ser desfeita.')) return;
      try {
        var keys = [];
        for (var i = 0; i < localStorage.length; i++) keys.push(localStorage.key(i));
        keys.forEach(function (k) { if (/^forja\./.test(k) || /^vessie_/.test(k)) localStorage.removeItem(k); });
      } catch (e) {}
      toast('Dados apagados - recarregando...', 'warn');
      setTimeout(function () { location.reload(); }, 900);
    });
  }

  /* ============================================================
     METRICS
     ============================================================ */
  function metricCard(label, value, unit, note, cls) {
    return '<div class="metric ' + (cls || '') + '">' +
      '<div class="m-label">' + esc(label) + '</div>' +
      '<div class="m-value">' + esc(value) + (unit ? '<span class="m-unit">' + esc(unit) + '</span>' : '') + '</div>' +
      (note ? '<div class="m-note">' + esc(note) + '</div>' : '') +
      '</div>';
  }

  function renderMetrics() {
    var grid = $('metricsGrid'), kv = $('metricsKv');
    var opt = window.ForjaOptimizer;
    var st = opt && opt.state ? opt.state : {};
    var set = (window.ForjaState && window.ForjaState.settings) || {};
    var models = (window.ForjaState && window.ForjaState.models) || [];

    var samples = (st._rttSamples || []).slice();
    var lastRtt = samples.length ? samples[samples.length - 1] : null;
    var avgRtt = samples.length ? Math.round(samples.reduce(function (a, b) { return a + b; }, 0) / samples.length) : null;
    var appLatency = (window.ForjaState && window.ForjaState.latency) || null;

    var throttle = (st.throttleMs != null) ? st.throttleMs : null;
    var cacheHit = (opt && opt.cacheGet) ? (opt.cacheGet('models', 30000) ? 'valido' : 'vazio') : 'n/d';

    var convos = countConvos();
    var msgs = convos.reduce(function (a, c) { return a + ((c.messages && c.messages.length) || 0); }, 0);

    if (grid) {
      grid.innerHTML =
        metricCard('Latencia', appLatency != null ? String(appLatency) : '-', 'ms',
          appLatency != null ? 'ultima verificacao de conexao' : 'sem leitura ainda',
          appLatency != null ? (appLatency < 200 ? 'good' : appLatency < 800 ? 'warn' : 'bad') : '') +
        metricCard('RTT medio', avgRtt != null ? String(avgRtt) : '-', 'ms',
          samples.length ? samples.length + ' amostra(s)' : 'sem amostras') +
        metricCard('RTT ultimo', lastRtt != null ? String(lastRtt) : '-', 'ms', 'ultimo ciclo') +
        metricCard('Throttle', throttle != null ? String(throttle) : '-', 'ms', 'renderizacao adaptativa') +
        metricCard('Conversas', String(convos.length), '', msgs + ' mensagem(ns)') +
        metricCard('Armazenamento', bytes(storageBytes()), '', 'localStorage do navegador');
    }

    if (kv) {
      var rows = [
        ['URL base', (set.baseUrl || st.baseUrl || '-')],
        ['Modelo', (set.model || st.model || '(primeiro da lista)')],
        ['Modelos detectados', String(models.length)],
        ['Temperatura', String(set.temperature != null ? set.temperature : '-')],
        ['Top P', String(set.topP != null ? set.topP : '-')],
        ['Max tokens', String(set.maxTokens != null ? set.maxTokens : '-')],
        ['Streaming', set.stream === false ? 'desligado' : 'ligado'],
        ['Cache de modelos', cacheHit],
        ['Heartbeat', (st.heartbeatMs != null ? st.heartbeatMs : '-') + ' ms'],
        ['Throttle base', (st.throttleMs != null ? st.throttleMs : '-') + ' ms'],
        ['High water mark', (st.highWaterMark != null ? st.highWaterMark : '-') + ' B'],
        ['Otimizador', opt ? 'ativo' : 'nao carregado']
      ];
      kv.innerHTML = rows.map(function (r) {
        return '<dt>' + esc(r[0]) + '</dt><dd>' + esc(r[1]) + '</dd>';
      }).join('');
    }
  }

  function bindMetrics() {
    var r = $('metricsRefresh'), c = $('metricsClearCache');
    if (r) r.addEventListener('click', function () { renderMetrics(); toast('Metricas atualizadas', 'ok'); });
    if (c) c.addEventListener('click', function () {
      if (window.ForjaOptimizer && window.ForjaOptimizer.clearCache) window.ForjaOptimizer.clearCache();
      renderMetrics();
      toast('Caches limpos', 'ok');
    });
  }

  /* ============================================================
     utilitarios locais
     ============================================================ */
  function debounce(fn, ms) {
    var t = null;
    return function () {
      var args = arguments, self = this;
      clearTimeout(t);
      t = setTimeout(function () { fn.apply(self, args); }, ms);
    };
  }
  function extOf(name) {
    var m = /\.([a-z0-9]+)$/i.exec(name || '');
    var e = m ? m[1].toLowerCase() : 'txt';
    return e === 'md' ? 'markdown' : (e === 'js' ? 'javascript' : e);
  }
  function toast(msg, type) {
    var host = $('toasts');
    if (!host) return;
    var t = document.createElement('div');
    t.className = 'toast ' + (type || 'ok');
    var span = document.createElement('span');
    span.textContent = msg;
    t.appendChild(span);
    host.appendChild(t);
    setTimeout(function () { t.classList.add('out'); }, 3400);
    setTimeout(function () { t.remove(); }, 3850);
  }

  /* ============================================================
     integracao com o router
     ============================================================ */
  function onRoute(route) {
    var heading = $('tabHeading');
    if (heading) heading.textContent = TITLES[route] || 'Forja';

    if (route === 'preview') {
      if (!previewReady) bindPreview();
      else renderPreview();
    } else if (route === 'settings') {
      renderSettingsData();
    } else if (route === 'metrics') {
      renderMetrics();
    }
  }

  function init() {
    bindSettingsTools();
    bindMetrics();

    if (window.ForjaRouter) {
      window.ForjaRouter.sync(onRoute);
    } else {
      document.addEventListener('DOMContentLoaded', function () {
        if (window.ForjaRouter) window.ForjaRouter.sync(onRoute);
      });
    }

    setInterval(function () {
      if (window.ForjaRouter && window.ForjaRouter.route === 'metrics') renderMetrics();
    }, 8000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.ForjaPanels = { renderMetrics: renderMetrics, renderSettingsData: renderSettingsData, renderPreview: renderPreview };
})();