// Vessie runtime (bundle gerado por scripts/build.js)
// Biblioteca padrão da Vessie em tempo de execução. Sem imports: este arquivo é
// concatenado ao runtime web pelo build (dist/runtime/vessie-runtime.js).

let output = (level, args) => {
  const fn = level === "error" ? console.error : level === "warn" ? console.warn : console.log;
  fn(...args);
};

/** Redireciona a saída de print/log/warn/error (útil em testes e no modo headless). */
export function setOutput(fn) { output = fn ?? output; }

const typeOfValue = (v) => (v === null ? "null" : Array.isArray(v) ? "array" : typeof v === "undefined" ? "null" : typeof v);
const isNull = (v) => v === null || v === undefined;

class VessieAssertionError extends Error {
  constructor(message) { super(message); this.name = "VessieAssertionError"; }
}

export const stdlib = {
  print: (...a) => output("print", a),
  log: (...a) => output("log", a),
  warn: (...a) => output("warn", a),
  error: (...a) => output("error", a),
  assert: (cond, msg = "Asserção falhou") => { if (!cond) throw new VessieAssertionError(msg); },
  typeof: typeOfValue,
  typeofValue: typeOfValue,
  isNull,
  isDefined: (v) => !isNull(v),
  range: (a, b) => {
    const [from, to] = b === undefined ? [0, a] : [a, b];
    const out = [];
    for (let i = from; i < to; i++) out.push(i);
    return out;
  },
  math: {
    PI: Math.PI,
    abs: Math.abs, floor: Math.floor, ceil: Math.ceil, round: Math.round, sqrt: Math.sqrt, pow: Math.pow,
    clamp: (v, lo, hi) => Math.min(Math.max(v, lo), hi),
    lerp: (a, b, t) => a + (b - a) * t,
    random: Math.random,
    randomInt: (min, max) => Math.floor(Math.random() * (Math.floor(max) - Math.ceil(min) + 1)) + Math.ceil(min),
    sign: Math.sign,
    modulo: (n, d) => ((n % d) + d) % d,
    radians: (degrees) => degrees * Math.PI / 180,
    degrees: (radians) => radians * 180 / Math.PI,
    min: Math.min, max: Math.max,
  },
  string: {
    length: (s) => s.length,
    upper: (s) => s.toUpperCase(),
    lower: (s) => s.toLowerCase(),
    trim: (s) => s.trim(),
    split: (s, sep) => s.split(sep),
    replace: (s, from, to) => s.split(from).join(to),
    includes: (s, sub) => s.includes(sub),
    startsWith: (s, prefix) => s.startsWith(prefix),
    endsWith: (s, suffix) => s.endsWith(suffix),
    repeat: (s, count) => s.repeat(count),
    chars: (s) => Array.from(s),
    format: (s, ...args) => s.replace(/\{(\d+)\}/g, (m, i) => (i < args.length ? String(args[i]) : m)),
  },
  array: {
    length: (a) => a.length,
    map: (a, fn) => a.map((x, i) => fn(x, i)),
    filter: (a, fn) => a.filter((x, i) => fn(x, i)),
    reduce: (a, fn, init) => (init === undefined ? a.reduce((acc, x) => fn(acc, x)) : a.reduce((acc, x) => fn(acc, x), init)),
    find: (a, fn) => a.find((x, i) => fn(x, i)) ?? null,
    sort: (a, fn) => [...a].sort(fn ?? ((x, y) => (x < y ? -1 : x > y ? 1 : 0))),
    forEach: (a, fn) => { a.forEach((x, i) => fn(x, i)); },
    includes: (a, v) => a.includes(v),
    push: (a, v) => a.push(v),
    join: (a, sep = ",") => a.join(sep),
    first: (a) => a.length ? a[0] : null,
    last: (a) => a.length ? a[a.length - 1] : null,
    reverse: (a) => [...a].reverse(),
    slice: (a, start, end) => a.slice(start, end),
    concat: (a, b) => a.concat(b),
    unique: (a) => [...new Set(a)],
    remove: (a, value) => { const i = a.indexOf(value); if (i >= 0) a.splice(i, 1); return i >= 0; },
  },
  object: {
    keys: (v) => Object.keys(v ?? {}),
    values: (v) => Object.values(v ?? {}),
    has: (v, key) => Object.prototype.hasOwnProperty.call(v ?? {}, key),
  },
  json: {
    parse: (s) => JSON.parse(s),
    stringify: (v) => JSON.stringify(v),
  },
  date: {
    now: () => Date.now(),
    iso: () => new Date().toISOString(),
    format: (timestamp, locale = "pt-BR") => new Intl.DateTimeFormat(locale).format(new Date(timestamp)),
  },
  storage: {
    get: (key, fallback = null) => { try { const v = globalThis.localStorage?.getItem(String(key)); return v === null || v === undefined ? fallback : v; } catch { return fallback; } },
    set: (key, value) => { try { globalThis.localStorage?.setItem(String(key), String(value)); return true; } catch { return false; } },
    remove: (key) => { try { globalThis.localStorage?.removeItem(String(key)); return true; } catch { return false; } },
    clear: () => { try { globalThis.localStorage?.clear(); return true; } catch { return false; } },
  },
  http: {
    get: async (url) => { const r = await fetch(String(url)); return { ok: r.ok, status: r.status, text: await r.text() }; },
    getJson: async (url) => { const r = await fetch(String(url)); return { ok: r.ok, status: r.status, data: await r.json() }; },
    postJson: async (url, data) => { const r = await fetch(String(url), { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(data) }); return { ok: r.ok, status: r.status, data: await r.json() }; },
  },
  // Compatibilidade direta com JavaScript (espelha o bloco `js` da linguagem).
  // Escreva JS puro em blocos `js nome = `...`` (executa verbatim no escopo
  // do app: $, $c, $ui, $std, h) ou avalie trechos com js.run/js.eval.
  // Combine com `css` (estilo) e `html nome = `...`` (markup próprio):
  // o app final é um HTML próprio com CSS+JS embutidos.
  js: {
    run: (code) => {
      const src = String(code);
      try { return new Function(`return (${src})`)(); }
      catch { return new Function(src)(); }
    },
    eval: (code) => {
      const src = String(code);
      try { return new Function(`return (${src})`)(); }
      catch { return new Function(src)(); }
    },
    get: (path) => {
      const parts = String(path).split(".");
      let cur = globalThis;
      for (const p of parts) {
        if (cur === null || cur === undefined) return undefined;
        cur = cur[p];
      }
      return cur;
    },
    set: (path, value) => {
      const parts = String(path).split(".");
      const last = parts.pop();
      let cur = globalThis;
      for (const p of parts) cur = cur[p] ?? (cur[p] = {});
      cur[last] = value;
      return value;
    },
    on: (event, handler) => {
      if (typeof globalThis.addEventListener === "function" && typeof handler === "function") {
        globalThis.addEventListener(String(event), handler);
        return true;
      }
      return false;
    },
  },
  // Conjunto de comandos para abrir/fechar UI (modal, dialog, ou qualquer
  // elemento com `id:`). Funciona no navegador; no modo headless retorna false.
  // Ex.: ui.open("ajuda") · ui.close("ajuda") · ui.toggle("menu") · ui.show("x") · ui.hide("x")
  ui: {
    _el: (id) => {
      try {
        const doc = globalThis.document;
        if (!doc || typeof doc.getElementById !== "function") return null;
        return doc.getElementById(String(id));
      } catch { return null; }
    },
    _set: (id, visible) => {
      const el = stdlib.ui._el(id);
      if (!el) return false;
      try {
        if (visible) {
          if ("hidden" in el && el.hidden) el.hidden = false;
          if (el.style) el.style.display = "";
          if (typeof el.setAttribute === "function") el.setAttribute("data-open", "true");
          if (el.tagName === "DIALOG" && typeof el.show === "function" && !el.open) el.show();
          else if ("open" in el && typeof el.open === "boolean") el.open = true;
        } else {
          if ("hidden" in el && !el.hidden && (el.tagName === "DIALOG" || el.tagName === "DIV" || el.tagName === "SECTION")) {
            // modal/div: usa hidden para esconder sem destruir o nó
            if (typeof el.setAttribute === "function") el.setAttribute("data-open", "false");
            if (el.tagName === "DIALOG" && typeof el.close === "function" && el.open) el.close();
            else if ("open" in el && typeof el.open === "boolean") el.open = false;
            else el.hidden = true;
          } else {
            if (typeof el.setAttribute === "function") el.setAttribute("data-open", "false");
            if (el.tagName === "DIALOG" && typeof el.close === "function" && el.open) el.close();
            else if ("open" in el && typeof el.open === "boolean") el.open = false;
            else if ("hidden" in el) el.hidden = true;
            else if (el.style) el.style.display = "none";
          }
        }
        return true;
      } catch { return false; }
    },
    show: (id) => stdlib.ui._set(id, true),
    open: (id) => stdlib.ui._set(id, true),
    hide: (id) => stdlib.ui._set(id, false),
    close: (id) => stdlib.ui._set(id, false),
    toggle: (id) => {
      const cur = stdlib.ui.isVisible(id);
      if (cur === null) return false;
      return stdlib.ui._set(id, !cur);
    },
    isVisible: (id) => {
      const el = stdlib.ui._el(id);
      if (!el) return null;
      try {
        if (el.tagName === "DIALOG" && typeof el.open === "boolean") return !!el.open;
        if ("hidden" in el && el.hidden) return false;
        if (el.style && el.style.display === "none") return false;
        const open = typeof el.getAttribute === "function" ? el.getAttribute("data-open") : null;
        if (open === "false") return false;
        if (open === "true") return true;
        return true;
      } catch { return null; }
    },
    isOpen: (id) => stdlib.ui.isVisible(id),
  },
};

// Runtime web da Vessie: estado reativo profundo, vnodes, patch incremental do DOM, modo headless.
// No build, este arquivo é concatenado à stdlib em dist/runtime/vessie-runtime.js; as linhas

// ---------------------------------------------------------------- estado reativo
const RAW = Symbol("vessie.raw");
const registry = new WeakMap(); // proxy raiz → Set de assinantes

const isPlain = (v) => v !== null && typeof v === "object" && (Array.isArray(v) || Object.getPrototypeOf(v) === Object.prototype);
const unwrap = (v) => (v !== null && typeof v === "object" && v[RAW] ? v[RAW] : v);

/** Cria um estado reativo profundo (objetos e listas simples). Mutações notificam os assinantes. */
export function createState(initial = {}) {
  const subs = new Set();
  const cache = new WeakMap();
  const notify = () => { for (const fn of [...subs]) fn(); };
  const wrap = (v) => {
    if (!isPlain(v)) return v;
    if (cache.has(v)) return cache.get(v);
    const proxy = new Proxy(v, {
      get(t, k) { return k === RAW ? t : wrap(Reflect.get(t, k)); },
      set(t, k, val) { const old = t[k]; const ok = Reflect.set(t, k, unwrap(val)); if (old !== unwrap(val)) notify(); return ok; },
      deleteProperty(t, k) { const had = k in t; const ok = Reflect.deleteProperty(t, k); if (had) notify(); return ok; },
    });
    cache.set(v, proxy);
    return proxy;
  };
  const root = wrap(initial);
  registry.set(root, subs);
  return root;
}

export function subscribe(state, fn) {
  const subs = registry.get(state);
  if (!subs) throw new Error("subscribe: o valor não é um estado criado por createState()");
  subs.add(fn);
  return () => subs.delete(fn);
}

// ---------------------------------------------------------------- vnodes
export function h(tag, props, children) {
  const flat = (children ?? []).flat(Infinity)
    .filter((c) => c !== null && c !== undefined && c !== false && c !== true)
    .map((c) => (typeof c === "object" ? c : { tag: "#text", text: String(c) }));
  return { tag, props: props ?? {}, children: flat, el: null };
}

const DOM_TAG = {
  page: "main", container: "div", row: "div", column: "div", grid: "div", card: "div", list: "ul", item: "li",
  text: "p", heading: "h2", button: "button", input: "input", textarea: "textarea", checkbox: "input", switch: "input", image: "img",
  select: "select", option: "option", link: "a", badge: "span", divider: "hr", progress: "progress", alert: "section", details: "details", summary: "summary",
  html: "div",
  modal: "div", dialog: "dialog", tabs: "div", tab: "div", table: "table", icon: "span", canvas: "canvas",
};

function domTag(v) {
  if (v.tag === "heading") { const l = Number(v.props.level); return l >= 1 && l <= 6 ? `h${Math.floor(l)}` : "h2"; }
  return DOM_TAG[v.tag] ?? "div";
}

const px = (v) => (typeof v === "number" ? `${v}px` : String(v));
const CONTAINERS = new Set(["row", "column", "grid", "card", "container", "page", "list", "modal", "dialog", "tabs", "tab"]);

/** Converte propriedades de estilo Vessie em propriedades CSS (camelCase). */
export function computeStyle(tag, p) {
  const s = {};
  for (const [k, v] of Object.entries(p)) {
    if (v === null || v === undefined) continue;
    switch (k) {
      case "width": case "height": case "padding": case "margin": case "gap": s[k] = px(v); break;
      case "background": case "color": case "position": case "opacity": s[k] = String(v); break;
      case "border": s.border = typeof v === "number" ? `${v}px solid currentColor` : String(v); break;
      case "radius": s.borderRadius = px(v); break;
      case "shadow": s.boxShadow = typeof v === "number" ? `0 ${v}px ${v * 2}px rgba(0,0,0,.2)` : String(v); break;
      case "font": if (typeof v === "number") s.fontSize = px(v); else s.font = String(v); break;
      case "align": if (CONTAINERS.has(tag)) s.alignItems = String(v); else s.textAlign = String(v); break;
      case "justify": s.justifyContent = String(v); break;
      case "columns": s.gridTemplateColumns = typeof v === "number" ? `repeat(${v}, minmax(0, 1fr))` : String(v); break;
      case "wrap": s.flexWrap = v ? "wrap" : "nowrap"; break;
      case "fit": s.objectFit = String(v); break;
      default: break;
    }
  }
  return s;
}

const ATTRS = new Set(["id", "role", "placeholder", "type", "name", "rows", "alt", "value", "max", "target", "rel"]);
const BOOL_PROPS = new Set(["disabled", "hidden", "multiple", "open"]);

/** Injeta CSS personalizado (blocos `css` da linguagem) uma única vez por conteúdo. */
const injectedCss = new Set();
export function injectCss(cssText) {
  const css = String(cssText ?? "").trim();
  if (!css || injectedCss.has(css)) return false;
  injectedCss.add(css);
  if (typeof document === "undefined") return true; // modo headless: registra sem tocar no DOM
  let el = document.getElementById("vessie-custom-css");
  if (!el) {
    el = document.createElement("style");
    el.id = "vessie-custom-css";
    document.head.appendChild(el);
  }
  el.textContent += (el.textContent ? "\n" : "") + css;
  return true;
}

/** Aceita apenas URLs http(s), data:image, relativas e âncoras (bloqueia javascript: etc.). */
export function safeUrl(u) {
  const s = String(u).trim();
  if (/^(https?:|data:image\/|\/|\.\/|\.\.\/|#)/i.test(s) || !/^[a-z][a-z0-9+.-]*:/i.test(s)) return s;
  return "";
}

function eventNameOf(propKey) { return propKey[2].toLowerCase() + propKey.slice(3); }
const isEventProp = (k) => k.length > 2 && k.startsWith("on") && k[2] === k[2].toUpperCase() && k[2] !== k[2].toLowerCase();

// ---------------------------------------------------------------- criação e patch do DOM
function ensureListener(el, name) {
  el.__vl ??= new Set();
  if (el.__vl.has(name)) return;
  el.__vl.add(name);
  el.addEventListener(name, (ev) => {
    const b = el.__bind;
    if (b && ((name === "input" && (el.__tag === "input" || el.__tag === "textarea")) || (name === "change" && (el.__tag === "checkbox" || el.__tag === "switch" || el.__tag === "select")))) {
      b.set(el.__tag === "checkbox" || el.__tag === "switch" ? !!el.checked : el.value);
    }
    const f = el.__vh?.[name];
    if (f) f(ev);
  });
}

function applyProps(el, oldP, newP, tag) {
  el.__tag = tag;
  // estilo
  const oldS = computeStyle(tag, oldP), newS = computeStyle(tag, newP);
  for (const k of Object.keys(oldS)) if (!(k in newS)) el.style[k] = "";
  for (const [k, v] of Object.entries(newS)) if (oldS[k] !== v || el.style[k] !== v) el.style[k] = v;
  // style bruto (CSS editável pelo usuário, ex.: style: "border: 2px dashed red;")
  // Aplica declaração por declaração (funciona no DOM real e no DOM de testes).
  if (typeof newP.style === "string" && newP.style !== oldP.style && el.style) {
    for (const decl of String(newP.style).split(";")) {
      const i = decl.indexOf(":");
      if (i < 0) continue;
      const rawK = decl.slice(0, i).trim();
      const v = decl.slice(i + 1).trim();
      if (!rawK || !v) continue;
      const camel = rawK.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
      try { el.style[camel] = v; } catch { /* ignora propriedade inválida */ }
    }
  }
  // atributos e propriedades
  for (const [k, v] of Object.entries(newP)) {
    if (k === "bind" || k === "style" || isEventProp(k)) continue;
    if (oldP[k] === v && k !== "src" && k !== "raw") continue;
    if (ATTRS.has(k)) {
      el.setAttribute(k, String(v));
      // id é a âncora dos comandos ui.open/ui.close/... — espelha em data-open quando houver open
      if (k === "id" && (tag === "modal" || tag === "dialog" || tag === "tab") && newP.open !== undefined) {
        try { el.setAttribute("data-open", String(!!newP.open)); } catch { /* DOM mínimo */ }
      }
    }
    else if (BOOL_PROPS.has(k)) {
      el[k] = !!v;
      if (k === "open" && (tag === "modal" || tag === "dialog" || tag === "tab")) {
        try { el.setAttribute("data-open", String(!!v)); } catch { /* DOM mínimo */ }
        // modal em div não tem `open` nativo: esconde via hidden quando fechado
        if (tag === "modal" && el.tagName !== "DIALOG") {
          try { el.hidden = !v; } catch { /* DOM mínimo */ }
        }
        // <dialog> nativo: tenta show()/close() quando disponível
        if (tag === "dialog" && el.tagName === "DIALOG") {
          try {
            if (v && typeof el.show === "function" && !el.open) el.show();
            if (!v && typeof el.close === "function" && el.open) el.close();
          } catch { /* já refletido em el.open */ }
        }
      }
    }
    else if (k === "label") el.setAttribute("aria-label", String(v));
    else if (k === "src") el.setAttribute("src", safeUrl(v));
    else if (k === "href") el.setAttribute("href", safeUrl(v));
    else if (k === "raw") { if (tag === "html") { try { el.innerHTML = String(v ?? ""); } catch { /* DOM mínimo de testes */ } } }
    else if (k === "variant") el.setAttribute("data-variant", String(v));
    else if (k === "theme") el.setAttribute("data-theme", String(v));
    else if (k === "title" && (tag === "modal" || tag === "dialog" || tag === "tab" || tag === "page")) el.setAttribute("data-title", String(v));
    else if (k === "columns" && tag === "table") el.setAttribute("data-columns", String(v));
    else if (k === "class") el.className = `v-${tag} ${v}`;
  }
  for (const k of Object.keys(oldP)) {
    if (!(k in newP) && (ATTRS.has(k) || k === "href" || k === "label" || k === "variant" || k === "theme")) el.removeAttribute(k === "label" ? "aria-label" : k === "variant" ? "data-variant" : k === "theme" ? "data-theme" : k);
    if (!(k in newP) && k === "class") el.className = `v-${tag}`;
  }
  // eventos (um único listener por tipo; o manipulador atual fica em __vh)
  el.__vh ??= {};
  for (const k of Object.keys(oldP)) if (isEventProp(k) && !(k in newP)) delete el.__vh[eventNameOf(k)];
  for (const [k, v] of Object.entries(newP)) if (isEventProp(k) && typeof v === "function") { el.__vh[eventNameOf(k)] = v; ensureListener(el, eventNameOf(k)); }
  // bind
  const b = newP.bind;
  el.__bind = b ?? null;
  if (b) {
    const val = b.get();
    if (tag === "checkbox" || tag === "switch") { if (el.checked !== !!val) el.checked = !!val; ensureListener(el, "change"); }
    else if (tag === "input" || tag === "textarea" || tag === "select") { const s = val === null || val === undefined ? "" : String(val); if (el.value !== s) el.value = s; ensureListener(el, tag === "select" ? "change" : "input"); }
  }
}

function create(doc, v) {
  if (v.tag === "#text") { v.el = doc.createTextNode(v.text); return v.el; }
  const el = doc.createElement(domTag(v));
  el.className = `v-${v.tag}`;
  if (v.tag === "checkbox" || v.tag === "switch") { el.setAttribute("type", "checkbox"); if (v.tag === "switch") el.setAttribute("role", "switch"); }
  // botão autônomo: borda e estilo padrão garantidos pela classe .v-button (editável via css/style/variant/border)
  if (v.tag === "button") { el.setAttribute("type", v.props?.type ?? "button"); }
  applyProps(el, {}, v.props, v.tag);
  if (v.tag === "html" && v.props?.raw !== undefined) { try { el.innerHTML = String(v.props.raw ?? ""); } catch { /* DOM mínimo de testes */ } }
  for (const c of v.children) el.appendChild(create(doc, c));
  v.el = el;
  return el;
}

function patchNode(doc, parentEl, o, n) {
  if (o.tag !== n.tag || (o.tag !== "#text" && domTag(o) !== domTag(n))) {
    parentEl.replaceChild(create(doc, n), o.el);
    return;
  }
  n.el = o.el;
  if (n.tag === "#text") { if (o.text !== n.text) n.el.nodeValue = n.text; return; }
  applyProps(n.el, o.props, n.props, n.tag);
  patchChildren(doc, n.el, o.children, n.children);
}

function patchChildren(doc, parentEl, oldC, newC) {
  const n = Math.max(oldC.length, newC.length);
  for (let i = 0; i < n; i++) {
    const o = oldC[i], nw = newC[i];
    if (!nw) parentEl.removeChild(o.el);
    else if (!o) parentEl.appendChild(create(doc, nw));
    else patchNode(doc, parentEl, o, nw);
  }
}

// ---------------------------------------------------------------- aplicação
const defer = (fn) => (typeof queueMicrotask === "function" ? queueMicrotask(fn) : Promise.resolve().then(fn));

export function createApp({ name = "VessieApp", state = null, computed = {}, ui = null, css = [], html = {}, cs = {} } = {}) {
  const app = {
    name, state, computed, ui, css, html, cs,
    vnode: null, rootEl: null, doc: null, pending: false, unsub: null, renders: 0,
    schedule() {
      if (app.pending || !app.rootEl) return;
      app.pending = true;
      defer(() => { app.pending = false; app.flush(); });
    },
    /** Renderiza imediatamente (síncrono). */
    flush() {
      if (!app.rootEl || !app.ui) return;
      try {
        const next = app.ui();
        if (!app.vnode) {
          while (app.rootEl.firstChild) app.rootEl.removeChild(app.rootEl.firstChild);
          app.rootEl.appendChild(create(app.doc, next));
        } else patchNode(app.doc, app.rootEl, app.vnode, next);
        app.vnode = next;
        app.renders++;
        if (next.props?.title !== undefined && app.doc) app.doc.title = String(next.props.title);
      } catch (e) {
        stdlib.error(`[vessie] erro ao renderizar: ${e?.message ?? e}`);
      }
    },
    mount(rootEl, doc = rootEl.ownerDocument ?? globalThis.document) {
      app.rootEl = rootEl; app.doc = doc; app.vnode = null;
      if (state) app.unsub = subscribe(state, app.schedule);
      app.flush();
      return app;
    },
    destroy() {
      app.unsub?.();
      if (app.rootEl) while (app.rootEl.firstChild) app.rootEl.removeChild(app.rootEl.firstChild);
      app.rootEl = null; app.vnode = null;
    },
    renderText() { return app.ui ? renderToText(app.ui()) : ""; },
  };
  return app;
}

/** Inicia a aplicação: monta em #app no navegador; em Node imprime uma visão textual (modo headless). */
export function start(app) {
  if (typeof document !== "undefined") {
    const root = document.getElementById("app") ?? document.body;
    app.mount(root, document);
  } else if (app.ui) {
    stdlib.print(app.renderText());
  }
  return app;
}

// ---------------------------------------------------------------- abrir/fechar UI por id
// Mesma lógica de `stdlib.ui` (duplicada aqui para uso direto do runtime/testes,
// sem ciclo de import). No navegador manipula o DOM; fora dele retorna false/null.
function uiEl(id) {
  try {
    const doc = globalThis.document;
    if (!doc || typeof doc.getElementById !== "function") return null;
    return doc.getElementById(String(id));
  } catch { return null; }
}

function uiSet(id, visible) {
  const el = uiEl(id);
  if (!el) return false;
  try {
    if (visible) {
      if ("hidden" in el && el.hidden) el.hidden = false;
      if (el.style) el.style.display = "";
      if (typeof el.setAttribute === "function") el.setAttribute("data-open", "true");
      if (el.tagName === "DIALOG" && typeof el.show === "function" && !el.open) el.show();
      else if ("open" in el && typeof el.open === "boolean") el.open = true;
    } else {
      if (typeof el.setAttribute === "function") el.setAttribute("data-open", "false");
      if (el.tagName === "DIALOG" && typeof el.close === "function" && el.open) el.close();
      else if ("open" in el && typeof el.open === "boolean") el.open = false;
      else if ("hidden" in el) el.hidden = true;
      else if (el.style) el.style.display = "none";
    }
    return true;
  } catch { return false; }
}

/** Mostra/abre um elemento ou modal pelo `id:`. Retorna false se não existir ou fora do navegador. */
export function showUI(id) { return uiSet(id, true); }
/** Alias de showUI: abrir UI. */
export function openUI(id) { return uiSet(id, true); }
/** Esconde/fecha um elemento ou modal pelo `id:`. */
export function hideUI(id) { return uiSet(id, false); }
/** Alias de hideUI: fechar UI. */
export function closeUI(id) { return uiSet(id, false); }
/** Alterna visível/oculto. Retorna false se o id não existe. */
export function toggleUI(id) {
  const cur = isVisibleUI(id);
  if (cur === null) return false;
  return uiSet(id, !cur);
}
/** true/false se visível/oculto, null se o id não existe (ou fora do navegador). */
export function isVisibleUI(id) {
  const el = uiEl(id);
  if (!el) return null;
  try {
    if (el.tagName === "DIALOG" && typeof el.open === "boolean") return !!el.open;
    if ("hidden" in el && el.hidden) return false;
    if (el.style && el.style.display === "none") return false;
    const open = typeof el.getAttribute === "function" ? el.getAttribute("data-open") : null;
    if (open === "false") return false;
    if (open === "true") return true;
    return true;
  } catch { return null; }
}

// ---------------------------------------------------------------- modo headless
function textOf(v) {
  if (v.tag === "#text") return v.text;
  return v.children.map(textOf).join("");
}

export function renderToText(v, depth = 0) {
  if (v.tag === "#text") return "  ".repeat(depth) + v.text;
  const pad = "  ".repeat(depth);
  switch (v.tag) {
    case "page": return [`${pad}== ${v.props.title ?? "página"} ==`, ...v.children.map((c) => renderToText(c, depth))].join("\n");
    case "heading": return `${pad}# ${textOf(v)}`;
    case "text": case "item": return `${pad}${textOf(v)}`;
    case "button": return `${pad}[ ${textOf(v)} ]`;
    case "link": return `${pad}${textOf(v)} (${v.props.href ?? "#"})`;
    case "badge": return `${pad}[${textOf(v)}]`;
    case "progress": return `${pad}${v.props.value ?? 0}/${v.props.max ?? 100}`;
    case "alert": return `${pad}! ${textOf(v)}`;
    case "modal": case "dialog": {
      const open = v.props.open ?? v.props.hidden === false ?? true;
      const title = v.props.title ?? textOf(v).slice(0, 40) ?? v.tag;
      const head = `${pad}[${v.tag}${open === false ? " (fechado)" : ""}] ${title}`.trimEnd();
      if (open === false) return head;
      const body = v.children.map((c) => renderToText(c, depth + 1)).join("\n");
      return body ? `${head}\n${body}` : head;
    }
    case "tabs": return [`${pad}== abas ==`, ...v.children.map((c) => renderToText(c, depth + 1))].join("\n");
    case "tab": return [`${pad}-- ${v.props.title ?? "aba"} --`, ...v.children.map((c) => renderToText(c, depth + 1))].join("\n");
    case "table": return `${pad}[tabela ${v.children.length} linha(s)]`;
    case "icon": return `${pad}<ícone ${textOf(v) || v.props.src || ""}>`.trimEnd();
    case "canvas": return `${pad}<canvas>`;
    case "html": return `${pad}${textOf(v)}${v.props?.raw ? String(v.props.raw).slice(0, 120) : ""}`.trimEnd();
    case "input": case "textarea": case "select": { const val = v.props.bind?.get(); return `${pad}(${v.props.placeholder ?? (v.tag === "select" ? "seleção" : "campo")}) ${val ?? ""}`.trimEnd(); }
    case "checkbox": case "switch": return `${pad}[${v.props.bind?.get() ? "x" : " "}] ${v.props.label ?? ""}`.trimEnd();
    case "image": return `${pad}<imagem ${v.props.alt ?? ""}>`.trimEnd();
    default: return v.children.map((c) => renderToText(c, depth + (CONTAINERS.has(v.tag) ? 1 : 0))).join("\n");
  }
}
