/* ============================================================
   FORJA — router.js
   Sistema de rotas por aba (SPA) compatível com GitHub Pages.

   Rotas: chat · preview · settings · metrics
   - .../Vessie-Lib/chat     -> rota por caminho limpo (produção)
   - .../Vessie-Lib/?/chat   -> rota vinda do redirect do 404.html
   - ...#/chat               -> fallback (file:// / local)

   API global: window.ForjaRouter
   ============================================================ */
(function () {
  'use strict';

  var ROUTES = ['chat', 'preview', 'settings', 'metrics'];
  var DEFAULT_ROUTE = 'chat';

  /* ---------- descoberta do base path ---------- */
  function computeBase() {
    try {
      var src = (document.currentScript && document.currentScript.src) || '';
      if (!src) {
        var list = document.getElementsByTagName('script');
        for (var i = 0; i < list.length; i++) {
          if (/\/js\/router\.js(\?|$|#)/.test(list[i].src)) { src = list[i].src; break; }
        }
      }
      if (!src) return '';
      var path = new URL(src, location.href).pathname;
      return path.replace(/\/js\/router\.js$/, '');
    } catch (e) { return ''; }
  }

  var BASE = location.protocol === 'file:' ? '' : computeBase();
  var USE_HASH = location.protocol === 'file:';
  var LISTENERS = [];
  var current = null;

  var TITLES = {
    chat: 'Chat',
    preview: 'Preview',
    settings: 'Configurações',
    metrics: 'Métricas'
  };

  /* ---------- utilidades ---------- */
  function normalize(route) {
    route = String(route || '')
      .replace(/^[#/?&]+/, '')
      .replace(/\/+$/, '')
      .split('&')[0]
      .split('?')[0]
      .toLowerCase();
    return ROUTES.indexOf(route) !== -1 ? route : DEFAULT_ROUTE;
  }

  function readRoute() {
    var s = location.search || '';
    if (s.charAt(0) === '?' && s.charAt(1) === '/') return normalize(s.slice(2));
    if ((location.hash || '').indexOf('#/') === 0) return normalize(location.hash.slice(2));
    var p = location.pathname || '';
    if (BASE && p.indexOf(BASE) === 0) p = p.slice(BASE.length);
    p = p.replace(/^\/+/, '').replace(/\/+$/, '');
    if (p === '' || p === 'index.html') return DEFAULT_ROUTE;
    return normalize(p);
  }

  function urlFor(route) {
    return BASE + '/' + route;
  }

  /* ---------- DOM ---------- */
  function updateDom(route) {
    var panels = document.querySelectorAll('.tabpanel');
    for (var i = 0; i < panels.length; i++) {
      var on = panels[i].getAttribute('data-tab') === route;
      panels[i].hidden = !on;
      panels[i].classList.toggle('active', on);
    }
    var links = document.querySelectorAll('[data-tab-link]');
    for (var j = 0; j < links.length; j++) {
      var on2 = links[j].getAttribute('data-tab-link') === route;
      links[j].classList.toggle('active', on2);
      links[j].setAttribute('aria-selected', on2 ? 'true' : 'false');
      links[j].setAttribute('tabindex', on2 ? '0' : '-1');
    }
    document.documentElement.setAttribute('data-route', route);
    document.documentElement.setAttribute('data-chat', route === 'chat' ? 'true' : 'false');
    document.title = route === DEFAULT_ROUTE
      ? 'Forja — chat para LM Studio'
      : TITLES[route] + ' · Forja';
  }

  function render(route, opts) {
    route = normalize(route);
    current = route;
    updateDom(route);
    for (var i = 0; i < LISTENERS.length; i++) {
      try { LISTENERS[i](route); } catch (e) { /* listener quebrado não derruba o router */ }
    }
    if (!opts || opts.scroll !== false) {
      try { window.scrollTo(0, 0); } catch (e) {}
    }
  }

  /* ---------- navegação ---------- */
  function go(route, opts) {
    route = normalize(route);
    if (route === current) { render(route, opts); return; }
    if (USE_HASH) {
      location.hash = '/' + route;
      return;
    }
    try { history.pushState({ route: route }, '', urlFor(route)); } catch (e) {}
    render(route, opts);
  }

  function replace(route, opts) {
    route = normalize(route);
    if (USE_HASH) {
      try { history.replaceState({ route: route }, '', location.pathname + location.search + '#/' + route); } catch (e) {}
    } else {
      try { history.replaceState({ route: route }, '', urlFor(route)); } catch (e) {}
    }
    render(route, opts);
  }

  function onChange(fn) { if (typeof fn === 'function') LISTENERS.push(fn); }

  function sync(fn) {
    onChange(fn);
    if (current) { try { fn(current); } catch (e) {} }
  }

  function href(route) {
    route = normalize(route);
    return USE_HASH ? ('#/' + route) : urlFor(route);
  }

  /* ---------- inicialização ---------- */
  function boot() {
    var s = location.search || '';
    if (!USE_HASH && s.charAt(0) === '?' && s.charAt(1) === '/') {
      var initial = readRoute();
      try {
        history.replaceState({ route: initial }, '', urlFor(initial) + (location.hash || ''));
      } catch (e) {}
    }

    document.addEventListener('click', function (e) {
      var a = e.target && e.target.closest ? e.target.closest('[data-tab-link]') : null;
      if (!a) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return;
      e.preventDefault();
      go(a.getAttribute('data-tab-link'));
    });

    window.addEventListener('popstate', function () { render(readRoute()); });
    window.addEventListener('hashchange', function () { render(readRoute()); });

    render(readRoute());
  }

  /* ---------- export ---------- */
  window.ForjaRouter = {
    routes: ROUTES,
    base: BASE,
    useHash: USE_HASH,
    go: go,
    replace: replace,
    onChange: onChange,
    sync: sync,
    href: href,
    normalize: normalize,
    get route() { return current; }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();