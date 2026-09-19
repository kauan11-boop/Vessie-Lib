/* ============================================================
   FORJA — preview.js
   Módulo de preview de arquivos/código (HTML, SVG, Markdown, texto).

   Recursos:
   1. Botão "visualizar" nos codeblocks do chat (html, svg, md, xml...)
   2. Modal com iframe sandbox para renderizar conteúdo
   3. Drag & drop de arquivos locais (.html, .svg, .md, ...)
   4. Seletor de arquivo opcional
   5. Área de escrita "colar código" para preview rápido

   API global: window.FilePreview
   Compatível com GitHub Pages (JavaScript puro, sem dependências).
   ============================================================ */
(function () {
  'use strict';

  /* ---------- Constantes ---------- */
  // Linguagens de codeblock que podem ser visualizadas
  var PREVIEWABLE_LANGS = ['html', 'htm', 'svg', 'xml', 'md', 'markdown', 'xhtml'];
  // Extensões de arquivo que podem ser abertas via drag & drop
  var PREVIEWABLE_EXTS = ['html', 'htm', 'xhtml', 'svg', 'md', 'markdown', 'xml', 'txt', 'json', 'css', 'js'];
  // Tipos que renderizam como texto puro (dentro de <pre>)
  var TEXT_TYPES = ['xml', 'txt', 'json', 'css', 'js'];

  /* ---------- Utilitários locais ---------- */
  // Nota: usamos '\x26' (o caractere '&') para montar as entidades de forma
  // segura, evitando que o texto das entidades seja interpretado/decodificado.
  var ENTITY_MAP = {
    '&': '\x26amp;',
    '<': '\x26lt;',
    '>': '\x26gt;',
    '"': '\x26quot;',
    "'": '\x26#39;'
  };
  function escHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return ENTITY_MAP[c];
    });
  }

  function extOf(name) {
    var m = /\.([a-z0-9]+)$/i.exec(name || '');
    return m ? m[1].toLowerCase() : '';
  }

  function isPreviewableExt(name) {
    return PREVIEWABLE_EXTS.indexOf(extOf(name)) !== -1;
  }

  function slugify(t) {
    return (t || 'preview').toLowerCase().normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') || 'preview';
  }

  // Ícone "olho" (usado no botão). Fallback caso app.js não esteja carregado.
  function eyeIcon(size) {
    if (typeof window.icon === 'function') {
      return window.icon('eye', size || 12);
    }
    return '<svg width="' + (size || 12) + '" height="' + (size || 12) + '" viewBox="0 0 24 24" ' +
      'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" ' +
      'stroke-linejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/>' +
      '<circle cx="12" cy="12" r="3"/></svg>';
  }

  /* ---------- Estado interno ---------- */
  var els = {};
  var current = { title: '', lang: '', content: '' };
  var dropDepth = 0;

  /* ---------- Construção do srcDoc (iframe) ---------- */

  /**
   * Monta o conteúdo completo de um documento HTML para o iframe.
   * Tipos de texto são embrulhados em <pre>; html/svg/vetor são renderizados
   * como página. Markdown é convertido com marked + DOMPurify.
   */
  function buildSrcDoc(content, lang, title) {
    var type = (lang || '').toLowerCase();

    // Markdown → HTML (usa marked/DOMPurify se disponíveis)
    if (type === 'md' || type === 'markdown') {
      var html;
      if (window.marked) {
        try { html = window.marked.parse(content); } catch (e) { html = escHtml(content).replace(/\n/g, '<br>'); }
      } else {
        html = escHtml(content).replace(/\n/g, '<br>');
      }
      if (window.DOMPurify) html = window.DOMPurify.sanitize(html);
      content = html;
      type = 'html';
    }

    // SVG isolado: centraliza em um container visual
    if (type === 'svg') {
      return docWrapper(
        '<div class="svg-stage">' + content + '</div>',
        { extraCss: '.svg-stage{min-height:100vh;display:grid;place-items:center;padding:32px;} .svg-stage svg{max-width:95%;height:auto;}' }
      );
    }

    // Tipos de texto: tudo dentro de <pre>
    if (TEXT_TYPES.indexOf(type) !== -1) {
      return docWrapper('<pre class="raw">' + escHtml(content) + '</pre>');
    }

    // HTML completo / fragmento
    return docWrapper(content);
  }

  /** Envolve um corpo + estilos num documento HTML completo. */
  function docWrapper(bodyHtml, opts) {
    opts = opts || {};
    var isFullDoc = /<html[\s>]/i.test(bodyHtml);
    if (isFullDoc) return bodyHtml; // documento já completo — entrega como está

    return '<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8">' +
      '<meta name="viewport" content="width=device-width, initial-scale=1">' +
      '<style>' +
      ':root{color-scheme:light dark;}' +
      'html,body{margin:0;padding:0;font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;' +
      'background:#ffffff;color:#1a1a1a;}' +
      '@media (prefers-color-scheme:dark){html,body{background:#0f0e0c;color:#ece6dc;}}' +
      '.raw{white-space:pre-wrap;word-break:break-word;padding:18px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:13px;line-height:1.6;}' +
      'pre{margin:0;}' +
      (opts.extraCss || '') +
      '</style></head><body>' + bodyHtml + '</body></html>';
  }

  /* ---------- Abertura do preview ---------- */

  function open(content, lang, title) {
    current = { content: content, lang: lang || '', title: title || ('preview.' + (lang || 'txt')) };
    if (!els.overlay) buildOverlay();

    els.title.textContent = current.title;
    els.badge.textContent = (current.lang || 'texto').toUpperCase();
    els.download.setAttribute('download', slugify(current.title) + '.' + (current.lang || 'txt'));

    var src = buildSrcDoc(content, lang, current.title);
    els.frame.srcdoc = src;

    els.overlay.classList.add('open');
    document.body.classList.add('preview-open');
  }

  function close() {
    if (!els.overlay) return;
    els.overlay.classList.remove('open');
    document.body.classList.remove('preview-open');
    // Limpa o iframe logo depois da transição
    setTimeout(function () { if (els.frame) els.frame.srcdoc = 'about:blank'; }, 200);
  }

  function download() {
    var blob = new Blob([current.content], { type: 'text/plain;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = slugify(current.title) + '.' + (current.lang || 'txt');
    a.click();
    URL.revokeObjectURL(a.href);
  }

  /* ---------- Construção do modal (uma vez) ---------- */

  function buildOverlay() {
    var overlay = document.createElement('div');
    overlay.className = 'overlay preview-overlay';
    overlay.id = 'previewOverlay';
    overlay.innerHTML =
      '<div class="preview-modal" role="dialog" aria-modal="true" aria-label="Preview">' +
        '<div class="preview-head">' +
          '<div class="preview-title-wrap">' +
            '<span class="preview-title" id="previewTitle"></span>' +
            '<span class="preview-badge" id="previewBadge"></span>' +
          '</div>' +
          '<div class="preview-actions">' +
            '<button class="btn small" id="previewDownload" title="Baixar arquivo"></button>' +
            '<button class="icon-btn" id="previewClose" title="Fechar (ESC)"></button>' +
          '</div>' +
        '</div>' +
        '<div class="preview-body">' +
          '<iframe id="previewFrame" class="preview-frame" sandbox="allow-scripts allow-forms allow-modals allow-popups" referrerpolicy="no-referrer"></iframe>' +
        '</div>' +
      '</div>';
    document.body.appendChild(overlay);

    els.overlay  = overlay;
    els.title    = overlay.querySelector('#previewTitle');
    els.badge    = overlay.querySelector('#previewBadge');
    els.frame    = overlay.querySelector('#previewFrame');
    els.close    = overlay.querySelector('#previewClose');
    els.download = overlay.querySelector('#previewDownload');

    // Ícones dos botões
    var dl = els.download;
    if (typeof window.icon === 'function') {
      dl.innerHTML = window.icon('download', 14) + '<span>Baixar</span>';
      els.close.innerHTML = window.icon('x', 16);
    } else {
      dl.textContent = 'Baixar';
      els.close.textContent = '✕';
    }

    els.close.addEventListener('click', close);
    els.download.addEventListener('click', download);
    overlay.addEventListener('click', function (e) { if (e.target === overlay) close(); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && overlay.classList.contains('open')) close();
    });
  }

  /* ---------- Integração com os codeblocks do chat ---------- */

  /**
   * Adiciona (se aplicável) o botão "visualizar" a um <pre> já embrulhado
   * em .codeblock pelo app.js. Idempotente.
   */
  function enhance(pre) {
    if (!pre) return;
    var code = pre.querySelector('code');
    if (!code) return;
    var langClass = null;
    for (var i = 0; i < code.classList.length; i++) {
      if (code.classList[i].indexOf('language-') === 0) { langClass = code.classList[i]; break; }
    }
    var lang = langClass ? langClass.replace('language-', '') : '';
    if (PREVIEWABLE_LANGS.indexOf(lang) === -1) return;

    var block = pre.closest('.codeblock');
    if (!block) return;
    var head = block.querySelector('.codeblock-head');
    if (!head || head.querySelector('.code-preview')) return;

    var btn = document.createElement('button');
    btn.className = 'code-preview';
    btn.type = 'button';
    btn.title = 'Visualizar resultado';
    btn.innerHTML = eyeIcon(12) + '<span>visualizar</span>';
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      open(code.textContent, lang, 'chat.' + lang);
    });
    head.appendChild(btn);
  }

  /* ---------- Drag & drop de arquivos locais ---------- */

  function openFile(file) {
    var lang = extOf(file.name);
    var reader = new FileReader();
    reader.onload = function () { open(String(reader.result || ''), lang, file.name); };
    reader.onerror = function () { alert('Não foi possível ler o arquivo.'); };
    reader.readAsText(file);
  }

  function showDropzone() {
    if (els.dropzone) els.dropzone.classList.add('show');
  }
  function hideDropzone() {
    if (els.dropzone) els.dropzone.classList.remove('show');
  }

  function buildDropzone() {
    var dz = document.createElement('div');
    dz.className = 'preview-dropzone';
    dz.innerHTML = '<div class="dropzone-box">' +
      eyeIcon(26) +
      '<p>Solte o arquivo para visualizar</p>' +
      '<span>HTML · SVG · MD · XML · TXT · JSON</span></div>';
    document.body.appendChild(dz);
    els.dropzone = dz;
  }

  function bindDragDrop() {
    window.addEventListener('dragenter', function (e) {
      e.preventDefault(); dropDepth++; showDropzone();
    });
    window.addEventListener('dragover', function (e) { e.preventDefault(); });
    window.addEventListener('dragleave', function (e) {
      e.preventDefault(); dropDepth = Math.max(0, dropDepth - 1);
      if (dropDepth === 0) hideDropzone();
    });
    window.addEventListener('drop', function (e) {
      e.preventDefault(); dropDepth = 0; hideDropzone();
      var dt = e.dataTransfer;
      if (!dt || !dt.files || !dt.files.length) return;
      var file = dt.files[0];
      if (isPreviewableExt(file.name)) openFile(file);
    });
  }

  /* ---------- Inicialização ---------- */

  function init() {
    buildOverlay();
    buildDropzone();
    bindDragDrop();
    console.log('[Vessie] FilePreview carregado — preview de HTML/SVG/MD ativada');
  }

  /* ---------- Export ---------- */
  window.FilePreview = {
    init: init,
    open: open,
    close: close,
    enhance: enhance,
    openFile: openFile,
    isPreviewable: isPreviewableExt,
    buildSrcDoc: buildSrcDoc,
    PREVIEWABLE_LANGS: PREVIEWABLE_LANGS,
    PREVIEWABLE_EXTS: PREVIEWABLE_EXTS
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();