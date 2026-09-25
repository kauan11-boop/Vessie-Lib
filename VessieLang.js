#!/usr/bin/env node
// VessieLang.js — o sistema Vessie inteiro em UM arquivo (gerado por scripts/bundle-self.js, não edite).
// Uso como CLI:  node VessieLang.js <comando>  (ex.: compile, check, build, run --node, exec, ai ...)
// Uso como API:  import { compile, buildWeb, main } from "./VessieLang.js";
// Requer apenas Node.js >= 20. Não precisa da pasta src/.
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import https from "node:https";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
const __EMBEDDED_ASSETS__ = {"stdlib/index.js":"// Biblioteca padrão da Vessie em tempo de execução. Sem imports: este arquivo é\n// concatenado ao runtime web pelo build (dist/runtime/vessie-runtime.js).\n\nlet output = (level, args) => {\n  const fn = level === \"error\" ? console.error : level === \"warn\" ? console.warn : console.log;\n  fn(...args);\n};\n\n/** Redireciona a saída de print/log/warn/error (útil em testes e no modo headless). */\nexport function setOutput(fn) { output = fn ?? output; }\n\nconst typeOfValue = (v) => (v === null ? \"null\" : Array.isArray(v) ? \"array\" : typeof v === \"undefined\" ? \"null\" : typeof v);\nconst isNull = (v) => v === null || v === undefined;\n\nclass VessieAssertionError extends Error {\n  constructor(message) { super(message); this.name = \"VessieAssertionError\"; }\n}\n\nexport const stdlib = {\n  print: (...a) => output(\"print\", a),\n  log: (...a) => output(\"log\", a),\n  warn: (...a) => output(\"warn\", a),\n  error: (...a) => output(\"error\", a),\n  assert: (cond, msg = \"Asserção falhou\") => { if (!cond) throw new VessieAssertionError(msg); },\n  typeof: typeOfValue,\n  typeofValue: typeOfValue,\n  isNull,\n  isDefined: (v) => !isNull(v),\n  range: (a, b) => {\n    const [from, to] = b === undefined ? [0, a] : [a, b];\n    const out = [];\n    for (let i = from; i < to; i++) out.push(i);\n    return out;\n  },\n  math: {\n    PI: Math.PI,\n    abs: Math.abs, floor: Math.floor, ceil: Math.ceil, round: Math.round, sqrt: Math.sqrt, pow: Math.pow,\n    clamp: (v, lo, hi) => Math.min(Math.max(v, lo), hi),\n    lerp: (a, b, t) => a + (b - a) * t,\n    random: Math.random,\n    randomInt: (min, max) => Math.floor(Math.random() * (Math.floor(max) - Math.ceil(min) + 1)) + Math.ceil(min),\n    sign: Math.sign,\n    modulo: (n, d) => ((n % d) + d) % d,\n    radians: (degrees) => degrees * Math.PI / 180,\n    degrees: (radians) => radians * 180 / Math.PI,\n    min: Math.min, max: Math.max,\n  },\n  string: {\n    length: (s) => s.length,\n    upper: (s) => s.toUpperCase(),\n    lower: (s) => s.toLowerCase(),\n    trim: (s) => s.trim(),\n    split: (s, sep) => s.split(sep),\n    replace: (s, from, to) => s.split(from).join(to),\n    includes: (s, sub) => s.includes(sub),\n    startsWith: (s, prefix) => s.startsWith(prefix),\n    endsWith: (s, suffix) => s.endsWith(suffix),\n    repeat: (s, count) => s.repeat(count),\n    chars: (s) => Array.from(s),\n    format: (s, ...args) => s.replace(/\\{(\\d+)\\}/g, (m, i) => (i < args.length ? String(args[i]) : m)),\n  },\n  array: {\n    length: (a) => a.length,\n    map: (a, fn) => a.map((x, i) => fn(x, i)),\n    filter: (a, fn) => a.filter((x, i) => fn(x, i)),\n    reduce: (a, fn, init) => (init === undefined ? a.reduce((acc, x) => fn(acc, x)) : a.reduce((acc, x) => fn(acc, x), init)),\n    find: (a, fn) => a.find((x, i) => fn(x, i)) ?? null,\n    sort: (a, fn) => [...a].sort(fn ?? ((x, y) => (x < y ? -1 : x > y ? 1 : 0))),\n    forEach: (a, fn) => { a.forEach((x, i) => fn(x, i)); },\n    includes: (a, v) => a.includes(v),\n    push: (a, v) => a.push(v),\n    join: (a, sep = \",\") => a.join(sep),\n    first: (a) => a.length ? a[0] : null,\n    last: (a) => a.length ? a[a.length - 1] : null,\n    reverse: (a) => [...a].reverse(),\n    slice: (a, start, end) => a.slice(start, end),\n    concat: (a, b) => a.concat(b),\n    unique: (a) => [...new Set(a)],\n    remove: (a, value) => { const i = a.indexOf(value); if (i >= 0) a.splice(i, 1); return i >= 0; },\n  },\n  object: {\n    keys: (v) => Object.keys(v ?? {}),\n    values: (v) => Object.values(v ?? {}),\n    has: (v, key) => Object.prototype.hasOwnProperty.call(v ?? {}, key),\n  },\n  json: {\n    parse: (s) => JSON.parse(s),\n    stringify: (v) => JSON.stringify(v),\n  },\n  date: {\n    now: () => Date.now(),\n    iso: () => new Date().toISOString(),\n    format: (timestamp, locale = \"pt-BR\") => new Intl.DateTimeFormat(locale).format(new Date(timestamp)),\n  },\n  storage: {\n    get: (key, fallback = null) => { try { const v = globalThis.localStorage?.getItem(String(key)); return v === null || v === undefined ? fallback : v; } catch { return fallback; } },\n    set: (key, value) => { try { globalThis.localStorage?.setItem(String(key), String(value)); return true; } catch { return false; } },\n    remove: (key) => { try { globalThis.localStorage?.removeItem(String(key)); return true; } catch { return false; } },\n    clear: () => { try { globalThis.localStorage?.clear(); return true; } catch { return false; } },\n  },\n  http: {\n    get: async (url) => { const r = await fetch(String(url)); return { ok: r.ok, status: r.status, text: await r.text() }; },\n    getJson: async (url) => { const r = await fetch(String(url)); return { ok: r.ok, status: r.status, data: await r.json() }; },\n    postJson: async (url, data) => { const r = await fetch(String(url), { method: \"POST\", headers: { \"content-type\": \"application/json\" }, body: JSON.stringify(data) }); return { ok: r.ok, status: r.status, data: await r.json() }; },\n  },\n  // Compatibilidade direta com JavaScript (espelha o bloco `js` da linguagem).\n  // Escreva JS puro em blocos `js nome = `...`` (executa verbatim no escopo\n  // do app: $, $c, $ui, $std, h) ou avalie trechos com js.run/js.eval.\n  // Combine com `css` (estilo) e `html nome = `...`` (markup próprio):\n  // o app final é um HTML próprio com CSS+JS embutidos.\n  js: {\n    run: (code) => {\n      const src = String(code);\n      try { return new Function(`return (${src})`)(); }\n      catch { return new Function(src)(); }\n    },\n    eval: (code) => {\n      const src = String(code);\n      try { return new Function(`return (${src})`)(); }\n      catch { return new Function(src)(); }\n    },\n    get: (path) => {\n      const parts = String(path).split(\".\");\n      let cur = globalThis;\n      for (const p of parts) {\n        if (cur === null || cur === undefined) return undefined;\n        cur = cur[p];\n      }\n      return cur;\n    },\n    set: (path, value) => {\n      const parts = String(path).split(\".\");\n      const last = parts.pop();\n      let cur = globalThis;\n      for (const p of parts) cur = cur[p] ?? (cur[p] = {});\n      cur[last] = value;\n      return value;\n    },\n    on: (event, handler) => {\n      if (typeof globalThis.addEventListener === \"function\" && typeof handler === \"function\") {\n        globalThis.addEventListener(String(event), handler);\n        return true;\n      }\n      return false;\n    },\n  },\n  // Conjunto de comandos para abrir/fechar UI (modal, dialog, ou qualquer\n  // elemento com `id:`). Funciona no navegador; no modo headless retorna false.\n  // Ex.: ui.open(\"ajuda\") · ui.close(\"ajuda\") · ui.toggle(\"menu\") · ui.show(\"x\") · ui.hide(\"x\")\n  ui: {\n    _el: (id) => {\n      try {\n        const doc = globalThis.document;\n        if (!doc || typeof doc.getElementById !== \"function\") return null;\n        return doc.getElementById(String(id));\n      } catch { return null; }\n    },\n    _set: (id, visible) => {\n      const el = stdlib.ui._el(id);\n      if (!el) return false;\n      try {\n        if (visible) {\n          if (\"hidden\" in el && el.hidden) el.hidden = false;\n          if (el.style) el.style.display = \"\";\n          if (typeof el.setAttribute === \"function\") el.setAttribute(\"data-open\", \"true\");\n          if (el.tagName === \"DIALOG\" && typeof el.show === \"function\" && !el.open) el.show();\n          else if (\"open\" in el && typeof el.open === \"boolean\") el.open = true;\n        } else {\n          if (\"hidden\" in el && !el.hidden && (el.tagName === \"DIALOG\" || el.tagName === \"DIV\" || el.tagName === \"SECTION\")) {\n            // modal/div: usa hidden para esconder sem destruir o nó\n            if (typeof el.setAttribute === \"function\") el.setAttribute(\"data-open\", \"false\");\n            if (el.tagName === \"DIALOG\" && typeof el.close === \"function\" && el.open) el.close();\n            else if (\"open\" in el && typeof el.open === \"boolean\") el.open = false;\n            else el.hidden = true;\n          } else {\n            if (typeof el.setAttribute === \"function\") el.setAttribute(\"data-open\", \"false\");\n            if (el.tagName === \"DIALOG\" && typeof el.close === \"function\" && el.open) el.close();\n            else if (\"open\" in el && typeof el.open === \"boolean\") el.open = false;\n            else if (\"hidden\" in el) el.hidden = true;\n            else if (el.style) el.style.display = \"none\";\n          }\n        }\n        return true;\n      } catch { return false; }\n    },\n    show: (id) => stdlib.ui._set(id, true),\n    open: (id) => stdlib.ui._set(id, true),\n    hide: (id) => stdlib.ui._set(id, false),\n    close: (id) => stdlib.ui._set(id, false),\n    toggle: (id) => {\n      const cur = stdlib.ui.isVisible(id);\n      if (cur === null) return false;\n      return stdlib.ui._set(id, !cur);\n    },\n    isVisible: (id) => {\n      const el = stdlib.ui._el(id);\n      if (!el) return null;\n      try {\n        if (el.tagName === \"DIALOG\" && typeof el.open === \"boolean\") return !!el.open;\n        if (\"hidden\" in el && el.hidden) return false;\n        if (el.style && el.style.display === \"none\") return false;\n        const open = typeof el.getAttribute === \"function\" ? el.getAttribute(\"data-open\") : null;\n        if (open === \"false\") return false;\n        if (open === \"true\") return true;\n        return true;\n      } catch { return null; }\n    },\n    isOpen: (id) => stdlib.ui.isVisible(id),\n  },\n};\n","runtime/web/runtime.js":"// Runtime web da Vessie: estado reativo profundo, vnodes, patch incremental do DOM, modo headless.\n// No build, este arquivo é concatenado à stdlib em dist/runtime/vessie-runtime.js; as linhas\n// marcadas com @bundle-strip existem só para uso direto a partir de src/ (testes).\nimport { stdlib, setOutput } from \"../../stdlib/index.js\"; // @bundle-strip\nexport { stdlib, setOutput }; // @bundle-strip\n\n// ---------------------------------------------------------------- estado reativo\nconst RAW = Symbol(\"vessie.raw\");\nconst registry = new WeakMap(); // proxy raiz → Set de assinantes\n\nconst isPlain = (v) => v !== null && typeof v === \"object\" && (Array.isArray(v) || Object.getPrototypeOf(v) === Object.prototype);\nconst unwrap = (v) => (v !== null && typeof v === \"object\" && v[RAW] ? v[RAW] : v);\n\n/** Cria um estado reativo profundo (objetos e listas simples). Mutações notificam os assinantes. */\nexport function createState(initial = {}) {\n  const subs = new Set();\n  const cache = new WeakMap();\n  const notify = () => { for (const fn of [...subs]) fn(); };\n  const wrap = (v) => {\n    if (!isPlain(v)) return v;\n    if (cache.has(v)) return cache.get(v);\n    const proxy = new Proxy(v, {\n      get(t, k) { return k === RAW ? t : wrap(Reflect.get(t, k)); },\n      set(t, k, val) { const old = t[k]; const ok = Reflect.set(t, k, unwrap(val)); if (old !== unwrap(val)) notify(); return ok; },\n      deleteProperty(t, k) { const had = k in t; const ok = Reflect.deleteProperty(t, k); if (had) notify(); return ok; },\n    });\n    cache.set(v, proxy);\n    return proxy;\n  };\n  const root = wrap(initial);\n  registry.set(root, subs);\n  return root;\n}\n\nexport function subscribe(state, fn) {\n  const subs = registry.get(state);\n  if (!subs) throw new Error(\"subscribe: o valor não é um estado criado por createState()\");\n  subs.add(fn);\n  return () => subs.delete(fn);\n}\n\n// ---------------------------------------------------------------- vnodes\nexport function h(tag, props, children) {\n  const flat = (children ?? []).flat(Infinity)\n    .filter((c) => c !== null && c !== undefined && c !== false && c !== true)\n    .map((c) => (typeof c === \"object\" ? c : { tag: \"#text\", text: String(c) }));\n  return { tag, props: props ?? {}, children: flat, el: null };\n}\n\nconst DOM_TAG = {\n  page: \"main\", container: \"div\", row: \"div\", column: \"div\", grid: \"div\", card: \"div\", list: \"ul\", item: \"li\",\n  text: \"p\", heading: \"h2\", button: \"button\", input: \"input\", textarea: \"textarea\", checkbox: \"input\", switch: \"input\", image: \"img\",\n  select: \"select\", option: \"option\", link: \"a\", badge: \"span\", divider: \"hr\", progress: \"progress\", alert: \"section\", details: \"details\", summary: \"summary\",\n  html: \"div\",\n  modal: \"div\", dialog: \"dialog\", tabs: \"div\", tab: \"div\", table: \"table\", icon: \"span\", canvas: \"canvas\",\n};\n\nfunction domTag(v) {\n  if (v.tag === \"heading\") { const l = Number(v.props.level); return l >= 1 && l <= 6 ? `h${Math.floor(l)}` : \"h2\"; }\n  return DOM_TAG[v.tag] ?? \"div\";\n}\n\nconst px = (v) => (typeof v === \"number\" ? `${v}px` : String(v));\nconst CONTAINERS = new Set([\"row\", \"column\", \"grid\", \"card\", \"container\", \"page\", \"list\", \"modal\", \"dialog\", \"tabs\", \"tab\"]);\n\n/** Converte propriedades de estilo Vessie em propriedades CSS (camelCase). */\nexport function computeStyle(tag, p) {\n  const s = {};\n  for (const [k, v] of Object.entries(p)) {\n    if (v === null || v === undefined) continue;\n    switch (k) {\n      case \"width\": case \"height\": case \"padding\": case \"margin\": case \"gap\": s[k] = px(v); break;\n      case \"background\": case \"color\": case \"position\": case \"opacity\": s[k] = String(v); break;\n      case \"border\": s.border = typeof v === \"number\" ? `${v}px solid currentColor` : String(v); break;\n      case \"radius\": s.borderRadius = px(v); break;\n      case \"shadow\": s.boxShadow = typeof v === \"number\" ? `0 ${v}px ${v * 2}px rgba(0,0,0,.2)` : String(v); break;\n      case \"font\": if (typeof v === \"number\") s.fontSize = px(v); else s.font = String(v); break;\n      case \"align\": if (CONTAINERS.has(tag)) s.alignItems = String(v); else s.textAlign = String(v); break;\n      case \"justify\": s.justifyContent = String(v); break;\n      case \"columns\": s.gridTemplateColumns = typeof v === \"number\" ? `repeat(${v}, minmax(0, 1fr))` : String(v); break;\n      case \"wrap\": s.flexWrap = v ? \"wrap\" : \"nowrap\"; break;\n      case \"fit\": s.objectFit = String(v); break;\n      default: break;\n    }\n  }\n  return s;\n}\n\nconst ATTRS = new Set([\"id\", \"role\", \"placeholder\", \"type\", \"name\", \"rows\", \"alt\", \"value\", \"max\", \"target\", \"rel\"]);\nconst BOOL_PROPS = new Set([\"disabled\", \"hidden\", \"multiple\", \"open\"]);\n\n/** Injeta CSS personalizado (blocos `css` da linguagem) uma única vez por conteúdo. */\nconst injectedCss = new Set();\nexport function injectCss(cssText) {\n  const css = String(cssText ?? \"\").trim();\n  if (!css || injectedCss.has(css)) return false;\n  injectedCss.add(css);\n  if (typeof document === \"undefined\") return true; // modo headless: registra sem tocar no DOM\n  let el = document.getElementById(\"vessie-custom-css\");\n  if (!el) {\n    el = document.createElement(\"style\");\n    el.id = \"vessie-custom-css\";\n    document.head.appendChild(el);\n  }\n  el.textContent += (el.textContent ? \"\\n\" : \"\") + css;\n  return true;\n}\n\n/** Aceita apenas URLs http(s), data:image, relativas e âncoras (bloqueia javascript: etc.). */\nexport function safeUrl(u) {\n  const s = String(u).trim();\n  if (/^(https?:|data:image\\/|\\/|\\.\\/|\\.\\.\\/|#)/i.test(s) || !/^[a-z][a-z0-9+.-]*:/i.test(s)) return s;\n  return \"\";\n}\n\nfunction eventNameOf(propKey) { return propKey[2].toLowerCase() + propKey.slice(3); }\nconst isEventProp = (k) => k.length > 2 && k.startsWith(\"on\") && k[2] === k[2].toUpperCase() && k[2] !== k[2].toLowerCase();\n\n// ---------------------------------------------------------------- criação e patch do DOM\nfunction ensureListener(el, name) {\n  el.__vl ??= new Set();\n  if (el.__vl.has(name)) return;\n  el.__vl.add(name);\n  el.addEventListener(name, (ev) => {\n    const b = el.__bind;\n    if (b && ((name === \"input\" && (el.__tag === \"input\" || el.__tag === \"textarea\")) || (name === \"change\" && (el.__tag === \"checkbox\" || el.__tag === \"switch\" || el.__tag === \"select\")))) {\n      b.set(el.__tag === \"checkbox\" || el.__tag === \"switch\" ? !!el.checked : el.value);\n    }\n    const f = el.__vh?.[name];\n    if (f) f(ev);\n  });\n}\n\nfunction applyProps(el, oldP, newP, tag) {\n  el.__tag = tag;\n  // estilo\n  const oldS = computeStyle(tag, oldP), newS = computeStyle(tag, newP);\n  for (const k of Object.keys(oldS)) if (!(k in newS)) el.style[k] = \"\";\n  for (const [k, v] of Object.entries(newS)) if (oldS[k] !== v || el.style[k] !== v) el.style[k] = v;\n  // style bruto (CSS editável pelo usuário, ex.: style: \"border: 2px dashed red;\")\n  // Aplica declaração por declaração (funciona no DOM real e no DOM de testes).\n  if (typeof newP.style === \"string\" && newP.style !== oldP.style && el.style) {\n    for (const decl of String(newP.style).split(\";\")) {\n      const i = decl.indexOf(\":\");\n      if (i < 0) continue;\n      const rawK = decl.slice(0, i).trim();\n      const v = decl.slice(i + 1).trim();\n      if (!rawK || !v) continue;\n      const camel = rawK.replace(/-([a-z])/g, (_, c) => c.toUpperCase());\n      try { el.style[camel] = v; } catch { /* ignora propriedade inválida */ }\n    }\n  }\n  // atributos e propriedades\n  for (const [k, v] of Object.entries(newP)) {\n    if (k === \"bind\" || k === \"style\" || isEventProp(k)) continue;\n    if (oldP[k] === v && k !== \"src\" && k !== \"raw\") continue;\n    if (ATTRS.has(k)) {\n      el.setAttribute(k, String(v));\n      // id é a âncora dos comandos ui.open/ui.close/... — espelha em data-open quando houver open\n      if (k === \"id\" && (tag === \"modal\" || tag === \"dialog\" || tag === \"tab\") && newP.open !== undefined) {\n        try { el.setAttribute(\"data-open\", String(!!newP.open)); } catch { /* DOM mínimo */ }\n      }\n    }\n    else if (BOOL_PROPS.has(k)) {\n      el[k] = !!v;\n      if (k === \"open\" && (tag === \"modal\" || tag === \"dialog\" || tag === \"tab\")) {\n        try { el.setAttribute(\"data-open\", String(!!v)); } catch { /* DOM mínimo */ }\n        // modal em div não tem `open` nativo: esconde via hidden quando fechado\n        if (tag === \"modal\" && el.tagName !== \"DIALOG\") {\n          try { el.hidden = !v; } catch { /* DOM mínimo */ }\n        }\n        // <dialog> nativo: tenta show()/close() quando disponível\n        if (tag === \"dialog\" && el.tagName === \"DIALOG\") {\n          try {\n            if (v && typeof el.show === \"function\" && !el.open) el.show();\n            if (!v && typeof el.close === \"function\" && el.open) el.close();\n          } catch { /* já refletido em el.open */ }\n        }\n      }\n    }\n    else if (k === \"label\") el.setAttribute(\"aria-label\", String(v));\n    else if (k === \"src\") el.setAttribute(\"src\", safeUrl(v));\n    else if (k === \"href\") el.setAttribute(\"href\", safeUrl(v));\n    else if (k === \"raw\") { if (tag === \"html\") { try { el.innerHTML = String(v ?? \"\"); } catch { /* DOM mínimo de testes */ } } }\n    else if (k === \"variant\") el.setAttribute(\"data-variant\", String(v));\n    else if (k === \"theme\") el.setAttribute(\"data-theme\", String(v));\n    else if (k === \"title\" && (tag === \"modal\" || tag === \"dialog\" || tag === \"tab\" || tag === \"page\")) el.setAttribute(\"data-title\", String(v));\n    else if (k === \"columns\" && tag === \"table\") el.setAttribute(\"data-columns\", String(v));\n    else if (k === \"class\") el.className = `v-${tag} ${v}`;\n  }\n  for (const k of Object.keys(oldP)) {\n    if (!(k in newP) && (ATTRS.has(k) || k === \"href\" || k === \"label\" || k === \"variant\" || k === \"theme\")) el.removeAttribute(k === \"label\" ? \"aria-label\" : k === \"variant\" ? \"data-variant\" : k === \"theme\" ? \"data-theme\" : k);\n    if (!(k in newP) && k === \"class\") el.className = `v-${tag}`;\n  }\n  // eventos (um único listener por tipo; o manipulador atual fica em __vh)\n  el.__vh ??= {};\n  for (const k of Object.keys(oldP)) if (isEventProp(k) && !(k in newP)) delete el.__vh[eventNameOf(k)];\n  for (const [k, v] of Object.entries(newP)) if (isEventProp(k) && typeof v === \"function\") { el.__vh[eventNameOf(k)] = v; ensureListener(el, eventNameOf(k)); }\n  // bind\n  const b = newP.bind;\n  el.__bind = b ?? null;\n  if (b) {\n    const val = b.get();\n    if (tag === \"checkbox\" || tag === \"switch\") { if (el.checked !== !!val) el.checked = !!val; ensureListener(el, \"change\"); }\n    else if (tag === \"input\" || tag === \"textarea\" || tag === \"select\") { const s = val === null || val === undefined ? \"\" : String(val); if (el.value !== s) el.value = s; ensureListener(el, tag === \"select\" ? \"change\" : \"input\"); }\n  }\n}\n\nfunction create(doc, v) {\n  if (v.tag === \"#text\") { v.el = doc.createTextNode(v.text); return v.el; }\n  const el = doc.createElement(domTag(v));\n  el.className = `v-${v.tag}`;\n  if (v.tag === \"checkbox\" || v.tag === \"switch\") { el.setAttribute(\"type\", \"checkbox\"); if (v.tag === \"switch\") el.setAttribute(\"role\", \"switch\"); }\n  // botão autônomo: borda e estilo padrão garantidos pela classe .v-button (editável via css/style/variant/border)\n  if (v.tag === \"button\") { el.setAttribute(\"type\", v.props?.type ?? \"button\"); }\n  applyProps(el, {}, v.props, v.tag);\n  if (v.tag === \"html\" && v.props?.raw !== undefined) { try { el.innerHTML = String(v.props.raw ?? \"\"); } catch { /* DOM mínimo de testes */ } }\n  for (const c of v.children) el.appendChild(create(doc, c));\n  v.el = el;\n  return el;\n}\n\nfunction patchNode(doc, parentEl, o, n) {\n  if (o.tag !== n.tag || (o.tag !== \"#text\" && domTag(o) !== domTag(n))) {\n    parentEl.replaceChild(create(doc, n), o.el);\n    return;\n  }\n  n.el = o.el;\n  if (n.tag === \"#text\") { if (o.text !== n.text) n.el.nodeValue = n.text; return; }\n  applyProps(n.el, o.props, n.props, n.tag);\n  patchChildren(doc, n.el, o.children, n.children);\n}\n\nfunction patchChildren(doc, parentEl, oldC, newC) {\n  const n = Math.max(oldC.length, newC.length);\n  for (let i = 0; i < n; i++) {\n    const o = oldC[i], nw = newC[i];\n    if (!nw) parentEl.removeChild(o.el);\n    else if (!o) parentEl.appendChild(create(doc, nw));\n    else patchNode(doc, parentEl, o, nw);\n  }\n}\n\n// ---------------------------------------------------------------- aplicação\nconst defer = (fn) => (typeof queueMicrotask === \"function\" ? queueMicrotask(fn) : Promise.resolve().then(fn));\n\nexport function createApp({ name = \"VessieApp\", state = null, computed = {}, ui = null, css = [], html = {}, cs = {} } = {}) {\n  const app = {\n    name, state, computed, ui, css, html, cs,\n    vnode: null, rootEl: null, doc: null, pending: false, unsub: null, renders: 0,\n    schedule() {\n      if (app.pending || !app.rootEl) return;\n      app.pending = true;\n      defer(() => { app.pending = false; app.flush(); });\n    },\n    /** Renderiza imediatamente (síncrono). */\n    flush() {\n      if (!app.rootEl || !app.ui) return;\n      try {\n        const next = app.ui();\n        if (!app.vnode) {\n          while (app.rootEl.firstChild) app.rootEl.removeChild(app.rootEl.firstChild);\n          app.rootEl.appendChild(create(app.doc, next));\n        } else patchNode(app.doc, app.rootEl, app.vnode, next);\n        app.vnode = next;\n        app.renders++;\n        if (next.props?.title !== undefined && app.doc) app.doc.title = String(next.props.title);\n      } catch (e) {\n        stdlib.error(`[vessie] erro ao renderizar: ${e?.message ?? e}`);\n      }\n    },\n    mount(rootEl, doc = rootEl.ownerDocument ?? globalThis.document) {\n      app.rootEl = rootEl; app.doc = doc; app.vnode = null;\n      if (state) app.unsub = subscribe(state, app.schedule);\n      app.flush();\n      return app;\n    },\n    destroy() {\n      app.unsub?.();\n      if (app.rootEl) while (app.rootEl.firstChild) app.rootEl.removeChild(app.rootEl.firstChild);\n      app.rootEl = null; app.vnode = null;\n    },\n    renderText() { return app.ui ? renderToText(app.ui()) : \"\"; },\n  };\n  return app;\n}\n\n/** Inicia a aplicação: monta em #app no navegador; em Node imprime uma visão textual (modo headless). */\nexport function start(app) {\n  if (typeof document !== \"undefined\") {\n    const root = document.getElementById(\"app\") ?? document.body;\n    app.mount(root, document);\n  } else if (app.ui) {\n    stdlib.print(app.renderText());\n  }\n  return app;\n}\n\n// ---------------------------------------------------------------- abrir/fechar UI por id\n// Mesma lógica de `stdlib.ui` (duplicada aqui para uso direto do runtime/testes,\n// sem ciclo de import). No navegador manipula o DOM; fora dele retorna false/null.\nfunction uiEl(id) {\n  try {\n    const doc = globalThis.document;\n    if (!doc || typeof doc.getElementById !== \"function\") return null;\n    return doc.getElementById(String(id));\n  } catch { return null; }\n}\n\nfunction uiSet(id, visible) {\n  const el = uiEl(id);\n  if (!el) return false;\n  try {\n    if (visible) {\n      if (\"hidden\" in el && el.hidden) el.hidden = false;\n      if (el.style) el.style.display = \"\";\n      if (typeof el.setAttribute === \"function\") el.setAttribute(\"data-open\", \"true\");\n      if (el.tagName === \"DIALOG\" && typeof el.show === \"function\" && !el.open) el.show();\n      else if (\"open\" in el && typeof el.open === \"boolean\") el.open = true;\n    } else {\n      if (typeof el.setAttribute === \"function\") el.setAttribute(\"data-open\", \"false\");\n      if (el.tagName === \"DIALOG\" && typeof el.close === \"function\" && el.open) el.close();\n      else if (\"open\" in el && typeof el.open === \"boolean\") el.open = false;\n      else if (\"hidden\" in el) el.hidden = true;\n      else if (el.style) el.style.display = \"none\";\n    }\n    return true;\n  } catch { return false; }\n}\n\n/** Mostra/abre um elemento ou modal pelo `id:`. Retorna false se não existir ou fora do navegador. */\nexport function showUI(id) { return uiSet(id, true); }\n/** Alias de showUI: abrir UI. */\nexport function openUI(id) { return uiSet(id, true); }\n/** Esconde/fecha um elemento ou modal pelo `id:`. */\nexport function hideUI(id) { return uiSet(id, false); }\n/** Alias de hideUI: fechar UI. */\nexport function closeUI(id) { return uiSet(id, false); }\n/** Alterna visível/oculto. Retorna false se o id não existe. */\nexport function toggleUI(id) {\n  const cur = isVisibleUI(id);\n  if (cur === null) return false;\n  return uiSet(id, !cur);\n}\n/** true/false se visível/oculto, null se o id não existe (ou fora do navegador). */\nexport function isVisibleUI(id) {\n  const el = uiEl(id);\n  if (!el) return null;\n  try {\n    if (el.tagName === \"DIALOG\" && typeof el.open === \"boolean\") return !!el.open;\n    if (\"hidden\" in el && el.hidden) return false;\n    if (el.style && el.style.display === \"none\") return false;\n    const open = typeof el.getAttribute === \"function\" ? el.getAttribute(\"data-open\") : null;\n    if (open === \"false\") return false;\n    if (open === \"true\") return true;\n    return true;\n  } catch { return null; }\n}\n\n// ---------------------------------------------------------------- modo headless\nfunction textOf(v) {\n  if (v.tag === \"#text\") return v.text;\n  return v.children.map(textOf).join(\"\");\n}\n\nexport function renderToText(v, depth = 0) {\n  if (v.tag === \"#text\") return \"  \".repeat(depth) + v.text;\n  const pad = \"  \".repeat(depth);\n  switch (v.tag) {\n    case \"page\": return [`${pad}== ${v.props.title ?? \"página\"} ==`, ...v.children.map((c) => renderToText(c, depth))].join(\"\\n\");\n    case \"heading\": return `${pad}# ${textOf(v)}`;\n    case \"text\": case \"item\": return `${pad}${textOf(v)}`;\n    case \"button\": return `${pad}[ ${textOf(v)} ]`;\n    case \"link\": return `${pad}${textOf(v)} (${v.props.href ?? \"#\"})`;\n    case \"badge\": return `${pad}[${textOf(v)}]`;\n    case \"progress\": return `${pad}${v.props.value ?? 0}/${v.props.max ?? 100}`;\n    case \"alert\": return `${pad}! ${textOf(v)}`;\n    case \"modal\": case \"dialog\": {\n      const open = v.props.open ?? v.props.hidden === false ?? true;\n      const title = v.props.title ?? textOf(v).slice(0, 40) ?? v.tag;\n      const head = `${pad}[${v.tag}${open === false ? \" (fechado)\" : \"\"}] ${title}`.trimEnd();\n      if (open === false) return head;\n      const body = v.children.map((c) => renderToText(c, depth + 1)).join(\"\\n\");\n      return body ? `${head}\\n${body}` : head;\n    }\n    case \"tabs\": return [`${pad}== abas ==`, ...v.children.map((c) => renderToText(c, depth + 1))].join(\"\\n\");\n    case \"tab\": return [`${pad}-- ${v.props.title ?? \"aba\"} --`, ...v.children.map((c) => renderToText(c, depth + 1))].join(\"\\n\");\n    case \"table\": return `${pad}[tabela ${v.children.length} linha(s)]`;\n    case \"icon\": return `${pad}<ícone ${textOf(v) || v.props.src || \"\"}>`.trimEnd();\n    case \"canvas\": return `${pad}<canvas>`;\n    case \"html\": return `${pad}${textOf(v)}${v.props?.raw ? String(v.props.raw).slice(0, 120) : \"\"}`.trimEnd();\n    case \"input\": case \"textarea\": case \"select\": { const val = v.props.bind?.get(); return `${pad}(${v.props.placeholder ?? (v.tag === \"select\" ? \"seleção\" : \"campo\")}) ${val ?? \"\"}`.trimEnd(); }\n    case \"checkbox\": case \"switch\": return `${pad}[${v.props.bind?.get() ? \"x\" : \" \"}] ${v.props.label ?? \"\"}`.trimEnd();\n    case \"image\": return `${pad}<imagem ${v.props.alt ?? \"\"}>`.trimEnd();\n    default: return v.children.map((c) => renderToText(c, depth + (CONTAINERS.has(v.tag) ? 1 : 0))).join(\"\\n\");\n  }\n}\n","runtime/web/styles.css":"/* Estilos base do runtime web da Vessie. Tema por variáveis CSS; claro/escuro automático. */\n:root {\n  --v-bg: #f6f7f9; --v-fg: #16181d; --v-card: #ffffff; --v-border: #d9dde3;\n  --v-accent: #4f46e5; --v-accent-fg: #ffffff; --v-muted: #5b6270;\n  color-scheme: light dark;\n}\n@media (prefers-color-scheme: dark) {\n  :root { --v-bg: #12141a; --v-fg: #eceef3; --v-card: #1b1e27; --v-border: #303543; --v-accent: #818cf8; --v-accent-fg: #0b0d12; --v-muted: #9aa3b5; }\n}\n[data-theme=\"light\"] { --v-bg: #f6f7f9; --v-fg: #16181d; --v-card: #ffffff; --v-border: #d9dde3; --v-accent: #4f46e5; --v-accent-fg: #ffffff; --v-muted: #5b6270; }\n[data-theme=\"dark\"] { --v-bg: #12141a; --v-fg: #eceef3; --v-card: #1b1e27; --v-border: #303543; --v-accent: #818cf8; --v-accent-fg: #0b0d12; --v-muted: #9aa3b5; }\n\n*, *::before, *::after { box-sizing: border-box; }\nhtml, body { margin: 0; min-height: 100%; }\nbody { font-family: system-ui, -apple-system, \"Segoe UI\", Roboto, sans-serif; background: var(--v-bg); color: var(--v-fg); line-height: 1.5; }\n\n.v-page { min-height: 100vh; padding: 24px; background: var(--v-bg); color: var(--v-fg); }\n.v-container, .v-column { display: flex; flex-direction: column; }\n.v-row { display: flex; flex-direction: row; align-items: center; }\n.v-grid { display: grid; gap: 12px; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); }\n.v-card { background: var(--v-card); border: 1px solid var(--v-border); border-radius: 12px; padding: 16px; display: flex; flex-direction: column; gap: 4px; }\n.v-list { margin: 0; padding-left: 1.2em; }\n.v-text, .v-heading { margin: 0; }\n.v-image { max-width: 100%; height: auto; }\n\n.v-button {\n  font: inherit; cursor: pointer; padding: 8px 16px; border-radius: 8px; border: 1px solid var(--v-accent);\n  background: var(--v-accent); color: var(--v-accent-fg); transition: filter .15s ease, transform .05s ease;\n}\n.v-button:hover { filter: brightness(1.08); }\n.v-button:active { transform: translateY(1px); }\n.v-button[data-variant=\"secondary\"] { background: transparent; color: var(--v-accent); }\n.v-button:disabled { opacity: .5; cursor: not-allowed; }\n.v-input, .v-textarea, .v-select { font: inherit; padding: 8px 10px; border-radius: 8px; border: 1px solid var(--v-border); background: var(--v-card); color: var(--v-fg); min-width: 0; }\n.v-checkbox, .v-switch { width: 1.2em; height: 1.2em; accent-color: var(--v-accent); }\n.v-link { color: var(--v-accent); text-underline-offset: .15em; }\n.v-badge { display: inline-block; width: fit-content; padding: 2px 8px; border-radius: 999px; background: color-mix(in srgb, var(--v-accent) 14%, transparent); color: var(--v-accent); font-size: .85em; font-weight: 600; }\n.v-divider { width: 100%; border: 0; border-top: 1px solid var(--v-border); margin: 8px 0; }\n.v-progress { width: 100%; height: 10px; accent-color: var(--v-accent); }\n.v-alert { padding: 12px 14px; border: 1px solid var(--v-border); border-left: 4px solid var(--v-accent); border-radius: 8px; background: var(--v-card); }\n.v-alert[data-variant=\"error\"] { border-left-color: #dc2626; }\n.v-alert[data-variant=\"success\"] { border-left-color: #16a34a; }\n.v-details { border: 1px solid var(--v-border); border-radius: 8px; padding: 8px 12px; }\n.v-summary { cursor: pointer; font-weight: 600; }\n.v-modal { background: var(--v-card); border: 1px solid var(--v-border); border-radius: 12px; padding: 16px; display: flex; flex-direction: column; gap: 8px; box-shadow: 0 12px 40px rgba(0,0,0,.25); max-width: min(560px, 100%); margin: 24px auto; }\n.v-modal[data-open=\"false\"] { display: none; }\n.v-dialog { border: 1px solid var(--v-border); border-radius: 12px; padding: 16px; background: var(--v-card); color: var(--v-fg); max-width: min(560px, 90vw); }\n.v-dialog::backdrop { background: rgba(0,0,0,.45); }\n.v-tabs { display: flex; flex-direction: column; gap: 8px; }\n.v-tab { border: 1px solid var(--v-border); border-radius: 8px; padding: 12px; background: var(--v-card); }\n.v-tab[data-open=\"false\"] { display: none; }\n.v-table { width: 100%; border-collapse: collapse; background: var(--v-card); }\n.v-icon { display: inline-block; font-size: 1.2em; line-height: 1; }\n.v-canvas { max-width: 100%; border: 1px solid var(--v-border); border-radius: 8px; }\n[hidden] { display: none !important; }\n\n:focus-visible { outline: 2px solid var(--v-accent); outline-offset: 2px; }\n@media (max-width: 640px) {\n  .v-page { padding: 16px; }\n  .v-row { flex-wrap: wrap; }\n  .v-grid { grid-template-columns: 1fr !important; }\n}\n@media (prefers-reduced-motion: reduce) { * { transition: none !important; animation: none !important; } }\n"};
const __EMBEDDED_DOCS__ = {"STATUS.md":"# Estado das funcionalidades\n\nLegenda: ✅ implementado e testado · 🟡 parcial · ⏳ pendente (não existe)\n\n## Fase 1 — Fundação\n- ✅ package.json, scripts reais, CLI, lexer, parser, AST, compilador, `npm run build` (verificado), testes\n## Fase 2 — Linguagem\n- ✅ variáveis (`let/const`), funções (inclui `async`), tipos e inferência, condicionais, laços, closures, diagnósticos com código/linha/coluna/trecho/dica\n- 🟡 source maps (nível de linha, não de expressão) · 🟡 tipos (sem genéricos, uniões nem opcionais)\n- ⏳ módulos `import/export`, enums, classes, tratamento de erros (`try/catch`), anotações, lockfile/pacotes\n## Fase 3 — Web e UI\n- ✅ runtime, HTML/CSS gerados, componentes (page, container, row, column, grid, card, list, item, text, heading, button, input, textarea, checkbox, switch, image, select, option, link, badge, divider, progress, alert, details, summary, modal, dialog, tabs, tab, table, icon, canvas), eventos, estado reativo profundo, computed, bind, patch de DOM, temas claro/escuro, responsivo básico, modo headless\n- ✅ abrir/fechar UI: `open:` reativo + comandos `ui.open/ui.close/ui.show/ui.hide/ui.toggle/ui.isVisible/ui.isOpen` por `id:`; CLI `vessie ui list` e `vessie open app.vessie` (abre no navegador; Ctrl+C fecha)\n- ✅ JavaScript direto + HTML próprio: blocos `css`/`js`/`html` (JS verbatim, `js.run/js.eval/js.get/js.set/js.on`, CSS injetado, markup reutilizável; ver `examples/ui-js.vessie`)\n- ⏳ Scene; animações/transições; `if/for` na UI; `watch`; code splitting/tree shaking; modo produção só omite source maps (sem minificação)\n## Biblioteca padrão\n- ✅ core (print/log/warn/error/assert/typeof/typeofValue/isNull/isDefined/range), math, string, array, object, json, date, storage, http, js (run/eval/get/set/on) e ui (open/show/close/hide/toggle/isVisible/isOpen) (ver `stdlib.md`)\n- ✅ adaptação C#: conversor `vessie cs convert` (tipos, Console, laços, métodos, coleções, interpolação, LINQ básico, Math) + `vessie cs run` (executa o original via .NET) + blocos `cs` (fonte guardada como string; ver `csharp.md`)\n- ⏳ `map/set`, `readFile/writeFile/resolvePath`, `websocket`, `worker`, `task.*` (dependem do modelo de permissões)\n## Sistemas próprios (novos)\n- ✅ adaptadores de execução (`vessie adapters`/`exec`: python, node, c, c++, c#) em processo-filho com timeout (ver `adapters.md`)\n- ✅ assistente de IA local com geração dupla p/ modelos pequenos (`vessie ai`, ver `ai.md`)\n- ✅ smart-web-search (`vessie websearch`, site+subsites mesma origem, ver `websearch.md`)\n- ✅ markdown próprio (`vessie markdown`), auditoria de acessibilidade (`vessie a11y`), SO (`vessie sys`: consumo/desempenho/processos)\n- ✅ otimizador de processos/jogos (`vessie optimize`): diagnóstico seguro e aplicação opcional de prioridade alta no Windows via Python, sempre com PID explícito\n## Fases 4–7 (todas pendentes)\n- ⏳ Engine 2D/3D (WebGL2/WebGPU) · ⏳ Vessie Adaptive Engine\n- ⏳ Integração LM Studio, agente de código remoto, geração de plugins\n- ✅ Adaptadores Python/C/C++/C# (`vessie adapters`/`exec`; o `vessie doctor` detecta as ferramentas)\n- ⏳ Servidor Node (`server { }`), sistema de extensões, pacotes, `vessie add/remove`, exemplos 3D/LM Studio/adaptadores/WASM\n\n## Testes\n`npm test` (48 testes: lexer, parser, semântica, geração/execução, runtime com DOM simulado, CLI, segurança).\n**Não verificado:** renderização em navegador real (não havia navegador no ambiente de desenvolvimento) e adaptadores/toolchains (inexistentes).\n","adapters.md":"# Adaptadores de execução\n\n`vessie adapters` lista os adaptadores; `vessie exec` executa código na linguagem indicada.\n\n```bash\nvessie adapters\nvessie exec --lang python --code \"print(40 + 2)\"\nvessie exec --lang node --code \"console.log('oi')\"\nvessie exec --lang c --code \"#include <stdio.h>\nint main(){printf(\\\"oi\\\\n\\\");}\"\nvessie exec --lang cpp prog.cpp\nvessie exec --lang csharp --code 'Console.WriteLine(\"oi\");' --timeout 30000\n```\n\n| Id | Aliases | Precisa de |\n|---|---|---|\n| `python` | `py` | `python3` ou `python` |\n| `node` | `js`, `javascript`, `nodejs` | Node.js (sempre disponível) |\n| `c` | — | `gcc` ou `cc` |\n| `cpp` | `c++`, `cxx` | `g++` ou `c++` |\n| `csharp` | `c#`, `cs`, `dotnet` | .NET SDK (`dotnet`) |\n\nLimites: trecho de até 256 KB, timeout padrão 15 s (máx. 120 s), sem shell e sem rede.\nCada execução cria seu **próprio processo-filho** temporário: o Vessie nunca injeta\ncódigo em processos de terceiros. Saída: stdout vai para stdout, stderr para stderr;\ncódigo de saída `1` em erro/timeout/falha de compilação.\n","ai.md":"# Assistente de IA local (geração dupla)\n\n`vessie ai` melhora pedidos para modelos de IA, inclusive **modelos pequenos sem\nraciocínio lógico**: tudo é local e determinístico (nenhuma rede, nenhuma chave).\n\n```bash\nvessie ai \"contador com botão\"              # pedido aprimorado + system prompt + exemplos\nvessie ai \"formulário de cadastro\" --system  # system + aprimorado (cole no modelo)\nvessie ai \"lista de tarefas\" --code          # só o .vessie gerado (compilável)\nvessie ai \"painel\" --code --out gen.vessie   # salva; depois: vessie check gen.vessie\nvessie ai --system                            # só a referência compacta da linguagem\n```\n\nGeração dupla:\n\n1. **Normalização** — limpa o pedido, detecta a intenção por padrões de palavras\n   (contador, formulário, lista, painel, botão, página) e reescreve um prompt\n   completo e direto, com restrições que cabem em modelo pequeno.\n2. **Conteúdos isolados** — gera exemplos `.vessie` pequenos e isolados (um por\n   conceito) e o **system prompt**, que é enviado **junto** com o prompt aprimorado.\n\nFluxo compilável por comando:\n\n```bash\nvessie ai \"contador com botão\" --code --out gen.vessie\nvessie check gen.vessie && vessie run --node gen.vessie\n```\n\nO exemplo da intenção é validado pelo próprio compilador antes de ser exibido.\n","cli.md":"# CLI `vessie`\n\nCódigos de saída: `0` ok · `1` erro de compilação/execução · `2` uso incorreto ou comando planejado.\n\n`init/create`, `build [--mode production] [--out dir] [--single]`, `compile`/`transpile [--out f.js] [--single]`, `check [--json] [--strict]`,\n`run [--port n] [--node]`, `open [--port n] [--no-browser]` (abre a UI no navegador; Ctrl+C fecha),\n`ui [list] [--json]` (componentes + comandos abrir/fechar), `dev`, `test` (arquivos `*.test.vessie`, use `assert`), `format [--check]`, `clean`, `doctor`, `adapters`,\n`exec --lang <id> (--code \"...\" | <arquivo>) [--timeout ms]`, `ai \"<pedido>\" [--code|--system|--json|--out f]`,\n`websearch <url> <termo> [--pages N] [--depth N] [--json|--out f]`, `markdown <arq.md> [--out f.html] [--text]`,\n`a11y <arq.vessie> [--json]`, `sys [info|procs] [--limit N] [--json]`,\n`cs convert <arq.cs> [--out f.vessie|--json]`, `cs run <arq.cs> [--timeout ms]`, `info`, `docs`.\nOpções globais: `-q` silencioso, `-v` verbose. **Planejados:** `add`, `remove` (pacotes).\n`dev` recompila ao salvar (sem recarga automática do navegador ainda).\n\n## Converter Vessie para JavaScript\n\n```bash\n# Gera um módulo JavaScript; informe sempre --out para salvar em arquivo\nvessie compile examples/catalogo.vessie --out dist/catalogo.js\n# Alias equivalente e fácil de memorizar\nvessie transpile examples/catalogo.vessie --out dist/catalogo.js\n# Um único JS, já com runtime e sem imports externos\nvessie compile examples/catalogo.vessie --single --out dist/catalogo.bundle.js\n# Aplicação web completa (HTML, CSS, runtime e JS)\nvessie build examples/catalogo.vessie --out dist/catalogo\n```\n\n## Otimizador de processos e jogos\n\n```bash\n# Só analisa o computador e sugere ajustes — não modifica nada\nvessie optimize\nvessie optimize --game steam\n# Lista processos para localizar o PID correto\nvessie sys procs --limit 100\n# Windows: aplica prioridade alta somente ao PID informado, usando Python padrão\nvessie optimize --pid 1234 --apply\n```\n\nO modo padrão é somente leitura. O modo `--apply` nunca encerra processos, não altera serviços nem arquivos e exige PID explícito. Alguns jogos/processos podem exigir um terminal aberto como administrador; o comando informa isso sem tentar contornar permissões.\n\nTambém é possível iniciar o mesmo recurso pelo Python: `python scripts\\vessie_optimizer.py audit`. Veja [optimizer.md](optimizer.md).\n","commands.md":"# Referência completa de comandos — CLI `vessie`\n\nTodos os comandos da CLI, com sintaxe, opções, exemplos e códigos de saída.\nNa pasta do projeto, troque `vessie` por `Vessie` (Windows, `Vessie.bat`):\no comando usa o `VessieLang.js` compilado e se gera sozinho se estiver ausente —\nsem `npm`, sem configuração.\nVeja também: `getting-started.md` (primeiros passos), `cli.md` (resumo),\n`adapters.md`, `ai.md`, `websearch.md`.\n\n## Convenções\n\n- Códigos de saída: `0` = ok · `1` = erro de compilação/execução ·\n  `2` = uso incorreto ou comando planejado (ex.: `add`, `remove`).\n- Opções globais (valem para todos os comandos):\n  `-q`/`--quiet` (silencioso), `-v`/`--verbose` (detalhes),\n  `--mode development|production`, `--out <dir|arquivo>`, `-h`/`--help`.\n- Ajuda rápida: `vessie --help` ou `vessie help`.\n\n## Projeto e compilação\n\n### `init [dir]` / `create <nome>`\n\nCria um projeto (`vessie.json` + `src/main.vessie` + `.gitignore`).\n\n```bash\nvessie init            # cria no diretório atual\nvessie init meu-app    # cria em ./meu-app\nvessie create meu-app  # igual a init, mas exige o nome\n```\n\n### `build [arquivo]`\n\nCompila para `dist/` (padrão): `index.html`, `js/`, `css/`, `runtime/`, `sourcemaps/`.\nSem argumento, usa o `entry` do `vessie.json` (se existir).\n\n```bash\nvessie build                        # usa vessie.json ou dist/\nvessie build src/main.vessie        # arquivo explícito\nvessie build --mode production      # sem source maps\nvessie build --out out              # outro diretório de saída\nvessie build --single               # UM .js autocontido (app.bundle.js) + index.html mínimo\nvessie build app.vessie --single --out dist1\n```\n\n### `compile <arquivo>`\n\nGera apenas o JavaScript (stdout, ou arquivo com `--out`).\n\n```bash\nvessie compile app.vessie                # imprime o JS no terminal\nvessie compile app.vessie --out app.js   # salva em app.js\nvessie compile app.vessie --single --out bundle.js   # bundle único, sem imports, auto-inicializa\n```\n\nO bundle `--single` inclui stdlib + runtime + CSS + código do app: basta\n`<script src=\"bundle.js\"></script>` ou `node bundle.js`.\n\n### `check [caminhos...]`\n\nSó diagnósticos (erros/avisos com arquivo, linha, coluna e dica), sem gerar arquivos.\nAceita arquivos ou diretórios (procura `*.vessie`, ignorando `node_modules`, `dist` e `.*`).\n\n```bash\nvessie check                    # verifica o projeto atual\nvessie check src/               # verifica um diretório\nvessie check a.vessie b.vessie\nvessie check --json             # saída JSON (para editores/ferramentas)\nvessie check --strict           # avisos também reprovam (saída 1)\n```\n\n### `run [arquivo]` / `open [arquivo]` / `dev [arquivo]` / `watch -- <comando...>`\n\n`run` compila e serve em `http://127.0.0.1:5173` (só localhost).\n`open` faz o mesmo e tenta abrir a UI no navegador (Ctrl+C fecha a UI).\n`ui list` mostra o conjunto de comandos abrir/fechar (`ui.open/ui.close/...`) e os componentes.\n`dev` faz o mesmo que `run` e recompila ao salvar (recarregue o navegador).\n`watch` é o gatilho genérico: executa uma vez e **reexecuta qualquer comando**\na cada mudança em `.vessie`/`vessie.json` (ignora `dist`, `node_modules` e ocultos).\n\n```bash\nvessie run app.vessie\nvessie open app.vessie              # abre no navegador; Ctrl+C fecha\nvessie open --port 8080 app.vessie\nvessie ui list                      # comandos ui.open/ui.close/...\nvessie ui list --json\nvessie run --port 8080 app.vessie\nvessie run --node app.vessie    # execução headless no terminal (sem servidor)\nvessie dev app.vessie\nvessie watch -- check src/              # revalida a cada save\nvessie watch -- run --node app.vessie   # reexecuta a cada save\nvessie watch --once -- test .           # executa uma vez e sai (propaga o código)\nvessie watch --debounce 500 -- build --single\n```\n\n### `test [caminhos...]`\n\nExecuta arquivos `*.test.vessie` (usam `assert`). Mostra `ok`/ `FALHOU` por arquivo\ne o placar final. Saída `1` se algum falhar.\n\n```bash\nvessie test\nvessie test tests/\nvessie test ok.test.vessie\n```\n\n### `format [caminhos...]`\n\nFormata arquivos `.vessie` (indentação, espaços, linhas em branco).\n\n```bash\nvessie format             # formata o projeto atual\nvessie format src/\nvessie format --check     # só verifica; saída 1 se algo precisa de formatação\n```\n\n### `clean [dir]`\n\nRemove a pasta de saída (padrão: `outDir` do `vessie.json`, ou `dist`).\nRecusa remover o diretório atual ou caminhos fora do projeto.\n\n```bash\nvessie clean\nvessie clean out\n```\n\n## Diagnóstico e ambiente\n\n### `doctor`\n\nVerifica Node (obrigatório, >= 20), Python, compiladores C/C++, .NET e CMake.\nA detecção alimenta `adapters`/`exec`. Saída `1` só se o Node for insuficiente.\n\n```bash\nvessie doctor\n```\n\n### `adapters`\n\nLista os adaptadores de execução com disponibilidade e versão detectada.\nDetalhes em `adapters.md`.\n\n```bash\nvessie adapters\nvessie adapters --json\n```\n\n### `info` / `docs`\n\n```bash\nvessie info    # versão, Node, resumo do que está implementado/planejado\nvessie docs    # lista os arquivos de docs/\n```\n\n## Execução multilinguagem (`exec`)\n\nExecuta código Python, Node.js, C, C++ ou C# em processo-filho próprio, com timeout.\nDetalhes e limites em `adapters.md`.\n\n```bash\nvessie exec --lang python --code \"print(6 * 7)\"\nvessie exec --lang node --code \"console.log('oi')\"\nvessie exec --lang node script.mjs        # executa um arquivo\nvessie exec --lang c prog.c\nvessie exec --lang cpp --code \"#include <iostream>\nint main(){std::cout << 42;}\"\nvessie exec --lang csharp --code 'Console.WriteLine(\"oi\");' --timeout 90000\n```\n\n- `--lang` aceita aliases: `py`, `js`/`javascript`/`nodejs`, `c++`/`cxx`, `c#`/`cs`/`dotnet`.\n- `--timeout` em ms (padrão 15000, máx. 120000); limite de 256 KB por trecho.\n- stdout vai para stdout, stderr para stderr; saída `1` em erro, timeout ou falha de compilação.\n\n## Adaptação C# → Vessie (`cs`)\n\nConverte C# estilo console para `.vessie` ou executa o original via .NET.\nDetalhes e tabela de conversão em `csharp.md`.\n\n```bash\nvessie cs convert programa.cs --out programa.vessie\nvessie cs convert programa.cs                    # imprime no terminal\nvessie cs convert programa.cs --json             # código + avisos + se compilou\nvessie cs run programa.cs                        # executa via dotnet [--timeout ms]\nvessie cs run programa.cs --timeout 30000\n```\n\n- Avisos de adaptação vão para stderr com a linha (`// [cs]` no código).\n- Se o resultado não compilar, o comando avisa e sai com código `1`.\n- Blocos `cs nome = `...`` guardam fonte C# dentro do `.vessie` (string).\n\n## Assistente de IA (`ai`)\n\nMelhora pedidos para modelos de IA, inclusive modelos pequenos: geração dupla\n(pedido aprimorado + system prompt com exemplos isolados). Detalhes em `ai.md`.\n\n```bash\nvessie ai \"contador com botão\"                    # visão completa no terminal\nvessie ai \"formulário de cadastro\" --system       # system prompt + pedido (cole no modelo)\nvessie ai \"lista de tarefas\" --code               # só o .vessie gerado\nvessie ai \"painel\" --code --out gen.vessie        # salva para compilar depois\nvessie ai \"x\" --json                              # resultado estruturado\nvessie ai --system                                # só a referência compacta da linguagem\n```\n\nFluxo compilável por comando:\n\n```bash\nvessie ai \"contador com botão\" --code --out gen.vessie\nvessie check gen.vessie && vessie run --node gen.vessie\n```\n\n## Pesquisa web (`websearch`)\n\nVarre um site + subsites de mesma origem, filtra pelo termo e gera um prompt\ncom textos, elementos e scripts. Detalhes em `websearch.md`.\n\n```bash\nvessie websearch https://exemplo.com botao\nvessie websearch https://exemplo.com preço --pages 8 --depth 1\nvessie websearch http://127.0.0.1:8080 menu --json\nvessie websearch https://exemplo.com menu --out resumo.md\n```\n\n## Markdown próprio (`markdown`)\n\nRenderiza o subconjunto Markdown do Vessie (títulos, ênfase, código, listas,\nlinks, imagens, citações, tabelas, blocos de código) com escape de HTML.\n\n```bash\nvessie markdown doc.md                 # HTML no terminal\nvessie markdown doc.md --out doc.html  # salva em arquivo\nvessie markdown doc.md --text          # texto puro (para terminal)\n```\n\n## Acessibilidade (`a11y`)\n\nAudita a UI: botão sem texto, imagem sem `alt`, campo sem rótulo, page sem\ntítulo, saltos de nível de heading. Saída `1` se houver problemas.\n\n```bash\nvessie a11y app.vessie\nvessie a11y src/ --json\n```\n\n## Sistema operacional (`sys`)\n\nSomente leitura: consumo, desempenho e processos.\n\n```bash\nvessie sys             # = sys info: SO, CPU, memória, carga, uptime\nvessie sys info\nvessie sys procs       # processos (pid + nome)\nvessie sys procs --limit 20\nvessie sys info --json\n```\n\n## Comandos planejados\n\n`add` e `remove` (gerenciador de pacotes, Fase 7) retornam saída `2` com aviso.\n\n## `VessieLang.js` — o sistema inteiro em um arquivo\n\n`VessieLang.js` (na raiz do projeto) é o compilador Vessie completo em **um único\narquivo**: todos os módulos de `src/` + CLI, com stdlib, runtime web, CSS base e\n`docs/*.md` embutidos. Substitui o sistema (pasta `src/` + `bin/`) para compilar\n`.vessie` em qualquer lugar — só precisa de Node.js >= 20. Regenerado com:\n\n```bash\nnpm run bundle                        # gera VessieLang.js\nnode scripts/bundle-self.js --out outro-nome.js\n```\n\n**Comando `Vessie` (Windows, sem npm):** o `Vessie.bat` da raiz executa\n`VessieLang.js` e o gera sozinho a partir de `src/` se estiver ausente.\nBasta digitar (na pasta do projeto):\n\n```cmd\nVessie compile app.vessie\nVessie check exemplos/\nVessie build app.vessie --single --out dist/\nVessie run --node app.vessie\nVessie watch -- check src/\n```\n\nUso como CLI (mesmos comandos e saídas do `vessie`):\n\n```bash\nnode VessieLang.js compile app.vessie\nnode VessieLang.js check exemplos/\nnode VessieLang.js build app.vessie --single --out dist/\nnode VessieLang.js run --node app.vessie\nnode VessieLang.js docs                # lista a documentação embutida\n```\n\nUso como API (importação ES, sem executar a CLI):\n\n```js\nimport { compile, buildWeb, main, VERSION } from \"./VessieLang.js\";\n\nconst r = compile(srcVessie, { file: \"app.vessie\", sourceMap: false });\nif (!r.ok) console.error(r.diagnostics);\n```\n\nAPI exportada: `main`, `compile`, `compileOrThrow`, `parse`, `tokenize`, `VERSION`,\n`buildWeb`, `buildWebSingle`, `buildSingleBundle`, `singleBundleHtml`,\n`createRuntimeBundle`, `baseCss`, `formatDiagnostics`, `createStaticServer`,\n`resolveInside`. O `npm run bundle` já valida o arquivo gerado (sintaxe +\ncomparação de saídas com o sistema + `build --single` fora da árvore).\n","compiler.md":"# Compilador\n\n```\n.vessie → Lexer → Parser → AST → Semântica/Tipos → Backend JS (+ source map) → Web (HTML/CSS/JS + runtime)\n```\n\n| Etapa | Arquivo | Notas |\n|---|---|---|\n| Lexer | `src/compiler/lexer/lexer.js` | nunca lança; erros com linha/coluna; templates com interpolação |\n| Parser | `src/compiler/parser/parser.js` | descendente recursivo + precedência; recuperação de erros por linha |\n| AST | `src/compiler/ast/index.js` | nós simples `{type, loc, ...}`, `walk()` |\n| Semântica | `src/compiler/semantic/analyzer.js` | escopos, tipos, aridade, UI (componentes/props/eventos/bind), avisos |\n| Tipos | `src/compiler/types/types.js` | number/string/boolean/void/null/any/objeto/lista/fn |\n| Backend JS | `src/compiler/backends/js.js` | módulo ES; source map v3 de **nível de linha** |\n| Backend web | `src/compiler/backends/web.js` | `dist/`: html, js, css, runtime, sourcemaps; CSP restritiva |\n\nDecisão: **sem IR separada** por enquanto (a AST anotada vai direto ao backend); será introduzida quando houver mais de um backend (WASM/Node).\nA biblioteca padrão é declarada em `src/stdlib/signatures.js` (compilador) e implementada em `src/stdlib/index.js` (runtime); o build verifica que ambas coincidem.\n","components.md":"# Componentes de UI (gerado por `npm run docs`)\n\nPropriedades comuns: `id`, `class`, `style`, `hidden`, `label`, `role`, `width`, `height`, `padding`, `margin`, `gap`, `background`, `border`, `radius`, `shadow`, `font`, `color`, `align`, `justify`, `position`, `opacity`\n\n| Componente | Args | Filhos | Props extras | Eventos | bind |\n|---|---|---|---|---|---|\n| page | text | sim | title, theme | - | - |\n| container | none | sim | - | click | - |\n| row | none | sim | wrap | click | - |\n| column | none | sim | - | click | - |\n| grid | none | sim | columns | click | - |\n| card | none | sim | - | click | - |\n| list | none | sim | - | - | - |\n| item | text | sim | - | click | - |\n| text | text | não | - | click | read |\n| heading | text | não | level | click | read |\n| button | text | não | disabled, variant, type | click | - |\n| input | none | não | placeholder, type, disabled, name | input, change, focus, blur, keydown | write |\n| textarea | none | não | placeholder, rows, disabled, name | input, change, focus, blur, keydown | write |\n| checkbox | none | não | disabled, name | change | write |\n| switch | none | não | disabled, name | change | write |\n| image | none | não | src, alt, fit | click | - |\n| html | text | não | raw | click | - |\n| select | none | sim | disabled, name, multiple | change, focus, blur | write |\n| option | text | não | value, disabled | - | - |\n| link | text | não | href, target, rel | click | - |\n| badge | text | não | variant | click | read |\n| divider | none | não | - | - | - |\n| progress | none | não | value, max | - | - |\n| alert | text | sim | variant | click | - |\n| details | none | sim | open | toggle | - |\n| summary | text | não | - | click | - |\n| modal | text | sim | title, open | click, close | - |\n| dialog | text | sim | title, open | click, close | - |\n| tabs | none | sim | - | click | - |\n| tab | text | sim | title, open | click | - |\n| table | none | sim | columns | click | - |\n| icon | text | não | src | click | - |\n| canvas | none | não | src | click | - |\n\nPlanejados (ainda não implementados): scene, app\n","csharp.md":"# Adaptação C# → Vessie\n\nEscreva C# (estilo console) e traga para a Vessie de dois jeitos:\n\n```bash\nvessie cs convert programa.cs --out programa.vessie   # adapta C# para .vessie\nvessie cs convert programa.cs                         # imprime no terminal\nvessie cs run programa.cs                             # executa o C# original via .NET\n```\n\nFluxo típico:\n\n```bash\nvessie cs convert examples/fib.cs --out fib.vessie\nvessie check fib.vessie && vessie run --node fib.vessie\n```\n\n## O que é convertido\n\n| C# | Vessie |\n|---|---|\n| `class Nome` | `app Nome` |\n| `static void Main()` | `fn main()` |\n| `int/n, double/d, string/s, bool/b, char/c` | `let n: number`, `let s: string`, ... (`var` sem anotação) |\n| `const` | `const` |\n| `Console.WriteLine(x)` | `print(x)` |\n| `for (int i = 0; i < n; i++)` | `for i in range(n)` |\n| `foreach (var x in xs)` | `for x in xs` |\n| `while`, `if/else`, `return`, `break`, `continue` | iguais |\n| `static int Soma(int a, int b)` | `fn Soma(a: number, b: number) -> number` |\n| `new List<int> { 1, 2 }`, `new int[] {...}` | `[1, 2]` |\n| `$\"Olá, {nome}\"`, `@\"C:\\x\"`, `'a'` | `` `Olá, ${nome}` ``, `\"C:\\\\x\"`, `\"a\"` |\n| `Math.Sqrt/Pow/Abs/Max/Min/PI` | `math.sqrt/pow/abs/max/min/PI` |\n| `.Length`/`.Count` | `.length` |\n| `.Where/.Select/.Any/.Count()/.Sum()/.Contains()` etc. | `array.filter/map/...` |\n| `xs.Add(x)` | `array.push(xs, x)` |\n| `string.Join(sep, arr)` | `array.join(arr, sep)` |\n| `string.IsNullOrEmpty(s)` | `(isNull(s) \\|\\| s == \"\")` |\n| `x.ToString()` | `` `${x}` `` |\n| `int.Parse(s)` | `` js.run(`Number(s)`) `` (com aviso) |\n| `throw ...` | `assert(false, ...)` |\n\nTodo o resto vira comentário `// [cs]` + aviso com a linha\n(`switch`, `try/catch`, `using (...)`, `ReadLine`, interfaces, enums,\nproperties, genéricos, atributos). O comando mostra os avisos no stderr e\ndiz se o resultado compilou; se não compilou, a saída é `1`.\n\n## Blocos `cs` (fonte C# dentro do `.vessie`)\n\n```vessie\ncs original = `Console.WriteLine(\"oi\");`\n\nfn main() {\n  print(original) // string com o C# guardado ($cs[\"original\"])\n}\n```\n\nO bloco guarda o fonte original como string (igual aos blocos `html`).\nConverta depois com `vessie cs convert`. Veja `examples/from-csharp.vessie`\n(gerado de `examples/fib.cs`).\n\n## Executar o C# original\n\n`vessie cs run programa.cs` é um atalho para `vessie exec --lang csharp`:\ncria um projeto console temporário com o .NET SDK e executa em processo-filho\ncom timeout (`--timeout ms`). Precisa do `dotnet` instalado (`vessie doctor`).\n","diagnostics.md":"# Códigos de diagnóstico (gerado por `npm run docs`)\n\n| Código | Descrição |\n|---|---|\n| VESSIE-0001 | Caractere inválido |\n| VESSIE-0002 | String não finalizada |\n| VESSIE-0003 | Template string não finalizado |\n| VESSIE-0004 | Comentário de bloco não finalizado |\n| VESSIE-0005 | Número inválido |\n| VESSIE-1001 | Token inesperado |\n| VESSIE-1002 | Expressão esperada |\n| VESSIE-1003 | Declaração app duplicada ou fora de lugar |\n| VESSIE-1004 | Alvo de atribuição inválido |\n| VESSIE-1005 | Tipo inválido |\n| VESSIE-1901 | Recurso planejado, ainda não implementado |\n| VESSIE-2001 | Identificador não declarado |\n| VESSIE-2002 | Identificador já declarado neste escopo |\n| VESSIE-2003 | Atribuição a valor imutável |\n| VESSIE-2004 | Tipos incompatíveis |\n| VESSIE-2005 | Número incorreto de argumentos |\n| VESSIE-2006 | Tipo de retorno incompatível |\n| VESSIE-2007 | Componente de UI desconhecido ou planejado |\n| VESSIE-2008 | Propriedade desconhecida para o componente |\n| VESSIE-2009 | Evento desconhecido para o componente |\n| VESSIE-2010 | Valor não é uma função |\n| VESSIE-2011 | return fora de função |\n| VESSIE-2012 | break/continue fora de laço |\n| VESSIE-2013 | Alvo de bind inválido |\n| VESSIE-2014 | Manipulador de evento inválido |\n| VESSIE-2015 | UI sem elemento raiz page |\n| VESSIE-2016 | Membro inexistente na biblioteca padrão |\n| VESSIE-4001 | Variável declarada e nunca usada |\n| VESSIE-4002 | Programa sem declaração app |\n| VESSIE-9001 | Erro interno do compilador |\n","getting-started.md":"# Primeiros passos\n\nRequisitos: Node.js >= 20. Nenhuma dependência npm é necessária.\n\n```bash\nnpm run build\nnode bin/vessie.js create meu-app && cd meu-app\nnode ../bin/vessie.js run          # http://127.0.0.1:5173\n```\n\nComandos úteis: `check` (diagnósticos), `compile arquivo.vessie` (JS no stdout), `build`, `format`, `test`, `doctor`.\n\nUm projeto tem `vessie.json` (`name`, `entry`, `outDir`) e `src/main.vessie`. A saída de `build` é `dist/` com\n`index.html`, `js/app.js`, `css/vessie.css`, `runtime/vessie-runtime.js` e `sourcemaps/`.\n","optimizer.md":"# Otimizador de processos e jogos\n\nO otimizador é um recurso da Vessie executado por `VessieLang.js`. Ele analisa CPU, memória e processos conhecidos de jogos. O modo padrão é somente leitura: não encerra processos, não modifica serviços e não toca em arquivos.\n\n```bat\nVessie optimize\nVessie optimize --game steam\nVessie sys procs --limit 100\n```\n\nNo Windows, a alteração de prioridade é opcional, exige PID explícito e usa o Python padrão como adaptador controlado pela Vessie:\n\n```bat\nVessie optimize --pid 1234 --apply\n```\n\n## Executar pelo Python\n\nO lançador [vessie_optimizer.py](../scripts/vessie_optimizer.py) chama exclusivamente o `VessieLang.js` do projeto — não duplica regras de otimização.\n\n```bat\npython scripts\\vessie_optimizer.py audit\npython scripts\\vessie_optimizer.py audit --game steam --json\npython scripts\\vessie_optimizer.py apply --pid 1234\n```\n\nEle usa uma lista de argumentos, sem shell; por isso, o nome de um jogo não é interpretado como comando do sistema. Para apontar para outro bundle, use `--vessie C:\\caminho\\VessieLang.js`.\n\n## Linguagens compatíveis\n\nO núcleo da Vessie compila `.vessie` para JavaScript. Para executar código externo, use os adaptadores já disponíveis:\n\n```bat\nVessie adapters\nVessie exec --lang python --code \"print(42)\"\nVessie exec --lang node --code \"console.log(42)\"\nVessie exec --lang c --code \"#include <stdio.h>\\nint main(){ puts(\\\"ok\\\"); }\"\n```\n\nAtualmente há adaptadores para Python, JavaScript/Node, C, C++ e C#. Não é possível executar literalmente todas as linguagens sem instalar seu compilador/interpretador e criar um adaptador específico; isso mantém a Vessie previsível e segura.\n","security.md":"# Segurança (estado atual)\n\nImplementado e testado:\n- `resolveInside()` bloqueia path traversal em `--out`, `clean`, `vessie.json` e no servidor estático (403/404 para `..`, `%2e%2e`, `..%2f`).\n- `clean` recusa remover o diretório atual ou qualquer coisa fora do projeto.\n- Servidor de `run/dev` escuta apenas em `127.0.0.1` e envia `X-Content-Type-Options: nosniff`.\n- Páginas geradas têm CSP (`default-src 'self'`, `object-src 'none'`); textos são inseridos como nós de texto (sem `innerHTML`); URLs de `src` e `href` bloqueiam `javascript:`.\n- O compilador nunca executa código externo; `vessie run --node`/`test` só executam o `.vessie` que você indicou, em processo próprio do CLI.\n\n**Atenção à rede:** `http.get`, `http.getJson` e `http.postJson` usam `fetch` do ambiente. No build web, a CSP padrão permite conexões apenas à mesma origem; serviços externos exigem que você ajuste a política de segurança do app conscientemente. Ainda não há permissões de arquivo, sandbox geral de processos ou agente de IA remoto.\nImportante: `run --node` executa o programa com os privilégios do seu usuário; não rode `.vessie` de origem não confiável.\nExecução de terceiros (`vessie exec`, adaptador C# etc.): cada comando cria seu próprio processo-filho temporário com timeout e sem shell; o Vessie **não** injeta código em processos de outros aplicativos nem executa nada sem o seu comando explícito.\n`vessie websearch` só lê páginas `http/https` de mesma origem, com limites de páginas/bytes/timeout, e nunca executa o JavaScript das páginas.\n","stdlib.md":"# Biblioteca padrão (gerado por `npm run docs`)\n\nNão edite à mão: altere `src/stdlib/signatures.js`.\n\n## Globais\n\n- `print(any, ...) -> void` — Escreve valores na saída padrão.\n- `log(any, ...) -> void` — Registra informação (nível log).\n- `warn(any, ...) -> void` — Registra um aviso.\n- `error(any, ...) -> void` — Registra um erro.\n- `assert(boolean, string?) -> void` — Lança erro se a condição for falsa.\n- `typeof(any) -> string` — Nome do tipo em tempo de execução (number, string, array, ...).\n- `typeofValue(any) -> string` — Alias de typeof.\n- `isNull(any) -> boolean` — true para null ou indefinido.\n- `isDefined(any) -> boolean` — true se o valor não é null nem indefinido.\n- `range(number, number?) -> number[]` — range(fim) ou range(início, fim): lista de inteiros [início, fim).\n\n## math\n\n- `math.PI: number` — Constante π.\n- `math.abs(number) -> number`\n- `math.floor(number) -> number`\n- `math.ceil(number) -> number`\n- `math.round(number) -> number`\n- `math.sqrt(number) -> number`\n- `math.pow(number, number) -> number`\n- `math.clamp(number, number, number) -> number` — clamp(valor, mínimo, máximo).\n- `math.lerp(number, number, number) -> number` — lerp(a, b, t) = a + (b - a) * t.\n- `math.random() -> number` — Número pseudoaleatório em [0, 1).\n- `math.randomInt(number, number) -> number` — Inteiro aleatório inclusivo entre mínimo e máximo.\n- `math.sign(number) -> number`\n- `math.modulo(number, number) -> number` — Resto sempre positivo para divisor positivo.\n- `math.radians(number) -> number`\n- `math.degrees(number) -> number`\n- `math.min(number, ...) -> number`\n- `math.max(number, ...) -> number`\n\n## string\n\n- `string.length(string) -> number`\n- `string.upper(string) -> string`\n- `string.lower(string) -> string`\n- `string.trim(string) -> string`\n- `string.split(string, string) -> string[]`\n- `string.replace(string, string, string) -> string` — Substitui todas as ocorrências (texto literal, sem regex).\n- `string.includes(string, string) -> boolean`\n- `string.startsWith(string, string) -> boolean`\n- `string.endsWith(string, string) -> boolean`\n- `string.repeat(string, number) -> string`\n- `string.chars(string) -> string[]`\n- `string.format(string, any, ...) -> string` — Substitui \"{0}\", \"{1}\"... pelos argumentos.\n\n## array\n\n- `array.length(any[]) -> number`\n- `array.map(any[], fn) -> any[]`\n- `array.filter(any[], fn) -> any[]`\n- `array.reduce(any[], fn, any?) -> any`\n- `array.find(any[], fn) -> any`\n- `array.sort(any[], fn?) -> any[]` — Retorna uma cópia ordenada (não altera a original).\n- `array.forEach(any[], fn) -> void`\n- `array.includes(any[], any) -> boolean`\n- `array.push(any[], any) -> number`\n- `array.join(any[], string?) -> string`\n- `array.first(any[]) -> any`\n- `array.last(any[]) -> any`\n- `array.reverse(any[]) -> any[]`\n- `array.slice(any[], number, number?) -> any[]`\n- `array.concat(any[], any[]) -> any[]`\n- `array.unique(any[]) -> any[]`\n- `array.remove(any[], any) -> boolean` — Remove a primeira ocorrência da lista e informa se encontrou.\n\n## object\n\n- `object.keys(object) -> string[]`\n- `object.values(object) -> any[]`\n- `object.has(object, string) -> boolean`\n\n## json\n\n- `json.parse(string) -> any`\n- `json.stringify(any) -> string`\n\n## date\n\n- `date.now() -> number` — Timestamp atual em milissegundos.\n- `date.iso() -> string` — Data/hora atual em ISO 8601.\n- `date.format(number, string?) -> string` — Formata um timestamp usando Intl.DateTimeFormat.\n\n## storage\n\n- `storage.get(string, any?) -> any` — Lê localStorage; usa fallback quando indisponível ou ausente.\n- `storage.set(string, any) -> boolean`\n- `storage.remove(string) -> boolean`\n- `storage.clear() -> boolean`\n\n## http\n\n- `http.get(string) -> any` — GET assíncrono; use await http.get(url).\n- `http.getJson(string) -> any` — GET JSON assíncrono; use await http.getJson(url).\n- `http.postJson(string, any) -> any` — POST JSON assíncrono; use await http.postJson(url, dados).\n\n## js\n\n- `js.run(string) -> any` — Executa código JavaScript arbitrário e retorna o resultado.\n- `js.eval(string) -> any` — Alias de js.run: avalia JavaScript puro (expressão ou bloco).\n- `js.get(string) -> any` — Lê um global JS por caminho, ex.: js.get(\"document.title\").\n- `js.set(string, any) -> any` — Escreve um global JS por caminho, ex.: js.set(\"document.title\", \"Oi\").\n- `js.on(string, fn) -> boolean` — Registra um listener global (window.addEventListener) quando disponível.\n\n## ui\n\n- `ui.show(string) -> boolean` — Mostra um elemento/modal pelo id: ui.show(\"ajuda\").\n- `ui.open(string) -> boolean` — Abre um modal/dialog pelo id: ui.open(\"ajuda\").\n- `ui.hide(string) -> boolean` — Esconde um elemento/modal pelo id: ui.hide(\"ajuda\").\n- `ui.close(string) -> boolean` — Fecha um modal/dialog pelo id: ui.close(\"ajuda\").\n- `ui.toggle(string) -> boolean` — Alterna visível/oculto pelo id: ui.toggle(\"menu\").\n- `ui.isVisible(string) -> any` — true/false se visível/oculto, null se o id não existe.\n- `ui.isOpen(string) -> any` — Alias de ui.isVisible.\n","syntax.md":"# Sintaxe da Vessie (implementada)\n\nInstruções terminam em quebra de linha ou `;`. Comentários: `// linha` e `/* bloco */`.\n\n## Declarações\n| Forma | Significado |\n|---|---|\n| `app Nome` | nome da aplicação (uma vez, no início) |\n| `const x = 1` / `let y: number = 2` | imutável / mutável (tipo opcional) |\n| `state s: string = \"\"` | estado reativo (só nível superior); mudanças re-renderizam a UI |\n| `computed d = s * 2` | valor derivado, recalculado a cada render |\n| `fn nome(a: number, b) -> number { ... }` / `async fn` | funções |\n| `ui App { page \"Título\" { ... } }` | interface declarativa |\n| `cs nome = `...`` | fonte C# guardada como string (adapte com `vessie cs convert`) |\n\n## Tipos\n`number`, `string`, `boolean`, `any`, `void`, listas `T[]`. Tipagem gradual: `any` é compatível com tudo;\nsem anotação o tipo é inferido do valor inicial (e o retorno de `fn` é inferido do corpo).\n\n## Instruções e expressões\n`if / else if / else`, `while`, `for x in lista`, `break`, `continue`, `return`; atribuições `= += -= *= /= %=`.\nExpressões: números, strings (`\"...\"`, `'...'`), templates `` `x ${expr}` ``, `true/false/null`, listas `[..]`,\nobjetos `{a: 1}`, membros `a.b`, índices `a[0]`, chamadas, `! - +`, `* / %`, `+ -`, `< > <= >=`, `== !=` (compilam para `===`/`!==`),\n`&& || ??`, ternário `c ? a : b`, funções anônimas `(a, b) => a + b`, `await`.\n`ui` também é um namespace chamável (`ui.open(\"id\")`, `ui.close(\"id\")`, ...); só é declaração (`ui Nome { ... }`)\nno nível superior seguido de nome + `{`.\n\n## Limites conhecidos\n- Em `ui`, elementos são separados por **quebra de linha ou `;`** (não coloque dois elementos na mesma linha sem `;`).\n- Condições (`if`, `while`, `?:`) exigem `boolean` (ou `any`).\n- Sem análise de fluxo: não verifica se todos os caminhos de uma função retornam valor.\n- `import/export`, `enum`, `class`, `match`, `watch`, `scene`, `server` são reservados: geram `VESSIE-1901`.\n","ui.md":"# UI declarativa\n\n```vessie\nui App {\n  page \"Título\" theme: \"dark\" {\n    column gap: 16 {\n      heading \"Olá\" level: 1\n      input bind:nome placeholder: \"Nome\" label: \"Nome\"\n      button \"Enviar\" on:click enviar\n      button \"-1\" on:click () => count -= 1\n      text bind:performance.fps\n    }\n  }\n}\n```\n\nForma de um elemento: `tag [argumento] [prop: valor]... [on:evento handler] [bind:alvo] [{ filhos }]`.\nPropriedades também podem ficar em linhas próprias dentro do bloco. Veja `components.md` (gerado) para a tabela completa.\n\n- **Reatividade:** estado profundo (objetos/listas). Mutações são agrupadas por microtask e o DOM é atualizado por *patch* incremental (nós reutilizados).\n- **Bind:** `input/textarea/select` (string) e `checkbox/switch` (boolean) são bidirecionais e exigem um `state`; `text/heading/badge` apenas leem.\n- **Estilo:** `width height padding margin gap background border radius shadow font color align justify position opacity` (números viram `px`).\n- **Temas/Responsivo:** variáveis CSS, claro/escuro automático (`prefers-color-scheme`), `theme: \"dark\"|\"light\"` na page, quebra de layout abaixo de 640 px.\n- **Acessibilidade:** elementos semânticos (`main`, `button`, `h1..h6`, `ul/li`), `label:` → `aria-label`, foco visível, `prefers-reduced-motion`.\n- **Seleção:** use `select bind:estado { option \"Rótulo\" value: \"valor\" }`. Os elementos `option` ficam dentro do `select`.\n- **Conteúdo adicional:** `link`, `badge`, `divider`, `progress`, `alert`, `details` e `summary` já estão disponíveis. Veja [catalogo.vessie](../examples/catalogo.vessie).\n- **Janelas que abrem/fecham:** `modal`, `dialog`, `tabs`/`tab`, `table`, `icon`, `canvas`.\n  Use `open: true/false` (reativo, via `state`) ou os comandos `ui.open/ui.close/ui.show/ui.hide/ui.toggle/ui.isVisible` com `id:`.\n  CLI: `vessie ui list` mostra o conjunto de comandos; `vessie open app.vessie` abre a UI no navegador (Ctrl+C fecha).\n- **Ainda não existem:** `scene`, `if/for` dentro de `ui`, animações/transições, navegação entre pages.\n\n```vessie\nstate mostrar: boolean = false\nfn abrir() { ui.open(\"ajuda\") }\nfn fechar() { ui.close(\"ajuda\") }\n\nui App {\n  page \"Demo\" {\n    column gap: 8 {\n      button \"Abrir\" on:click abrir\n      modal id: \"ajuda\" title: \"Ajuda\" open: mostrar {\n        text \"Conteúdo do modal.\"\n        button \"Fechar\" on:click fechar\n      }\n    }\n  }\n}\n```\n\n## JavaScript direto + HTML próprio (css + js + html)\n\nA Vessie é compatível com JavaScript puro e gera um HTML próprio (CSS+JS embutidos):\n\n```vessie\ncss main = `.destaque { border: 2px dashed #4f46e5; padding: 10px; }`\njs util = `globalThis.dobro = (n) => n * 2`\nhtml cartao = `<strong>HTML próprio:</strong> markup cru reutilizável.`\n\nstate n: number = 21\nui App {\n  page \"JS\" {\n    column gap: 8 {\n      text `Dobro via JS: ${js.get(\"dobro\")(n)}`\n      text `Avaliado na hora: ${js.run(\"6 * 7\")}`\n      html cartao\n    }\n  }\n}\n```\n\n- Bloco `js nome = `...``: executa verbatim no bundle final (mesmo escopo do app).\n  Exponha funções em `globalThis` e chame com `js.get(\"nome\")(...)`; trechos autocontidos usam `js.run/js.eval`; `js.get/js.set/js.on` acessam globals, DOM e eventos.\n- Bloco `css nome = `...`` ou `css nome { rule \"seletor\" { prop: valor } }`: injetado uma vez via `injectCss`.\n- Bloco `html nome = `...``: string reutilizável (`$html[\"nome\"]`); componente `html` com `raw:` injeta markup (use só com conteúdo confiável).\n- Veja `examples/ui-js.vessie` (modal abrir/fechar + JS + HTML próprio) e `vessie ui list`.\n","websearch.md":"# Smart-Web-Search\n\n`vessie websearch <url> <termo>` varre o site inicial e os **subsites** (links de\n**mesma origem**) até o limite, filtra por padrões de palavras do termo e gera um\nprompt/markdown com textos, elementos e scripts encontrados.\n\n```bash\nvessie websearch https://exemplo.com botao --pages 8 --depth 1\nvessie websearch http://127.0.0.1:8080 preço --json\nvessie websearch https://exemplo.com menu --out resumo.md\n```\n\nO que é coletado por página: título, texto, cabeçalhos, elementos (`button`,\n`input`, `img` com texto/atributos) e scripts (`src` + tamanho do inline, sem\nexecutar nada). Páginas são pontuadas pelos acertos do termo; só as relevantes\nentram no prompt.\n\nLimites: só `http/https`, mesma origem do URL inicial, 8 páginas / profundidade 1\npor padrão, 512 KB por página, 10 s por requisição, sem executar JavaScript.\n"};

/* ===== src\diagnostics\index.js ===== */
// Diagnósticos da Vessie: códigos, severidade, formatação com trecho de código.

const Severity = Object.freeze({ ERROR: "error", WARNING: "warning", INFO: "info" });

/** Catálogo de códigos (usado também para gerar docs/diagnostics.md). */
const CODES = Object.freeze({
  "VESSIE-0001": "Caractere inválido",
  "VESSIE-0002": "String não finalizada",
  "VESSIE-0003": "Template string não finalizado",
  "VESSIE-0004": "Comentário de bloco não finalizado",
  "VESSIE-0005": "Número inválido",
  "VESSIE-1001": "Token inesperado",
  "VESSIE-1002": "Expressão esperada",
  "VESSIE-1003": "Declaração app duplicada ou fora de lugar",
  "VESSIE-1004": "Alvo de atribuição inválido",
  "VESSIE-1005": "Tipo inválido",
  "VESSIE-1901": "Recurso planejado, ainda não implementado",
  "VESSIE-2001": "Identificador não declarado",
  "VESSIE-2002": "Identificador já declarado neste escopo",
  "VESSIE-2003": "Atribuição a valor imutável",
  "VESSIE-2004": "Tipos incompatíveis",
  "VESSIE-2005": "Número incorreto de argumentos",
  "VESSIE-2006": "Tipo de retorno incompatível",
  "VESSIE-2007": "Componente de UI desconhecido ou planejado",
  "VESSIE-2008": "Propriedade desconhecida para o componente",
  "VESSIE-2009": "Evento desconhecido para o componente",
  "VESSIE-2010": "Valor não é uma função",
  "VESSIE-2011": "return fora de função",
  "VESSIE-2012": "break/continue fora de laço",
  "VESSIE-2013": "Alvo de bind inválido",
  "VESSIE-2014": "Manipulador de evento inválido",
  "VESSIE-2015": "UI sem elemento raiz page",
  "VESSIE-2016": "Membro inexistente na biblioteca padrão",
  "VESSIE-4001": "Variável declarada e nunca usada",
  "VESSIE-4002": "Programa sem declaração app",
  "VESSIE-9001": "Erro interno do compilador",
});

class VessieDiagnostic {
  constructor({ code, severity = Severity.ERROR, message, file = "<memória>", line = 1, column = 1, length = 1, hint = null }) {
    Object.assign(this, { code, severity, message, file, line, column, length, hint });
  }
  toJSON() {
    const { code, severity, message, file, line, column, length, hint } = this;
    return { code, severity, message, file, line, column, length, hint };
  }
}

class DiagnosticBag {
  constructor(file = "<memória>", { warnings = true } = {}) {
    this.file = file;
    this.warningsEnabled = warnings;
    this.items = [];
  }
  add(severity, code, message, loc = {}, hint = null) {
    if (severity === Severity.WARNING && !this.warningsEnabled) return;
    if (!CODES[code]) throw new Error(`Código de diagnóstico desconhecido: ${code}`);
    this.items.push(new VessieDiagnostic({
      code, severity, message, file: this.file,
      line: loc.line ?? 1, column: loc.col ?? loc.column ?? 1, length: loc.length ?? 1, hint,
    }));
  }
  error(code, message, loc, hint) { this.add(Severity.ERROR, code, message, loc, hint); }
  warn(code, message, loc, hint) { this.add(Severity.WARNING, code, message, loc, hint); }
  get errors() { return this.items.filter((d) => d.severity === Severity.ERROR); }
  get warnings() { return this.items.filter((d) => d.severity === Severity.WARNING); }
  hasErrors() { return this.errors.length > 0; }
}

class VessieCompileError extends Error {
  constructor(diagnostics, source) {
    super(`${diagnostics.filter((d) => d.severity === Severity.ERROR).length} erro(s) de compilação`);
    this.name = "VessieCompileError";
    this.diagnostics = diagnostics;
    this.source = source;
  }
}

/** Formata um diagnóstico com arquivo, linha, coluna e trecho de código. */
function formatDiagnostic(d, source = null) {
  const head = `${d.severity} ${d.code}: ${d.message}`;
  const lines = [head, `  --> ${d.file}:${d.line}:${d.column}`];
  if (source != null) {
    const text = source.split(/\r?\n/)[d.line - 1];
    if (text !== undefined) {
      const num = String(d.line);
      const pad = " ".repeat(num.length);
      lines.push(`${pad} |`, `${num} | ${text}`, `${pad} | ${" ".repeat(Math.max(0, d.column - 1))}${"^".repeat(Math.max(1, d.length))}`);
    }
  }
  if (d.hint) lines.push(`  dica: ${d.hint}`);
  return lines.join("\n");
}

function formatDiagnostics(list, sources = {}) {
  return list.map((d) => formatDiagnostic(d, sources[d.file] ?? null)).join("\n\n");
}


/* ===== src\compiler\lexer\lexer.js ===== */
// Lexer da Vessie. Nunca lança exceção: registra diagnósticos e continua.

const KEYWORDS = new Set([
  "app", "state", "computed", "const", "let", "fn", "async", "await", "return",
  "if", "else", "while", "for", "in", "break", "continue", "true", "false", "null", "ui",
  "css", "js", "html", "cs", "rule", "raw",
]);

/** Palavras reservadas para recursos ainda não implementados (o parser emite VESSIE-1901). */
const PLANNED_KEYWORDS = new Set([
  "import", "export", "enum", "scene", "server", "watch", "class", "module", "match",
]);

const PUNCT3 = new Set(["..."]);
const PUNCT2 = new Set(["=>", "==", "!=", "<=", ">=", "&&", "||", "??", "+=", "-=", "*=", "/=", "%=", "->"]);
const PUNCT1 = new Set("+-*/%=<>!?:;,.()[]{}".split(""));

const isIdStart = (c) => /[\p{L}_$]/u.test(c);
const isIdPart = (c) => /[\p{L}\p{N}_$]/u.test(c);
const isDigit = (c) => c >= "0" && c <= "9";

const ESCAPES = { n: "\n", t: "\t", r: "\r", 0: "\0", "\\": "\\", '"': '"', "'": "'", "`": "`", $: "$" };

class Lexer {
  /**
   * @param {string} src código-fonte
   * @param {import('../../diagnostics/index.js').DiagnosticBag} bag
   * @param {{line?:number,col?:number}} origin posição inicial (usado para expressões de templates)
   */
  constructor(src, bag, origin = {}) {
    this.src = src;
    this.bag = bag;
    this.i = 0;
    this.line = origin.line ?? 1;
    this.col = origin.col ?? 1;
    this.tokens = [];
    this.nl = false;
  }

  peek(o = 0) { return this.src[this.i + o]; }

  adv() {
    const c = this.src[this.i++];
    if (c === "\n") { this.line++; this.col = 1; this.nl = true; } else this.col++;
    return c;
  }

  loc(line, col, length = 1) { return { line, col, length }; }

  push(type, value, line, col, start, extra = {}) {
    const nl = this.nl;
    this.nl = false;
    this.tokens.push({ type, value, line, col, start, end: this.i, nl, ...extra });
  }

  tokenize() {
    const { src } = this;
    while (this.i < src.length) {
      const c = this.peek();
      if (c === " " || c === "\t" || c === "\r" || c === "\n") { this.adv(); continue; }
      if (c === "/" && this.peek(1) === "/") { while (this.i < src.length && this.peek() !== "\n") this.adv(); continue; }
      if (c === "/" && this.peek(1) === "*") { this.blockComment(); continue; }
      const line = this.line, col = this.col, start = this.i;
      if (isIdStart(c)) {
        let s = "";
        while (this.i < src.length && isIdPart(this.peek())) s += this.adv();
        this.push(KEYWORDS.has(s) ? "keyword" : "ident", s, line, col, start);
        continue;
      }
      if (isDigit(c) || (c === "." && isDigit(this.peek(1) ?? ""))) { this.number(line, col, start); continue; }
      if (c === '"' || c === "'") { this.string(c, line, col, start); continue; }
      if (c === "`") { this.template(line, col, start); continue; }
      const three = src.substr(this.i, 3), two = src.substr(this.i, 2);
      if (PUNCT3.has(three)) { this.adv(); this.adv(); this.adv(); this.push("punct", three, line, col, start); continue; }
      if (PUNCT2.has(two)) { this.adv(); this.adv(); this.push("punct", two, line, col, start); continue; }
      if (PUNCT1.has(c)) { this.adv(); this.push("punct", c, line, col, start); continue; }
      this.bag.error("VESSIE-0001", `Caractere inválido: ${JSON.stringify(c)}`, this.loc(line, col));
      this.adv();
    }
    this.push("eof", "", this.line, this.col, this.i);
    return this.tokens;
  }

  blockComment() {
    const line = this.line, col = this.col;
    this.adv(); this.adv();
    while (this.i < this.src.length && !(this.peek() === "*" && this.peek(1) === "/")) this.adv();
    if (this.i >= this.src.length) { this.bag.error("VESSIE-0004", "Comentário de bloco não finalizado", this.loc(line, col, 2)); return; }
    this.adv(); this.adv();
  }

  number(line, col, start) {
    let s = "";
    while (isDigit(this.peek() ?? "") || this.peek() === "_") s += this.adv();
    if (this.peek() === "." && isDigit(this.peek(1) ?? "")) { s += this.adv(); while (isDigit(this.peek() ?? "") || this.peek() === "_") s += this.adv(); }
    if ((this.peek() === "e" || this.peek() === "E") && (isDigit(this.peek(1) ?? "") || ((this.peek(1) === "+" || this.peek(1) === "-") && isDigit(this.peek(2) ?? "")))) {
      s += this.adv(); if (this.peek() === "+" || this.peek() === "-") s += this.adv();
      while (isDigit(this.peek() ?? "")) s += this.adv();
    }
    const clean = s.replace(/_/g, "");
    if (isIdStart(this.peek() ?? "") || Number.isNaN(Number(clean))) {
      this.bag.error("VESSIE-0005", `Número inválido: ${s}${isIdStart(this.peek() ?? "") ? this.peek() : ""}`, this.loc(line, col, s.length));
      while (isIdPart(this.peek() ?? "")) this.adv();
    }
    this.push("number", clean, line, col, start);
  }

  readEscape(quote) {
    this.adv(); // barra
    const e = this.peek();
    if (e === undefined) return "";
    if (e in ESCAPES) { this.adv(); return ESCAPES[e]; }
    if (e === "u" && this.peek(1) === "{") {
      let hex = ""; this.adv(); this.adv();
      while (this.peek() !== undefined && this.peek() !== "}" && /[0-9a-fA-F]/.test(this.peek())) hex += this.adv();
      if (this.peek() === "}" && hex) { this.adv(); try { return String.fromCodePoint(parseInt(hex, 16)); } catch { /* cai no erro abaixo */ } }
    }
    this.bag.error("VESSIE-0001", `Sequência de escape inválida: \\${e}`, this.loc(this.line, this.col - 1, 2));
    this.adv();
    return "";
  }

  string(quote, line, col, start) {
    this.adv();
    let s = "";
    for (;;) {
      const c = this.peek();
      if (c === undefined || c === "\n") { this.bag.error("VESSIE-0002", "String não finalizada", this.loc(line, col, 1), `Feche a string com ${quote}`); break; }
      if (c === quote) { this.adv(); break; }
      if (c === "\\") { s += this.readEscape(quote); continue; }
      s += this.adv();
    }
    this.push("string", s, line, col, start);
  }

  /** Avança sobre uma template string aninhada dentro de `${ }` sem interpretá-la. */
  skipTemplate() {
    this.adv();
    while (this.i < this.src.length) {
      const c = this.peek();
      if (c === "\\") { this.adv(); this.adv(); continue; }
      if (c === "`") { this.adv(); return; }
      if (c === "$" && this.peek(1) === "{") { this.adv(); this.adv(); this.skipExpr(); continue; }
      this.adv();
    }
  }

  /** Avança até o "}" que fecha uma interpolação (posição logo após o "${"). */
  skipExpr() {
    let depth = 1;
    while (this.i < this.src.length) {
      const c = this.peek();
      if (c === '"' || c === "'") {
        const q = this.adv();
        while (this.i < this.src.length && this.peek() !== q && this.peek() !== "\n") { if (this.peek() === "\\") this.adv(); this.adv(); }
        this.adv();
      } else if (c === "`") this.skipTemplate();
      else if (c === "{") { depth++; this.adv(); }
      else if (c === "}") { depth--; if (depth === 0) return true; this.adv(); }
      else this.adv();
    }
    return false;
  }

  template(line, col, start) {
    this.adv();
    const parts = [];
    let cur = "";
    let closed = false;
    while (this.i < this.src.length) {
      const c = this.peek();
      if (c === "`") { this.adv(); closed = true; break; }
      if (c === "\\") { cur += this.readEscape("`"); continue; }
      if (c === "$" && this.peek(1) === "{") {
        if (cur) { parts.push({ kind: "str", value: cur }); cur = ""; }
        this.adv(); this.adv();
        const exprLine = this.line, exprCol = this.col, from = this.i;
        const ok = this.skipExpr();
        const srcText = this.src.slice(from, this.i);
        parts.push({ kind: "expr", src: srcText, line: exprLine, col: exprCol });
        if (!ok) break;
        this.adv(); // "}"
        continue;
      }
      cur += this.adv();
    }
    if (!closed) this.bag.error("VESSIE-0003", "Template string não finalizado", this.loc(line, col, 1), "Feche o template com `");
    if (cur) parts.push({ kind: "str", value: cur });
    this.push("template", "", line, col, start, { parts });
  }
}

function tokenize(src, bag, origin) {
  return new Lexer(src, bag, origin).tokenize();
}


/* ===== src\compiler\ast\index.js ===== */
// AST da Vessie. Os nós são objetos simples: { type, loc:{line,col,length}, ... }.

const NodeType = Object.freeze({
  Program: "Program",
  // declarações
  StateDecl: "StateDecl", ComputedDecl: "ComputedDecl", VarDecl: "VarDecl", FnDecl: "FnDecl", UiDecl: "UiDecl",
  CssDecl: "CssDecl", CssRule: "CssRule", JsDecl: "JsDecl", HtmlDecl: "HtmlDecl", CsDecl: "CsDecl",
  // instruções
  Block: "Block", If: "If", While: "While", For: "For", Return: "Return", Break: "Break", Continue: "Continue",
  ExprStmt: "ExprStmt", Assign: "Assign",
  // expressões
  Number: "Number", String: "String", Template: "Template", Boolean: "Boolean", Null: "Null",
  Identifier: "Identifier", Array: "Array", Object: "Object", Member: "Member", Index: "Index", Call: "Call",
  Unary: "Unary", Binary: "Binary", Ternary: "Ternary", Await: "Await", Arrow: "Arrow",
  // UI
  Element: "Element",
});

function node(type, loc, props = {}) {
  return { type, loc, ...props };
}

const SKIP = new Set(["loc", "binding", "resolvedType", "stmtType"]);

/** Percorre a AST em profundidade; `visit(node, parent)` pode retornar false para não descer. */
function walk(root, visit, parent = null) {
  if (Array.isArray(root)) { for (const n of root) walk(n, visit, parent); return; }
  if (!root || typeof root !== "object" || typeof root.type !== "string") return;
  if (visit(root, parent) === false) return;
  for (const [k, v] of Object.entries(root)) {
    if (SKIP.has(k) || v == null || typeof v !== "object") continue;
    if (Array.isArray(v)) for (const item of v) walkAny(item, visit, root);
    else walkAny(v, visit, root);
  }
}

function walkAny(v, visit, parent) {
  if (!v || typeof v !== "object") return;
  if (typeof v.type === "string") walk(v, visit, parent);
  else for (const item of Object.values(v)) walkAny(item, visit, parent); // pares {name,value}, partes de template
}


/* ===== src\compiler\parser\parser.js ===== */
// Parser recursivo descendente (com precedência por escalada) da Vessie.
// Estratégia: separação de instruções por quebra de linha ou ";" (token.nl), sem ASI complexo.


class ParseAbort extends Error {}

const ASSIGN_OPS = new Set(["=", "+=", "-=", "*=", "/=", "%="]);
const BINARY_PREC = {
  "??": 1, "||": 2, "&&": 3, "==": 4, "!=": 4, "<": 5, ">": 5, "<=": 5, ">=": 5, "+": 6, "-": 6, "*": 7, "/": 7, "%": 7,
};
const PLANNED_HELP = {
  import: "Imports de módulos serão implementados na Fase 2 (resolução de módulos).",
  export: "Exports de módulos serão implementados na Fase 2.",
  enum: "Enums são planejados para a Fase 2.",
  scene: "Cenas 3D fazem parte da Fase 4 (engine gráfica).",
  server: "Servidores Node.js fazem parte de uma fase posterior.",
  watch: "watch (efeitos reativos) é planejado para a Fase 3.",
  class: "Classes são planejadas; por enquanto use fn, state e ui.",
  module: "Módulos são planejados para a Fase 2.",
  match: "match é planejado para a Fase 2.",
};

class Parser {
  constructor(tokens, bag) {
    this.toks = tokens;
    this.p = 0;
    this.bag = bag;
    this.lastErr = null;
    this.fnDepth = 0;
  }

  // ---------- utilidades ----------
  get tok() { return this.toks[this.p]; }
  at(n = 1) { return this.toks[Math.min(this.p + n, this.toks.length - 1)]; }
  next() { const t = this.tok; if (t.type !== "eof") this.p++; return t; }
  isP(v, t = this.tok) { return t.type === "punct" && t.value === v; }
  isK(v, t = this.tok) { return t.type === "keyword" && t.value === v; }
  isEOF() { return this.tok.type === "eof"; }
  locOf(t, end = t) { return { line: t.line, col: t.col, length: Math.max(1, end.end - t.start) }; }

  describe(t) {
    if (t.type === "eof") return "fim do arquivo";
    if (t.type === "string") return "string";
    if (t.type === "template") return "template string";
    return `"${t.value}"`;
  }

  fail(code, message, t = this.tok, hint = null) {
    const key = `${t.line}:${t.col}`;
    if (this.lastErr !== key) {
      this.lastErr = key;
      this.bag.error(code, message, this.locOf(t), hint);
    }
    throw new ParseAbort();
  }

  expectP(v, ctx = "") {
    if (this.isP(v)) return this.next();
    return this.fail("VESSIE-1001", `Esperado "${v}"${ctx ? ` ${ctx}` : ""}, encontrado ${this.describe(this.tok)}`);
  }

  expectIdent(ctx = "") {
    if (this.tok.type === "ident") return this.next();
    // nomes de variáveis/funções podem usar as palavras de conteúdo (css/js/html/cs/rule/raw)
    if (this.tok.type === "keyword" && ["css", "js", "html", "cs", "rule", "raw"].includes(this.tok.value)) return this.next();
    return this.fail("VESSIE-1001", `Esperado um identificador${ctx ? ` ${ctx}` : ""}, encontrado ${this.describe(this.tok)}`);
  }

  /** Após uma instrução: exige ";", quebra de linha, "}" ou fim de arquivo. */
  endStatement() {
    if (this.isP(";")) { this.next(); return; }
    if (this.tok.nl || this.isP("}") || this.isEOF()) return;
    this.fail("VESSIE-1001", `Esperado fim da instrução (nova linha ou ";"), encontrado ${this.describe(this.tok)}`);
  }

  /** Recuperação de erro: descarta tokens até a próxima linha ou "}". */
  recover(startIndex) {
    if (this.p === startIndex && !this.isEOF()) this.next();
    while (!this.isEOF() && !this.tok.nl && !this.isP("}")) this.next();
  }

  // ---------- programa ----------
  parseProgram() {
    const start = this.tok;
    let app = null;
    const body = [];
    while (!this.isEOF()) {
      const startIdx = this.p;
      try {
        if (this.isP(";")) { this.next(); continue; }
        if (this.isK("app")) {
          const t = this.next();
          const nameTok = this.expectIdent("após app");
          if (app || body.length) this.bag.error("VESSIE-1003", 'A declaração "app" deve aparecer uma única vez, no início do arquivo', this.locOf(t, nameTok));
          else app = node("App", this.locOf(t, nameTok), { name: nameTok.value });
          this.endStatement();
          continue;
        }
        body.push(this.parseStatement(true));
      } catch (e) {
        if (!(e instanceof ParseAbort)) throw e;
        this.recover(startIdx);
        if (this.isP("}")) this.next(); // "}" solta no nível superior
      }
    }
    return node("Program", this.locOf(start), { app, body });
  }

  // ---------- instruções ----------
  parseStatement(top = false) {
    const t = this.tok;

    if (t.type === "ident" && PLANNED_KEYWORDS.has(t.value)) {
      const n = this.at();
      if (n.type === "ident" || n.type === "string" || n.type === "template" || this.isP("{", n)) {
        this.fail("VESSIE-1901", `"${t.value}" ainda não está implementado`, t, PLANNED_HELP[t.value]);
      }
    }

    if (t.type === "keyword") {
      switch (t.value) {
        case "state": return this.topOnly(top, t, () => this.parseState());
        case "computed": return this.topOnly(top, t, () => this.parseComputed());
        case "ui": if (top && this.isUiDeclAhead()) return this.parseUi(); break;
        case "css": if (top && this.isAssetDeclAhead()) return this.parseCss(); break;
        case "js": if (top && this.isAssetDeclAhead(false)) return this.parseJs(); break;
        case "html": if (top && this.isAssetDeclAhead(false)) return this.parseHtml(); break;
        case "cs": if (top && this.isAssetDeclAhead(false)) return this.parseCs(); break;
        case "const": case "let": return this.parseVar();
        case "fn": return this.parseFn(false);
        case "async":
          if (this.isK("fn", this.at())) return this.parseFn(true);
          return this.fail("VESSIE-1901", '"async" só é suportado antes de "fn"', t, "Use: async fn nome() { ... }");
        case "if": return this.parseIf();
        case "while": return this.parseWhile();
        case "for": return this.parseFor();
        case "return": return this.parseReturn();
        case "break": case "continue": {
          this.next(); this.endStatement();
          return node(t.value === "break" ? "Break" : "Continue", this.locOf(t));
        }
        case "app": return this.fail("VESSIE-1003", 'A declaração "app" deve aparecer no início do arquivo');
        case "else": return this.fail("VESSIE-1001", '"else" sem "if" correspondente');
        default: break;
      }
    }
    if (this.isP("{")) return this.parseBlock();
    return this.parseExprOrAssign();
  }

  topOnly(top, t, fn) {
    if (!top) this.fail("VESSIE-1001", `"${t.value}" só pode ser declarado no nível superior do arquivo`, t);
    return fn();
  }

  parseExprOrAssign() {
    const startTok = this.tok;
    const expr = this.parseExpression();
    if (this.tok.type === "punct" && ASSIGN_OPS.has(this.tok.value) && !this.tok.nl) {
      const opTok = this.next();
      if (!["Identifier", "Member", "Index"].includes(expr.type)) {
        this.bag.error("VESSIE-1004", "O lado esquerdo da atribuição deve ser uma variável, membro ou índice", expr.loc);
      }
      const value = this.parseExpression();
      this.endStatement();
      return node("Assign", this.locOf(startTok, opTok), { op: opTok.value, target: expr, value });
    }
    this.endStatement();
    return node("ExprStmt", expr.loc, { expr });
  }

  parseType() {
    const t = this.tok;
    if (t.type !== "ident" && !(t.type === "keyword" && t.value === "null")) this.fail("VESSIE-1005", `Tipo esperado, encontrado ${this.describe(t)}`);
    this.next();
    let dims = 0;
    while (this.isP("[") && this.isP("]", this.at())) { this.next(); this.next(); dims++; }
    return node("TypeRef", this.locOf(t), { name: t.value, dims });
  }

  parseTypeAnn() {
    if (this.isP(":")) { this.next(); return this.parseType(); }
    return null;
  }

  parseState() {
    const kw = this.next();
    const name = this.expectIdent("após state");
    const typeAnn = this.parseTypeAnn();
    this.expectP("=", "no valor inicial do state");
    const init = this.parseExpression();
    this.endStatement();
    return node("StateDecl", this.locOf(name), { name: name.value, typeAnn, init, kw: this.locOf(kw) });
  }

  parseComputed() {
    this.next();
    const name = this.expectIdent("após computed");
    const typeAnn = this.parseTypeAnn();
    this.expectP("=", "na expressão do computed");
    const init = this.parseExpression();
    this.endStatement();
    return node("ComputedDecl", this.locOf(name), { name: name.value, typeAnn, init });
  }

  // ---------- blocos de conteúdo (css / js / html) ----------
  // Formas aceitas (nível superior):
  //   css nome = `...css bruto...` | css nome { rule "seletor" { prop: expr ... } ... }
  //   js nome = `...js bruto...`   | html nome = `...html bruto...`
  // `css`/`js`/`html`/`cs`/`ui` continuam utilizáveis como identificadores comuns
  // (ex.: js.run("..."), ui.open("id")) quando não seguem o formato de declaração.
  isAssetDeclAhead(structured = true) {
    const n1 = this.at(1);
    // `css = ...` (nome omitido)
    if (n1.type === "punct" && (n1.value === "=" || (structured && n1.value === "{"))) return true;
    // `css nome = ...` ou `css nome { ... }`
    if (n1.type === "ident" || n1.type === "keyword") {
      const n2 = this.at(2);
      if (n2.type === "punct" && (n2.value === "=" || (structured && n2.value === "{"))) return true;
    }
    return false;
  }

  /** `ui Nome { ... }` é declaração; qualquer outro uso de `ui` (ex.: ui.open("x")) é expressão. */
  isUiDeclAhead() {
    const n1 = this.at(1);
    if (n1.type === "ident" || (n1.type === "keyword" && ["css", "js", "html", "cs", "rule", "raw", "ui"].includes(n1.value))) {
      return this.isP("{", this.at(2));
    }
    return false;
  }

  parseAssetName(after) {
    if (this.tok.type === "ident" || (this.tok.type === "keyword" && ["css", "js", "html", "cs", "rule", "raw"].includes(this.tok.value))) {
      const n = this.next();
      return { name: n.value, loc: this.locOf(n) };
    }
    return null;
  }

  parseCss() {
    const kw = this.next();
    const named = this.parseAssetName("após css");
    if (this.isP("=")) {
      this.next();
      const css = this.parseExpression();
      this.endStatement();
      return node("CssDecl", this.locOf(kw), { name: named?.name ?? "main", raw: css, rules: [] });
    }
    this.expectP("{", "para abrir o bloco css");
    const rules = [];
    for (;;) {
      if (this.isEOF()) { this.bag.error("VESSIE-1001", 'Bloco css não fechado: esperado "}"', this.locOf(kw)); break; }
      if (this.isP("}")) { this.next(); break; }
      if (this.isP(";")) { this.next(); continue; }
      const startIdx = this.p;
      try {
        if (!((this.tok.type === "keyword" && this.tok.value === "rule") || (this.tok.type === "ident" && this.tok.value === "rule"))) {
          this.fail("VESSIE-1001", `Esperado rule "seletor" {{ ... }}, encontrado ${this.describe(this.tok)}`);
        }
        const ruleKw = this.next();
        const sel = this.tok;
        if (sel.type !== "string" && sel.type !== "template") this.fail("VESSIE-1001", `Seletor CSS esperado como string, encontrado ${this.describe(sel)}`, sel, 'Exemplo: rule ".meu-botao" { ... }');
        this.next();
        const selector = sel.type === "string" ? sel.value : null;
        const selectorExpr = sel.type === "template" ? this.buildTemplate(sel) : null;
        this.expectP("{", "para abrir as propriedades da regra");
        const props = [];
        for (;;) {
          if (this.isEOF()) { this.bag.error("VESSIE-1001", 'Regra css não fechada: esperado "}"', this.locOf(ruleKw)); break; }
          if (this.isP("}")) { this.next(); break; }
          if (this.isP(";") || this.isP(",")) { this.next(); continue; }
          const pname = this.parseCssPropName();
          this.expectP(":", `após a propriedade css "${pname}"`);
          const value = this.parseExpression();
          props.push({ name: pname, value, loc: this.locOf(this.tok) });
          if (this.isP(",") || this.isP(";")) this.next();
        }
        rules.push(node("CssRule", this.locOf(ruleKw), { selector, selectorExpr, props }));
      } catch (e) {
        if (!(e instanceof ParseAbort)) throw e;
        this.recover(startIdx);
      }
    }
    return node("CssDecl", this.locOf(kw), { name: named?.name ?? "main", raw: null, rules });
  }

  parseCssPropName() {
    const t = this.tok;
    if (t.type === "string") { this.next(); return t.value; }
    if (t.type !== "ident" && t.type !== "keyword") this.fail("VESSIE-1001", `Nome de propriedade CSS esperado, encontrado ${this.describe(t)}`);
    let name = this.next().value;
    while (this.isP("-") && !this.tok.nl) {
      this.next();
      const part = this.tok;
      if (part.type !== "ident" && part.type !== "keyword") this.fail("VESSIE-1001", `Nome de propriedade CSS inválido após "-"`, part);
      name += "-" + this.next().value;
    }
    return name;
  }

  parseJs() {
    const kw = this.next();
    const named = this.parseAssetName("após js");
    this.expectP("=", 'na declaração js (use: js nome = `...código...`)');
    const code = this.parseExpression();
    this.endStatement();
    return node("JsDecl", this.locOf(kw), { name: named?.name ?? "main", code });
  }

  parseHtml() {
    const kw = this.next();
    // `html` também é um componente de UI; aqui só entra quando há `=` adiante (ver isAssetDeclAhead).
    const named = this.parseAssetName("após html");
    this.expectP("=", 'na declaração html (use: html nome = `...markup...`)');
    const markup = this.parseExpression();
    this.endStatement();
    return node("HtmlDecl", this.locOf(kw), { name: named?.name ?? "main", markup });
  }

  parseCs() {
    const kw = this.next();
    const named = this.parseAssetName("após cs");
    this.expectP("=", 'na declaração cs (use: cs nome = `...código C#...`)');
    const source = this.parseExpression();
    this.endStatement();
    return node("CsDecl", this.locOf(kw), { name: named?.name ?? "main", source });
  }

  parseVar() {
    const kw = this.next();
    const name = this.expectIdent(`após ${kw.value}`);
    const typeAnn = this.parseTypeAnn();
    let init = null;
    if (this.isP("=")) { this.next(); init = this.parseExpression(); }
    else if (kw.value === "const") this.fail("VESSIE-1001", "Uma constante precisa de valor inicial", this.tok, `Use: const ${name.value} = ...`);
    this.endStatement();
    return node("VarDecl", this.locOf(name), { kind: kw.value, name: name.value, typeAnn, init });
  }

  parseParams() {
    const params = [];
    this.expectP("(");
    while (!this.isP(")")) {
      const n = this.expectIdent("como nome de parâmetro");
      const typeAnn = this.parseTypeAnn();
      params.push(node("Param", this.locOf(n), { name: n.value, typeAnn }));
      if (this.isP(",")) this.next(); else break;
    }
    this.expectP(")", "ao final dos parâmetros");
    return params;
  }

  parseFn(isAsync) {
    if (isAsync) this.next();
    const kw = this.next();
    const name = this.expectIdent("após fn");
    const params = this.parseParams();
    let retType = null;
    if (this.isP("->")) { this.next(); retType = this.parseType(); }
    this.fnDepth++;
    const body = this.parseBlock();
    this.fnDepth--;
    return node("FnDecl", this.locOf(name), { name: name.value, params, retType, body, isAsync, kw: this.locOf(kw) });
  }

  parseBlock() {
    const open = this.expectP("{");
    const body = [];
    while (!this.isP("}") && !this.isEOF()) {
      const startIdx = this.p;
      try { body.push(this.parseStatement(false)); } catch (e) {
        if (!(e instanceof ParseAbort)) throw e;
        this.recover(startIdx);
      }
    }
    if (this.isEOF()) this.bag.error("VESSIE-1001", 'Bloco não fechado: esperado "}"', this.locOf(open));
    else this.next();
    return node("Block", this.locOf(open), { body });
  }

  parseIf() {
    const kw = this.next();
    const test = this.parseExpression();
    const then = this.parseBlock();
    let otherwise = null;
    if (this.isK("else")) {
      this.next();
      otherwise = this.isK("if") ? this.parseIf() : this.parseBlock();
    }
    return node("If", this.locOf(kw), { test, then, otherwise });
  }

  parseWhile() {
    const kw = this.next();
    const test = this.parseExpression();
    return node("While", this.locOf(kw), { test, body: this.parseBlock() });
  }

  parseFor() {
    const kw = this.next();
    const v = this.expectIdent("como variável do laço");
    if (!this.isK("in")) this.fail("VESSIE-1001", `Esperado "in" no laço for, encontrado ${this.describe(this.tok)}`, this.tok, "Use: for item in lista { ... }");
    this.next();
    const iter = this.parseExpression();
    return node("For", this.locOf(kw), { name: v.value, nameLoc: this.locOf(v), iter, body: this.parseBlock() });
  }

  parseReturn() {
    const kw = this.next();
    let value = null;
    if (!this.tok.nl && !this.isP("}") && !this.isP(";") && !this.isEOF()) value = this.parseExpression();
    this.endStatement();
    return node("Return", this.locOf(kw), { value });
  }

  // ---------- expressões ----------
  parseExpression() {
    const test = this.parseBinary(1);
    if (this.isP("?") && !this.tok.nl) {
      this.next();
      const a = this.parseExpression();
      this.expectP(":", "no operador ternário");
      const b = this.parseExpression();
      return node("Ternary", test.loc, { test, then: a, otherwise: b });
    }
    return test;
  }

  parseBinary(minPrec) {
    let left = this.parseUnary();
    for (;;) {
      const t = this.tok;
      if (t.type !== "punct") break;
      const prec = BINARY_PREC[t.value];
      if (!prec || prec < minPrec) break;
      if (t.nl && (t.value === "+" || t.value === "-")) break; // "-x" na linha seguinte é outra instrução
      this.next();
      const right = this.parseBinary(prec + 1);
      left = node("Binary", left.loc, { op: t.value, left, right, opLoc: this.locOf(t) });
    }
    return left;
  }

  parseUnary() {
    const t = this.tok;
    if (t.type === "punct" && (t.value === "!" || t.value === "-" || t.value === "+")) {
      this.next();
      return node("Unary", this.locOf(t), { op: t.value, arg: this.parseUnary() });
    }
    if (this.isK("await")) {
      this.next();
      return node("Await", this.locOf(t), { arg: this.parseUnary() });
    }
    return this.parsePostfix(this.parsePrimary());
  }

  parsePostfix(expr) {
    for (;;) {
      const t = this.tok;
      if (this.isP(".")) {
        this.next();
        const n = this.tok;
        if (n.type !== "ident" && n.type !== "keyword") this.fail("VESSIE-1001", `Esperado nome do membro após ".", encontrado ${this.describe(n)}`);
        this.next();
        expr = node("Member", expr.loc, { object: expr, property: n.value, propLoc: this.locOf(n) });
      } else if (this.isP("(") && !t.nl) {
        this.next();
        const args = this.parseArgs(")");
        expr = node("Call", expr.loc, { callee: expr, args });
      } else if (this.isP("[") && !t.nl) {
        this.next();
        const index = this.parseExpression();
        this.expectP("]", "após o índice");
        expr = node("Index", expr.loc, { object: expr, index });
      } else break;
    }
    return expr;
  }

  parseArgs(close) {
    const args = [];
    while (!this.isP(close)) {
      if (this.isEOF()) this.fail("VESSIE-1001", `Esperado "${close}", encontrado fim do arquivo`);
      args.push(this.parseExpression());
      if (this.isP(",")) this.next(); else break;
    }
    this.expectP(close, "ao final da lista");
    return args;
  }

  /** "(" já é o token atual: existe "=>" logo após o ")" correspondente? */
  isArrowAhead() {
    let depth = 0;
    for (let i = this.p; i < this.toks.length; i++) {
      const t = this.toks[i];
      if (t.type === "eof") return false;
      if (t.type === "punct") {
        if (t.value === "(") depth++;
        else if (t.value === ")") { depth--; if (depth === 0) { const n = this.toks[i + 1]; return n && n.type === "punct" && n.value === "=>"; } }
      }
    }
    return false;
  }

  parseArrow(params, startTok) {
    this.expectP("=>");
    let body;
    if (this.isP("{")) { this.fnDepth++; body = this.parseBlock(); this.fnDepth--; }
    else {
      const value = this.parseExpression();
      if (this.tok.type === "punct" && ASSIGN_OPS.has(this.tok.value) && !this.tok.nl) {
        const opTok = this.next();
        if (!["Identifier", "Member", "Index"].includes(value.type)) this.bag.error("VESSIE-1004", "O lado esquerdo da atribuição deve ser uma variável, membro ou índice", value.loc);
        const rhs = this.parseExpression();
        body = node("Assign", value.loc, { op: opTok.value, target: value, value: rhs });
      } else body = value;
    }
    return node("Arrow", this.locOf(startTok), { params, body });
  }

  parsePrimary() {
    const t = this.tok;
    switch (t.type) {
      case "number": this.next(); return node("Number", this.locOf(t), { value: Number(t.value), raw: t.value });
      case "string": this.next(); return node("String", this.locOf(t), { value: t.value });
      case "template": this.next(); return this.buildTemplate(t);
      case "ident": {
        this.next();
        if (this.isP("=>") && !this.tok.nl) return this.parseArrow([node("Param", this.locOf(t), { name: t.value, typeAnn: null })], t);
        return node("Identifier", this.locOf(t), { name: t.value });
      }
      case "keyword":
        if (t.value === "true" || t.value === "false") { this.next(); return node("Boolean", this.locOf(t), { value: t.value === "true" }); }
        if (t.value === "null") { this.next(); return node("Null", this.locOf(t)); }
        // `css`/`js`/`html`/`cs`/`rule`/`raw`/`ui` podem ser usados como variáveis (ex.: js.run("..."), ui.open("id"))
        if (["css", "js", "html", "cs", "rule", "raw", "ui"].includes(t.value)) {
          this.next();
          if (this.isP("=>") && !this.tok.nl) return this.parseArrow([node("Param", this.locOf(t), { name: t.value, typeAnn: null })], t);
          return node("Identifier", this.locOf(t), { name: t.value });
        }
        break;
      case "punct":
        if (t.value === "(") {
          if (this.isArrowAhead()) {
            this.next();
            const params = [];
            while (!this.isP(")")) {
              const n = this.expectIdent("como parâmetro");
              params.push(node("Param", this.locOf(n), { name: n.value, typeAnn: this.parseTypeAnn() }));
              if (this.isP(",")) this.next(); else break;
            }
            this.expectP(")");
            return this.parseArrow(params, t);
          }
          this.next();
          const e = this.parseExpression();
          this.expectP(")", "após a expressão");
          return e;
        }
        if (t.value === "[") { this.next(); return node("Array", this.locOf(t), { items: this.parseArgs("]") }); }
        if (t.value === "{") return this.parseObject();
        break;
      default: break;
    }
    return this.fail("VESSIE-1002", `Expressão esperada, encontrado ${this.describe(t)}`);
  }

  parseObject() {
    const open = this.next();
    const props = [];
    while (!this.isP("}")) {
      if (this.isEOF()) this.fail("VESSIE-1001", 'Esperado "}", encontrado fim do arquivo');
      const k = this.tok;
      if (k.type !== "ident" && k.type !== "string" && k.type !== "keyword") this.fail("VESSIE-1001", `Chave de objeto esperada, encontrado ${this.describe(k)}`);
      this.next();
      let value;
      if (this.isP(":")) { this.next(); value = this.parseExpression(); }
      else if (k.type === "ident") value = node("Identifier", this.locOf(k), { name: k.value });
      else this.fail("VESSIE-1001", 'Esperado ":" após a chave do objeto');
      props.push({ key: k.value, value, loc: this.locOf(k) });
      if (this.isP(",")) this.next();
      else if (!this.isP("}") && !this.tok.nl) this.fail("VESSIE-1001", `Esperado "," ou "}", encontrado ${this.describe(this.tok)}`);
    }
    this.next();
    return node("Object", this.locOf(open), { props });
  }

  buildTemplate(t) {
    const parts = [];
    for (const part of t.parts) {
      if (part.kind === "str") { parts.push({ kind: "str", value: part.value }); continue; }
      const toks = new Lexer(part.src, this.bag, { line: part.line, col: part.col }).tokenize();
      const sub = new Parser(toks, this.bag);
      let expr;
      try {
        expr = sub.parseExpression();
        if (!sub.isEOF()) sub.fail("VESSIE-1001", `Token inesperado na interpolação: ${sub.describe(sub.tok)}`);
      } catch (e) {
        if (!(e instanceof ParseAbort)) throw e;
        expr = node("Null", this.locOf(t));
      }
      parts.push({ kind: "expr", expr });
    }
    return node("Template", this.locOf(t), { parts });
  }

  // ---------- UI ----------
  parseUi() {
    this.next();
    const name = this.expectIdent("após ui");
    this.expectP("{", "para abrir o bloco da UI");
    const body = this.parseElementBody(null);
    return node("UiDecl", this.locOf(name), { name: name.value, children: body.children });
  }

  isAdjacentColon(t = this.tok) {
    const c = this.at(1);
    return this.isP(":", c) && c.start === t.end;
  }

  /** Lê itens até "}" (já consumido o "{"). `owner` recebe props/eventos/bind escritos em linhas próprias. */
  parseElementBody(owner) {
    const children = [];
    for (;;) {
      if (this.isEOF()) { this.bag.error("VESSIE-1001", 'Bloco de UI não fechado: esperado "}"', this.tok.line ? { line: this.tok.line, col: this.tok.col } : {}); break; }
      if (this.isP("}")) { this.next(); break; }
      if (this.isP(";")) { this.next(); continue; }
      const startIdx = this.p;
      try {
        const t = this.tok;
        if (t.type === "keyword" && ["if", "for", "while", "else"].includes(t.value)) {
          this.fail("VESSIE-1901", `"${t.value}" dentro de blocos ui ainda não está implementado`, t, "Use expressões (ternário, array.map) ou renderização por estado por enquanto.");
        }
        if (t.type === "ident" && this.isP(":", this.at(1)) && owner) {
          if (this.isAdjacentColon(t) && (t.value === "on" || t.value === "bind")) this.parseModifier(owner);
          else {
            this.next(); this.next();
            owner.props.push({ name: t.value, value: this.parseExpression(), loc: this.locOf(t) });
          }
          continue;
        }
        if (t.type !== "ident" && !(t.type === "keyword" && ["css", "js", "html", "rule", "raw"].includes(t.value))) this.fail("VESSIE-1001", `Esperado um elemento de UI, encontrado ${this.describe(t)}`);
        children.push(this.parseElement());
      } catch (e) {
        if (!(e instanceof ParseAbort)) throw e;
        this.recover(startIdx);
      }
    }
    return { children };
  }

  parseModifier(owner) {
    const kw = this.next(); // on | bind
    this.next(); // ":"
    if (kw.value === "on") {
      const ev = this.tok;
      if (ev.type !== "ident" && ev.type !== "keyword") this.fail("VESSIE-1001", `Nome de evento esperado após "on:", encontrado ${this.describe(ev)}`);
      this.next();
      const handler = this.parseExpression();
      owner.events.push({ name: ev.value, handler, loc: this.locOf(kw, ev) });
    } else {
      const target = this.parsePostfix(this.parsePrimary());
      owner.bind = { target, loc: this.locOf(kw) };
    }
  }

  parseElement() {
    const tag = this.next();
    const el = node("Element", this.locOf(tag), { tag: tag.value, args: [], props: [], events: [], bind: null, children: [] });
    while (!this.isP("{") && !this.isP("}") && !this.isEOF() && !this.tok.nl && !this.isP(";")) {
      const t = this.tok;
      if (t.type === "ident" && this.isAdjacentColon(t) && (t.value === "on" || t.value === "bind")) { this.parseModifier(el); continue; }
      if (t.type === "ident" && this.isP(":", this.at(1))) {
        this.next(); this.next();
        el.props.push({ name: t.value, value: this.parseExpression(), loc: this.locOf(t) });
        continue;
      }
      el.args.push(this.parseExpression());
    }
    if (this.isP("{")) {
      this.next();
      el.children = this.parseElementBody(el).children;
    }
    return el;
  }
}

function parse(source, bag) {
  const tokens = tokenize(source, bag);
  return new Parser(tokens, bag).parseProgram();
}


/* ===== src\compiler\types\types.js ===== */
// Sistema de tipos da Vessie (tipagem gradual: "any" é compatível com tudo).

const T = Object.freeze({
  number: { kind: "number" },
  string: { kind: "string" },
  boolean: { kind: "boolean" },
  void: { kind: "void" },
  null: { kind: "null" },
  any: { kind: "any" },
  object: { kind: "object" },
});

const arrayOf = (elem) => ({ kind: "array", elem });
const fnType = (params, ret = T.any, rest = false) => ({ kind: "fn", params, ret, rest });

const PRIMITIVE_NAMES = new Set(["number", "string", "boolean", "any", "void"]);

function typeToString(t) {
  if (!t) return "any";
  if (t.kind === "array") return `${typeToString(t.elem)}[]`;
  if (t.kind === "fn") return `fn(${t.params.map((p) => typeToString(p.type)).join(", ")}) -> ${typeToString(t.ret)}`;
  return t.kind;
}

/** `to` aceita um valor do tipo `from`? */
function isAssignable(to, from) {
  if (!to || !from) return true;
  if (to.kind === "any" || from.kind === "any") return true;
  if (from.kind === "void") return to.kind === "void";
  if (to.kind !== from.kind) return false;
  if (to.kind === "array") return isAssignable(to.elem, from.elem);
  return true; // fn e object: verificação frouxa
}

/** União simplificada usada em ternários e arrays: iguais → o tipo; senão any. */
function unify(a, b) {
  if (!a) return b ?? T.any;
  if (!b) return a;
  if (a.kind === "any" || b.kind === "any") return T.any;
  if (a.kind === b.kind) {
    if (a.kind === "array") return arrayOf(unify(a.elem, b.elem));
    return a;
  }
  return T.any;
}

/** Converte uma anotação de tipo da AST (TypeRef) em tipo. Retorna null se inválida. */
function resolveTypeRef(ref, bag) {
  if (!ref) return null;
  let base;
  if (ref.name === "null") base = T.null;
  else if (PRIMITIVE_NAMES.has(ref.name)) base = T[ref.name];
  else {
    bag.error("VESSIE-1005", `Tipo desconhecido: "${ref.name}"`, ref.loc, "Tipos disponíveis: number, string, boolean, any, void (e T[] para listas)");
    return T.any;
  }
  let t = base;
  for (let i = 0; i < ref.dims; i++) t = arrayOf(t);
  return t;
}

/** Converte a notação compacta das assinaturas da stdlib ("number", "any[]", "string?", "fn") em tipo. */
function parseSigType(s) {
  let str = s;
  let optional = false;
  if (str.endsWith("?")) { optional = true; str = str.slice(0, -1); }
  let dims = 0;
  while (str.endsWith("[]")) { dims++; str = str.slice(0, -2); }
  let t = str === "fn" ? fnType([], T.any, true) : T[str];
  if (!t) throw new Error(`Tipo de assinatura inválido: ${s}`);
  for (let i = 0; i < dims; i++) t = arrayOf(t);
  return { type: t, optional };
}


/* ===== src\stdlib\signatures.js ===== */
// Assinaturas da biblioteca padrão vistas pelo compilador (verificação de tipos/aridade).
// A implementação de cada entrada está em src/stdlib/index.js (um teste garante a consistência).
// Notação de tipos: number, string, boolean, any, void, fn, "T[]"; sufixo "?" = parâmetro opcional.

const f = (params, ret, opts = {}) => ({ kind: "fn", params, ret, rest: !!opts.rest, doc: opts.doc ?? "" });
const c = (type, doc = "") => ({ kind: "const", type, doc });

const globals = {
  print: f(["any"], "void", { rest: true, doc: "Escreve valores na saída padrão." }),
  log: f(["any"], "void", { rest: true, doc: "Registra informação (nível log)." }),
  warn: f(["any"], "void", { rest: true, doc: "Registra um aviso." }),
  error: f(["any"], "void", { rest: true, doc: "Registra um erro." }),
  assert: f(["boolean", "string?"], "void", { doc: "Lança erro se a condição for falsa." }),
  typeof: f(["any"], "string", { doc: "Nome do tipo em tempo de execução (number, string, array, ...)." }),
  typeofValue: f(["any"], "string", { doc: "Alias de typeof." }),
  isNull: f(["any"], "boolean", { doc: "true para null ou indefinido." }),
  isDefined: f(["any"], "boolean", { doc: "true se o valor não é null nem indefinido." }),
  range: f(["number", "number?"], "number[]", { doc: "range(fim) ou range(início, fim): lista de inteiros [início, fim)." }),
};

const namespaces = {
  math: {
    PI: c("number", "Constante π."),
    abs: f(["number"], "number"),
    floor: f(["number"], "number"),
    ceil: f(["number"], "number"),
    round: f(["number"], "number"),
    sqrt: f(["number"], "number"),
    pow: f(["number", "number"], "number"),
    clamp: f(["number", "number", "number"], "number", { doc: "clamp(valor, mínimo, máximo)." }),
    lerp: f(["number", "number", "number"], "number", { doc: "lerp(a, b, t) = a + (b - a) * t." }),
    random: f([], "number", { doc: "Número pseudoaleatório em [0, 1)." }),
    randomInt: f(["number", "number"], "number", { doc: "Inteiro aleatório inclusivo entre mínimo e máximo." }),
    sign: f(["number"], "number"),
    modulo: f(["number", "number"], "number", { doc: "Resto sempre positivo para divisor positivo." }),
    radians: f(["number"], "number"),
    degrees: f(["number"], "number"),
    min: f(["number"], "number", { rest: true }),
    max: f(["number"], "number", { rest: true }),
  },
  string: {
    length: f(["string"], "number"),
    upper: f(["string"], "string"),
    lower: f(["string"], "string"),
    trim: f(["string"], "string"),
    split: f(["string", "string"], "string[]"),
    replace: f(["string", "string", "string"], "string", { doc: "Substitui todas as ocorrências (texto literal, sem regex)." }),
    includes: f(["string", "string"], "boolean"),
    startsWith: f(["string", "string"], "boolean"),
    endsWith: f(["string", "string"], "boolean"),
    repeat: f(["string", "number"], "string"),
    chars: f(["string"], "string[]"),
    format: f(["string", "any"], "string", { rest: true, doc: 'Substitui "{0}", "{1}"... pelos argumentos.' }),
  },
  array: {
    length: f(["any[]"], "number"),
    map: f(["any[]", "fn"], "any[]"),
    filter: f(["any[]", "fn"], "any[]"),
    reduce: f(["any[]", "fn", "any?"], "any"),
    find: f(["any[]", "fn"], "any"),
    sort: f(["any[]", "fn?"], "any[]", { doc: "Retorna uma cópia ordenada (não altera a original)." }),
    forEach: f(["any[]", "fn"], "void"),
    includes: f(["any[]", "any"], "boolean"),
    push: f(["any[]", "any"], "number"),
    join: f(["any[]", "string?"], "string"),
    first: f(["any[]"], "any"),
    last: f(["any[]"], "any"),
    reverse: f(["any[]"], "any[]"),
    slice: f(["any[]", "number", "number?"], "any[]"),
    concat: f(["any[]", "any[]"], "any[]"),
    unique: f(["any[]"], "any[]"),
    remove: f(["any[]", "any"], "boolean", { doc: "Remove a primeira ocorrência da lista e informa se encontrou." }),
  },
  object: {
    keys: f(["object"], "string[]"),
    values: f(["object"], "any[]"),
    has: f(["object", "string"], "boolean"),
  },
  json: {
    parse: f(["string"], "any"),
    stringify: f(["any"], "string"),
  },
  date: {
    now: f([], "number", { doc: "Timestamp atual em milissegundos." }),
    iso: f([], "string", { doc: "Data/hora atual em ISO 8601." }),
    format: f(["number", "string?"], "string", { doc: "Formata um timestamp usando Intl.DateTimeFormat." }),
  },
  storage: {
    get: f(["string", "any?"], "any", { doc: "Lê localStorage; usa fallback quando indisponível ou ausente." }),
    set: f(["string", "any"], "boolean"),
    remove: f(["string"], "boolean"),
    clear: f([], "boolean"),
  },
  http: {
    get: f(["string"], "any", { doc: "GET assíncrono; use await http.get(url)." }),
    getJson: f(["string"], "any", { doc: "GET JSON assíncrono; use await http.getJson(url)." }),
    postJson: f(["string", "any"], "any", { doc: "POST JSON assíncrono; use await http.postJson(url, dados)." }),
  },
  js: {
    run: f(["string"], "any", { doc: "Executa código JavaScript arbitrário e retorna o resultado." }),
    eval: f(["string"], "any", { doc: "Alias de js.run: avalia JavaScript puro (expressão ou bloco)." }),
    get: f(["string"], "any", { doc: 'Lê um global JS por caminho, ex.: js.get("document.title").' }),
    set: f(["string", "any"], "any", { doc: 'Escreve um global JS por caminho, ex.: js.set("document.title", "Oi").' }),
    on: f(["string", "fn"], "boolean", { doc: "Registra um listener global (window.addEventListener) quando disponível." }),
  },
  ui: {
    show: f(["string"], "boolean", { doc: 'Mostra um elemento/modal pelo id: ui.show("ajuda").' }),
    open: f(["string"], "boolean", { doc: 'Abre um modal/dialog pelo id: ui.open("ajuda").' }),
    hide: f(["string"], "boolean", { doc: 'Esconde um elemento/modal pelo id: ui.hide("ajuda").' }),
    close: f(["string"], "boolean", { doc: 'Fecha um modal/dialog pelo id: ui.close("ajuda").' }),
    toggle: f(["string"], "boolean", { doc: 'Alterna visível/oculto pelo id: ui.toggle("menu").' }),
    isVisible: f(["string"], "any", { doc: 'true/false se visível/oculto, null se o id não existe.' }),
    isOpen: f(["string"], "any", { doc: 'Alias de ui.isVisible.' }),
  },
};


/* ===== src\compiler\semantic\components.js ===== */
// Tabela de componentes de UI conhecidos pelo compilador (validação de propriedades e eventos).
// O mapeamento para elementos DOM fica em src/runtime/web/runtime.js.

const COMMON_PROPS = [
  "id", "class", "style", "hidden", "label", "role",
  "width", "height", "padding", "margin", "gap", "background", "border", "radius", "shadow",
  "font", "color", "align", "justify", "position", "opacity",
];

const ev = (...names) => new Set(names);

const COMPONENTS = {
  page: { container: true, args: "text", props: ["title", "theme"], events: ev(), bind: null },
  container: { container: true, args: "none", props: [], events: ev("click"), bind: null },
  row: { container: true, args: "none", props: ["wrap"], events: ev("click"), bind: null },
  column: { container: true, args: "none", props: [], events: ev("click"), bind: null },
  grid: { container: true, args: "none", props: ["columns"], events: ev("click"), bind: null },
  card: { container: true, args: "none", props: [], events: ev("click"), bind: null },
  list: { container: true, args: "none", props: [], events: ev(), bind: null },
  item: { container: true, args: "text", props: [], events: ev("click"), bind: null },
  text: { container: false, args: "text", props: [], events: ev("click"), bind: "read" },
  heading: { container: false, args: "text", props: ["level"], events: ev("click"), bind: "read" },
  button: { container: false, args: "text", props: ["disabled", "variant", "type"], events: ev("click"), bind: null },
  input: { container: false, args: "none", props: ["placeholder", "type", "disabled", "name"], events: ev("input", "change", "focus", "blur", "keydown"), bind: "write", bindType: "string" },
  textarea: { container: false, args: "none", props: ["placeholder", "rows", "disabled", "name"], events: ev("input", "change", "focus", "blur", "keydown"), bind: "write", bindType: "string" },
  checkbox: { container: false, args: "none", props: ["disabled", "name"], events: ev("change"), bind: "write", bindType: "boolean" },
  switch: { container: false, args: "none", props: ["disabled", "name"], events: ev("change"), bind: "write", bindType: "boolean" },
  image: { container: false, args: "none", props: ["src", "alt", "fit"], events: ev("click"), bind: null },
  html: { container: false, args: "text", props: ["raw"], events: ev("click"), bind: null },
  // Formulários e conteúdo semântico. `select` recebe elementos `option` como filhos.
  select: { container: true, args: "none", props: ["disabled", "name", "multiple"], events: ev("change", "focus", "blur"), bind: "write", bindType: "string" },
  option: { container: false, args: "text", props: ["value", "disabled"], events: ev(), bind: null },
  link: { container: false, args: "text", props: ["href", "target", "rel"], events: ev("click"), bind: null },
  badge: { container: false, args: "text", props: ["variant"], events: ev("click"), bind: "read" },
  divider: { container: false, args: "none", props: [], events: ev(), bind: null },
  progress: { container: false, args: "none", props: ["value", "max"], events: ev(), bind: null },
  alert: { container: true, args: "text", props: ["variant"], events: ev("click"), bind: null },
  details: { container: true, args: "none", props: ["open"], events: ev("toggle"), bind: null },
  summary: { container: false, args: "text", props: [], events: ev("click"), bind: null },
  // Janelas que abrem/fecham: use `open: true/false` ou os comandos `ui.open/ui.close/ui.show/ui.hide/ui.toggle`.
  modal: { container: true, args: "text", props: ["title", "open"], events: ev("click", "close"), bind: null },
  dialog: { container: true, args: "text", props: ["title", "open"], events: ev("click", "close"), bind: null },
  tabs: { container: true, args: "none", props: [], events: ev("click"), bind: null },
  tab: { container: true, args: "text", props: ["title", "open"], events: ev("click"), bind: null },
  table: { container: true, args: "none", props: ["columns"], events: ev("click"), bind: null },
  icon: { container: false, args: "text", props: ["src"], events: ev("click"), bind: null },
  canvas: { container: false, args: "none", props: ["src"], events: ev("click"), bind: null },
};

/** Componentes citados na especificação que ainda não existem. */
const PLANNED_COMPONENTS = new Set(["scene", "app"]);


/* ===== src\compiler\semantic\analyzer.js ===== */
// Análise semântica: escopos, resolução de nomes, tipos, validação de UI.
// Anota a AST: Identifier.binding (símbolo), Member.binding (membro da stdlib), *.resolvedType.


function levenshtein(a, b) {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) {
    dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  }
  return dp[a.length][b.length];
}

function suggest(name, candidates) {
  let best = null, bestD = 3;
  for (const c of candidates) { const d = levenshtein(name.toLowerCase(), c.toLowerCase()); if (d < bestD) { bestD = d; best = c; } }
  return best;
}

function sigToType(sig) {
  if (sig.kind === "const") return parseSigType(sig.type).type;
  return fnType(sig.params.map((p) => parseSigType(p)), parseSigType(sig.ret).type, sig.rest);
}

class Scope {
  constructor(parent = null, isFn = false) { this.parent = parent; this.map = new Map(); this.isFn = isFn; }
  lookup(name) { for (let s = this; s; s = s.parent) { const v = s.map.get(name); if (v) return v; } return null; }
  names() { const out = new Set(); for (let s = this; s; s = s.parent) for (const k of s.map.keys()) out.add(k); return [...out]; }
}

function analyze(program, bag) {
  const a = new Analyzer(bag);
  return a.run(program);
}

class Analyzer {
  constructor(bag) {
    this.bag = bag;
    this.global = new Scope();
    this.uis = new Map();
    this.css = [];
    this.jsBlocks = [];
    this.htmlBlocks = [];
    this.csBlocks = [];
    for (const [name, sig] of Object.entries(globals)) this.global.map.set(name, { name, kind: "std", type: sigToType(sig), mutable: false, used: true });
    for (const [name, members] of Object.entries(namespaces)) this.global.map.set(name, { name, kind: "namespace", type: T.any, members, mutable: false, used: true });
  }

  run(program) {
    if (!program.app) this.bag.warn("VESSIE-4002", 'O programa não possui declaração "app"', program.loc, 'Adicione "app NomeDoApp" no início do arquivo');
    // 1ª passada: hoisting de declarações de nível superior
    for (const s of program.body) this.hoist(s, this.global);
    // 2ª passada: análise em ordem
    // 2a: declarações de valores (state/computed/const/let) primeiro, para que as funções vejam seus tipos
    const ctx = { fn: null, loop: 0 };
    const isValueDecl = (s) => s.type === "StateDecl" || s.type === "ComputedDecl" || s.type === "VarDecl";
    for (const s of program.body) if (isValueDecl(s)) this.stmt(s, this.global, ctx, true);
    for (const s of program.body) if (!isValueDecl(s)) this.stmt(s, this.global, ctx, true);
    const entry = this.uis.get("App") ?? [...this.uis.values()][0] ?? null;
    return { program, uis: this.uis, entry: entry ? entry.name : null, css: this.css, jsBlocks: this.jsBlocks, htmlBlocks: this.htmlBlocks, csBlocks: this.csBlocks };
  }

  declare(scope, sym, loc) {
    if (scope.map.has(sym.name)) {
      const prev = scope.map.get(sym.name);
      this.bag.error("VESSIE-2002", `"${sym.name}" já foi declarado neste escopo`, loc, prev.std ? null : `Declaração anterior na linha ${prev.line}`);
      return prev;
    }
    scope.map.set(sym.name, sym);
    return sym;
  }

  hoist(s, scope) {
    switch (s.type) {
      case "FnDecl": {
        const params = s.params.map((p) => ({ type: resolveTypeRef(p.typeAnn, this.bag) ?? T.any, optional: false }));
        const ret = s.isAsync ? T.any : (resolveTypeRef(s.retType, this.bag) ?? null);
        s.binding = this.declare(scope, { name: s.name, kind: "fn", type: fnType(params, ret ?? T.any), declaredRet: !!s.retType || s.isAsync, mutable: false, used: false, line: s.loc.line, node: s, scope }, s.loc);
        break;
      }
      case "StateDecl": case "ComputedDecl": {
        const t = resolveTypeRef(s.typeAnn, this.bag);
        s.binding = this.declare(scope, { name: s.name, kind: s.type === "StateDecl" ? "state" : "computed", type: t ?? T.any, declared: !!t, mutable: s.type === "StateDecl", used: false, line: s.loc.line }, s.loc);
        break;
      }
      case "VarDecl": {
        const t = resolveTypeRef(s.typeAnn, this.bag);
        s.binding = this.declare(scope, { name: s.name, kind: s.kind, type: t ?? T.any, declared: !!t, mutable: s.kind === "let", used: false, top: true, line: s.loc.line }, s.loc);
        break;
      }
      case "UiDecl":
        if (this.uis.has(s.name)) this.bag.error("VESSIE-2002", `Já existe uma ui chamada "${s.name}"`, s.loc);
        else this.uis.set(s.name, s);
        break;
      case "CssDecl":
        if (this.css.some((c) => c.name === s.name)) this.bag.error("VESSIE-2002", `Já existe um bloco css chamado "${s.name}"`, s.loc);
        else this.css.push(s);
        break;
      case "JsDecl":
        if (this.jsBlocks.some((c) => c.name === s.name)) this.bag.error("VESSIE-2002", `Já existe um bloco js chamado "${s.name}"`, s.loc);
        else this.jsBlocks.push(s);
        break;
      case "HtmlDecl":
        if (this.htmlBlocks.some((c) => c.name === s.name)) this.bag.error("VESSIE-2002", `Já existe um bloco html chamado "${s.name}"`, s.loc);
        else {
          this.htmlBlocks.push(s);
          this.declare(scope, { name: s.name, kind: "const", type: T.string, mutable: false, used: false, line: s.loc.line, loc: s.loc }, s.loc);
        }
        break;
      case "CsDecl":
        if (this.csBlocks.some((c) => c.name === s.name)) this.bag.error("VESSIE-2002", `Já existe um bloco cs chamado "${s.name}"`, s.loc);
        else {
          this.csBlocks.push(s);
          this.declare(scope, { name: s.name, kind: "const", type: T.string, mutable: false, used: false, line: s.loc.line, loc: s.loc }, s.loc);
        }
        break;
      default: break;
    }
  }

  // ---------- instruções ----------
  block(stmts, scope, ctx) {
    const inner = new Scope(scope);
    for (const s of stmts) if (s.type === "FnDecl") this.hoist(s, inner);
    for (const s of stmts) this.stmt(s, inner, ctx, false);
    this.warnUnused(inner);
  }

  warnUnused(scope) {
    for (const sym of scope.map.values()) {
      if (!sym.used && (sym.kind === "let" || sym.kind === "const") && !sym.top && !sym.name.startsWith("_")) {
        this.bag.warn("VESSIE-4001", `A variável "${sym.name}" foi declarada mas nunca é usada`, sym.loc ?? {}, 'Remova-a ou prefixe com "_"');
      }
    }
  }

  stmt(s, scope, ctx, top) {
    switch (s.type) {
      case "StateDecl": case "ComputedDecl": case "VarDecl": return this.varLike(s, scope, ctx, top);
      case "FnDecl": return this.fnDecl(s, scope);
      case "UiDecl": return this.ui(s, scope);
      case "CssDecl": return this.cssDecl(s, scope, ctx);
      case "JsDecl": return this.jsDecl(s, scope, ctx);
      case "HtmlDecl": return this.htmlDecl(s, scope, ctx);
      case "CsDecl": return this.csDecl(s, scope, ctx);
      case "Block": return this.block(s.body, scope, ctx);
      case "If":
        this.condition(s.test, scope, ctx, "if");
        this.stmt(s.then, scope, ctx, false);
        if (s.otherwise) this.stmt(s.otherwise, scope, ctx, false);
        return undefined;
      case "While":
        this.condition(s.test, scope, ctx, "while");
        return this.stmt(s.body, scope, { ...ctx, loop: ctx.loop + 1 }, false);
      case "For": {
        const it = this.expr(s.iter, scope, ctx);
        let elem = T.any;
        if (it.kind === "array") elem = it.elem;
        else if (it.kind === "string") elem = T.string;
        else if (it.kind !== "any") this.bag.error("VESSIE-2004", `"for ... in" espera uma lista, mas recebeu ${typeToString(it)}`, s.iter.loc);
        const inner = new Scope(scope);
        inner.map.set(s.name, { name: s.name, kind: "loop", type: elem, mutable: false, used: true });
        return this.stmt(s.body, inner, { ...ctx, loop: ctx.loop + 1 }, false);
      }
      case "Return": return this.ret(s, scope, ctx);
      case "Break": case "Continue":
        if (!ctx.loop) this.bag.error("VESSIE-2012", `"${s.type === "Break" ? "break" : "continue"}" fora de um laço`, s.loc);
        return undefined;
      case "ExprStmt": this.expr(s.expr, scope, ctx); return undefined;
      case "Assign": return this.assign(s, scope, ctx);
      default: return undefined;
    }
  }

  condition(test, scope, ctx, what) {
    const t = this.expr(test, scope, ctx);
    if (t.kind !== "boolean" && t.kind !== "any") this.bag.error("VESSIE-2004", `A condição de "${what}" deve ser boolean, mas é ${typeToString(t)}`, test.loc, "Compare explicitamente, por exemplo: valor != 0");
  }

  varLike(s, scope, ctx, top) {
    let sym = s.binding;
    if (!sym) { // declaração local (não içada)
      const t = resolveTypeRef(s.typeAnn, this.bag);
      const kind = s.type === "VarDecl" ? s.kind : s.type === "StateDecl" ? "state" : "computed";
      sym = this.declare(scope, { name: s.name, kind, type: t ?? T.any, declared: !!t, mutable: kind === "let", used: false, loc: s.loc, line: s.loc.line }, s.loc);
      s.binding = sym;
    } else sym.loc = s.loc;
    if (s.init) {
      const it = this.expr(s.init, scope, ctx);
      if (sym.declared) {
        if (!isAssignable(sym.type, it)) this.bag.error("VESSIE-2004", `Não é possível atribuir ${typeToString(it)} a "${s.name}" do tipo ${typeToString(sym.type)}`, s.init.loc);
      } else if (it.kind !== "null" && it.kind !== "void") sym.type = it;
      else if (it.kind === "void") this.bag.error("VESSIE-2004", "A expressão não produz valor (void)", s.init.loc);
    }
    return undefined;
  }

  // ---------- blocos de conteúdo (css / js / html) ----------
  cssDecl(s, scope, ctx) {
    if (s.raw) {
      const t = this.expr(s.raw, scope, ctx);
      if (t.kind !== "string" && t.kind !== "any") this.bag.error("VESSIE-2004", `O bloco css "${s.name}" deve ser uma string (template ou texto), mas é ${typeToString(t)}`, s.raw.loc);
    }
    for (const r of s.rules) {
      if (r.selectorExpr) this.expr(r.selectorExpr, scope, ctx);
      if (!r.selector && !r.selectorExpr) this.bag.error("VESSIE-2004", `Regra css sem seletor no bloco "${s.name}"`, r.loc);
      for (const p of r.props) {
        const t = this.expr(p.value, scope, ctx);
        if (!["string", "number", "boolean", "any"].includes(t.kind)) this.bag.error("VESSIE-2004", `Valor da propriedade css "${p.name}" deve ser string, number ou boolean, mas é ${typeToString(t)}`, p.value.loc);
      }
    }
    return undefined;
  }

  jsDecl(s, scope, ctx) {
    const t = this.expr(s.code, scope, ctx);
    if (t.kind !== "string" && t.kind !== "any") this.bag.error("VESSIE-2004", `O bloco js "${s.name}" deve ser uma string com código JavaScript, mas é ${typeToString(t)}`, s.code.loc);
    return undefined;
  }

  htmlDecl(s, scope, ctx) {
    const t = this.expr(s.markup, scope, ctx);
    if (t.kind !== "string" && t.kind !== "any") this.bag.error("VESSIE-2004", `O bloco html "${s.name}" deve ser uma string com markup, mas é ${typeToString(t)}`, s.markup.loc);
    else {
      const sym = scope.lookup(s.name);
      if (sym) { sym.used = true; sym.htmlBlock = true; s.binding = sym; }
    }
    return undefined;
  }

  csDecl(s, scope, ctx) {
    const t = this.expr(s.source, scope, ctx);
    if (t.kind !== "string" && t.kind !== "any") this.bag.error("VESSIE-2004", `O bloco cs "${s.name}" deve ser uma string com código C#, mas é ${typeToString(t)}`, s.source.loc);
    else {
      const sym = scope.lookup(s.name);
      if (sym) { sym.used = true; sym.csBlock = true; s.binding = sym; }
    }
    return undefined;
  }

  fnDecl(s, scope) {
    if (s.analyzed) return undefined;
    s.analyzed = true;
    const sym = s.binding ?? this.declare(scope, { name: s.name, kind: "fn", type: fnType(s.params.map((p) => ({ type: resolveTypeRef(p.typeAnn, this.bag) ?? T.any })), T.any), mutable: false, used: false }, s.loc);
    if (!s.binding) s.binding = sym;
    const inner = new Scope(scope, true);
    s.params.forEach((p, i) => {
      this.declare(inner, { name: p.name, kind: "param", type: sym.type.params[i].type, mutable: true, used: true }, p.loc);
    });
    const fnCtx = { retType: s.isAsync ? null : (resolveTypeRef(s.retType, this.bag) ?? null), rets: [], isAsync: s.isAsync };
    const ctx = { fn: fnCtx, loop: 0 };
    for (const st of s.body.body) if (st.type === "FnDecl") this.hoist(st, inner);
    for (const st of s.body.body) this.stmt(st, inner, ctx, false);
    this.warnUnused(inner);
    if (!s.retType && !s.isAsync) {
      sym.type = fnType(sym.type.params, fnCtx.rets.length ? fnCtx.rets.reduce((x, y) => unify(x, y)) : T.void);
    }
    return undefined;
  }

  ret(s, scope, ctx) {
    if (!ctx.fn) { this.bag.error("VESSIE-2011", '"return" fora de uma função', s.loc); return; }
    const t = s.value ? this.expr(s.value, scope, ctx) : T.void;
    const { retType } = ctx.fn;
    if (retType) {
      if (retType.kind === "void" && s.value) this.bag.error("VESSIE-2006", "Uma função void não pode retornar valor", s.value.loc);
      else if (retType.kind !== "void" && !s.value) this.bag.error("VESSIE-2006", `A função deve retornar ${typeToString(retType)}`, s.loc);
      else if (!isAssignable(retType, t)) this.bag.error("VESSIE-2006", `Retorno ${typeToString(t)} incompatível com o tipo declarado ${typeToString(retType)}`, (s.value ?? s).loc);
    } else ctx.fn.rets.push(t);
  }

  assign(s, scope, ctx) {
    const tt = this.lvalue(s.target, scope, ctx);
    const vt = this.expr(s.value, scope, ctx);
    const opLoc = s.target.loc;
    if (s.op === "=") {
      if (!isAssignable(tt, vt)) this.bag.error("VESSIE-2004", `Não é possível atribuir ${typeToString(vt)} a um destino do tipo ${typeToString(tt)}`, s.value.loc);
    } else if (s.op === "+=") {
      const ok = (tt.kind === "number" && (vt.kind === "number" || vt.kind === "any")) || (tt.kind === "string" && vt.kind !== "void") || tt.kind === "any";
      if (!ok) this.bag.error("VESSIE-2004", `Operador "+=" não é válido entre ${typeToString(tt)} e ${typeToString(vt)}`, opLoc);
    } else if (!((tt.kind === "number" || tt.kind === "any") && (vt.kind === "number" || vt.kind === "any"))) {
      this.bag.error("VESSIE-2004", `Operador "${s.op}" exige números, mas recebeu ${typeToString(tt)} e ${typeToString(vt)}`, opLoc);
    }
    return undefined;
  }

  lvalue(target, scope, ctx) {
    if (target.type === "Identifier") {
      const sym = scope.lookup(target.name);
      const t = this.expr(target, scope, ctx);
      if (sym && !sym.mutable) {
        const what = sym.kind === "const" ? "uma constante" : sym.kind === "computed" ? "um valor computed (somente leitura)" : sym.kind === "fn" ? "uma função" : sym.kind === "loop" ? "a variável do laço" : "um valor imutável";
        this.bag.error("VESSIE-2003", `"${target.name}" é ${what} e não pode receber atribuição`, target.loc, sym.kind === "const" ? `Declare com "let" se precisar alterar o valor` : null);
      }
      return t;
    }
    if (target.type === "Member" || target.type === "Index") {
      let root = target;
      while (root.type === "Member" || root.type === "Index") root = root.object;
      if (root.type === "Identifier") {
        const sym = scope.lookup(root.name);
        if (sym && (sym.kind === "computed" || sym.kind === "std" || sym.kind === "namespace")) {
          this.bag.error("VESSIE-2003", `"${root.name}" é somente leitura`, root.loc);
        }
      }
      return this.expr(target, scope, ctx);
    }
    return T.any;
  }

  // ---------- expressões ----------
  expr(e, scope, ctx) {
    const t = this.expr0(e, scope, ctx);
    e.resolvedType = t;
    return t;
  }

  expr0(e, scope, ctx) {
    switch (e.type) {
      case "Number": return T.number;
      case "String": return T.string;
      case "Boolean": return T.boolean;
      case "Null": return T.null;
      case "Template": for (const p of e.parts) if (p.kind === "expr") this.expr(p.expr, scope, ctx); return T.string;
      case "Identifier": return this.ident(e, scope);
      case "Array": {
        const ts = e.items.map((i) => this.expr(i, scope, ctx));
        return arrayOf(ts.length ? ts.reduce((x, y) => unify(x, y)) : T.any);
      }
      case "Object": for (const p of e.props) this.expr(p.value, scope, ctx); return T.object;
      case "Member": return this.member(e, scope, ctx);
      case "Index": {
        const ot = this.expr(e.object, scope, ctx);
        const it = this.expr(e.index, scope, ctx);
        if (ot.kind === "array") {
          if (it.kind !== "number" && it.kind !== "any") this.bag.error("VESSIE-2004", `O índice de uma lista deve ser number, mas é ${typeToString(it)}`, e.index.loc);
          return ot.elem;
        }
        if (ot.kind === "string") return T.string;
        return T.any;
      }
      case "Call": return this.call(e, scope, ctx);
      case "Unary": {
        const at = this.expr(e.arg, scope, ctx);
        if (e.op === "!") return T.boolean;
        if (at.kind !== "number" && at.kind !== "any") this.bag.error("VESSIE-2004", `Operador unário "${e.op}" exige number, mas recebeu ${typeToString(at)}`, e.loc);
        return T.number;
      }
      case "Await": this.expr(e.arg, scope, ctx); return T.any;
      case "Binary": return this.binary(e, scope, ctx);
      case "Ternary": {
        this.condition(e.test, scope, ctx, "?:");
        return unify(this.expr(e.then, scope, ctx), this.expr(e.otherwise, scope, ctx));
      }
      case "Arrow": return this.arrow(e, scope, ctx);
      default: return T.any;
    }
  }

  ident(e, scope) {
    const sym = scope.lookup(e.name);
    if (!sym) {
      const s = suggest(e.name, scope.names());
      this.bag.error("VESSIE-2001", `A variável "${e.name}" não foi encontrada no escopo atual`, { ...e.loc, length: e.name.length }, s ? `Você quis dizer "${s}"?` : null);
      e.binding = { name: e.name, kind: "unknown" };
      return T.any;
    }
    sym.used = true;
    e.binding = sym;
    // função sem tipo de retorno declarado: infere o corpo sob demanda para que chamadas antes da definição vejam o tipo
    if (sym.kind === "fn" && sym.node && !sym.node.analyzed && !sym.declaredRet) this.fnDecl(sym.node, sym.scope);
    return sym.type;
  }

  member(e, scope, ctx) {
    if (e.object.type === "Identifier") {
      const sym = scope.lookup(e.object.name);
      if (sym && sym.kind === "namespace") {
        sym.used = true;
        e.object.binding = sym;
        const m = sym.members[e.property];
        if (!m) {
          const s = suggest(e.property, Object.keys(sym.members));
          this.bag.error("VESSIE-2016", `"${sym.name}" não possui o membro "${e.property}"`, e.propLoc, s ? `Você quis dizer "${sym.name}.${s}"?` : null);
          return T.any;
        }
        e.binding = { kind: "stdmember", ns: sym.name, name: e.property, isConst: m.kind === "const" };
        return sigToType(m);
      }
    }
    const ot = this.expr(e.object, scope, ctx);
    if (e.property === "length" && (ot.kind === "array" || ot.kind === "string")) return T.number;
    return T.any;
  }

  binary(e, scope, ctx) {
    const l = this.expr(e.left, scope, ctx), r = this.expr(e.right, scope, ctx);
    const bad = () => { this.bag.error("VESSIE-2004", `Operador "${e.op}" não é válido entre ${typeToString(l)} e ${typeToString(r)}`, e.opLoc); return T.any; };
    const isNum = (t) => t.kind === "number" || t.kind === "any";
    switch (e.op) {
      case "+":
        if (l.kind === "string" || r.kind === "string") return (l.kind === "void" || r.kind === "void") ? bad() : T.string;
        if (isNum(l) && isNum(r)) return l.kind === "any" && r.kind === "any" ? T.any : T.number;
        return bad();
      case "-": case "*": case "/": case "%": return isNum(l) && isNum(r) ? T.number : bad();
      case "<": case ">": case "<=": case ">=": {
        const ok = (isNum(l) && isNum(r)) || (l.kind === "string" && (r.kind === "string" || r.kind === "any")) || (l.kind === "any" && r.kind === "string");
        return ok ? T.boolean : bad();
      }
      case "==": case "!=": return T.boolean;
      case "&&": case "||": return l.kind === "boolean" && r.kind === "boolean" ? T.boolean : unify(l, r);
      case "??": return r.kind === "null" ? l : unify(l, r);
      default: return T.any;
    }
  }

  arrow(e, scope, ctx) {
    const inner = new Scope(scope, true);
    const params = e.params.map((p) => {
      const t = resolveTypeRef(p.typeAnn, this.bag) ?? T.any;
      this.declare(inner, { name: p.name, kind: "param", type: t, mutable: true, used: true }, p.loc);
      return { type: t };
    });
    let ret = T.any;
    if (e.body.type === "Block") {
      const fnCtx = { retType: null, rets: [], isAsync: false };
      const c = { fn: fnCtx, loop: 0 };
      for (const st of e.body.body) if (st.type === "FnDecl") this.hoist(st, inner);
      for (const st of e.body.body) this.stmt(st, inner, c, false);
      this.warnUnused(inner);
      ret = fnCtx.rets.length ? fnCtx.rets.reduce((x, y) => unify(x, y)) : T.void;
    } else if (e.body.type === "Assign") { this.assign(e.body, inner, { fn: { retType: null, rets: [] }, loop: 0 }); ret = T.void; }
    else ret = this.expr(e.body, inner, { fn: { retType: null, rets: [] }, loop: 0 });
    return fnType(params, ret);
  }

  call(e, scope, ctx) {
    const ct = this.expr(e.callee, scope, ctx);
    const argTypes = e.args.map((a) => this.expr(a, scope, ctx));
    if (ct.kind !== "fn") {
      if (ct.kind !== "any") this.bag.error("VESSIE-2010", `${this.calleeName(e.callee)} não é uma função (tipo ${typeToString(ct)})`, e.callee.loc);
      return T.any;
    }
    const name = this.calleeName(e.callee);
    const required = ct.params.filter((p) => !p.optional).length;
    const max = ct.params.length;
    const isUnknownArity = ct.params.length === 0 && ct.rest && !e.callee.binding; // tipo "fn" genérico
    if (!isUnknownArity) {
      if (argTypes.length < required || (!ct.rest && argTypes.length > max)) {
        const expected = ct.rest ? `pelo menos ${required}` : required === max ? `${max}` : `${required} a ${max}`;
        this.bag.error("VESSIE-2005", `${name} espera ${expected} argumento(s), mas recebeu ${argTypes.length}`, e.loc);
      } else {
        argTypes.forEach((at, i) => {
          const p = ct.params[Math.min(i, ct.params.length - 1)];
          if (p && !isAssignable(p.type, at)) this.bag.error("VESSIE-2004", `Argumento ${i + 1} de ${name}: esperado ${typeToString(p.type)}, recebido ${typeToString(at)}`, e.args[i].loc);
        });
      }
    }
    return ct.ret;
  }

  calleeName(c) {
    if (c.type === "Identifier") return `"${c.name}"`;
    if (c.type === "Member" && c.object.type === "Identifier") return `"${c.object.name}.${c.property}"`;
    return "O valor chamado";
  }

  // ---------- UI ----------
  ui(u, scope) {
    if (!u.children.length || u.children.some((c) => c.tag !== "page")) {
      this.bag.error("VESSIE-2015", `A ui "${u.name}" deve conter elementos "page" na raiz`, u.loc, 'Exemplo: ui App { page "Título" { ... } }');
    }
    if (u.children.length > 1) this.bag.error("VESSIE-2015", `A ui "${u.name}" possui várias "page"; por enquanto só uma page por ui é suportada`, u.children[1].loc, "Navegação entre páginas é uma funcionalidade planejada");
    const ctx = { fn: null, loop: 0 };
    for (const c of u.children) this.element(c, scope, ctx, true);
  }

  element(el, scope, ctx, isRoot) {
    const comp = COMPONENTS[el.tag];
    if (!comp) {
      const planned = PLANNED_COMPONENTS.has(el.tag);
      const s = suggest(el.tag, Object.keys(COMPONENTS));
      this.bag.error("VESSIE-2007", planned ? `O componente "${el.tag}" está planejado, mas ainda não foi implementado` : `Componente desconhecido: "${el.tag}"`, el.loc, planned ? "Veja docs/STATUS.md para o estado das funcionalidades" : (s ? `Você quis dizer "${s}"?` : `Componentes disponíveis: ${Object.keys(COMPONENTS).join(", ")}`));
      // ainda analisa filhos para reportar outros erros
      for (const a of el.args) this.expr(a, scope, ctx);
      for (const p of el.props) this.expr(p.value, scope, ctx);
      for (const c of el.children) this.element(c, scope, ctx, false);
      return;
    }
    if (el.tag === "page" && !isRoot) this.bag.error("VESSIE-2007", '"page" só pode ser usado na raiz de uma ui', el.loc);
    if (comp.args === "none" && el.args.length) this.bag.error("VESSIE-2005", `"${el.tag}" não aceita argumento posicional`, el.args[0].loc, "Use propriedades nomeadas, por exemplo: propriedade: valor");
    if (el.args.length > 1) this.bag.error("VESSIE-2005", `"${el.tag}" aceita no máximo um argumento posicional`, el.args[1].loc);
    for (const a of el.args) this.expr(a, scope, ctx);

    const allowedProps = new Set([...COMMON_PROPS, ...comp.props]);
    const seen = new Set();
    for (const p of el.props) {
      if (!allowedProps.has(p.name)) {
        const s = suggest(p.name, [...allowedProps]);
        this.bag.error("VESSIE-2008", `"${el.tag}" não possui a propriedade "${p.name}"`, { ...p.loc, length: p.name.length }, s ? `Você quis dizer "${s}"?` : `Propriedades: ${[...allowedProps].join(", ")}`);
      } else if (seen.has(p.name)) this.bag.error("VESSIE-2008", `Propriedade "${p.name}" repetida em "${el.tag}"`, p.loc);
      seen.add(p.name);
      this.expr(p.value, scope, ctx);
    }

    for (const ev of el.events) {
      if (!comp.events.has(ev.name)) this.bag.error("VESSIE-2009", `"${el.tag}" não suporta o evento "${ev.name}"`, ev.loc, `Eventos: ${[...comp.events].join(", ") || "(nenhum)"}`);
      const h = ev.handler;
      if (h.type === "Arrow") this.expr(h, scope, ctx);
      else if (h.type === "Identifier") {
        const t = this.expr(h, scope, ctx);
        if (t.kind !== "fn" && t.kind !== "any") this.bag.error("VESSIE-2014", `O manipulador "${h.name}" não é uma função`, h.loc);
        else if (t.kind === "fn" && t.params.length > 1) this.bag.error("VESSIE-2014", `O manipulador "${h.name}" pode receber no máximo 1 parâmetro (o evento)`, h.loc);
      } else this.bag.error("VESSIE-2014", "O manipulador de evento deve ser o nome de uma função ou uma função anônima (() => ...)", h.loc, `Exemplo: on:${ev.name} minhaFuncao`);
    }

    if (el.bind) {
      const b = el.bind.target;
      if (!["Identifier", "Member", "Index"].includes(b.type)) this.bag.error("VESSIE-2013", "bind: deve apontar para uma variável, membro ou índice", b.loc);
      else {
        const t = this.expr(b, scope, ctx);
        let root = b;
        while (root.type === "Member" || root.type === "Index") root = root.object;
        const sym = root.type === "Identifier" ? scope.lookup(root.name) : null;
        if (!comp.bind) this.bag.error("VESSIE-2013", `"${el.tag}" não suporta bind:`, el.bind.loc);
        else if (comp.bind === "write") {
          if (!sym || sym.kind !== "state") this.bag.error("VESSIE-2013", `bind: em "${el.tag}" exige um "state" (o valor é escrito pelo usuário)`, b.loc, "Declare: state nome: string = \"\"");
          const want = comp.bindType;
          if (want && t.kind !== "any" && t.kind !== "object" && t.kind !== want) this.bag.error("VESSIE-2013", `bind: em "${el.tag}" espera ${want}, mas o valor é ${typeToString(t)}`, b.loc);
        }
      }
    }

    if (el.children.length && !comp.container) this.bag.error("VESSIE-2008", `"${el.tag}" não aceita elementos filhos`, el.children[0].loc);
    for (const c of el.children) this.element(c, scope, ctx, false);
  }
}


/* ===== src\compiler\backends\js.js ===== */
// Backend JavaScript: gera um módulo ES a partir da AST analisada, com source map (nível de linha).


const JS_RESERVED = new Set([
  "break", "case", "catch", "class", "const", "continue", "debugger", "default", "delete", "do", "else", "enum", "export",
  "extends", "false", "finally", "for", "function", "if", "import", "in", "instanceof", "new", "null", "return", "super",
  "switch", "this", "throw", "true", "try", "typeof", "var", "void", "while", "with", "yield", "let", "static",
  "implements", "interface", "package", "private", "protected", "public", "await", "async", "arguments", "eval",
  "undefined", "NaN", "Infinity", "h",
]);

const IDENT_RE = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

/** Nome seguro em JavaScript para um identificador Vessie. */
function jsName(name) {
  if (JS_RESERVED.has(name) || name.startsWith("$")) return `_v$${name.replace(/^\$/, "")}`;
  return name;
}

const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
function vlq(n) {
  let v = n < 0 ? ((-n) << 1) | 1 : n << 1;
  let out = "";
  do { let d = v & 31; v >>>= 5; if (v > 0) d |= 32; out += B64[d]; } while (v > 0);
  return out;
}

const key = (k) => (IDENT_RE.test(k) ? k : JSON.stringify(k));
const eventProp = (name) => `on${name[0].toUpperCase()}${name.slice(1)}`;

class Gen {
  constructor(opts) { this.opts = opts; this.lines = []; this.ind = 0; }

  line(text, loc = null) {
    const pad = "  ".repeat(this.ind);
    text.split("\n").forEach((part, i) => this.lines.push({ text: pad + part, loc: i === 0 ? loc : null }));
  }

  stmts(list) { for (const s of list) this.stmt(s); }

  block(list) { this.ind++; this.stmts(list); this.ind--; }

  stmt(s) {
    switch (s.type) {
      case "StateDecl":
        this.line(`$.${jsName(s.name)} = ${this.ex(s.init)};`, s.loc); break;
      case "ComputedDecl":
        this.line(`$c.${jsName(s.name)} = () => (${this.ex(s.init)});`, s.loc); break;
      case "CssDecl": this.cssDecl(s); break;
      case "JsDecl": this.jsDecl(s); break;
      case "HtmlDecl": this.htmlDecl(s); break;
      case "CsDecl": this.csDecl(s); break;
      case "VarDecl":
        this.line(s.init ? `${s.kind} ${jsName(s.name)} = ${this.ex(s.init)};` : `let ${jsName(s.name)};`, s.loc); break;
      case "FnDecl":
        this.line(`${s.isAsync ? "async " : ""}function ${jsName(s.name)}(${s.params.map((p) => jsName(p.name)).join(", ")}) {`, s.loc);
        this.block(s.body.body);
        this.line("}");
        break;
      case "UiDecl": this.ui(s); break;
      case "Block": this.line("{", s.loc); this.block(s.body); this.line("}"); break;
      case "If": this.ifStmt(s); break;
      case "While": this.line(`while (${this.ex(s.test)}) {`, s.loc); this.block(s.body.body); this.line("}"); break;
      case "For": this.line(`for (const ${jsName(s.name)} of ${this.ex(s.iter)}) {`, s.loc); this.block(s.body.body); this.line("}"); break;
      case "Return": this.line(s.value ? `return ${this.ex(s.value)};` : "return;", s.loc); break;
      case "Break": this.line("break;", s.loc); break;
      case "Continue": this.line("continue;", s.loc); break;
      case "ExprStmt": this.line(`${this.ex(s.expr)};`, s.loc); break;
      case "Assign": this.line(`${this.assign(s)};`, s.loc); break;
      default: throw new Error(`Gerador: nó de instrução desconhecido: ${s.type}`);
    }
  }

  ifStmt(s) {
    this.line(`if (${this.ex(s.test)}) {`, s.loc);
    this.block(s.then.body);
    if (s.otherwise) {
      this.line("} else {");
      this.ind++;
      if (s.otherwise.type === "If") this.ifStmt(s.otherwise); else this.stmts(s.otherwise.body);
      this.ind--;
    }
    this.line("}");
  }

  assign(s) { return `${this.ex(s.target)} ${s.op} ${this.ex(s.value)}`; }

  // ---------- expressões ----------
  ex(e) {
    switch (e.type) {
      case "Number": return e.raw;
      case "String": return JSON.stringify(e.value);
      case "Boolean": return String(e.value);
      case "Null": return "null";
      case "Template": return this.template(e);
      case "Identifier": return this.ident(e);
      case "Array": return `[${e.items.map((i) => this.ex(i)).join(", ")}]`;
      case "Object": return `{ ${e.props.map((p) => `${key(p.key)}: ${this.ex(p.value)}`).join(", ")} }`;
      case "Member":
        if (e.binding?.kind === "stdmember") return `$std.${e.binding.ns}.${e.property}`;
        return `${this.ex(e.object)}.${e.property}`;
      case "Index": return `${this.ex(e.object)}[${this.ex(e.index)}]`;
      case "Call": return `${this.ex(e.callee)}(${e.args.map((a) => this.ex(a)).join(", ")})`;
      case "Unary": return `(${e.op}${this.ex(e.arg)})`;
      case "Await": return `(await ${this.ex(e.arg)})`;
      case "Binary": {
        const op = e.op === "==" ? "===" : e.op === "!=" ? "!==" : e.op;
        return `(${this.ex(e.left)} ${op} ${this.ex(e.right)})`;
      }
      case "Ternary": return `(${this.ex(e.test)} ? ${this.ex(e.then)} : ${this.ex(e.otherwise)})`;
      case "Arrow": return this.arrow(e);
      default: throw new Error(`Gerador: nó de expressão desconhecido: ${e.type}`);
    }
  }

  ident(e) {
    const b = e.binding;
    if (b?.htmlBlock) return `$html[${JSON.stringify(e.name)}]`;
    if (b?.csBlock) return `$cs[${JSON.stringify(e.name)}]`;
    switch (b?.kind) {
      case "state": return `$.${jsName(e.name)}`;
      case "computed": return `$c.${jsName(e.name)}()`;
      case "std": case "namespace": return `$std.${e.name}`;
      default: return jsName(e.name);
    }
  }

  template(e) {
    const esc = (s) => s.replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$\{/g, "\\${");
    return `\`${e.parts.map((p) => (p.kind === "str" ? esc(p.value) : `\${${this.ex(p.expr)}}`)).join("")}\``;
  }

  arrow(e) {
    const params = `(${e.params.map((p) => jsName(p.name)).join(", ")})`;
    if (e.body.type === "Block") {
      const sub = new Gen(this.opts);
      sub.ind = 1;
      sub.stmts(e.body.body);
      return `${params} => {\n${sub.lines.map((l) => l.text).join("\n")}\n}`;
    }
    if (e.body.type === "Assign") return `${params} => { ${this.assign(e.body)}; }`;
    const b = this.ex(e.body);
    return `${params} => ${e.body.type === "Object" ? `(${b})` : b}`;
  }

  // ---------- blocos de conteúdo (css / js / html) ----------
  staticText(e) {
    if (!e) return null;
    if (e.type === "String") return e.value;
    if (e.type === "Template" && e.parts.every((p) => p.kind === "str")) return e.parts.map((p) => p.value).join("");
    if (e.type === "Number") return String(e.value);
    if (e.type === "Boolean") return String(e.value);
    return null;
  }

  cssDecl(s) {
    if (s.raw) {
      const lit = this.staticText(s.raw);
      this.line(`$css.push(${lit !== null ? JSON.stringify(lit) : this.ex(s.raw)});`, s.loc);
      return;
    }
    for (const r of s.rules) {
      const selLit = r.selector ?? this.staticText(r.selectorExpr);
      const parts = [];
      let dynamic = r.selectorExpr && selLit === null;
      for (const p of r.props) {
        const v = this.staticText(p.value);
        if (v === null) { dynamic = true; break; }
      }
      if (!dynamic && selLit !== null) {
        const body = r.props.map((p) => `${p.name}: ${this.staticText(p.value)}`).join("; ");
        this.line(`$css.push(${JSON.stringify(`${selLit} { ${body}; }`)});`, s.loc);
      } else {
        // regra com interpolação: monta o CSS em tempo de execução
        const selEx = r.selector !== null && r.selector !== undefined ? JSON.stringify(r.selector) : this.ex(r.selectorExpr);
        const valEx = r.props.map((p) => `${JSON.stringify(`${p.name}: `)} + (${this.ex(p.value)})`).join(` + ${JSON.stringify("; ")} + `);
        this.line(`$css.push((${selEx}) + ${JSON.stringify(" { ")} + (${valEx}) + ${JSON.stringify("; }")});`, s.loc);
      }
    }
  }

  jsDecl(s) {
    const lit = this.staticText(s.code);
    this.line(`// js:${s.name} (compatibilidade direta com JavaScript)`, s.loc);
    if (lit !== null) {
      // código literal: executa verbatim, no mesmo escopo ($, $c, $ui, $std, h disponíveis)
      for (const ln of String(lit).split("\n")) this.line(ln === "" ? "" : ln);
    } else {
      this.line(`$std.js.run(${this.ex(s.code)});`, s.loc);
    }
  }

  htmlDecl(s) {
    const v = jsName(s.name);
    this.line(`const $h_${v} = (${this.ex(s.markup)});`, s.loc);
    this.line(`$html[${JSON.stringify(s.name)}] = $h_${v};`);
  }

  csDecl(s) {
    const v = jsName(s.name);
    this.line(`// cs:${s.name} (fonte C# original; converta com: vessie cs convert)`, s.loc);
    this.line(`const $cs_${v} = (${this.ex(s.source)});`, s.loc);
    this.line(`$cs[${JSON.stringify(s.name)}] = $cs_${v};`);
  }

  // ---------- UI ----------
  ui(u) {
    const root = u.children[0];
    this.line(`$ui.${jsName(u.name)} = () => ${root ? this.element(root, 1) : "null"};`, u.loc);
  }

  element(el, depth) {
    const comp = COMPONENTS[el.tag];
    if (!comp) return "null"; // já reportado pelo analisador
    const pad = "  ".repeat(depth + this.ind);
    const props = [];
    const children = [];
    if (el.args.length) {
      if (el.tag === "page") props.push(`title: ${this.ex(el.args[0])}`);
      else if (el.tag === "html") props.push(`raw: ${this.ex(el.args[0])}`);
      else children.push(this.ex(el.args[0]));
    }
    if (el.tag === "html" && el.args.length > 1) {
      for (let i = 1; i < el.args.length; i++) children.push(this.ex(el.args[i]));
    }
    for (const p of el.props) props.push(`${key(p.name)}: ${this.ex(p.value)}`);
    for (const ev of el.events) props.push(`${eventProp(ev.name)}: ${this.ex(ev.handler)}`);
    if (el.bind) {
      const getter = this.ex(el.bind.target);
      if (comp.bind === "write") props.push(`bind: { get: () => ${getter}, set: ($v) => { ${getter} = $v; } }`);
      else if (comp.bind === "read") children.push(getter);
    }
    for (const c of el.children) children.push(this.element(c, depth + 1));
    const propsStr = props.length ? `{ ${props.join(", ")} }` : "null";
    if (!children.length) return `h(${JSON.stringify(el.tag)}, ${propsStr})`;
    const inner = children.map((c) => `${pad}  ${c}`).join(",\n");
    return `h(${JSON.stringify(el.tag)}, ${propsStr}, [\n${inner},\n${pad}])`;
  }
}

/**
 * @param {object} program AST analisada
 * @param {{entry:string|null}} analysis
 * @param {{file?:string, runtimePath?:string, sourceMap?:boolean, source?:string, mapFileName?:string}} opts
 */
function generateJS(program, analysis, opts = {}) {
  const { file = "<memória>", runtimePath = "./runtime/vessie-runtime.js", source = null } = opts;
  const g = new Gen(opts);
  const appName = program.app?.name ?? "VessieApp";
  const head = [
    "// Gerado pelo compilador Vessie. Não edite: altere o arquivo .vessie de origem.",
    `import * as $R from ${JSON.stringify(runtimePath)};`,
    "const $std = $R.stdlib;",
    "const { h } = $R;",
    "const $ = $R.createState();",
    "const $c = {};",
    "const $ui = {};",
    "const $css = [];",
    "const $html = {};",
    "const $cs = {};",
    "",
  ];
  g.stmts(program.body);
  const hasMain = program.body.some((s) => s.type === "FnDecl" && s.name === "main" && s.params.length === 0 && !s.isAsync);
  const tail = [
    "",
    `export const app = $R.createApp({ name: ${JSON.stringify(appName)}, state: $, computed: $c, ui: ${analysis.entry ? `$ui.${jsName(analysis.entry)}` : "null"}, css: $css, html: $html, cs: $cs });`,
    "if ($css.length) $R.injectCss($css.join(\"\\n\"));",
    ...(hasMain ? ["main();"] : []),
    ...(opts.autostart === false ? [] : ["$R.start(app);"]),
  ];

  const all = [...head.map((text) => ({ text, loc: null })), ...g.lines, ...tail.map((text) => ({ text, loc: null }))];
  let code = all.map((l) => l.text).join("\n") + "\n";

  let map = null;
  if (opts.sourceMap !== false) {
    let prevLine = 0, prevCol = 0;
    const segs = all.map((l) => {
      if (!l.loc) return "";
      const sl = l.loc.line - 1, sc = l.loc.col - 1;
      const seg = vlq(0) + vlq(0) + vlq(sl - prevLine) + vlq(sc - prevCol);
      prevLine = sl; prevCol = sc;
      return seg;
    });
    map = { version: 3, file: "app.js", sources: [file], sourcesContent: source != null ? [source] : undefined, names: [], mappings: segs.join(";") };
    if (opts.mapFileName) code += `//# sourceMappingURL=${opts.mapFileName}\n`;
  }
  return { code, map };
}


/* ===== src\compiler\index.js ===== */
// Pipeline do compilador: fonte → lexer → parser → AST → semântica/tipos → backend JS.


const VERSION = "0.1.0";

/**
 * Compila um arquivo Vessie.
 * @returns {{ok:boolean, code:string|null, map:object|null, diagnostics:object[], ast:object, analysis:object|null}}
 */
function compile(source, options = {}) {
  const { file = "<memória>", warnings = true, sourceMap = true, runtimePath, autostart, mapFileName } = options;
  const bag = new DiagnosticBag(file, { warnings });
  let ast = null, analysis = null;
  try {
    ast = parse(source, bag);
    if (!bag.hasErrors()) analysis = analyze(ast, bag);
    else analyze(ast, new DiagnosticBag(file, { warnings: false })); // não reporta em cascata; só evita AST sem anotação
  } catch (e) {
    bag.error("VESSIE-9001", `Erro interno do compilador: ${e.message}`, { line: 1, col: 1 });
  }
  if (bag.hasErrors() || !analysis) return { ok: false, code: null, map: null, diagnostics: bag.items, ast, analysis };
  try {
    const { code, map } = generateJS(ast, analysis, { file, source, runtimePath, sourceMap, autostart, mapFileName });
    return { ok: true, code, map, diagnostics: bag.items, ast, analysis };
  } catch (e) {
    bag.error("VESSIE-9001", `Erro interno no gerador de código: ${e.message}`, { line: 1, col: 1 });
    return { ok: false, code: null, map: null, diagnostics: bag.items, ast, analysis };
  }
}

/** Como compile(), mas lança VessieCompileError quando há erros. */
function compileOrThrow(source, options = {}) {
  const r = compile(source, options);
  if (!r.ok) throw new VessieCompileError(r.diagnostics, source);
  return r;
}



/* ===== src\config\paths.js ===== */
// Utilitários de caminho com proteção contra path traversal.

/** Resolve `target` dentro de `root`; lança erro se escapar (../, caminho absoluto externo). */
function resolveInside(root, target) {
  const base = path.resolve(root);
  const full = path.resolve(base, target);
  const rel = path.relative(base, full);
  if (rel.startsWith("..") || path.isAbsolute(rel)) {
    throw new Error(`Caminho fora do diretório permitido: ${target}`);
  }
  return full;
}


/* ===== src\compiler\backends\single.js ===== */
// Backend de arquivo único: gera UM script .js autocontido a partir de um .vessie.
// O bundle embute stdlib + runtime + CSS base + código do app + blocos css/js/html,
// sem nenhum `import`. Ao ser carregado (<script src>) ou executado (node), ele se
// inicializa sozinho: injeta o CSS, monta em #app (ou body) no navegador e expõe
// globalThis.__VESSIE_APP__. Mantém compatibilidade total com JavaScript.

/** Remove `export ` para embutir o runtime como código local (sem módulos). */
function inlineRuntime(bundle) {
  return bundle
    .split("\n")
    .filter((l) => !l.trim().startsWith("import ") || !l.includes("@bundle-strip"))
    .map((l) => l.replace(/^export\s+(?=const|let|var|function|class|async function)/, ""))
    .join("\n")
    .replace(/export\s*\{[^}]*\}\s*;?/g, "");
}

const cssEscape = (s) => s.replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$\{/g, "\\${");

/**
 * @returns {{ok:boolean, code:string|null, diagnostics:object[], appName:string|null}}
 */
function buildSingleBundle({ file, source, warnings = true, title = null }) {
  const r = compile(source, {
    file, source, warnings, sourceMap: false, runtimePath: "__inline__", autostart: false,
  });
  if (!r.ok) return { ok: false, code: null, diagnostics: r.diagnostics, appName: null };
  const appName = r.ast.app?.name ?? "VessieApp";

  // Código do app sem a linha de import e sem `export` (vira script clássico + módulo).
  // O runtime embutido já declara stdlib/h/... no escopo, então reescreve as pontes $R.
  const appLines = r.code.split("\n").filter((l) => !l.startsWith("import * as $R"));
  const appBody = appLines
    .join("\n")
    .replace(/^export\s+const\s+app\b/m, "const app")
    .replace("const $std = $R.stdlib;", "const $std = stdlib;")
    .replace("const { h } = $R;", "")
    .replace(/\$R\.(createState|createApp|start|injectCss|subscribe|renderToText|computeStyle|safeUrl|setOutput|showUI|hideUI|toggleUI|openUI|closeUI|isVisibleUI)\b/g, "$1");

  const runtimeInline = inlineRuntime(createRuntimeBundle());
  const base = baseCss();

  const code = `// Vessie single-file bundle — app "${appName}" (gerado, não edite)
(function () {
"use strict";
/* ---- runtime embutido (stdlib + web) ---- */
${runtimeInline}
/* ---- ponte $R (mesma API do modo multi-arquivo) ---- */
const $R = { stdlib, setOutput, createState, subscribe, h, computeStyle, safeUrl, createApp, start, renderToText, injectCss, showUI, hideUI, toggleUI, openUI, closeUI, isVisibleUI };
/* ---- CSS base embutido ---- */
const $VESSIE_BASE_CSS = \`${cssEscape(base)}\`;
try { injectCss($VESSIE_BASE_CSS); } catch (e) {}
/* ---- app compilado (state/computed/fn/ui + blocos css/js/html) ---- */
${appBody}
/* ---- sincronização/execução automática ---- */
try {
  if (typeof globalThis !== "undefined") globalThis.__VESSIE_APP__ = app;
  if (typeof window !== "undefined") window.__VESSIE_APP__ = app;
  if (typeof document !== "undefined") {
    const boot = () => { try { start(app); } catch (e) { console.error("[vessie]", e); } };
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once: true });
    else boot();
  } else {
    try { start(app); } catch (e) { console.error("[vessie]", e); }
  }
} catch (e) { console.error("[vessie] falha ao iniciar o bundle:", e); }
})();
`;
  return { ok: true, code, diagnostics: r.diagnostics, appName, title: title ?? appName };
}

/** HTML mínimo que carrega o bundle único via uma única tag <script>. */
function singleBundleHtml({ title = "Vessie", bundleFile = "app.bundle.js" }) {
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
</head>
<body>
<div id="app"></div>
<noscript>Esta aplicação Vessie precisa de JavaScript.</noscript>
<script src="${esc(bundleFile)}"></script>
</body>
</html>
`;
}


/* ===== src\compiler\backends\web.js ===== */
// Backend web: gera dist/{index.html, js/, css/, runtime/, sourcemaps/} a partir de um arquivo .vessie.

const SRC = null;
const read = (rel) => {
  if (Object.prototype.hasOwnProperty.call(__EMBEDDED_ASSETS__, rel)) return __EMBEDDED_ASSETS__[rel];
  throw new Error(`[VessieLang.js] asset embutido ausente: ${rel}`);
};

/** Runtime distribuível: stdlib + runtime web em um único módulo ES sem imports. */
function createRuntimeBundle() {
  const strip = (s) => s.split("\n").filter((l) => !l.includes("@bundle-strip")).join("\n");
  return `// Vessie runtime (bundle gerado por scripts/build.js)\n${strip(read("stdlib/index.js"))}\n${strip(read("runtime/web/runtime.js"))}`;
}

const baseCss = () => read("runtime/web/styles.css");

const escapeHtml = (s) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

/**
 * @returns {{ok:boolean, diagnostics:object[], files:string[]}}
 */
function buildWeb({ file, outDir, mode = "development", title = null, warnings = true }) {
  const source = fs.readFileSync(file, "utf8");
  const dev = mode !== "production";
  const r = compile(source, { file, warnings, sourceMap: dev, runtimePath: "../runtime/vessie-runtime.js", mapFileName: dev ? "app.js.map" : undefined });
  if (!r.ok) return { ok: false, diagnostics: r.diagnostics, files: [], source };
  const out = path.resolve(outDir);
  const files = [];
  const write = (rel, data) => {
    const full = resolveInside(out, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, data);
    files.push(path.relative(out, full));
  };
  const appTitle = title ?? r.ast.app?.name ?? "Vessie";
  write("index.html", `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; img-src 'self' data: https:; connect-src 'self'; object-src 'none'; base-uri 'self'">
<title>${escapeHtml(appTitle)}</title>
<link rel="stylesheet" href="css/vessie.css">
</head>
<body>
<div id="app"></div>
<noscript>Esta aplicação Vessie precisa de JavaScript.</noscript>
<script type="module" src="js/app.js"></script>
</body>
</html>
`);
  write("js/app.js", r.code);
  if (dev && r.map) write("sourcemaps/app.js.map", JSON.stringify(r.map));
  if (dev && r.map) { // o mapa é servido ao lado do JS para o navegador encontrá-lo
    write("js/app.js.map", JSON.stringify(r.map));
  }
  write("css/vessie.css", baseCss());
  write("runtime/vessie-runtime.js", createRuntimeBundle());
  write("assets/.gitkeep", "");
  return { ok: true, diagnostics: r.diagnostics, files, source };
}

/**
 * Build de arquivo único: gera UM .js autocontido + um index.html mínimo que o carrega.
 * O bundle dispensa css/, js/, runtime/ e sourcemaps/ — basta sincronizar/copiar o .js.
 * @returns {{ok:boolean, diagnostics:object[], files:string[], source:string}}
 */
function buildWebSingle({ file, outDir, title = null, warnings = true, bundleName = "app.bundle.js" }) {
  const source = fs.readFileSync(file, "utf8");
  const r = buildSingleBundle({ file, source, warnings, title });
  if (!r.ok) return { ok: false, diagnostics: r.diagnostics, files: [], source };
  const out = path.resolve(outDir);
  const files = [];
  const write = (rel, data) => {
    const full = resolveInside(out, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, data);
    files.push(path.relative(out, full));
  };
  write(bundleName, r.code);
  write("index.html", singleBundleHtml({ title: r.title, bundleFile: bundleName }));
  return { ok: true, diagnostics: r.diagnostics, files, source };
}


/* ===== src\adapters\index.js ===== */
// Adaptadores de execução: rodam trechos de código em toolchains locais
// (Python, Node.js, C, C++, C#) em processo-filho próprio do CLI, com timeout.
// Segurança: sem shell (`shell: false`), sem acesso à rede, arquivos só em
// diretório temporário próprio, limite de tamanho e de tempo. O Vessie NÃO injeta
// código em processos de terceiros: cada execução cria seu próprio processo-filho
// que termina junto com o comando.


const MAX_CODE_BYTES = 256 * 1024;
const DEFAULT_TIMEOUT_MS = 15000;

function which(candidates) {
  for (const c of candidates) {
    try {
      const r = spawnSync(c, ["--version"], { encoding: "utf8", timeout: 5000 });
      if (!r.error && r.status === 0) return { cmd: c, version: (r.stdout || r.stderr).split("\n")[0].trim() };
    } catch { /* tenta o próximo */ }
  }
  return null;
}

function tmpWork() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "vessie-exec-"));
}

function run(cmd, args, { timeout = DEFAULT_TIMEOUT_MS } = {}) {
  const r = spawnSync(cmd, args, { encoding: "utf8", timeout, shell: false, windowsHide: true });
  if (r.error) {
    const killed = r.error.code === "ETIMEDOUT" || r.signal === "SIGTERM";
    return { ok: false, stdout: r.stdout ?? "", stderr: r.stderr ?? "", exitCode: null, timedOut: !!killed, error: killed ? `Tempo esgotado (${timeout}ms)` : r.error.message };
  }
  return { ok: r.status === 0, stdout: r.stdout ?? "", stderr: r.stderr ?? "", exitCode: r.status, timedOut: false };
}

function checkSize(code) {
  if (Buffer.byteLength(code, "utf8") > MAX_CODE_BYTES) {
    return `Código excede o limite de ${MAX_CODE_BYTES} bytes`;
  }
  return null;
}

const ADAPTERS = {
  python: {
    id: "python",
    aliases: ["py"],
    label: "Python",
    detect: () => which(["python3", "python"]),
    describe: "executa o trecho com o interpretador Python local",
    exec(code, opts) {
      const found = this.detect();
      if (!found) return { ok: false, error: "Python não encontrado (instale python3)" };
      const dir = tmpWork();
      try {
        fs.writeFileSync(path.join(dir, "main.py"), code);
        return run(found.cmd, [path.join(dir, "main.py")], opts);
      } finally {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    },
  },
  node: {
    id: "node",
    aliases: ["js", "javascript", "nodejs"],
    label: "Node.js / JavaScript",
    detect: () => ({ cmd: process.execPath, version: process.version }),
    describe: "executa o trecho com o próprio Node.js (mesmo motor do código .vessie compilado)",
    exec(code, opts) {
      const dir = tmpWork();
      try {
        const f = path.join(dir, "main.mjs");
        fs.writeFileSync(f, code);
        return run(process.execPath, [f], opts);
      } finally {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    },
  },
  c: {
    id: "c",
    aliases: [],
    label: "C (gcc/cc)",
    detect: () => which(["gcc", "cc"]),
    describe: "compila com gcc/cc e executa o binário resultante",
    exec(code, opts) {
      const found = this.detect();
      if (!found) return { ok: false, error: "Compilador C não encontrado (instale gcc)" };
      const dir = tmpWork();
      try {
        const src = path.join(dir, "main.c");
        const exe = path.join(dir, "main" + (process.platform === "win32" ? ".exe" : ""));
        fs.writeFileSync(src, code);
        const cc = run(found.cmd, [src, "-O1", "-o", exe], opts);
        if (!cc.ok) return { ...cc, error: "Falha de compilação C (veja stderr)" };
        return run(exe, [], opts);
      } finally {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    },
  },
  cpp: {
    id: "cpp",
    aliases: ["c++", "cxx"],
    label: "C++ (g++/c++)",
    detect: () => which(["g++", "c++"]),
    describe: "compila com g++/c++ e executa o binário resultante",
    exec(code, opts) {
      const found = this.detect();
      if (!found) return { ok: false, error: "Compilador C++ não encontrado (instale g++)" };
      const dir = tmpWork();
      try {
        const src = path.join(dir, "main.cpp");
        const exe = path.join(dir, "main" + (process.platform === "win32" ? ".exe" : ""));
        fs.writeFileSync(src, code);
        const cc = run(found.cmd, [src, "-O1", "-o", exe], opts);
        if (!cc.ok) return { ...cc, error: "Falha de compilação C++ (veja stderr)" };
        return run(exe, [], opts);
      } finally {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    },
  },
  csharp: {
    id: "csharp",
    aliases: ["c#", "cs", "dotnet"],
    label: "C# (.NET)",
    detect: () => which(["dotnet"]),
    describe: "cria um projeto console temporário com `dotnet` e executa (precisa do .NET SDK)",
    exec(code, opts) {
      const found = this.detect();
      if (!found) return { ok: false, error: ".NET SDK não encontrado (instale o dotnet)" };
      const dir = tmpWork();
      try {
        const proj = path.join(dir, "app");
        const nw = run(found.cmd, ["new", "console", "-o", proj, "--no-restore"], opts);
        if (!nw.ok) return { ...nw, error: "Falha ao criar projeto C# temporário (veja stderr)" };
        fs.writeFileSync(path.join(proj, "Program.cs"), code);
        return run(found.cmd, ["run", "--project", proj], opts);
      } finally {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    },
  },
};

/** Normaliza "C#", "c++", "JS"... para o id do adaptador. Lança erro se desconhecido. */
function resolveAdapter(name) {
  const n = String(name ?? "").trim().toLowerCase();
  for (const a of Object.values(ADAPTERS)) {
    if (a.id === n || a.aliases.includes(n)) return a;
  }
  throw new Error(`Linguagem sem adaptador: "${name}". Adaptadores: ${Object.keys(ADAPTERS).join(", ")}`);
}

function listAdapters() {
  return Object.values(ADAPTERS).map((a) => {
    const found = (() => { try { return a.detect(); } catch { return null; } })();
    return {
      id: a.id, aliases: a.aliases, label: a.describe ? a.label : a.id,
      description: a.describe, available: !!found, version: found?.version ?? null,
    };
  });
}

/**
 * Executa um trecho de código na linguagem indicada.
 * @returns {{ok, stdout, stderr, exitCode, timedOut, error?, lang}}
 */
function runCode(lang, code, { timeout = DEFAULT_TIMEOUT_MS } = {}) {
  const sizeErr = checkSize(String(code ?? ""));
  if (sizeErr) return { ok: false, lang, stdout: "", stderr: "", exitCode: null, timedOut: false, error: sizeErr };
  let adapter;
  try {
    adapter = resolveAdapter(lang);
  } catch (e) {
    return { ok: false, lang, stdout: "", stderr: "", exitCode: null, timedOut: false, error: e.message };
  }
  const t = Number(timeout);
  const r = adapter.exec(String(code), { timeout: Number.isFinite(t) && t > 0 ? Math.min(t, 120000) : DEFAULT_TIMEOUT_MS });
  return { lang: adapter.id, ...r };
}


/* ===== src\ai\index.js ===== */
// Assistente de IA local do Vessie: melhora pedidos para modelos de IA,
// inclusive modelos pequenos sem raciocínio lógico. Tudo determinístico e
// offline (sem rede, sem dependências): nenhuma chamada externa é feita.
//
// Geração dupla:
//   1ª geração (normalização): limpa o pedido, detecta a intenção por padrões de
//      palavras e reescreve um prompt completo e direto.
//   2ª geração (conteúdos isolados): produz exemplos .vessie pequenos e isolados
//      (um por conceito) + o system prompt final, que é enviado junto com o
//      prompt aprimorado ao modelo.


/** Referência compacta da linguagem (~50 linhas) para caber em modelos pequenos. */
const COMPACT_SPEC = `Vessie (regras obrigatórias):
- 1ª linha: app Nome (uma vez, no início).
- state nome: tipo = valor (só no topo; re-renderiza a UI). computed nome = expr.
- fn nome(params) { ... } | async fn. return, if/else, while, for x in lista.
- Tipos: number string boolean any void, listas T[]. Sem imports.
- ui App { page "Título" { ... } } — UMA page por ui.
- Componentes: page column row grid card list item text heading button input textarea checkbox switch image html.
- Props comuns: gap width background border radius color class style label placeholder.
- Eventos: button on:click fn | input on:input fn | checkbox on:change fn. bind: input bind:var.
- Botão funcional autônomo: button "Texto" on:click minhaFn (borda vem do CSS; edite com border:/style:).
- css nome = \`...css...\` | css nome { rule ".sel" { prop: valor } }.
- js nome = \`...javascript...\` (verbatim). html nome = \`...markup...\` (uso: html nome).
- stdlib: print assert range math.* string.* array.* json.* js.run js.get js.set.
- Cada instrução em sua linha. Sem try/catch, sem classes, sem HTML cru na ui (use html).`;

const INTENT_PATTERNS = [
  { id: "counter", test: /(contador|contar|clique|increment|decrement|counter|click)/i, label: "contador com botão" },
  { id: "form", test: /(formul|form|cadastro|input|campo|nome|email|checkbox|envi)/i, label: "formulário com estado" },
  { id: "list", test: /(lista|list|tarefas|todo|itens|item)/i, label: "lista de itens" },
  { id: "dashboard", test: /(painel|dashboard|placar|gráfico|metric|cart)/i, label: "painel com cartões" },
  { id: "button", test: /(bot[aã]o|button|boton)/i, label: "botão funcional" },
  { id: "page", test: /(p[aá]gina|page|tela|site|landing)/i, label: "página" },
];

const STOP = new Set("de um uma o a os as e ou para com por favor criar cria faça faz gere gerar monte quero preciso preciso-me mostra mostre exemplo código site página app aplicativo no na do da em que se ele ela isso este esta como mais muito bem".split(" "));

/** Palavras-chave do pedido (minúsculas, sem stopwords, ordem de aparição). */
function keywordsOf(raw) {
  const words = String(raw ?? "").toLowerCase().replace(/[`"'.,;:!?()[\]{}]/g, " ").split(/\s+/);
  const out = [];
  for (const w of words) {
    const t = w.trim();
    if (t.length >= 3 && !STOP.has(t) && !out.includes(t)) out.push(t);
  }
  return out.slice(0, 12);
}

export function detectIntent(raw) {
  for (const p of INTENT_PATTERNS) if (p.test.test(String(raw))) return p;
  return { id: "generic", label: "aplicação simples" };
}

function appNameOf(keywords, intent) {
  const base = (keywords[0] ?? intent.id).replace(/[^a-z0-9_]/gi, "").replace(/^(\d)/, "_$1");
  const name = (base || "App").slice(0, 24);
  return name[0].toUpperCase() + name.slice(1);
}

function snippetFor(intent, app) {
  switch (intent.id) {
    case "counter":
      return `app ${app}\n\nstate count: number = 0\n\nfn increment() {\n  count += 1\n}\n\nfn reset() {\n  count = 0\n}\n\nui App {\n  page "${app}" {\n    column gap: 16 {\n      heading "${app}"\n      text \`Valor: \${count}\`\n      row gap: 8 {\n        button "Incrementar" on:click increment\n        button "Zerar" variant: "secondary" on:click reset\n      }\n    }\n  }\n}`;
    case "form":
      return `app ${app}\n\nstate name: string = ""\n\ncomputed greeting: string = name == "" ? "Digite seu nome" : \`Olá, \${name}!\`\n\nfn submit() {\n  if name != "" {\n    print(string.format("enviado: {0}", name))\n    name = ""\n  }\n}\n\nui App {\n  page "${app}" {\n    column gap: 12 width: 360 {\n      heading "${app}"\n      input bind:name placeholder: "Seu nome" label: "Nome"\n      text greeting\n      button "Enviar" on:click submit\n    }\n  }\n}`;
    case "list":
      return `app ${app}\n\nstate items: string[] = ["Primeiro", "Segundo"]\n\nfn add() {\n  array.push(items, string.format("Item {0}", array.length(items) + 1))\n}\n\nui App {\n  page "${app}" {\n    column gap: 12 {\n      heading "${app}"\n      button "Adicionar" on:click add\n      list {\n        item \`Total: \${array.length(items)}\`\n      }\n    }\n  }\n}`;
    case "dashboard":
      return `app ${app}\n\nstate fps: number = 60\n\nfn refresh() {\n  fps = math.round(math.lerp(30, 120, math.random()))\n}\n\nui App {\n  page "${app}" theme: "dark" {\n    column gap: 16 {\n      heading "${app}"\n      row gap: 12 {\n        card {\n          text "FPS"\n          text bind:fps\n        }\n      }\n      button "Atualizar" on:click refresh\n    }\n  }\n}`;
    case "button":
      return `app ${app}\n\nstate clicks: number = 0\n\nfn tapped() {\n  clicks += 1\n}\n\ncss tema = \`.cta { border: 2px solid #4f46e5; border-radius: 10px; }\`\n\nui App {\n  page "${app}" {\n    column gap: 12 {\n      button "Clique aqui" on:click tapped border: "2px solid #4f46e5" class: "cta"\n      text \`Cliques: \${clicks}\`\n    }\n  }\n}`;
    default:
      return `app ${app}\n\nfn main() {\n  print("Olá, Vessie!")\n}\n\nui App {\n  page "${app}" {\n    column gap: 12 {\n      heading "Olá, Vessie!"\n      text "Sua primeira aplicação compilada."\n    }\n  }\n}`;
  }
}

/**
 * Geração dupla a partir de um pedido em linguagem natural.
 * @returns {{intent, keywords, app, improved, systemPrompt, examples, code, notes}}
 */
export function improvePrompt(rawInput) {
  const raw = String(rawInput ?? "").trim();
  if (!raw) throw new Error("Informe um pedido (ex.: vessie ai \"contador com botão\")");
  const intent = detectIntent(raw);
  const keywords = keywordsOf(raw);
  const app = appNameOf(keywords, intent);

  // 1ª geração: prompt completo e direto, com restrições que cabem em modelo pequeno.
  const improved = `Crie UM programa Vessie completo e compilável para: ${intent.label} — "${raw}".\n` +
    `Palavras-chave: ${keywords.join(", ") || "(nenhuma)"}.\n` +
    `Regras: comece com "app ${app}"; use state/fn/ui; UMA page por ui; ` +
    `botões com on:click; cada instrução em sua linha; sem imports, classes ou try/catch. ` +
    `Responda SOMENTE com o código .vessie.`;

  // 2ª geração: exemplos isolados (um conceito por exemplo) + system prompt final.
  const examples = [
    { title: "Estado + botão", code: `state n: number = 0\nfn inc() {\n  n += 1\n}\nbutton "Ir" on:click inc` },
    { title: "Texto reativo", code: "text `Valor: ${n}`" },
    { title: "Intenção detectada", code: snippetFor(intent, app) },
  ];
  // Garante que os exemplos são válidos compilando o exemplo completo.
  const check = compile(examples[2].code, { file: "<ai>", warnings: false });
  const notes = check.ok ? [] : [`Aviso: exemplo da intenção não compilou: ${check.diagnostics[0]?.message ?? "?"}`];

  const systemPrompt = `Você gera código Vessie (.vessie) válido e compilável.\n\n${COMPACT_SPEC}\n\n` +
    `Exemplos isolados (copie o padrão, não o conteúdo):\n` +
    examples.map((e, i) => `[${i + 1}] ${e.title}:\n${e.code}`).join("\n\n");

  return { intent: intent.id, intentLabel: intent.label, keywords, app, improved, systemPrompt, examples, code: examples[2].code, notes };
}

/** Prompt combinado pronto para colar no modelo: system + aprimorado. */
export function combinedPrompt(result) {
  return `===== SYSTEM PROMPT =====\n${result.systemPrompt}\n\n===== PEDIDO APRIMORADO =====\n${result.improved}\n`;
}


/* ===== src\search\smart.js ===== */
// Smart-Web-Search do Vessie: dado um site inicial + termo, busca o site e os
// subsites (links de mesma origem) até um limite, filtra por padrões de palavras
// e gera um prompt/markdown com o que foi encontrado (textos, elementos e scripts).
// Limites de segurança: só http/https, mesma origem, nº de páginas, bytes por
// página, timeout e sem executar nenhum JavaScript das páginas.


const DEFAULTS = { maxPages: 8, maxDepth: 1, timeoutMs: 10000, maxBytes: 512 * 1024, maxScripts: 20 };

function fetchPage(url, { timeoutMs, maxBytes }) {
  return new Promise((resolve) => {
    let u;
    try {
      u = new URL(url);
      if (u.protocol !== "http:" && u.protocol !== "https:") return resolve({ ok: false, error: "Apenas http/https" });
    } catch {
      return resolve({ ok: false, error: "URL inválida" });
    }
    const lib = u.protocol === "https:" ? https : http;
    const req = lib.get(u, { timeout: timeoutMs, headers: { "User-Agent": "VessieSmartSearch/0.1" } }, (res) => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
        res.resume();
        return resolve({ ok: false, redirect: new URL(res.headers.location, u).href });
      }
      if (res.statusCode !== 200) {
        res.resume();
        return resolve({ ok: false, error: `HTTP ${res.statusCode}` });
      }
      let bytes = 0;
      const chunks = [];
      res.on("data", (c) => {
        bytes += c.length;
        if (bytes <= maxBytes) chunks.push(c);
      });
      res.on("end", () => resolve({ ok: true, html: Buffer.concat(chunks).toString("utf8"), truncated: bytes > maxBytes }));
      res.on("error", (e) => resolve({ ok: false, error: e.message }));
    });
    req.on("timeout", () => { req.destroy(); resolve({ ok: false, error: "Timeout" }); });
    req.on("error", (e) => resolve({ ok: false, error: e.message }));
  });
}

const strip = (s) => s.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ")
  .replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();

function tokensOf(term) {
  return String(term ?? "").toLowerCase().split(/[^a-z0-9\u00c0-\u024f]+/u).filter((t) => t.length >= 3);
}

function scoreText(text, tokens) {
  const t = text.toLowerCase();
  let score = 0;
  const hits = [];
  for (const tok of tokens) {
    const n = t.split(tok).length - 1;
    if (n > 0) { score += n; hits.push(tok); }
  }
  return { score, hits };
}

/** Extrai título, texto, links, elementos (botões/inputs/imagens/cabeçalhos) e scripts. */
function extractPage(html, baseUrl) {
  const title = /<title[^>]*>([\s\S]{0,300})<\/title>/i.exec(html)?.[1]?.trim() ?? "";
  const headings = [...html.matchAll(/<h[1-6][^>]*>([\s\S]{0,200}?)<\/h[1-6]>/gi)].slice(0, 20).map((m) => strip(m[1])).filter(Boolean);
  const links = [];
  for (const m of html.matchAll(/<a[^>]+href=["']([^"'#]+)["'][^>]*>/gi)) {
    try {
      const abs = new URL(m[1], baseUrl);
      abs.hash = "";
      if (abs.protocol === "http:" || abs.protocol === "https:") links.push(abs.href);
    } catch { /* ignora */ }
    if (links.length >= 100) break;
  }
  const elements = [];
  const pushEl = (kind, htmlTag) => {
    const re = new RegExp(`<${htmlTag}\\b([^>]*)>([\\s\\S]{0,160}?)<\/${htmlTag}>|<${htmlTag}\\b([^>]*)/?>`, "gi");
    for (const m of html.matchAll(re)) {
      const attrs = (m[1] ?? m[3] ?? "").slice(0, 300);
      const text = strip(m[2] ?? "").slice(0, 160);
      elements.push({ kind, text, attrs });
      if (elements.length >= 60) return;
    }
  };
  pushEl("button", "button");
  pushEl("input", "input");
  pushEl("image", "img");
  const scripts = [];
  for (const m of html.matchAll(/<script\b([^>]*)>([\s\S]{0,2000}?)<\/script>/gi)) {
    const src = /src=["']([^"']+)["']/i.exec(m[1] ?? "")?.[1] ?? null;
    scripts.push({ src, inlineBytes: Buffer.byteLength(m[2] ?? "", "utf8"), inlineHead: (m[2] ?? "").slice(0, 300) });
    if (scripts.length >= DEFAULTS.maxScripts) break;
  }
  return { title, text: strip(html).slice(0, 8000), headings, links: [...new Set(links)], elements, scripts };
}

/**
 * Varre o site inicial + subsites de mesma origem, filtra pelo termo e monta o prompt.
 * @returns {Promise<{pages, elements, scripts, prompt, markdown}>}
 */
async function smartSearch(startUrl, term, opts = {}) {
  const { maxPages = DEFAULTS.maxPages, maxDepth = DEFAULTS.maxDepth, timeoutMs = DEFAULTS.timeoutMs, maxBytes = DEFAULTS.maxBytes } = opts;
  const tokens = tokensOf(term);
  if (!tokens.length) throw new Error("Informe um termo de busca (3+ letras)");
  const origin = new URL(startUrl).origin;
  const seen = new Set();
  const queue = [{ url: startUrl, depth: 0 }];
  const pages = [];
  let redirects = 0;

  while (queue.length && pages.length < maxPages) {
    const { url, depth } = queue.shift();
    if (seen.has(url)) continue;
    seen.add(url);
    const r = await fetchPage(url, { timeoutMs, maxBytes });
    if (r.redirect && redirects < 3) {
      redirects++;
      queue.unshift({ url: r.redirect, depth });
      continue;
    }
    if (!r.ok) {
      pages.push({ url, ok: false, error: r.error });
      continue;
    }
    const ex = extractPage(r.html, url);
    const s = scoreText(`${ex.title} ${ex.text} ${ex.headings.join(" ")}`, tokens);
    pages.push({ url, ok: true, title: ex.title, score: s.score, hits: s.hits, headings: ex.headings.slice(0, 8), excerpt: ex.text.slice(0, 500), truncated: r.truncated, scripts: ex.scripts });
    if (depth < maxDepth) {
      for (const l of ex.links) {
        try {
          if (new URL(l).origin === origin && !seen.has(l) && pages.length + queue.length < maxPages * 2) queue.push({ url: l, depth: depth + 1 });
        } catch { /* ignora */ }
      }
    }
    // elementos da página com melhor correspondência ao termo
    ex.elements.forEach((el) => {
      const es = scoreText(`${el.text} ${el.attrs}`, tokens);
      if (es.score > 0) pages[pages.length - 1].elements ??= [];
      if (es.score > 0) pages[pages.length - 1].elements.push({ ...el, score: es.score });
    });
  }

  const good = pages.filter((p) => p.ok && p.score > 0).sort((a, b) => b.score - a.score);
  const elements = good.flatMap((p) => (p.elements ?? []).map((e) => ({ page: p.url, ...e }))).slice(0, 30);
  const scripts = good.flatMap((p) => p.scripts.map((s) => ({ page: p.url, ...s }))).slice(0, DEFAULTS.maxScripts);

  const prompt = `Contexto coletado do site ${origin} para o termo "${term}" ` +
    `(${good.length} página(s) relevante(s) de ${pages.length} visitada(s)):\n` +
    good.map((p, i) => `[${i + 1}] ${p.title || p.url} (${p.url}) — hits: ${p.hits.join(", ")}\n${p.excerpt}`).join("\n\n") +
    (elements.length ? `\n\nElementos com o termo:\n${elements.map((e) => `- [${e.kind}] "${e.text}" (${e.page})`).join("\n")}` : "") +
    (scripts.length ? `\n\nScripts encontrados:\n${scripts.map((s) => `- ${s.src ?? `(inline, ${s.inlineBytes} bytes)`} em ${s.page}`).join("\n")}` : "");

  const markdown = `# Smart-Web-Search: "${term}"\n\nOrigem: ${origin}\nPáginas visitadas: ${pages.length} · relevantes: ${good.length}\n\n` +
    good.map((p, i) => `## ${i + 1}. ${p.title || "(sem título)"}\n\n- URL: ${p.url}\n- Hits: ${p.hits.join(", ")}\n\n${p.excerpt}\n`).join("\n");

  return { pages, elements, scripts, prompt, markdown };
}


/* ===== src\markdown\index.js ===== */
// Markdown próprio do Vessie: subconjunto comum (títulos, ênfase, código,
// listas, links, imagens, citações, tabelas simples, blocos de código) com
// escape de HTML (seguro contra XSS). Sem dependências.

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function inline(md) {
  let s = esc(md);
  s = s.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (_, alt, src) => `<img src="${src}" alt="${alt}">`);
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, t, href) => `<a href="${href}">${t}</a>`);
  s = s.replace(/`([^`]+)`/g, (_, c) => `<code>${c}</code>`);
  s = s.replace(/\*\*([^*]+)\*\*/g, (_, t) => `<strong>${t}</strong>`);
  s = s.replace(/(^|\W)\*([^*\n]+)\*/g, (_, p, t) => `${p}<em>${t}</em>`);
  return s;
}

/** Markdown → HTML (fragmento, sem <html>). */
export function renderMarkdown(src) {
  const lines = String(src ?? "").replace(/\r\n/g, "\n").split("\n");
  const out = [];
  let i = 0;
  let list = null; // "ul" | "ol" | null

  const closeList = () => { if (list) { out.push(`</${list}>`); list = null; } };

  while (i < lines.length) {
    const line = lines[i];
    // bloco de código cercado
    if (line.startsWith("```")) {
      closeList();
      const lang = line.slice(3).trim();
      const buf = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) buf.push(lines[i++]);
      i++;
      out.push(`<pre><code${lang ? ` class="language-${esc(lang)}"` : ""}>${esc(buf.join("\n"))}</code></pre>`);
      continue;
    }
    // tabela simples
    if (/^\|.+\|$/.test(line.trim()) && /^\|[\s:|-]+\|$/.test((lines[i + 1] ?? "").trim())) {
      closeList();
      const cells = (l) => l.trim().slice(1, -1).split("|").map((c) => `<td>${inline(c.trim())}</td>`).join("");
      const head = line.trim().slice(1, -1).split("|").map((c) => `<th>${inline(c.trim())}</th>`).join("");
      out.push(`<table><thead><tr>${head}</tr></thead><tbody>`);
      i += 2;
      while (i < lines.length && /^\|.+\|$/.test(lines[i].trim())) out.push(`<tr>${cells(lines[i++])}</tr>`);
      out.push("</tbody></table>");
      continue;
    }
    const h = /^(#{1,6})\s+(.*)$/.exec(line);
    if (h) { closeList(); out.push(`<h${h[1].length}>${inline(h[2])}</h${h[1].length}>`); i++; continue; }
    if (/^---+$/.test(line.trim()) || /^\*\*\*+$/.test(line.trim())) { closeList(); out.push("<hr>"); i++; continue; }
    if (line.startsWith(">")) { closeList(); out.push(`<blockquote>${inline(line.replace(/^>\s?/, ""))}</blockquote>`); i++; continue; }
    const ul = /^[-*]\s+(.*)$/.exec(line);
    const ol = /^(\d+)[.)]\s+(.*)$/.exec(line);
    if (ul || ol) {
      const kind = ul ? "ul" : "ol";
      if (list !== kind) { closeList(); out.push(`<${kind}>`); list = kind; }
      out.push(`<li>${inline(ul ? ul[1] : ol[2])}</li>`);
      i++;
      continue;
    }
    if (line.trim() === "") { closeList(); i++; continue; }
    closeList();
    out.push(`<p>${inline(line)}</p>`);
    i++;
  }
  closeList();
  return out.join("\n");
}

/** Markdown → texto puro (para terminal/headless). */
export function renderText(src) {
  return String(src ?? "")
    .replace(/```[\s\S]*?```/g, " [código] ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/(\*\*|__)([^*]+)\1/g, "$2")
    .replace(/(^|\W)[*_]([^*\n]+)[*_]/g, "$1$2")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^>\s?/gm, "")
    .replace(/\s+/g, " ")
    .trim();
}


/* ===== src\a11y\index.js ===== */
// Auditoria de acessibilidade do Vessie: analisa a UI compilada e aponta
// problemas comuns (botão sem texto, imagem sem alt, campo sem rótulo,
// page sem título, saltos de nível de heading). Localizações apontam para o elemento.


/**
 * @returns {{ok:boolean, issues:Array<{rule,message,line,col}>, counts:{pages,buttons,images,inputs}}}
 */
function auditSource(source, { file = "<memória>" } = {}) {
  const r = compile(source, { file, warnings: false });
  if (!r.ok) return { ok: false, issues: [], counts: null, diagnostics: r.diagnostics };
  const issues = [];
  const counts = { pages: 0, buttons: 0, images: 0, inputs: 0 };
  const at = (loc) => ({ line: loc?.line ?? 1, col: loc?.col ?? 1 });

  const hasProp = (el, name) => el.props.some((p) => p.name === name);
  const textOf = (el) => [
    ...el.args.filter((a) => a.type === "String").map((a) => a.value),
    ...el.args.filter((a) => a.type === "Template").map(() => " "),
  ].join(" ").trim();

  const visit = (el, ctx = { level: 0 }) => {
    const loc = at(el.loc);
    if (el.tag === "page") {
      counts.pages++;
      const title = el.args[0];
      if (!title || (title.type === "String" && !title.value.trim())) {
        issues.push({ rule: "page-title", message: 'page sem título: informe page "Título"', ...loc });
      }
    }
    if (el.tag === "button") {
      counts.buttons++;
      if (!textOf(el)) issues.push({ rule: "button-name", message: "button sem texto visível: leitores de tela não o anunciam", ...loc });
    }
    if (el.tag === "image") {
      counts.images++;
      if (!hasProp(el, "alt")) issues.push({ rule: "image-alt", message: 'image sem alt: adicione alt: "descrição"', ...loc });
    }
    if (["input", "textarea", "checkbox", "switch"].includes(el.tag)) {
      counts.inputs++;
      if (!hasProp(el, "label") && !hasProp(el, "placeholder") && !hasProp(el, "name")) {
        issues.push({ rule: "input-label", message: `${el.tag} sem rótulo: adicione label:, placeholder: ou name:`, ...loc });
      }
    }
    if (el.tag === "heading") {
      const lvl = Number(el.props.find((p) => p.name === "level")?.value?.value ?? 2);
      // o título da page conta como h1: primeiro heading h2 é válido; só acusa saltos depois disso
      if (ctx.level > 0 && lvl > ctx.level + 1) issues.push({ rule: "heading-order", message: `heading pula de h${ctx.level} para h${lvl}: mantenha a ordem`, ...loc });
      ctx = { level: lvl };
    }
    for (const c of el.children) visit(c, { ...ctx });
  };

  for (const s of r.ast.body) {
    if (s.type === "UiDecl") for (const c of s.children) visit(c);
  }
  return { ok: true, issues, counts, diagnostics: r.diagnostics };
}


/* ===== src\sys\index.js ===== */
// Sistema operacional (somente leitura): consumo, desempenho e processos.
// Não altera nada no SO: apenas lê `node:os` e lista processos via `tasklist`
// (Windows) ou `ps` (Unix) para detecção de aplicativos em execução.


/** CPU, memória, carga e uptime. Valores em bytes/segundos, sem formatação. */
function sysInfo() {
  const cpus = os.cpus();
  const total = os.totalmem();
  const free = os.freemem();
  return {
    platform: os.platform(),
    arch: os.arch(),
    release: os.release(),
    hostname: os.hostname(),
    cpus: cpus.length,
    cpuModel: cpus[0]?.model ?? "desconhecido",
    loadAvg: os.loadavg(),
    totalMem: total,
    freeMem: free,
    usedMem: total - free,
    usedPct: total ? Math.round(((total - free) / total) * 100) : 0,
    uptimeSec: Math.round(os.uptime()),
    node: process.version,
  };
}

/** Lista processos (nome + pid). Retorna {available:false} se o comando falhar. */
function sysProcs({ limit = 50 } = {}) {
  const n = Math.max(1, Math.min(Number(limit) || 50, 500));
  try {
    if (process.platform === "win32") {
      const r = spawnSync("tasklist", ["/FO", "CSV", "/NH"], { encoding: "utf8", timeout: 10000 });
      if (r.error || r.status !== 0) return { available: false, procs: [] };
      const procs = [];
      for (const line of String(r.stdout).split("\n")) {
        const m = /^"([^"]+)","(\d+)"/.exec(line.trim());
        if (m) procs.push({ name: m[1], pid: Number(m[2]) });
        if (procs.length >= n) break;
      }
      return { available: true, count: procs.length, procs };
    }
    const r = spawnSync("ps", ["-e", "-o", "pid=,comm="], { encoding: "utf8", timeout: 10000 });
    if (r.error || r.status !== 0) return { available: false, procs: [] };
    const procs = [];
    for (const line of String(r.stdout).split("\n")) {
      const m = /^\s*(\d+)\s+(.+?)\s*$/.exec(line);
      if (m) procs.push({ pid: Number(m[1]), name: m[2] });
      if (procs.length >= n) break;
    }
    return { available: true, count: procs.length, procs };
  } catch {
    return { available: false, procs: [] };
  }
}


/* ===== src\sys\optimizer.js ===== */
// Diagnóstico de desempenho para jogos/processos. Por padrão é somente leitura.
// A alteração de prioridade exige --apply e um PID explícito; nunca encerra processos.


const GAME_NAMES = /(game|steam|epic|gog|unity|unreal|minecraft|roblox|fortnite|valorant|cs2|r5apex|league|overwatch)/i;

function optimizationReport({ game = null, limit = 100 } = {}) {
  const system = sysInfo();
  const listed = sysProcs({ limit });
  const query = game ? String(game).trim().toLowerCase() : null;
  const candidates = listed.available
    ? listed.procs.filter((p) => (query ? p.name.toLowerCase().includes(query) : GAME_NAMES.test(p.name))).slice(0, 20)
    : [];
  const recommendations = [];
  if (system.usedPct >= 85) recommendations.push("Memória alta: feche aplicativos pesados antes de iniciar o jogo.");
  else recommendations.push("Memória em nível aceitável; feche apenas programas que você não está usando.");
  if (system.cpus < 4) recommendations.push("CPU com poucos núcleos: reduza sombras, distância de visão e processos em segundo plano.");
  else recommendations.push("Use o plano de energia de alto desempenho e mantenha o driver de vídeo atualizado.");
  if (!candidates.length) recommendations.push(query ? `Nenhum processo contendo "${game}" foi encontrado.` : "Nenhum processo de jogo conhecido foi identificado.");
  else recommendations.push("Selecione um PID listado e use --apply somente se quiser elevar sua prioridade no Windows.");
  return {
    mode: "audit", system: { platform: system.platform, cpus: system.cpus, usedMem: system.usedMem, totalMem: system.totalMem, usedPct: system.usedPct },
    candidates, recommendations,
    safety: "Este relatório não encerra processos, não altera serviços e não modifica arquivos.",
  };
}

/** Usa Python padrão para elevar a prioridade de um PID no Windows, quando pedido explicitamente. */
function applyGamePriority(pid) {
  const n = Number(pid);
  if (!Number.isInteger(n) || n <= 0) return { ok: false, error: "PID inválido. Informe um número inteiro positivo." };
  const script = `import ctypes, json, os, sys
pid = ${n}
out = {"ok": False, "pid": pid}
if os.name != "nt":
    out["error"] = "Aplicação de prioridade é suportada somente no Windows."
elif pid == os.getpid():
    out["error"] = "Recusado: não é permitido alterar o processo do otimizador."
else:
    PROCESS_SET_INFORMATION = 0x0200
    HIGH_PRIORITY_CLASS = 0x00000080
    handle = ctypes.windll.kernel32.OpenProcess(PROCESS_SET_INFORMATION, False, pid)
    if not handle:
        out["error"] = "Não foi possível abrir o processo; tente executar o terminal como administrador."
    else:
        try:
            out["ok"] = bool(ctypes.windll.kernel32.SetPriorityClass(handle, HIGH_PRIORITY_CLASS))
            if not out["ok"]: out["error"] = "O Windows recusou a alteração de prioridade."
        finally:
            ctypes.windll.kernel32.CloseHandle(handle)
print(json.dumps(out))`;
  const r = runCode("python", script, { timeout: 10000 });
  if (!r.ok) return { ok: false, error: r.error ?? r.stderr ?? "Falha ao executar o Python." };
  try { return JSON.parse(r.stdout.trim()); } catch { return { ok: false, error: "Resposta inválida do otimizador Python." }; }
}


/* ===== src\cli\format.js ===== */
// Formatador da Vessie: reindenta por profundidade de {} () [], remove espaços finais e
// colapsa linhas em branco. Preserva strings, templates e comentários (não reescreve conteúdo).

function formatSource(src, { indent = "  " } = {}) {
  const lines = src.replace(/\r\n/g, "\n").split("\n");
  const out = [];
  let depth = 0;
  let inBlockComment = false;
  let inTemplate = false;
  let blank = 0;
  for (const raw of lines) {
    const wasVerbatim = inBlockComment || inTemplate;
    const trimmed = raw.trim();
    if (wasVerbatim) {
      out.push(raw.replace(/\s+$/, ""));
      blank = 0;
    } else if (trimmed === "") {
      if (++blank <= 1 && out.length) out.push("");
      scan(raw);
      continue;
    } else {
      blank = 0;
      let lead = 0;
      for (const ch of trimmed) { if ("}])".includes(ch)) lead++; else break; }
      out.push(indent.repeat(Math.max(0, depth - lead)) + trimmed);
    }
    if (!wasVerbatim) scan(raw); else scan(raw);
  }
  while (out.length && out[out.length - 1] === "") out.pop();
  return out.join("\n") + "\n";

  function scan(line) {
    let i = 0, inStr = null;
    while (i < line.length) {
      const c = line[i], n = line[i + 1];
      if (inBlockComment) { if (c === "*" && n === "/") { inBlockComment = false; i += 2; continue; } i++; continue; }
      if (inTemplate) { if (c === "\\") { i += 2; continue; } if (c === "`") inTemplate = false; i++; continue; }
      if (inStr) { if (c === "\\") { i += 2; continue; } if (c === inStr) inStr = null; i++; continue; }
      if (c === "/" && n === "/") return;
      if (c === "/" && n === "*") { inBlockComment = true; i += 2; continue; }
      if (c === '"' || c === "'") { inStr = c; i++; continue; }
      if (c === "`") { inTemplate = true; i++; continue; }
      if ("{[(".includes(c)) depth++;
      else if ("}])".includes(c)) depth = Math.max(0, depth - 1);
      i++;
    }
  }
}


/* ===== src\cs\index.js ===== */
// Conversor C# → Vessie (adaptação da linguagem C# para a Vessie).
// Cobre o subconjunto console comum (tipos, Console, laços, métodos, coleções,
// interpolação, LINQ básico, Math). O resto vira comentário `// [cs]` + aviso.
// Puro, sem imports: usável na CLI (`vessie cs convert`) e em testes.

const NUM = new Set(["int", "long", "short", "byte", "sbyte", "uint", "ulong", "ushort", "float", "double", "decimal"]);
const STR = new Set(["string", "char"]);
const BOO = new Set(["bool"]);

const MODIFIERS = new Set(["public", "private", "protected", "internal", "static", "readonly", "sealed", "volatile", "new", "virtual", "override", "abstract", "async", "extern", "unsafe", "partial", "required", "ref", "in", "out", "params"]);

const CS_LIMITS = [
  "switch/case, try/catch/finally, using (...) e lock viram blocos simples (semântica aproximada)",
  "Console.ReadLine/ReadKey não têm entrada equivalente (viram string vazia)",
  "classes extras, structs, interfaces, enums, properties e LINQ avançado são ignorados com aviso",
  "genéricos, atributos, comentários-doc e diretivas de pré-processador são descartados",
];

/** Tipo C# → anotação Vessie (`number`/`string`/`boolean`/`T[]`) ou null (any, sem anotação). */
function vType(t) {
  if (!t) return null;
  const s = t.trim();
  const arr = s.match(/^(.*?)\s*(\[\s*(?:,\s*)*\])$/);
  const base = (arr ? arr[1] : s).replace(/<[\s\S]*$/, "").replace(/\?$/, "").trim();
  let v = null;
  if (NUM.has(base)) v = "number";
  else if (STR.has(base)) v = "string";
  else if (BOO.has(base)) v = "boolean";
  else return null;
  return arr ? `${v}[]` : v;
}

const isIdent = (s) => /^[A-Za-z_]\w*$/.test(s);

/** Remove comentários de bloco `/* ... *\/` respeitando strings C#. */
function stripBlockComments(src) {
  let out = "", i = 0, n = src.length, mode = null; // null | '"' | "'" | '@"'
  while (i < n) {
    const c = src[i], nx = src[i + 1];
    if (mode === null) {
      if (c === "/" && nx === "*") {
        const end = src.indexOf("*/", i + 2);
        const block = end < 0 ? src.slice(i) : src.slice(i, end + 2);
        out += block.replace(/[^\n]/g, " "); // preserva quebras de linha
        i = end < 0 ? n : end + 2;
      } else if (c === "/" && nx === "/" && src[i + 2] !== "/") {
        out += c; i++; // `//` tratado por linha depois (/// doc é descartado lá)
      } else if (c === "@" && nx === '"') { mode = '@"'; out += "@\""; i += 2; }
      else if (c === "$" && nx === '"') { out += "$\""; i += 2; }
      else if (c === "$" && nx === "@" && src[i + 2] === '"') { out += "$@\""; i += 3; }
      else if (c === '"') { mode = '"'; out += c; i++; }
      else if (c === "'") { mode = "'"; out += c; i++; }
      else { out += c; i++; }
    } else if (mode === '"') {
      out += c; i++;
      if (c === "\\" && i < n) { out += src[i]; i++; }
      else if (c === '"') mode = null;
    } else if (mode === "'") {
      out += c; i++;
      if (c === "\\" && i < n) { out += src[i]; i++; }
      else if (c === "'") mode = null;
    } else { // '@"'
      if (c === '"' && nx === '"') { out += '""'; i += 2; }
      else { out += c; i++; if (c === '"') mode = null; }
    }
  }
  return out;
}

/** Remove `//...` (e linhas `///...`) respeitando strings C#. */
function stripLineComment(line) {
  let m = null, i = 0;
  const n = line.length;
  while (i < n) {
    const c = line[i], nx = line[i + 1];
    if (m === null) {
      if (c === "/" && nx === "/") return line.slice(0, i);
      if (c === "@" && nx === '"') { m = '@"'; i += 2; continue; }
      if (c === '"') { m = '"'; i++; continue; }
      if (c === "'") { m = "'"; i++; continue; }
      i++;
    } else if (m === '"') {
      if (c === "\\") i += 2;
      else { if (c === '"') m = null; i++; }
    } else if (m === "'") {
      if (c === "\\") i += 2;
      else { if (c === "'") m = null; i++; }
    } else {
      if (c === '"' && nx === '"') i += 2;
      else { if (c === '"') m = null; i++; }
    }
  }
  return line;
}

/** Máscara strings/chars por espaços (mesmo tamanho) para regexes estruturais e `{}`. */
function maskStrings(line) {
  let out = "", i = 0;
  const n = line.length;
  const sp = (k) => { out += " ".repeat(k); };
  while (i < n) {
    const c = line[i], nx = line[i + 1];
    if (c === "@" && nx === '"') {
      sp(2); i += 2;
      while (i < n) {
        if (line[i] === '"' && line[i + 1] === '"') { sp(2); i += 2; }
        else if (line[i] === '"') { sp(1); i++; break; }
        else { sp(1); i++; }
      }
    } else if (c === '"') {
      sp(1); i++;
      while (i < n) {
        if (line[i] === "\\" && i + 1 < n) { sp(2); i += 2; }
        else if (line[i] === '"') { sp(1); i++; break; }
        else { sp(1); i++; }
      }
    } else if (c === "'") {
      sp(1); i++;
      while (i < n) {
        if (line[i] === "\\" && i + 1 < n) { sp(2); i += 2; }
        else if (line[i] === "'") { sp(1); i++; break; }
        else { sp(1); i++; }
      }
    } else { out += c; i++; }
  }
  return out;
}

/** Divide no separador de nível superior (fora de strings e ()[]{}). */
function splitTop(s, sep) {
  const parts = [];
  let depth = 0, cur = "", m = null, i = 0;
  while (i < s.length) {
    const c = s[i], nx = s[i + 1];
    if (m === null) {
      if (c === '"') { m = '"'; cur += c; i++; continue; }
      if (c === "'") { m = "'"; cur += c; i++; continue; }
      if (c === "(" || c === "[" || c === "{") depth++;
      if (c === ")" || c === "]" || c === "}") depth--;
      if (c === sep && depth === 0) { parts.push(cur); cur = ""; i++; continue; }
      cur += c; i++;
    } else {
      cur += c; i++;
      if (c === "\\" && i < s.length) { cur += s[i]; i++; }
      else if ((m === '"' && c === '"') || (m === "'" && c === "'")) m = null;
    }
  }
  parts.push(cur);
  return parts;
}

/** Dado o índice de `(`, retorna { inner, end } (índice do `)`). Respeita strings. */
function balanced(s, openIdx) {
  let depth = 0, m = null, i = openIdx;
  while (i < s.length) {
    const c = s[i], nx = s[i + 1];
    if (m === null) {
      if (c === '"') m = '"';
      else if (c === "'") m = "'";
      else if (c === "(" || c === "[") depth++;
      else if (c === ")") {
        depth--;
        if (depth === 0) return { inner: s.slice(openIdx + 1, i), end: i };
      }
      else if (c === "]") depth--;
      i++;
    } else {
      i++;
      if (c === "\\" && i < s.length) i++;
      else if ((m === '"' && c === '"') || (m === "'" && c === "'")) m = null;
    }
  }
  return null;
}

const countChar = (s, ch) => { let k = 0; for (const c of s) if (c === ch) k++; return k; };

/** Dado o índice de `{`, retorna o índice do `}` correspondente (ou -1). Respeita strings. */
function matchBrace(s, openIdx) {
  let depth = 0, m = null, i = openIdx;
  while (i < s.length) {
    const c = s[i];
    if (m === null) {
      if (c === '"' || c === "'") m = c;
      else if (c === "{") depth++;
      else if (c === "}") { depth--; if (depth === 0) return i; }
      i++;
    } else {
      i++;
      if (c === "\\" && i < s.length) i++;
      else if (c === m) m = null;
    }
  }
  return -1;
}

// ---------------------------------------------------------------- expressões

function convertCharLit(lit, warn) {
  const m = /^'(\\?[\s\S])'$/.exec(lit.trim());
  if (!m) { warn(`literal char complexo: ${lit.trim()}`); return `"${lit.trim()}"`; }
  const esc = { n: "\\n", t: "\\t", r: "\\r", "\\": "\\\\", "'": "'", '"': '"', 0: "\\0" };
  const body = m[1].startsWith("\\") ? (esc[m[1].slice(1)] ?? m[1]) : m[1];
  return `"${body}"`;
}

/** `$"..."` / `$@"..."` → template `` `...` `` (`{e}` → `${e}`). */
function convertInterpolated(lit, expr) {
  const verbatim = lit.startsWith("$@");
  let body = lit.slice(verbatim ? 3 : 2, -1);
  if (verbatim) body = body.replace(/""/g, '"');
  let out = "";
  for (let i = 0; i < body.length;) {
    const c = body[i];
    if (c === "{" && body[i + 1] === "{") { out += "{"; i += 2; }
    else if (c === "}" && body[i + 1] === "}") { out += "}"; i += 2; }
    else if (c === "{") {
      let j = i + 1, d = 1, m = null;
      while (j < body.length && d > 0) {
        const k = body[j];
        if (m) { if (k === "\\") j++; else if ((m === '"' && k === '"') || (m === "'" && k === "'")) m = null; }
        else if (k === '"' || k === "'") m = k;
        else if (k === "{") d++;
        else if (k === "}") d--;
        j++;
      }
      const inner = body.slice(i + 1, j - 1);
      const [e, fmt] = splitTop(inner, ":")[0] === inner ? [inner, null] : [splitTop(inner, ":")[0], true];
      void fmt;
      out += "${" + expr(e) + "}";
      i = j;
    } else if (c === "\\" && !verbatim) { out += c + (body[i + 1] ?? ""); i += 2; }
    else { out += c === "`" ? "\\`" : c; i++; }
  }
  return "`" + out + "`";
}

/** Converte um literal de string C# (regular, verbatim ou interpolado). */
function convertStringLit(lit, expr, warn) {
  const t = lit.trim();
  if (t.startsWith("$")) return convertInterpolated(t, expr);
  if (t.startsWith("@")) return JSON.stringify(t.slice(2, -1).replace(/""/g, '"'));
  return t; // "..." regular: mesma sintaxe
}

/** `string.Format(fmt, args)` → template. */
function convertFormat(args, expr, warn) {
  const parts = splitTop(args, ",").map((s) => s.trim()).filter((s) => s !== "");
  if (!parts.length) return null;
  const fmt = parts[0];
  if (!/^@?"[\s\S]*"$/.test(fmt)) { warn(`string.Format com formato não-literal`); return null; }
  let body = fmt.startsWith("@") ? fmt.slice(2, -1).replace(/""/g, '"') : JSON.parse(fmt);
  body = body.replace(/`/g, "\\`").replace(/{{/g, "\u0000").replace(/}}/g, "\u0001");
  body = body.replace(/\{(\d+)(?:[^}]*)?\}/g, (_, n) => {
    const a = parts[1 + Number(n)];
    return a !== undefined ? "${" + expr(a) + "}" : "{?}";
  });
  body = body.replace(/\u0000/g, "{").replace(/\u0001/g, "}");
  return "`" + body + "`";
}

const MATH_FN = { Sqrt: "sqrt", Pow: "pow", Abs: "abs", Floor: "floor", Ceiling: "ceil", Round: "round", Max: "max", Min: "min" };

/**
 * Reescreve chamadas `obj.Metodo(args)` (LINQ/coleções) para a stdlib Vessie.
 * Retorna null se não houver reescrita.
 */
function rewriteCall(obj, name, args, expr, warn) {
  const A = splitTop(args, ",").map((s) => s.trim()).filter((s) => s !== "");
  switch (name) {
    case "Where": return A.length === 1 ? `array.filter(${obj}, ${A[0]})` : null;
    case "Select": return A.length === 1 ? `array.map(${obj}, ${A[0]})` : null;
    case "ToList": case "ToArray": return A.length === 0 ? obj : null;
    case "First": case "FirstOrDefault": return A.length <= 1 ? `array.first(${A.length ? `array.filter(${obj}, ${A[0]})` : obj})` : null;
    case "Any": return A.length === 0 ? `(array.length(${obj}) > 0)` : `((array.find(${obj}, ${A[0]})) != null)`;
    case "All": return A.length === 1 ? `(array.length(array.filter(${obj}, ${A[0]})) == array.length(${obj}))` : null;
    case "Count": return A.length === 0 ? `array.length(${obj})` : `array.length(array.filter(${obj}, ${A[0]}))`;
    case "Sum": return A.length === 0 ? `array.reduce(${obj}, (a, b) => a + b, 0)` : `array.reduce(array.map(${obj}, ${A[0]}), (a, b) => a + b, 0)`;
    case "Contains": return A.length === 1 ? `array.includes(${obj}, ${A[0]})` : null;
    case "Distinct": return A.length === 0 ? `array.unique(${obj})` : null;
    case "Reverse": return A.length === 0 ? `array.reverse(${obj})` : null;
    case "Take": return A.length === 1 ? `array.slice(${obj}, 0, ${A[0]})` : null;
    case "Skip": return A.length === 1 ? `array.slice(${obj}, ${A[0]})` : null;
    case "Join": return A.length === 2 ? `array.join(${A[1]}, ${A[0]})` : null; // string.Join(sep, arr)
    case "Split": return A.length >= 1 ? `string.split(${obj}, ${A[0]})` : null;
    case "Replace": return A.length === 2 ? `string.replace(${obj}, ${A[0]}, ${A[1]})` : null;
    case "ToUpper": case "ToUpperInvariant": return `string.upper(${obj})`;
    case "ToLower": case "ToLowerInvariant": return `string.lower(${obj})`;
    case "Trim": return `string.trim(${obj})`;
    case "StartsWith": return A.length === 1 ? `string.startsWith(${obj}, ${A[0]})` : null;
    case "EndsWith": return A.length === 1 ? `string.endsWith(${obj}, ${A[0]})` : null;
    case "Contains2": return null;
    case "Substring": warn(`Substring não tem equivalente direto; revise`); return null;
    case "IndexOf": warn(`IndexOf não tem equivalente direto; revise`); return null;
    case "Add": warn(`Add fora de instrução; revise`); return null;
    case "Remove": case "RemoveAt": case "Clear": case "Sort": case "OrderBy": case "OrderByDescending":
      warn(`${name} não tem equivalente direto; revise`); return null;
    default: return null;
  }
}

/** Converte uma expressão C# em expressão Vessie (melhor esforço). */
function convertExpr(raw, warn) {
  let s = raw.trim();
  if (!s) return s;
  // string.Format(...)
  s = s.replace(/string\.Format\s*\(/g, "\u0002(");
  // laço de reescrita de chamadas obj.Metodo(...)
  const rewriteLoops = () => {
    for (;;) {
      const m = /([\w.\[\]]+?)\s*\.\s*(Where|Select|ToList|ToArray|First|FirstOrDefault|Any|All|Count|Sum|Join|Split|Replace|ToUpper|ToUpperInvariant|ToLower|ToLowerInvariant|Trim|StartsWith|EndsWith|Substring|IndexOf|Add|Remove|RemoveAt|Clear|Sort|OrderBy|OrderByDescending)\s*\(/.exec(s);
      if (!m) return;
      // não reescreve o que o próprio conversor já gerou (array./math.); `string.Join` é
      // estático em C# e precisa de conversão, então só ele passa com obj `string`.
      if (m[1] === "array" || m[1] === "math" || (m[1] === "string" && m[2] !== "Join")) return;
      const openIdx = m.index + m[0].length - 1;
      const b = balanced(s, openIdx);
      if (!b) return;
      // objeto simples (identificador/cadeia/índice); senão, só continua procurando adiante
      if (!/^[\w.\[\]]+$/.test(m[1])) { s = s.slice(0, openIdx) + "\u0003" + s.slice(openIdx + 1); continue; }
      const rep = rewriteCall(m[1], m[2], b.inner, (e) => convertExpr(e, warn), warn);
      if (rep === null) return;
      s = s.slice(0, m.index) + rep + s.slice(b.end + 1);
    }
  };
  rewriteLoops();
  s = s.split("\u0003").join("(");
  // string.Format (marcado com \u0002)
  for (;;) {
    const i = s.indexOf("\u0002(");
    if (i < 0) break;
    const b = balanced(s, i + 1);
    if (!b) break;
    const rep = convertFormat(b.inner, (e) => convertExpr(e, warn), warn);
    s = s.slice(0, i) + (rep ?? `string.Format(${b.inner})`) + s.slice(b.end + 1);
  }
  // Random().Next(...)
  s = s.replace(/new\s+Random\s*\(\s*\)\s*\.\s*Next\s*\(\s*\)/g, "math.random()");
  s = s.replace(/new\s+Random\s*\(\s*\)\s*\.\s*Next\s*\(\s*([^,()]+?)\s*\)/g, (_, a) => `math.randomInt(0, ${a.trim()})`);
  s = s.replace(/new\s+Random\s*\(\s*\)\s*\.\s*Next\s*\(\s*([^,()]+?)\s*,\s*([^,()]+?)\s*\)/g, (_, a, b) => `math.randomInt(${a.trim()}, ${b.trim()})`);
  // Math.*
  s = s.replace(/Math\.(Sqrt|Pow|Abs|Floor|Ceiling|Round|Max|Min)\s*\(/g, (_, f) => `math.${MATH_FN[f]}(`);
  s = s.replace(/Math\.PI\b/g, "math.PI");
  s = s.replace(/Math\.(Sin|Cos|Tan|Log|Exp|Log10|Atan2)\s*\(([^()]*)\)/g, (_, f, a) => (warn(`Math.${f} via js.run`), `js.run(\`Math.${f}(${a.trim()})\`)`));
  // Parse/Convert numérico
  s = s.replace(/(?:int|long|double|float|decimal)\.Parse\s*\(([^()]*)\)/g, (_, a) => (warn("Parse via js.run"), `js.run(\`Number(${a.trim()})\`)`));
  s = s.replace(/Convert\.To(?:Int32|Int64|Double|Single|Decimal)\s*\(([^()]*)\)/g, (_, a) => (warn("Convert via js.run"), `js.run(\`Number(${a.trim()})\`)`));
  s = s.replace(/Convert\.ToString\s*\(([^()]*)\)/g, (_, a) => `\`${"${" + a.trim() + "}"}\``);
  s = s.replace(/Convert\.ToBoolean\s*\(([^()]*)\)/g, (_, a) => `(${a.trim()} ? true : false)`);
  // string.IsNullOrEmpty
  s = s.replace(/string\.IsNullOrEmpty\s*\(([^()]*)\)/g, (_, a) => `(isNull(${a.trim()}) || ${a.trim()} == "")`);
  s = s.replace(/string\.IsNullOrWhiteSpace\s*\(([^()]*)\)/g, (_, a) => `(isNull(${a.trim()}) || string.trim(${a.trim()}) == "")`);
  // nameof / typeof / default
  s = s.replace(/nameof\s*\(\s*(\w+)\s*\)/g, (_, w) => `"${w}"`);
  s = s.replace(/typeof\s*\(\s*([\w.]+)\s*\)/g, (_, w) => `"${w}"`);
  s = s.replace(/\bdefault\b(?!\s*\()/, () => (warn("default → null"), "null"));
  // x.ToString() / a.Equals(b)
  s = s.replace(/([\w.\[\]"')]+?)\.ToString\s*\(\s*\)/g, (_, o) => `\`${"${" + o.trim() + "}"}\``);
  s = s.replace(/([\w.\[\]"')]+?)\.Equals\s*\(/g, (_, o) => `(${o.trim()} == `);
  // .Length / .Count (propriedade)
  s = s.replace(/([\w\])"'])\.(Length|Count)\b(?!\s*\()/g, "$1.length");
  // casts (int)x
  s = s.replace(/\(\s*(int|long|short|byte|sbyte|uint|ulong|ushort|float|double|decimal|string|char|bool|object)\s*\)\s*/g, () => (warn("cast C# descartado"), ""));
  // this. / ?. / ??=
  s = s.replace(/\bthis\./g, "");
  if (/\?\./.test(s)) { warn("operador ?. aproximado para ."); s = s.replace(/\?\./g, "."); }
  s = s.replace(/(\S[\s\S]*?)\s*\?\?=\s*(\S[\s\S]*)/, "$1 = $1 ?? $2");
  // literais char 'x' → "x"
  s = s.replace(/'(?:\\.|[^'\\])'/g, (m) => convertCharLit(m, warn));
  // strings $".." / $@".." (interpoladas) e @".." (verbatim) fora de chamadas já tratadas
  s = s.replace(/\$(?:@)?"(?:[^"]|"")*"/g, (m) => convertStringLit(m, (e) => convertExpr(e, warn), warn));
  s = s.replace(/@"(?:[^"]|"")*"/g, (m) => convertStringLit(m, (e) => convertExpr(e, warn), warn));
  return s;
}

// ---------------------------------------------------------------- instruções

const DECL_RE = /^((?:(?:public|private|protected|internal|static|readonly|sealed|volatile|new|required)\s+)*)(const\s+)?([\w?]+(?:\s*<[^;{}=]+>)?(?:\s*\[\s*(?:,\s*)*\])?)\s+([A-Za-z_]\w*)\s*(=\s*([\s\S]+))?$/;
const KEYWORD_STMT = /^(if|else|for|foreach|while|do|switch|return|break|continue|throw|using|lock|fixed|try|catch|finally|new|case|default|goto)\b/;

function convertDecl(masked, code, ctx, warn, out) {
  const m = DECL_RE.exec(masked);
  if (!m) return false;
  const [, mods, cnst, typeRaw, name, , initRaw] = m;
  if (KEYWORD_STMT.test(typeRaw) || !isIdent(name)) return false;
  const isConst = !!cnst || /\bconst\b/.test(mods);
  const ann = vType(typeRaw.trim());
  const kind = isConst ? "const" : (ctx.isField ? "state" : "let");
  const finish = (nm, init, type) => {
    if (init == null) {
      if (kind === "const") { warn(`const ${nm} sem valor inicial`); out.push(`// [cs] const ${nm} sem valor inicial: ${code.trim()}`); return; }
      out.push(type ? `${kind} ${nm}: ${type}` : `${kind} ${nm}`);
      return;
    }
    let v = convertExpr(init, warn);
    // new List<T>{...} / new T[]{...} / new[]{...} → [...]
    const col = /^\s*new\s+[\w.]+(\s*<[^;]*>)?(\s*\[[^\];]*\])?\s*\{([\s\S]*)\}\s*$/.exec(v);
    if (col) v = `[${col[3].trim()}]`;
    else {
      const sized = /^\s*new\s+([\w.]+)(\s*<[^;]*>)?\s*\[\s*(\d+)\s*\]\s*$/.exec(v);
      if (sized) {
        const zero = STR.has(sized[1]) ? `""` : BOO.has(sized[1]) ? "false" : "0";
        v = `[${Array(Number(sized[3])).fill(zero).join(", ")}]`;
      } else if (/^\s*new\s+/.test(v)) {
        warn(`construção C# sem equivalente: ${code.trim().slice(0, 60)}`);
        out.push(`// [cs] revisar: ${code.trim()}`);
        return;
      }
    }
    if (kind === "const") out.push(`const ${nm} = ${v}`);
    else if (type && kind === "state") out.push(`state ${nm}: ${type} = ${v}`);
    else if (type && initRaw != null && (NUM.has(typeRaw.trim()) || STR.has(typeRaw.trim()) || BOO.has(typeRaw.trim()))) out.push(`${kind} ${nm}: ${type} = ${v}`);
    else out.push(`${kind} ${nm} = ${v}`);
  };
  if (initRaw == null) { finish(name, null, ann); return true; }
  // múltiplos declaradores: int a = 1, b = 2 (divide após o nome, como palavra inteira)
  const nameIdx = masked.search(new RegExp(`\\b${name}\\b`));
  const afterName = code.replace(/;\s*$/, "").slice(nameIdx + name.length).trim().replace(/^=\s*/, "");
  const inits2 = splitTop(afterName, ",");
  if (inits2.length === 1) { finish(name, inits2[0], ann); return true; }
  const firstInit = inits2[0];
  finish(name, firstInit, ann);
  for (const extra of inits2.slice(1)) {
    const em = /^\s*([A-Za-z_]\w*)\s*(=\s*([\s\S]+))?$/.exec(extra);
    if (!em) { warn(`declarador não reconhecido: ${extra.trim()}`); out.push(`// [cs] revisar: ${extra.trim()}`); continue; }
    finish(em[1], em[3] ?? null, ann);
  }
  return true;
}

/** `for (int i = 0; i < n; i++)` → `for i in range(...)` ou null. */
function convertClassicFor(header, warn) {
  const b = balanced(header, header.indexOf("("));
  if (!b) return null;
  const parts = splitTop(b.inner, ";");
  if (parts.length !== 3) return null;
  const init = /^\s*(?:[\w<>?,\s\[\]]+?)\s+([A-Za-z_]\w*)\s*=\s*([\s\S]+)$/.exec(parts[0].trim());
  const cond = /^\s*([A-Za-z_]\w*)\s*(<|<=|>|>=)\s*([\s\S]+)$/.exec(parts[1].trim());
  const step = /^\s*([A-Za-z_]\w*)\s*(\+\+|--|\+=\s*.+|-=\s*.+)$/.exec(parts[2].trim());
  if (!init || !cond || !step || init[1] !== cond[1] || init[1] !== step[1]) return null;
  const v = init[1], from = convertExpr(init[2], warn), bound = convertExpr(cond[3], warn);
  const op = cond[2], st = step[2].replace(/\s+/g, "");
  if ((st !== "++" && st !== "+=1") || (op !== "<" && op !== "<=")) return null;
  const hi = op === "<" ? bound : `${bound} + 1`;
  const fromIsZero = from === "0";
  return fromIsZero ? `for ${v} in range(${hi})` : `for ${v} in range(${from}, ${hi})`;
}

function convertStmt(code, masked, ctx, warn, out) {
  const t = masked.trim();
  const C = code.trim();
  // cabeçalho + corpo: `{` presente (mesma linha ou próxima), bloco inline,
  // corpo de linha única ou corpo vazio
  const withBody = (head, after) => {
    const a = after.trim();
    if (!a) { out.push(`${head} {`); ctx.addedBrace = true; return; } // `{` vem na próxima linha
    if (a.startsWith("{")) {
      const close = matchBrace(a, 0);
      if (close < 0) { out.push(`${head} {`); return; } // chave fecha depois
      const inner = a.slice(1, close);
      out.push(`${head} {`);
      for (const seg of splitTop(inner, ";").map((s) => s.trim()).filter((s) => s !== "")) {
        convertStmt(seg, maskStrings(seg), ctx, warn, out);
      }
      out.push(`}`);
      const rest = a.slice(close + 1).trim();
      if (rest) convertStmt(rest, maskStrings(rest), ctx, warn, out); // `else ...`, `catch ...`
      return;
    }
    if (a === ";") { out.push(`${head} {}`); warn(`${head} sem corpo: bloco vazio`); return; }
    out.push(`${head} {`);
    const stmt = a.replace(/;\s*$/, "");
    convertStmt(stmt, maskStrings(stmt), ctx, warn, out);
    out.push("}");
  };
  if (!t) return;
  if (t === "{" || t === "}") { out.push(t); return; }
  // chaves penduradas: `... {` de if/while/for/fn já tratados; `{` sozinho ok
  let m;
  // } else if (c) / } else (+ corpo de linha única)
  if (/^\}\s*else\s+if\s*\(/.test(t)) {
    const b = balanced(C, C.indexOf("(", t.indexOf("if")));
    if (!b) { warn(`if sem parênteses balanceados: ${C.slice(0, 50)}`); out.push(`// [cs] revisar: ${C}`); return; }
    withBody(`} else if ${convertExpr(b.inner, warn)}`, C.slice(b.end + 1));
    return;
  }
  if (/^\}\s*else\b(?!\s*if\b)/.test(t)) {
    const after = C.slice(t.match(/^\}\s*else\b/)[0].length);
    withBody("} else", after);
    return;
  }
  // else if (c) / else isolados (o `}` de fechamento veio na linha anterior)
  if (/^else\s+if\s*\(/.test(t)) {
    const b = balanced(C, C.indexOf("("));
    if (!b) { warn(`if sem parênteses balanceados: ${C.slice(0, 50)}`); out.push(`// [cs] revisar: ${C}`); return; }
    withBody(`else if ${convertExpr(b.inner, warn)}`, C.slice(b.end + 1));
    return;
  }
  if (/^else\b/.test(t)) {
    withBody("else", C.slice(t.match(/^else\b/)[0].length));
    return;
  }
  // try / catch / finally → blocos simples (com corpo inline ou não)
  {
    const mAll = /^(?:\}\s*)?(try|catch|finally)\b/.exec(t);
    if (mAll) {
      warn(`${mAll[1]} aproximado para bloco`);
      let afterC = C.slice(mAll[0].length);
      const afterM = t.slice(mAll[0].length);
      if (afterM.trimStart().startsWith("(")) {
        const b = balanced(afterC, afterM.indexOf("("));
        afterC = b ? afterC.slice(b.end + 1) : "";
      }
      withBody(t.trimStart().startsWith("}") ? "}" : "", afterC);
      return;
    }
  }
  // if / while
  if ((m = /^(if|while)\s*\(/.exec(t))) {
    const kw = m[1];
    const b = balanced(C, C.indexOf("("));
    if (!b) { warn(`${kw} sem parênteses balanceados`); out.push(`// [cs] revisar: ${C}`); return; }
    withBody(`${kw} ${convertExpr(b.inner, warn)}`, C.slice(b.end + 1));
    return;
  }
  if (/^do\s*\{?\s*$/.test(t)) { warn("do/while aproximado para bloco"); out.push("{"); return; }
  if (/^\}\s*while\s*\(/.test(t)) { warn("do/while aproximado: condição descartada"); out.push("}"); return; }
  // for / foreach
  if (/^foreach\s*\(/.test(t)) {
    const b = balanced(C, C.indexOf("("));
    // foreach (var x in xs) / foreach (int x in xs)
    const mm = /^(?:[\w<>?,\[\]\s]+?)\s+([A-Za-z_]\w*)\s+in\s+([\s\S]+)$/.exec(b ? b.inner.trim() : "");
    if (!b || !mm) { warn(`foreach não reconhecido: ${C.slice(0, 60)}`); out.push(`// [cs] revisar: ${C}`); return; }
    withBody(`for ${mm[1]} in ${convertExpr(mm[2], warn)}`, C.slice(b.end + 1));
    return;
  }
  if (/^for\s*\(/.test(t)) {
    const rep = convertClassicFor(C, warn);
    if (rep) {
      const b = balanced(C, C.indexOf("("));
      withBody(rep, C.slice(b.end + 1));
    } else {
      warn(`for C-style fora do padrão i = 0; i < n; i++: ${C.slice(0, 60)}`);
      out.push(`// [cs] revisar: ${C}`);
    }
    return;
  }
  if (/^switch\s*\(/.test(t)) {
    // só descarta as linhas seguintes quando o bloco continua (chave aberta na linha)
    if (countChar(masked, "{") > countChar(masked, "}")) ctx.skipTo = ctx.depthBefore;
    warn("switch/case sem equivalente; bloco ignorado");
    out.push(`// [cs] switch ignorado: ${C.slice(0, 60)}`);
    return;
  }
  if (/^(case\s|default\s*:)/.test(t)) { warn("case fora de switch ignorado"); out.push(`// [cs] case ignorado: ${C}`); return; }
  // return / break / continue
  if (/^return\b/.test(t)) { out.push(`return${/;\s*$/.test(C) ? " " + convertExpr(C.replace(/^return\b/, "").replace(/;\s*$/, ""), warn) : " " + convertExpr(C.replace(/^return\b/, ""), warn)}`.replace(/return\s*$/, "return")); return; }
  if (/^(break|continue)\s*;?\s*$/.test(t)) { out.push(t.replace(/;.*$/, "")); return; }
  // throw → assert
  if ((m = /^\bthrow\b/.exec(t))) {
    const arg = C.slice(5).replace(/;\s*$/, "").trim();
    const sm = /new\s+\w+(?:\.\w+)*\s*\(\s*("(?:\\.|[^"\\])*"|`[^`]*`)?/.exec(arg);
    out.push(sm && sm[1] ? `assert(false, ${convertExpr(sm[1], warn)})` : `assert(false)`);
    warn("throw adaptado para assert(false)");
    return;
  }
  // Console.*
  if ((m = /^Console\.WriteLine\s*\(/.exec(t))) {
    const b = balanced(C, C.indexOf("("));
    const inner = b ? b.inner.trim() : "";
    out.push(inner ? `print(${convertExpr(inner, warn)})` : `print("")`);
    return;
  }
  if ((m = /^Console\.Write\s*\(/.exec(t))) {
    const b = balanced(C, C.indexOf("("));
    warn("Console.Write aproximado para print (com quebra de linha)");
    out.push(`print(${convertExpr(b ? b.inner.trim() : '""', warn)})`);
    return;
  }
  if (/^Console\.ReadLine\s*\(\s*\)/.test(t)) { warn("Console.ReadLine sem entrada equivalente (string vazia)"); out.push(`""`); return; }
  if (/^Console\.ReadKey/.test(t)) { warn("Console.ReadKey sem equivalente"); out.push(`// [cs] Console.ReadKey ignorado`); return; }
  if (/^Console\.(Clear|SetCursorPosition|Beep|ResetColor|ForegroundColor|BackgroundColor|Title|CursorVisible)/.test(t)) {
    warn("recurso de console sem equivalente"); out.push(`// [cs] console ignorado: ${C}`); return;
  }
  // declarações
  const noSemi = C.replace(/;\s*$/, "");
  if (convertDecl(maskStrings(noSemi).replace(/;\s*$/, ""), noSemi, ctx, warn, out)) return;
  // i++ / i--
  if (/^[A-Za-z_][\w.]*\s*(\+\+|--)\s*;?\s*$/.test(t)) {
    out.push(`${C.replace(/(\+\+|--)\s*;?\s*$/, "").trim()} ${C.includes("++") ? "+=" : "-="} 1`);
    return;
  }
  // atribuição composta/simples
  if ((m = /^([A-Za-z_][\w.\[\]]*)\s*(=|\+=|-=|\*=|\/=|%=|\?\?=)\s*([\s\S]+?);?\s*$/.exec(C))) {
    const [, target, op, val] = m;
    if (op === "?=" || op === "??=") out.push(`${target} = ${target} ?? ${convertExpr(val, warn)}`);
    else out.push(`${target} ${op} ${convertExpr(val, warn)}`);
    return;
  }
  // chamada / expressão
  if (/;\s*$/.test(C) || !/[{}]/.test(t)) {
    const e = convertExpr(C.replace(/;\s*$/, ""), warn);
    if (/^\s*new\s+/.test(e) || /\b(as|is)\b/.test(maskStrings(e)) || /lock\s*\(|fixed\s*\(/.test(t)) {
      warn(`construção sem equivalente: ${C.slice(0, 60)}`);
      out.push(`// [cs] revisar: ${C}`);
      return;
    }
    // guarda: parênteses/chaves desbalanceados
    if (countChar(maskStrings(e), "(") !== countChar(maskStrings(e), ")")) {
      warn(`expressão desbalanceada: ${C.slice(0, 60)}`);
      out.push(`// [cs] revisar: ${C}`);
      return;
    }
    out.push(e);
    return;
  }
  warn(`linha não reconhecida: ${C.slice(0, 60)}`);
  out.push(`// [cs] revisar: ${C}`);
}

// ---------------------------------------------------------------- principal

const CLASS_RE = /^\s*(?:(?:public|internal|private|protected|static|sealed|abstract|partial|unsafe)\s+)*(class|struct|record|interface|enum)\s+([A-Za-z_]\w*)/;
const METHOD_RE = /^\s*((?:(?:public|private|protected|internal|static|virtual|override|async|sealed|extern|unsafe|new|partial)\s+)*)([\w?<>,\[\]\s]+?)\s+([A-Za-z_]\w*)(<[^;{}]*>)?\s*\(([^;{}]*)\)\s*(\{?)\s*$/;
const NON_METHOD = new Set(["if", "else", "for", "foreach", "while", "do", "switch", "catch", "using", "lock", "fixed", "return", "new", "case", "where"]);

/** Máscara strings/templates Vessie para contar `{}` com segurança. */
function maskVessie(line) {
  let out = "", i = 0;
  const n = line.length;
  while (i < n) {
    const c = line[i];
    if (c === "/" && line[i + 1] === "/") break; // comentário: ignora o resto
    if (c === '"' || c === "'" || c === "`") {
      const q = c;
      out += " ";
      i++;
      while (i < n && line[i] !== q) {
        if (line[i] === "\\" && i + 1 < n) { out += "  "; i += 2; }
        else { out += line[i] === "\n" ? "\n" : " "; i++; }
      }
      out += " ";
      i++;
    } else { out += c; i++; }
  }
  return out;
}

/** Reindenta o fonte Vessie gerado (2 espaços por nível). */
function reindent(lines) {
  let d = 0;
  return lines.map((raw) => {
    if (!raw.trim()) return "";
    const m = maskVessie(raw);
    const opens = countChar(m, "{");
    const closes = countChar(m, "}");
    const startsClose = /^\s*}/.test(m);
    const ind = Math.max(0, d - (startsClose ? 1 : 0));
    d = Math.max(0, d + opens - closes);
    return "  ".repeat(ind) + raw.trim();
  });
}

/**
 * Converte fonte C# em fonte Vessie.
 * @returns {{code: string, warnings: string[]}}
 */
function convertCSharp(src, { appName = null } = {}) {
  const warnings = [];
  const warn = (w) => { if (!warnings.includes(w)) warnings.push(w); };
  const endl = (n) => ` (linha ${n})`;
  const text = stripBlockComments(String(src ?? "")).split("\n");
  // máscara + sem comentários de linha
  const rows = text.map((raw) => {
    if (/^\s*\/\//.test(raw)) return { raw, code: "", masked: "", skip: true, doc: true };
    if (/^\s*#/.test(raw)) return { raw, code: "", masked: "", skip: true, doc: true }; // diretivas
    if (/^\s*using\s+[\w.=\s]+\s*;\s*$/.test(raw)) return { raw, code: "", masked: "", skip: true, doc: false };
    const code = stripLineComment(raw).replace(/\s+$/, "");
    return { raw, code, masked: maskStrings(code), skip: false, doc: false };
  });
  const droppedDoc = rows.filter((r) => r.doc).length;
  if (droppedDoc) warn(`${droppedDoc} linha(s) de comentário-doc/diretiva descartadas`);

  const hasClass = rows.some((r) => !r.skip && CLASS_RE.test(r.masked));
  let app = null; // primeira classe encontrada (tem prioridade sobre appName)
  const optName = appName;
  const out = [];
  const skipClosers = []; // profundidades cujo `}` solitário deve ser descartado
  let pendingOpener = false; // `class X` sem `{`: o próximo `{` solitário abre o bloco descartável
  let classDepth = null;
  let inMethod = false, methodOpen = null;
  let skipSwitchDepth = null;
  let dropNextOpen = false; // `{` emitido por nós: descarta o `{` solitário seguinte do C#
  let depth = 0;
  let mainCount = 0;

  const pushSkip = (dAfter) => skipClosers.push(dAfter);

  for (let li = 0; li < rows.length; li++) {
    const r = rows[li];
    const lineNo = li + 1;
    const w = (msg) => warn(msg + endl(lineNo));
    if (r.skip) continue;
    const t = r.masked.trim();
    const opens = countChar(r.masked, "{");
    const closes = countChar(r.masked, "}");
    const depthBefore = depth;

    // dentro de switch ignorado: descarta até voltar à profundidade
    if (skipSwitchDepth !== null) {
      depth += opens - closes;
      if (depth <= skipSwitchDepth) skipSwitchDepth = null;
      continue;
    }
    // `{` solitário que duplica uma chave já emitida pelo conversor
    if (dropNextOpen) {
      dropNextOpen = false;
      if (t === "{") { depth += opens - closes; continue; }
    }
    // `}` solitário de bloco descartável (namespace/classe)
    if (t === "}" && skipClosers.length && depthBefore === skipClosers[skipClosers.length - 1]) {
      skipClosers.pop();
      if (classDepth !== null && depthBefore === classDepth) { classDepth = null; inMethod = false; }
      depth += opens - closes;
      continue;
    }
    // `{` solitário após `class X` sem chave
    if (pendingOpener && t === "{") {
      pendingOpener = false;
      pushSkip(depthBefore + 1);
      depth += opens - closes;
      continue;
    }
    pendingOpener = false;
    if (!t) { depth += opens - closes; continue; }

    // namespace
    let m;
    if ((m = /^\s*namespace\s+[\w.]+\s*;?\s*$/.exec(t))) {
      if (!m[0].trimEnd().endsWith(";")) {
        // `namespace X` sem `;` nem `{`: abre bloco até o `}` correspondente
        pushSkip(depthBefore + (opens ? 1 : 1));
        if (!opens) {
          // a chave vem depois; marca pendência genérica via skipClosers já empilhado
        }
      }
      depth += opens - closes;
      continue;
    }
    // classe/struct/record/interface/enum
    if ((m = CLASS_RE.exec(r.masked))) {
      const [, kind, name] = m;
      if (!app) app = name;
      if (kind === "interface" || kind === "enum") {
        w(`${kind} ${name} sem equivalente; bloco ignorado`);
        if (opens) pushSkip(depthBefore + 1);
        else pendingOpener = true;
        depth += opens - closes;
        continue;
      }
      if (classDepth !== null) w(`tipo aninhado ${name}: membros mesclados no app`);
      if (opens) { pushSkip(depthBefore + 1); classDepth = depthBefore + 1; }
      else pendingOpener = true;
      // classe sem `{` na linha: classDepth vale após o `{` solitário
      if (!opens) classDepth = depthBefore + 1;
      depth += opens - closes;
      continue;
    }
    // assinatura de método (dentro de classe ou nível superior com classe)
    const methodCtx = classDepth !== null && !inMethod && depthBefore === classDepth;
    const buildHead = (mods, retRaw, name, gen, paramsRaw) => {
      if (gen) w(`método genérico ${name}: parâmetros de tipo descartados`);
      const isMain = name === "Main";
      const isAsync = /\basync\b/.test(mods) || /^Task\b/.test(retRaw.trim());
      const isCtor = app && name === app;
      if (isCtor) w(`construtor ${name} adaptado como função`);
      const params = paramsRaw.trim() ? splitTop(paramsRaw, ",").map((p) => {
        const pm = /^(?:(?:ref|out|in|params|this)\s+)*([\w?<>,\[\]\s]+?)\s+([A-Za-z_]\w*)(?:\s*=\s*([\s\S]+))?$/.exec(p.trim());
        if (!pm) { w(`parâmetro não reconhecido: ${p.trim().slice(0, 40)}`); return "_"; }
        if (pm[3] !== undefined) w(`valor padrão descartado no parâmetro ${pm[2]}`);
        if (/^(ref|out|in|params)\b/.test(p.trim())) w(`modificador de parâmetro descartado: ${p.trim().slice(0, 40)}`);
        const ann = vType(pm[1].trim());
        return ann ? `${pm[2]}: ${ann}` : pm[2];
      }) : [];
      const ret = vType(retRaw.trim());
      const retAnn = (!ret || /^(void|Task)$/.test(retRaw.trim())) ? "" : ` -> ${ret}`;
      const fname = isMain ? "main" : name;
      if (isMain) mainCount++;
      const finalParams = isMain && params.length ? (w("parâmetros de Main descartados (args de console sem equivalente)"), []) : params;
      return `${isAsync ? "async " : ""}fn ${fname}(${finalParams.join(", ")})${retAnn} {`;
    };
    // método de linha única: `static int Dobro(int x) { return x * 2; }`
    if (methodCtx && opens === closes && opens >= 1 && (m = /^\s*((?:(?:public|private|protected|internal|static|virtual|override|async|sealed|extern|unsafe|new|partial)\s+)*)([\w?<>,\[\]\s]+?)\s+([A-Za-z_]\w*)\s*\(/.exec(r.masked)) && !NON_METHOD.has(m[3])) {
      const b = balanced(r.code, r.code.indexOf("(", m[1].length + m[2].length));
      const afterParen = b ? r.code.slice(b.end + 1).trim() : "";
      if (b && afterParen.startsWith("{")) {
        const closeIdx = matchBrace(afterParen, 0);
        if (closeIdx >= 0 && afterParen.slice(closeIdx + 1).trim() === "") {
          const inner = afterParen.slice(1, closeIdx);
          out.push(buildHead(m[1], m[2], m[3], null, b.inner));
          for (const seg of splitTop(inner, ";").map((s) => s.trim()).filter((s) => s !== "")) {
            convertStmt(seg, maskStrings(seg), { isField: false, depthBefore, skipTo: null, addedBrace: false }, w, out);
          }
          out.push(`}`);
          depth += opens - closes;
          continue;
        }
      }
    }
    if (methodCtx && (m = METHOD_RE.exec(r.masked)) && !NON_METHOD.has(m[3]) && !t.includes(";") && !t.includes(".")) {
      const [, , retRaw, name, gen, paramsRaw, brace] = m;
      out.push(buildHead(m[1], retRaw, name, gen, paramsRaw));
      inMethod = true;
      methodOpen = depthBefore + 1;
      if (!brace) dropNextOpen = true; // `{` na próxima linha duplica a chave emitida
      depth += opens - closes;
      continue;
    }
    // método de corpo de expressão: `int Dobro(int x) => x * 2;`
    if (methodCtx && (m = /^\s*((?:(?:public|private|protected|internal|static|virtual|override|async|sealed|extern|unsafe|new|partial)\s+)*)([\w?<>,\[\]\s]+?)\s+([A-Za-z_]\w*)\s*\(([^;{}]*)\)\s*=>\s*([\s\S]+?);?\s*$/.exec(r.masked)) && !NON_METHOD.has(m[3]) && !t.includes(".")) {
      const [, , retRaw2, name2, paramsRaw2] = m;
      const body2 = r.code.slice(r.code.indexOf("=>") + 2).replace(/;\s*$/, "").trim();
      const params2 = paramsRaw2.trim() ? splitTop(paramsRaw2, ",").map((p) => {
        const pm = /^(?:(?:ref|out|in|params|this)\s+)*([\w?<>,\[\]\s]+?)\s+([A-Za-z_]\w*)(?:\s*=\s*([\s\S]+))?$/.exec(p.trim());
        if (!pm) return "_";
        const ann = vType(pm[1].trim());
        return ann ? `${pm[2]}: ${ann}` : pm[2];
      }) : [];
      const ret2 = vType(retRaw2.trim());
      out.push(`fn ${name2}(${params2.join(", ")})${ret2 && !/^(void|Task)$/.test(retRaw2.trim()) ? ` -> ${ret2}` : ""} {`);
      out.push(`  return ${convertExpr(body2, w)}`);
      out.push(`}`);
      depth += opens - closes;
      continue;
    }
    // `}` solitário fecha método
    if (inMethod && t === "}" && depthBefore === methodOpen) {
      inMethod = false; methodOpen = null;
      out.push("}");
      depth += opens - closes;
      continue;
    }
    // constraints where
    if (/^\s*where\s+\w+\s*:/.test(t)) { w("constraint where descartada"); depth += opens - closes; continue; }
    // atributos [X]
    if (/^\[/.test(t)) { w(`atributo ignorado: ${r.code.trim().slice(0, 50)}`); out.push(`// [cs] atributo ignorado: ${r.code.trim()}`); depth += opens - closes; continue; }
    // propriedades auto/get-set
    if (/{\s*get\s*;/.test(t)) { w(`propriedade sem equivalente: ${r.code.trim().slice(0, 50)}`); out.push(`// [cs] propriedade ignorada: ${r.code.trim()}`); depth += opens - closes; continue; }

    // instrução comum (pode ter vários `;` na linha, exceto for)
    const ctx = { isField: classDepth !== null && !inMethod && depthBefore === classDepth, depthBefore, skipTo: null, addedBrace: false };
    const segs = /^for\s*\(/.test(t) ? [r.code] : splitTop(r.code, ";").map((s) => s.trim()).filter((s) => s !== "");
    if (!segs.length) { depth += opens - closes; continue; }
    for (const seg of segs) convertStmt(seg, maskStrings(seg), ctx, w, out);
    if (ctx.skipTo !== null) skipSwitchDepth = ctx.skipTo;
    if (ctx.addedBrace) dropNextOpen = true;
    depth += opens - closes;
  }

  if (!app) app = optName ?? "App";
  // sem classe: embrulha tudo em fn main
  let body = out;
  if (!hasClass) {
    body = ["fn main() {", ...out, "}"];
    if (mainCount === 0) warn("sem classe/método Main: instruções embrulhadas em fn main()");
  }
  let code = `app ${app}\n\n${reindent(body).join("\n")}\n`.replace(/\n{3,}/g, "\n\n");
  return { code, warnings };
}


/* ===== src\compiler\backends\python.js ===== */
// Backend Python: transpila um arquivo .vessie para um script .py executável.
// Alvo: o subconjunto lógico da linguagem (estado, funções, condicionais, laços,
// stdlib núcleo: math/string/array/object/json/date/print). UI, CSS, blocos `js`/`html`
// e stdlib web (http/storage/js/ui) NÃO são traduzíveis: são omitidos com comentários.
//
// O código gerado é autocontido (helper de runtime embutido) e roda com `python3 arquivo.py`.

const PY_IDENT_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;

/** Nome seguro em Python para um identificador Vessie (palavras reservadas viram <nome>_). */
const PY_RESERVED = new Set([
  "and", "as", "assert", "async", "await", "break", "class", "continue", "def", "del", "elif", "else",
  "except", "finally", "for", "from", "global", "if", "import", "in", "is", "lambda", "nonlocal", "not",
  "or", "pass", "raise", "return", "try", "while", "with", "yield", "True", "False", "None", "print",
]);

function pyName(name) {
  if (PY_RESERVED.has(name) || !PY_IDENT_RE.test(name)) return `${name}_`;
  return name;
}

const pyStr = (s) => JSON.stringify(String(s)).replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");

/** Pré-âmbulo embutido: helpers que espelham a semântica da stdlib Vessie no Python. */
const PY_HEADER = `# Gerado pelo backend Python da Vessie. Rode com: python3 este_arquivo.py
import math, json, random, datetime as _dt

def _clamp(v, lo, hi): return max(lo, min(v, hi))
def _lerp(a, b, t): return a + (b - a) * t
def _random_int(mn, mx): return random.randint(mn, mx)
def _modulo(n, d): return ((n % d) + d) % d
def _sign(x): return (x > 0) - (x < 0)
def _arr_map(a, fn): return [fn(x, i) for i, x in enumerate(a)]
def _arr_filter(a, fn): return [x for i, x in enumerate(a) if fn(x, i)]
def _arr_reduce(a, fn, init=None):
    if init is None:
        _it = iter(a); _acc = next(_it)
        for _x in _it: _acc = fn(_acc, _x)
        return _acc
    _acc = init
    for _x in a: _acc = fn(_acc, _x)
    return _acc
def _arr_find(a, fn):
    for _i, _x in enumerate(a):
        if fn(_x, _i): return _x
    return None
def _arr_sort(a, fn=None):
    if fn is None: return sorted(a)
    import functools
    return sorted(a, key=functools.cmp_to_key(fn))
def _arr_for_each(a, fn):
    for _i, _x in enumerate(a): fn(_x, _i)
def _arr_unique(a):
    _seen = set(); _out = []
    for _x in a:
        if _x not in _seen: _seen.add(_x); _out.append(_x)
    return _out
def _arr_remove(a, v):
    try: a.remove(v); return True
    except ValueError: return False
def _get(obj, key):
    if isinstance(obj, dict): return obj[key]
    return getattr(obj, key)
def _set(obj, key, value):
    if isinstance(obj, dict): obj[key] = value
    else: setattr(obj, key, value)
def _typeof(v):
    if v is None: return "null"
    if isinstance(v, list): return "array"
    return type(v).__name__
def _ts_now(): return int(_dt.datetime.now().timestamp() * 1000)
def _ts_iso(): return _dt.datetime.now().isoformat()
`;

/** Mapeamento $std.<ns>.<membro>(args) → Python. "fn" recebe os argumentos já traduzidos. */
const PY_STD = {
  "": {
    print: (a) => `print(${a.join(", ")})`,
    log: (a) => `print(${a.join(", ")})`,
    warn: (a) => `print("WARN:", ${a.join(", ")})`,
    error: (a) => `print("ERROR:", ${a.join(", ")})`,
    assert: (a) => `assert ${a[0]}${a[1] !== undefined ? ", " + a[1] : ""}`,
    typeof: (a) => `_typeof(${a[0]})`,
    typeofValue: (a) => `_typeof(${a[0]})`,
    isNull: (a) => `(${a[0]} is None)`,
    isDefined: (a) => `(${a[0]} is not None)`,
    range: (a) => (a[1] === undefined ? `range(${a[0]})` : `range(${a[0]}, ${a[1]})`),
  },
  math: {
    PI: "math.pi", E: "math.e",
    abs: (a) => `abs(${a[0]})`, floor: (a) => `math.floor(${a[0]})`, ceil: (a) => `math.ceil(${a[0]})`,
    round: (a) => `round(${a[0]})`, sqrt: (a) => `math.sqrt(${a[0]})`, pow: (a) => `math.pow(${a[0]}, ${a[1]})`,
    clamp: (a) => `_clamp(${a.join(", ")})`, lerp: (a) => `_lerp(${a.join(", ")})`,
    random: () => `random.random()`, randomInt: (a) => `_random_int(${a.join(", ")})`,
    sign: (a) => `_sign(${a[0]})`, modulo: (a) => `_modulo(${a.join(", ")})`,
    radians: (a) => `math.radians(${a[0]})`, degrees: (a) => `math.degrees(${a[0]})`,
    min: (a) => `min(${a.join(", ")})`, max: (a) => `max(${a.join(", ")})`,
  },
  string: {
    length: (a) => `len(${a[0]})`, upper: (a) => `${a[0]}.upper()`, lower: (a) => `${a[0]}.lower()`,
    trim: (a) => `${a[0]}.strip()`, split: (a) => `${a[0]}.split(${a[1]})`, replace: (a) => `${a[0]}.replace(${a[1]}, ${a[2]})`,
    includes: (a) => `(${a[1]} in ${a[0]})`, startsWith: (a) => `${a[0]}.startswith(${a[1]})`,
    endsWith: (a) => `${a[0]}.endswith(${a[1]})`, repeat: (a) => `(${a[0]} * ${a[1]})`,
    chars: (a) => `list(${a[0]})`, format: (a) => `${a[0]}.format(${a.slice(1).join(", ")})`,
  },
  array: {
    length: (a) => `len(${a[0]})`, map: (a) => `_arr_map(${a.join(", ")})`, filter: (a) => `_arr_filter(${a.join(", ")})`,
    reduce: (a) => `_arr_reduce(${a.join(", ")})`, find: (a) => `_arr_find(${a.join(", ")})`, sort: (a) => `_arr_sort(${a.join(", ")})`,
    forEach: (a) => `_arr_for_each(${a.join(", ")})`, includes: (a) => `(${a[1]} in ${a[0]})`,
    push: (a) => `${a[0]}.append(${a[1]})`,
    join: (a) => (a[1] === undefined ? `",".join(str(x) for x in ${a[0]})` : `str(${a[1]}).join(str(x) for x in ${a[0]})`),
    first: (a) => `(${a[0]}[0] if ${a[0]} else None)`, last: (a) => `(${a[0]}[-1] if ${a[0]} else None)`,
    reverse: (a) => `${a[0]}[::-1]`, slice: (a) => `${a[0]}[${a[1]}:${a[2] ?? "None"}]`,
    concat: (a) => `${a[0]} + ${a[1]}`, unique: (a) => `_arr_unique(${a[0]})`, remove: (a) => `_arr_remove(${a.join(", ")})`,
  },
  object: {
    keys: (a) => `list((${a[0]}).keys())`, values: (a) => `list((${a[0]}).values())`,
    has: (a) => `(${a[1]} in ${a[0]})`,
  },
  json: {
    parse: (a) => `json.loads(${a[0]})`, stringify: (a) => `json.dumps(${a[0]})`,
  },
  date: {
    now: () => `_ts_now()`, iso: () => `_ts_iso()`, format: () => `_ts_iso()`,
  },
};

const STD_HELPERS = new Set(["joincollect"]);
const NOT_SUPPORTED = new Set(["http", "storage", "js", "ui", "cs", "html"]);

class PyGen {
  constructor() { this.lines = []; this.ind = 0; this.notes = []; }

  line(text = "") {
    const pad = "    ".repeat(this.ind);
    for (const part of String(text).split("\n")) this.lines.push(part === "" ? "" : pad + part);
  }

  stmts(list) { for (const s of list) this.stmt(s); }

  block(list) { this.ind++; this.stmts(list); this.ind--; }

  stmt(s) {
    switch (s.type) {
      case "StateDecl": this.line(`${pyName(s.name)} = ${this.ex(s.init)}`, s.loc); break;
      case "ComputedDecl": this.line(`def _c_${pyName(s.name)}():`); this.ind++; this.line(`return ${this.ex(s.init)}`); this.ind--; break;
      case "CssDecl": case "JsDecl": case "HtmlDecl": case "CsDecl":
        this.line(`# (bloco ${s.type.replace("Decl", "")} omitido no alvo Python)`); break;
      case "VarDecl":
        this.line(`${pyName(s.name)} = ${s.init ? this.ex(s.init) : "None"}`, s.loc); break;
      case "FnDecl": {
        const prefix = s.isAsync ? "async " : "";
        this.line(`${prefix}def ${pyName(s.name)}(${s.params.map((p) => pyName(p.name)).join(", ")}):`, s.loc);
        if (!s.body.body.length) { this.ind++; this.line("pass"); this.ind--; }
        else this.block(s.body.body);
        break;
      }
      case "UiDecl": this.line(`# (ui "${s.name}" omitida no alvo Python)`); break;
      case "Block": this.block(s.body); break;
      case "If": {
        this.line(`if ${this.ex(s.test)}:`, s.loc);
        this.block(s.then.body);
        if (s.otherwise) {
          if (s.otherwise.type === "If") {
            this.line("elif " + this.ex(s.otherwise.test) + ":");
            this.block(s.otherwise.then.body);
            let rest = s.otherwise.otherwise;
            while (rest && rest.type === "If") {
              this.line("elif " + this.ex(rest.test) + ":");
              this.block(rest.then.body);
              rest = rest.otherwise;
            }
            if (rest) { this.line("else:"); this.block(rest.body); }
            else if (s.otherwise.otherwise && !s.otherwise.otherwise.type) {
              this.line("else:"); this.block(s.otherwise.otherwise.body);
            }
          } else {
            this.line("else:");
            this.block(s.otherwise.body);
          }
        }
        break;
      }
      case "While":
        this.line(`while ${this.ex(s.test)}:`, s.loc);
        this.block(s.body.body);
        break;
      case "For":
        this.line(`for ${pyName(s.name)} in ${this.ex(s.iter)}:`, s.loc);
        this.block(s.body.body);
        break;
      case "Return": this.line(s.value ? `return ${this.ex(s.value)}` : "return", s.loc); break;
      case "Break": this.line("break", s.loc); break;
      case "Continue": this.line("continue", s.loc); break;
      case "ExprStmt": this.line(`${this.ex(s.expr)}`, s.loc); break;
      case "Assign": this.line(`${this.assign(s)}`, s.loc); break;
      default: this.notes.push(`Instrução "${s.type}" fora do subconjunto Python (ignorada).`);
    }
  }

  assign(s) {
    const t = s.target;
    if (t.type === "Member") return `${this.ex(t.object)}[${pyStr(t.property)}] ${s.op} ${this.ex(s.value)}`;
    if (t.type === "Index") return `${this.ex(t.object)}[${this.ex(t.index)}] ${s.op} ${this.ex(s.value)}`;
    return `${this.ex(t)} ${s.op} ${this.ex(s.value)}`;
  }

  ex(e) {
    switch (e.type) {
      case "Number": return e.raw;
      case "String": return pyStr(e.value);
      case "Boolean": return e.value ? "True" : "False";
      case "Null": return "None";
      case "Template": return this.template(e);
      case "Identifier": return this.ident(e);
      case "Array": return `[${e.items.map((i) => this.ex(i)).join(", ")}]`;
      case "Object": return `{ ${e.props.map((p) => `${pyStr(p.key)}: ${this.ex(p.value)}`).join(", ")} }`;
      case "Member": return this.member(e);
      case "Index": return `${this.ex(e.object)}[${this.ex(e.index)}]`;
      case "Call": return this.call(e);
      case "Unary": return `(${e.op === "!" ? "not " : e.op}${this.ex(e.arg)})`;
      case "Await": return `(await ${this.ex(e.arg)})`;
      case "Binary": return this.binary(e);
      case "Ternary": return `(${this.ex(e.then)} if ${this.ex(e.test)} else ${this.ex(e.otherwise)})`;
      case "Arrow": return this.arrow(e);
      default: this.notes.push(`Expressão "${e.type}" fora do subconjunto Python (usou None).`); return "None";
    }
  }

  ident(e) {
    const b = e.binding;
    if (b?.htmlBlock || b?.csBlock) return "None";
    switch (b?.kind) {
      case "state": return pyName(e.name);
      case "computed": return `_c_${pyName(e.name)}()`;
      case "std": case "namespace": return e.name; // ex.: referência ao próprio namespace
      default: return pyName(e.name);
    }
  }

  member(e) {
    if (e.binding?.kind === "stdmember") {
      const map = PY_STD[e.binding.ns]?.[e.property];
      if (typeof map === "string") return map;
      if (typeof map === "function") return map([]);
      return `${e.binding.ns}.${e.property}`;
    }
    return `_get(${this.ex(e.object)}, ${pyStr(e.property)})`;
  }

  call(e) {
    const callee = e.callee;
    const args = e.args.map((a) => this.ex(a));
    if (callee.type === "Member" && callee.binding?.kind === "stdmember") {
      const ns = callee.binding.ns, prop = callee.property;
      if (NOT_SUPPORTED.has(ns)) { this.notes.push(`std.${ns}.${prop} não é suportado no alvo Python (omitido).`); return "None"; }
      const map = PY_STD[ns]?.[prop];
      if (typeof map === "function") return map(args);
      if (typeof map === "string") return map;
      this.notes.push(`std.${ns}.${prop} sem tradução Python (usou None).`);
      return "None";
    }
    if (callee.type === "Identifier" && (callee.binding?.kind === "std" || callee.binding?.kind === "namespace")) {
      const map = PY_STD[""]?.[callee.name];
      if (typeof map === "function") return map(args);
      if (callee.name === "range") return args.length === 1 ? `range(${args[0]})` : `range(${args.join(", ")})`;
    }
    return `${this.ex(callee)}(${args.join(", ")})`;
  }

  template(e) {
    let out = 'f"';
    for (const p of e.parts) {
      if (p.kind === "str") {
        out += String(p.value).replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\{/g, "{{").replace(/\}/g, "}}");
      } else {
        out += `{${this.ex(p.expr)}}`;
      }
    }
    return out + '"';
  }

  binary(e) {
    const op = e.op === "&&" ? "and" : e.op === "||" ? "or" : e.op;
    return `(${this.ex(e.left)} ${op} ${this.ex(e.right)})`;
  }

  arrow(e) {
    const params = `(${e.params.map((p) => pyName(p.name)).join(", ")})`;
    if (e.body.type === "Block") {
      this.notes.push("Arrow com corpo de bloco fora do subconjunto Python (gerou lambda no-op).");
      return `(lambda ${params.replace(/^\(|\)$/g, "")}: None)`;
    }
    if (e.body.type === "Assign") {
      const fn = `lambda ${params.replace(/^\(|\)$/g, "")}: ${this.assign(e.body)}`;
      return fn;
    }
    return `(lambda ${params.replace(/^\(|\)$/g, "")}: ${this.ex(e.body)})`;
  }
}

/**
 * Gera um script Python a partir da AST analisada.
 * @returns {{ok:boolean, code:string|null, notes:string[]}}
 */
function generatePython(program, analysis, opts = {}) {
  const g = new PyGen();
  g.line("# Gerado pelo backend Python da Vessie (subconjunto lógico).");
  const appName = program.app?.name ?? "VessieApp";
  g.line(`# App: ${String(appName).replace(/\n/g, " ")}`);
  g.line("");
  for (const ln of PY_HEADER.split("\n")) g.line(ln);
  g.line("");
  g.stmts(program.body);
  const hasMain = program.body.some((s) => s.type === "FnDecl" && s.name === "main" && s.params.length === 0 && !s.isAsync);
  if (hasMain) {
    g.line("");
    g.line(`if __name__ == "__main__":`);
    g.line(`    main()`);
  }
  return { ok: true, code: g.lines.join("\n") + "\n", notes: [...new Set(g.notes)] };
}

/* ===== src\multibase\catalog.js ===== */
// Catálogo da Multi-Base Vessie: módulos organizados por gênero, com código-fonte
// por linguagem (vessie, python, node/js, html, css) e pools de variação.
// Cada `{{PARAM}}` no código é substituído pela variação escolhida na geração.

const MODULES = [
  // ============================ web (UI .vessie) ============================
  {
    id: "counter", genre: "web", name: "Contador reativo",
    desc: "Contador com estado, computed e botões de incrementar/zerar.",
    tags: ["contador", "estado", "botão", "computed", "iniciante"],
    params: { APP: "Contador", TITLE: "Contador" },
    vary: {
      TITLE: ["Contador", "Contador de cliques", "Placar", "Pontuação", "Score Game", "Contador de passos"],
      APP: ["Contador", "Placar", "Pontuacao", "ScoreApp", "Passos"],
    },
    code: {
      vessie: `app {{APP}}

state count: number = 0

computed dobro: number = count * 2

fn incrementar() { count += 1 }

fn zerar() { count = 0 }

ui App {
  page "{{TITLE}}" {
    column gap: 16 {
      heading "{{TITLE}}" level: 1
      text \`Valor: \${count} · dobro: \${dobro}\`
      row gap: 8 {
        button "Incrementar" on:click incrementar
        button "Zerar" variant: "secondary" on:click zerar
        button "-1" on:click () => count -= 1
      }
    }
  }
}
`,
    },
  },
  {
    id: "todolist", genre: "web", name: "Lista de tarefas",
    desc: "Adiciona tarefas, mostra total e última tarefa, limpa a lista.",
    tags: ["tarefas", "todo", "lista", "input", "formulário"],
    params: { APP: "Tarefas", TITLE: "Minhas Tarefas" },
    vary: {
      TITLE: ["Minhas Tarefas", "Lista de Tarefas", "Afazeres", "To-Do", "Planejamento", "Checklist"],
      APP: ["Tarefas", "TodoApp", "Afazeres", "Checklist"],
    },
    code: {
      vessie: `app {{APP}}

state tarefas: string[] = []
state nova: string = ""

fn adicionar() {
  if nova != "" {
    array.push(tarefas, nova)
    nova = ""
  }
}

fn limpar() {
  tarefas = []
}

ui App {
  page "{{TITLE}}" {
    column gap: 12 width: 420 {
      heading "{{TITLE}}"
      input bind:nova placeholder: "Nova tarefa" label: "Tarefa"
      row gap: 8 {
        button "Adicionar" on:click adicionar
        button "Limpar" variant: "secondary" on:click limpar
      }
      text \`Total: \${array.length(tarefas)}\`
      text \`Última: \${array.length(tarefas) > 0 ? array.last(tarefas) : "—"}\`
    }
  }
}
`,
    },
  },
  {
    id: "calculator", genre: "web", name: "Calculadora",
    desc: "Calculadora com as quatro operações, sem dependências.",
    tags: ["calculadora", "math", "botões", "lógica"],
    params: { APP: "Calculadora", TITLE: "Calculadora" },
    vary: {
      TITLE: ["Calculadora", "Mini Calculadora", "Calc Vessie", "Calculadora Rápida"],
      APP: ["Calculadora", "CalcApp", "MiniCalc"],
    },
    code: {
      vessie: `app {{APP}}

state display: number = 0
state total: number = 0
state operacao: string = ""
state novo: boolean = true

fn digitar(d: number) {
  if novo { display = d; novo = false }
  else { display = display * 10 + d }
}

fn definir(op: string) {
  if operacao != "" { igualar() }
  total = display
  operacao = op
  novo = true
}

fn igualar() {
  if operacao == "+" { display = total + display }
  if operacao == "-" { display = total - display }
  if operacao == "*" { display = total * display }
  if operacao == "/" { display = total / display }
  operacao = ""
  novo = true
}

fn limpar() {
  display = 0
  total = 0
  operacao = ""
  novo = true
}

ui App {
  page "{{TITLE}}" {
    column gap: 12 width: 280 {
      heading "{{TITLE}}"
      text \`Valor: \${display}\`
      row gap: 6 { button "7" on:click () => digitar(7) button "8" on:click () => digitar(8) button "9" on:click () => digitar(9) button "/" on:click () => definir("/") }
      row gap: 6 { button "4" on:click () => digitar(4) button "5" on:click () => digitar(5) button "6" on:click () => digitar(6) button "*" on:click () => definir("*") }
      row gap: 6 { button "1" on:click () => digitar(1) button "2" on:click () => digitar(2) button "3" on:click () => digitar(3) button "-" on:click () => definir("-") }
      row gap: 6 { button "0" on:click () => digitar(0) button "=" variant: "primary" on:click igualar button "C" variant: "secondary" on:click limpar button "+" on:click () => definir("+") }
    }
  }
}
`,
    },
  },
  {
    id: "timer", genre: "web", name: "Cronômetro",
    desc: "Cronômetro com bloco js (setInterval) integrado ao estado reativo.",
    tags: ["cronômetro", "tempo", "js", "setInterval", "integração"],
    params: { APP: "Cronometro", TITLE: "Cronômetro" },
    vary: {
      TITLE: ["Cronômetro", "Timer", "Temporizador", "Relógio", "Contador de Tempo"],
      APP: ["Cronometro", "TimerApp", "Temporizador"],
    },
    code: {
      vessie: `app {{APP}}

state segundos: number = 0
state rodando: boolean = false

js tick = \`
  setInterval(() => {
    if ($["rodando"]) {
      $["segundos"] += 1
    }
  }, 1000)
\`

fn iniciar() { rodando = true }

fn pausar() { rodando = false }

fn zerar() { segundos = 0 }

ui App {
  page "{{TITLE}}" {
    column gap: 16 align: "center" {
      heading "{{TITLE}}"
      text \`Segundos: \${segundos}\`
      row gap: 8 {
        button "Iniciar" on:click iniciar
        button "Pausar" variant: "secondary" on:click pausar
        button "Zerar" variant: "secondary" on:click zerar
      }
    }
  }
}
`,
    },
  },
  {
    id: "quiz", genre: "web", name: "Quiz de perguntas",
    desc: "Quiz com pontuação, feedback e próxima pergunta.",
    tags: ["quiz", "pergunta", "pontos", "jogo", "educação"],
    params: { APP: "Quiz", TITLE: "Quiz Rápido", TOTAL: 5, P1: "Qual linguagem gera esta página?", RESPOSTA: "A" },
    vary: {
      TITLE: ["Quiz Rápido", "Teste seus conhecimentos", "Q&A", "Desafio", "Quiz de Tags"],
      P1: ["Qual linguagem gera esta página?", "Qual é a capital do Brasil?", "Quanto é 2 + 2?", "Qual a cor do céu?"],
      RESPOSTA: ["A", "B", "C"],
    },
    code: {
      vessie: `app {{APP}}

state indice: number = 0
state pontos: number = 0
state respondido: boolean = false
state acertou: boolean = false

computed total: number = {{TOTAL}}

fn responder(opcao: string) {
  if respondido { return }
  acertou = opcao == "{{RESPOSTA}}"
  if acertou { pontos += 1 }
  respondido = true
}

fn proxima() {
  indice = indice + 1
  respondido = false
}

fn reiniciar() {
  indice = 0
  pontos = 0
  respondido = false
}

ui App {
  page "{{TITLE}}" {
    column gap: 16 width: 440 {
      heading "{{TITLE}}"
      text \`Pergunta \${indice + 1} de \${total} · pontos: \${pontos}\`
      alert "{{P1}}" variant: "info"
      row gap: 8 {
        button "A" on:click () => responder("A")
        button "B" on:click () => responder("B")
        button "C" on:click () => responder("C")
      }
      text acertou ? "Correto! 🎉" : respondido ? "Errado." : "Escolha uma alternativa"
      button "Próxima" variant: "secondary" disabled: !respondido on:click proxima
      button "Reiniciar" variant: "secondary" on:click reiniciar
    }
  }
}
`,
    },
  },
  {
    id: "theme-switch", genre: "web", name: "Alternador de tema",
    desc: "Alterna claro/escuro pela propriedade theme da página.",
    tags: ["tema", "claro", "escuro", "dark", "light", "estilo"],
    params: { APP: "Temas", TITLE: "Tema Claro/Escuro" },
    vary: {
      TITLE: ["Tema Claro/Escuro", "Modo Noturno", "Aparência", "Temas", "Dark Mode"],
      APP: ["Temas", "ThemeApp", "DarkMode"],
    },
    code: {
      vessie: `app {{APP}}

state escuro: boolean = false

fn alternar() { escuro = !escuro }

ui App {
  page "{{TITLE}}" theme: escuro ? "dark" : "light" {
    column gap: 16 align: "center" {
      heading "{{TITLE}}"
      text escuro ? "Tema escuro ativo 🌙" : "Tema claro ativo ☀️"
      button escuro ? "Usar claro" : "Usar escuro" on:click alternar
    }
  }
}
`,
    },
  },
  {
    id: "notes", genre: "web", name: "Bloco de notas persistente",
    desc: "Salva anotações no localStorage via storage + json.",
    tags: ["notas", "storage", "localStorage", "json", "persistência"],
    params: { APP: "Notas", TITLE: "Bloco de Notas", STORAGE_KEY: "vessie.notas" },
    vary: {
      TITLE: ["Bloco de Notas", "Anotações", "Memórias", "Lembretes", "Notas Rápidas"],
      STORAGE_KEY: ["vessie.notas", "app.notas", "bloco.anotacoes", "lembretes.v1"],
    },
    code: {
      vessie: `app {{APP}}

state notas: string[] = []
state nova: string = ""

fn salvar() {
  if nova != "" {
    array.push(notas, nova)
    storage.set("{{STORAGE_KEY}}", json.stringify(notas))
    nova = ""
  }
}

fn carregar() {
  notas = json.parse(storage.get("{{STORAGE_KEY}}", "[]"))
}

fn apagar() {
  notas = []
  storage.remove("{{STORAGE_KEY}}")
}

ui App {
  page "{{TITLE}}" {
    column gap: 12 width: 420 {
      heading "{{TITLE}}"
      button "Carregar" variant: "secondary" on:click carregar
      input bind:nova placeholder: "Nova nota" label: "Nota"
      row gap: 8 {
        button "Salvar" on:click salvar
        button "Apagar tudo" variant: "secondary" on:click apagar
      }
      text \`Notas salvas: \${array.length(notas)}\`
      text array.length(notas) > 0 ? array.last(notas) : "(vazio)"
    }
  }
}
`,
    },
  },
  {
    id: "form-cadastro", genre: "web", name: "Formulário de cadastro",
    desc: "Formulário com nome, e-mail, select e aceite de termos.",
    tags: ["formulário", "input", "select", "checkbox", "cadastro", "email"],
    params: { APP: "Cadastro", TITLE: "Cadastro" },
    vary: {
      TITLE: ["Cadastro", "Inscreva-se", "Criar Conta", "Registro", "Formulário de Contato"],
      APP: ["Cadastro", "CadastroApp", "RegistroApp"],
    },
    code: {
      vessie: `app {{APP}}

state nome: string = ""
state email: string = ""
state plano: string = "basico"
state aceito: boolean = false
state enviado: boolean = false

fn enviar() {
  if nome != "" && email != "" && aceito {
    enviado = true
  }
}

ui App {
  page "{{TITLE}}" {
    column gap: 12 width: 380 {
      heading "{{TITLE}}"
      input bind:nome placeholder: "Seu nome" label: "Nome"
      input bind:email placeholder: "voce@exemplo.com" type: "email" label: "E-mail"
      select bind:plano label: "Plano" {
        option "Básico" value: "basico"
        option "Pro" value: "pro"
        option "Max" value: "max"
      }
      checkbox bind:aceito label: "Aceito os termos"
      button "Enviar" on:click enviar
      text enviado ? \`Obrigado, \${nome}! Plano \${plano}.\` : ""
    }
  }
}
`,
    },
  },
  {
    id: "progress-app", genre: "web", name: "Barra de progresso",
    desc: "Progresso com botões, clamp via math e badge de status.",
    tags: ["progresso", "progress", "barra", "badge", "math"],
    params: { APP: "Progresso", TITLE: "Andamento" },
    vary: {
      TITLE: ["Andamento", "Progresso da meta", "Carregamento", "Nível", "Energia"],
      APP: ["Progresso", "NivelApp", "MetaApp"],
    },
    code: {
      vessie: `app {{APP}}

state progresso: number = 10

fn avancar() { progresso = math.min(100, progresso + 10) }

fn voltar() { progresso = math.max(0, progresso - 10) }

computed status: string = progresso >= 100 ? "success" : progresso >= 50 ? "info" : "warning"

ui App {
  page "{{TITLE}}" {
    column gap: 16 {
      heading "{{TITLE}}"
      progress value: progresso max: 100 label: "Progresso"
      text \`Andamento: \${progresso}%\`
      row gap: 8 {
        button "Avançar" on:click avancar
        button "Voltar" variant: "secondary" on:click voltar
      }
      badge bind: status
    }
  }
}
`,
    },
  },
  {
    id: "tabs-app", genre: "web", name: "Aplicativo com abas",
    desc: "Abas com conteúdo trocável e botões de seleção.",
    tags: ["abas", "tabs", "navegação", "conteúdo"],
    params: { APP: "Abas", TITLE: "Navegação em Abas" },
    vary: {
      TITLE: ["Navegação em Abas", "Portal", "Seções", "Conteúdo Guiado", "Painel de Abas"],
      APP: ["Abas", "PortalApp", "SeccoesApp"],
    },
    code: {
      vessie: `app {{APP}}

state ativa: string = "um"

ui App {
  page "{{TITLE}}" {
    column gap: 16 {
      heading "{{TITLE}}"
      tabs {
        tab "Primeira" title: "um" open: ativa == "um" {
          text "Conteúdo da primeira aba."
        }
        tab "Segunda" title: "dois" open: ativa == "dois" {
          text "Conteúdo da segunda aba."
        }
        tab "Terceira" title: "tres" open: ativa == "tres" {
          text "Conteúdo da terceira aba."
        }
      }
      row gap: 8 {
        button "Aba 1" on:click () => ativa = "um"
        button "Aba 2" on:click () => ativa = "dois"
        button "Aba 3" on:click () => ativa = "tres"
      }
    }
  }
}
`,
    },
  },
  {
    id: "modal-app", genre: "web", name: "Janela modal",
    desc: "Modal abrindo/fechando por estado, com ui.open/ui.close.",
    tags: ["modal", "dialog", "janela", "ui.open", "ui.close"],
    params: { APP: "Modal", TITLE: "Modal Vessie", MODAL_TITLE: "Aviso", MODAL_TEXT: "Esta janela abre por estado e fecha pelo botão." },
    vary: {
      TITLE: ["Modal Vessie", "Janelas", "Diálogos", "Popup"],
      MODAL_TITLE: ["Aviso", "Confirmação", "Atenção", "Informação"],
      MODAL_TEXT: ["Esta janela abre por estado e fecha pelo botão.", "Confirma a exclusão?", "Sua sessão expirou.", "Bem-vindo ao modal!"],
    },
    code: {
      vessie: `app {{APP}}

state aberto: boolean = false

fn abrir() { aberto = true }

fn fechar() { aberto = false }

ui App {
  page "{{TITLE}}" {
    column gap: 16 {
      heading "{{TITLE}}"
      button "Abrir modal" on:click abrir
      modal id: "aviso" title: "{{MODAL_TITLE}}" open: aberto {
        column gap: 12 {
          text "{{MODAL_TEXT}}"
          button "Fechar" variant: "secondary" on:click fechar
        }
      }
    }
  }
}
`,
    },
  },
  {
    id: "dashboard", genre: "web", name: "Painel (dashboard)",
    desc: "Grade de cards com computed de metas e percentuais.",
    tags: ["dashboard", "painel", "cards", "grid", "métricas"],
    params: { APP: "Painel", TITLE: "Painel de Vendas", VENDAS: 120, META: 100 },
    vary: {
      TITLE: ["Painel de Vendas", "Dashboard", "Métricas", "Visão Geral", "Relatório"],
      VENDAS: [120, 85, 210, 64, 150],
      META: [100, 90, 200, 80, 150],
    },
    code: {
      vessie: `app {{APP}}

state vendas: number = {{VENDAS}}
state meta: number = {{META}}

computed percentual: number = math.round(vendas / meta * 100)
computed status: string = vendas >= meta ? "Meta atingida!" : \`Faltam \${meta - vendas} vendas\`

ui App {
  page "{{TITLE}}" {
    column gap: 16 width: "min(720px, 100%)" {
      heading "{{TITLE}}" level: 1
      grid columns: 2 gap: 12 {
        card { column gap: 8 { heading "Vendas" text \`R\$ \${vendas}\` } }
        card { column gap: 8 { heading "Meta" text \`R\$ \${meta}\` } }
        card { column gap: 8 { heading "Percentual" text \`\${percentual}%\` } }
        card { column gap: 8 { heading "Status" badge bind: status } }
      }
    }
  }
}
`,
    },
  },
  {
    id: "search-filter", genre: "web", name: "Filtro de busca",
    desc: "Filtra nomes por termo usando computed + array.filter.",
    tags: ["busca", "filtro", "filter", "computed", "array"],
    params: { APP: "Busca", TITLE: "Buscar Nomes" },
    vary: {
      TITLE: ["Buscar Nomes", "Filtro de Clientes", "Pesquisa", "Lista Dinâmica", "Busca Rápida"],
      APP: ["Busca", "ClientesApp", "FiltroApp"],
    },
    code: {
      vessie: `app {{APP}}

state termo: string = ""

computed itens: string[] = ["Ana", "Bruno", "Carla", "Diego", "Elisa", "Fábio", "Gabi", "Hugo", "Iara"]
computed filtradas: string[] = array.filter(itens, (nome) => string.includes(string.lower(nome), string.lower(termo)))

ui App {
  page "{{TITLE}}" {
    column gap: 12 width: 380 {
      heading "{{TITLE}}"
      input bind:termo placeholder: "Buscar..." label: "Busca"
      text string.length(termo) == 0 ? array.join(itens, ", ") : array.join(filtradas, ", ")
      text \`Resultados: \${array.length(filtradas)}\`
    }
  }
}
`,
    },
  },

  // ============================ python ============================
  {
    id: "py-calculadora", genre: "python", name: "Calculadora no terminal",
    desc: "Calculadora interativa com as quatro operações (input).",
    tags: ["calculadora", "terminal", "input", "operações"],
    params: { TITLE: "Calculadora" },
    vary: { TITLE: ["Calculadora", "Calc CLI", "Calculadora Rápida", "Matemática"] },
    code: {
      python: `print("{{TITLE}}")
a = float(input("Primeiro número: "))
op = input("Operação (+ - * /): ").strip()
b = float(input("Segundo número: "))

if op == "+":
    r = a + b
elif op == "-":
    r = a - b
elif op == "*":
    r = a * b
elif op == "/":
    r = a / b if b != 0 else None
else:
    r = None

print("Resultado:", r if r is not None else "operação inválida")
`,
    },
  },
  {
    id: "py-fibonacci", genre: "python", name: "Sequência de Fibonacci",
    desc: "Gera a sequência com soma e média.",
    tags: ["fibonacci", "sequência", "laço", "número"],
    params: { TITLE: "Fibonacci" },
    vary: { TITLE: ["Fibonacci", "Sequência Fib", "Números de Fibonacci", "Série"] },
    code: {
      python: `n = int(input("Quantos termos? ") or 10)
a, b = 0, 1
serie = []
for _ in range(n):
    serie.append(a)
    a, b = b, a + b
print("Fibonacci:", serie)
print("Soma:", sum(serie))
print("Média:", sum(serie) / len(serie) if serie else 0)
`,
    },
  },
  {
    id: "py-fizzbuzz", genre: "python", name: "FizzBuzz",
    desc: "Clássico de entrevistas: múltiplos de 3, 5 e 15.",
    tags: ["fizzbuzz", "entrevista", "laço", "condicional"],
    params: { LIMITE: 30 },
    vary: { LIMITE: [30, 50, 100, 20] },
    code: {
      python: `limite = int(input("Até quanto? ") or {{LIMITE}})
for i in range(1, limite + 1):
    if i % 15 == 0:
        print("FizzBuzz")
    elif i % 3 == 0:
        print("Fizz")
    elif i % 5 == 0:
        print("Buzz")
    else:
        print(i)
`,
    },
  },
  {
    id: "py-primos", genre: "python", name: "Números primos",
    desc: "Lista, conta e soma os primos até um limite.",
    tags: ["primos", "números", "matemática", "crivo"],
    params: { ATE: 100 },
    vary: { ATE: [100, 200, 50, 500] },
    code: {
      python: `def eh_primo(n):
    if n < 2:
        return False
    for d in range(2, int(n ** 0.5) + 1):
        if n % d == 0:
            return False
    return True

ate = int(input("Primos até: ") or {{ATE}})
primos = [n for n in range(2, ate + 1) if eh_primo(n)]
print("Primos:", primos)
print("Quantidade:", len(primos))
print("Soma:", sum(primos))
`,
    },
  },
  {
    id: "py-media-notas", genre: "python", name: "Média de notas",
    desc: "Lê notas até Enter e devolve média e conceito.",
    tags: ["média", "notas", "escola", "conceito"],
    params: { TITLE: "Média de Notas" },
    vary: { TITLE: ["Média de Notas", "Boletim", "Médias Escolares", "Desempenho"] },
    code: {
      python: `print("{{TITLE}}")
notas = []
while True:
    v = input("Nota (ou Enter para sair): ")
    if v == "":
        break
    notas.append(float(v))

if notas:
    media = sum(notas) / len(notas)
    conceito = "A" if media >= 9 else "B" if media >= 7 else "C" if media >= 5 else "D"
    print("Notas:", notas)
    print(f"Média: {media:.2f} — conceito {conceito}")
else:
    print("Nenhuma nota informada.")
`,
    },
  },
  {
    id: "py-gerador-senha", genre: "python", name: "Gerador de senhas",
    desc: "Senha aleatória com letras, números e símbolos.",
    tags: ["senha", "segurança", "aleatório", "random"],
    params: { TAMANHO: 12 },
    vary: { TAMANHO: [8, 12, 16, 20] },
    code: {
      python: `import random, string
tamanho = int(input("Tamanho da senha: ") or {{TAMANHO}})
chars = string.ascii_letters + string.digits + "!@#$%"
senha = "".join(random.choice(chars) for _ in range(tamanho))
print("Senha:", senha)
print("Força:", "Forte" if tamanho >= 12 else "Média" if tamanho >= 8 else "Fraca")
`,
    },
  },
  {
    id: "py-palindromo", genre: "python", name: "Detector de palíndromos",
    desc: "Verifica se a frase é igual de trás para frente.",
    tags: ["palíndromo", "string", "texto", "verificação"],
    params: { FRASE: "Socorram-me, subi no ônibus em Marrocos" },
    vary: { FRASE: ["Socorram-me, subi no ônibus em Marrocos", "Anotaram a data da maratona", "A babá baba", "radar", "casa"] },
    code: {
      python: `texto = input("Digite uma palavra ou frase: ") or "{{FRASE}}"
limpo = "".join(c for c in texto.lower() if c.isalnum())
if limpo == limpo[::-1]:
    print("É palíndromo!")
else:
    print("Não é palíndromo.")
`,
    },
  },
  {
    id: "py-tabuada", genre: "python", name: "Tabuada",
    desc: "Imprime a tabuada de um número até um limite.",
    tags: ["tabuada", "multiplicação", "escola", "laço"],
    params: { N: 7, ATE: 10 },
    vary: { N: [3, 5, 7, 9], ATE: [10, 12, 15] },
    code: {
      python: `n = int(input("Tabuada de: ") or {{N}})
ate = int(input("Até: ") or {{ATE}})
print(f"Tabuada do {n}:")
for i in range(1, ate + 1):
    print(f"{n} x {i} = {n * i}")
`,
    },
  },
  {
    id: "py-fatorial", genre: "python", name: "Fatorial",
    desc: "Fatorial iterativo com tratamento de negativos.",
    tags: ["fatorial", "matemática", "recursão", "número"],
    params: { N: 5 },
    vary: { N: [5, 7, 10, 12] },
    code: {
      python: `def fatorial(n):
    if n < 0:
        return None
    r = 1
    for i in range(2, n + 1):
        r *= i
    return r

n = int(input("Fatorial de: ") or {{N}})
print(f"{n}! = {fatorial(n)}")
`,
    },
  },
  {
    id: "py-ordenar", genre: "python", name: "Ordenação (insertion sort)",
    desc: "Ordena números digitados com insertion sort.",
    tags: ["ordenação", "algoritmos", "insertion sort", "lista"],
    params: { TITLE: "Ordenação" },
    vary: { TITLE: ["Ordenação", "Insertion Sort", "Ordenar Lista", "Sort CLI"] },
    code: {
      python: `def ordenar(lista):
    for i in range(1, len(lista)):
        atual = lista[i]
        j = i - 1
        while j >= 0 and lista[j] > atual:
            lista[j + 1] = lista[j]
            j -= 1
        lista[j + 1] = atual
    return lista

itens = [int(x) for x in input("Números (espaçados): ").split()]
print("Original:", itens)
print("Ordenado:", ordenar(itens))
`,
    },
  },

  // ============================ node ============================
  {
    id: "node-hello", genre: "node", name: "Olá, Node.js",
    desc: "Script mínimo em Node.js.",
    tags: ["hello", "node", "exemplo", "começar"],
    params: { TITLE: "Olá, Node.js!" },
    vary: { TITLE: ["Olá, Node.js!", "Hello from Node", "Oi, mundo!", "Vessie → Node"] },
    code: {
      node: `// Rodar com: node este_arquivo.js
console.log("{{TITLE}}");
console.log("Gerado pela Multi-Base Vessie.");
`,
    },
  },
  {
    id: "node-args", genre: "node", name: "Argumentos de linha de comando",
    desc: "Lê e lista os argumentos passados ao script.",
    tags: ["args", "cli", "process.argv", "entrada"],
    params: {},
    vary: {},
    code: {
      node: `const args = process.argv.slice(2);
console.log("Argumentos:", args.length ? args.join(" | ") : "(nenhum)");
if (args.length) {
  for (const a of args) console.log("  •", a);
}
`,
    },
  },
  {
    id: "node-http-server", genre: "node", name: "Servidor HTTP",
    desc: "Servidor HTTP local com resposta em HTML.",
    tags: ["http", "servidor", "web", "porta"],
    params: { TITLE: "Servidor Vessie" },
    vary: { TITLE: ["Servidor Vessie", "Meu Site", "Servidor Local", "Página Mínima"] },
    code: {
      node: `const http = require("node:http");
const port = Number(process.env.PORT || 3000);
const titulo = "{{TITLE}}";
const server = http.createServer((req, res) => {
  res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
  res.end("<!doctype html><meta charset=utf-8><h1>" + titulo + "</h1><p>Servidor gerado pela Multi-Base Vessie.</p>");
});
server.listen(port, () => console.log("Servidor em http://127.0.0.1:" + port));
`,
    },
  },
  {
    id: "node-json-api", genre: "node", name: "API JSON em memória",
    desc: "API REST simples com GET /itens e GET /itens/:id.",
    tags: ["api", "json", "rest", "http", "crud"],
    params: { ITEM_UM: "Livro", ITEM_DOIS: "Curso" },
    vary: { ITEM_UM: ["Livro", "Camiseta", "Teclado", "Curso"], ITEM_DOIS: ["Curso", "Caneca", "Mouse", "Livro"] },
    code: {
      node: `const http = require("node:http");
const port = Number(process.env.PORT || 3000);
let itens = [
  { id: 1, nome: "{{ITEM_UM}}" },
  { id: 2, nome: "{{ITEM_DOIS}}" },
];
const send = (res, code, data) => {
  res.writeHead(code, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(data));
};
const server = http.createServer((req, res) => {
  if (req.url === "/itens" && req.method === "GET") return send(res, 200, itens);
  if (req.url.startsWith("/itens/") && req.method === "GET") {
    const id = Number(req.url.split("/")[2]);
    const item = itens.find((x) => x.id === id);
    return item ? send(res, 200, item) : send(res, 404, { erro: "não encontrado" });
  }
  send(res, 404, { erro: "rota desconhecida" });
});
server.listen(port, () => console.log("API em http://127.0.0.1:" + port + "/itens"));
`,
    },
  },
  {
    id: "node-lista-arquivos", genre: "node", name: "Listar arquivos",
    desc: "Lista o conteúdo de uma pasta com tamanho e tipo.",
    tags: ["arquivos", "fs", "pasta", "diretório"],
    params: {},
    vary: {},
    code: {
      node: `const fs = require("node:fs");
const path = require("node:path");
const dir = process.argv[2] || ".";
if (!fs.existsSync(dir)) {
  console.error("Pasta não encontrada:", dir);
  process.exit(1);
}
const itens = fs.readdirSync(dir).map((nome) => {
  const full = path.join(dir, nome);
  const stat = fs.statSync(full);
  return { nome, tipo: stat.isDirectory() ? "pasta" : "arquivo", bytes: stat.size };
});
console.log("Conteúdo de", path.resolve(dir));
for (const e of itens) {
  console.log("  " + e.tipo.padEnd(7) + " " + String(e.bytes).padStart(10) + "  " + e.nome);
}
`,
    },
  },
  {
    id: "node-timer", genre: "node", name: "Contagem regressiva",
    desc: "Contagem regressiva com setInterval no terminal.",
    tags: ["timer", "setInterval", "tempo", "contagem"],
    params: { SEGUNDOS: 10 },
    vary: { SEGUNDOS: [10, 5, 30, 60] },
    code: {
      node: `const segundos = Number(process.argv[2] || {{SEGUNDOS}});
let restante = segundos;
const id = setInterval(() => {
  console.log("Faltam " + restante + "s");
  restante--;
  if (restante < 0) {
    clearInterval(id);
    console.log("Tempo esgotado!");
  }
}, 1000);
`,
    },
  },
  {
    id: "node-env", genre: "node", name: "Variáveis de ambiente",
    desc: "Lista variáveis de ambiente, com filtro por prefixo.",
    tags: ["env", "ambiente", "process.env", "configuração"],
    params: {},
    vary: {},
    code: {
      node: `const prefixo = process.argv[2] || "";
const vars = Object.entries(process.env)
  .filter(([k]) => !prefixo || k.startsWith(prefixo))
  .sort();
console.log("Variáveis" + (prefixo ? " com prefixo " + prefixo : "") + ":");
for (const [k, v] of vars) console.log("  " + k + "=" + v);
`,
    },
  },
  {
    id: "node-csv", genre: "node", name: "Ler CSV",
    desc: "Lê um CSV separado por ponto-e-vírgula e mostra colunas.",
    tags: ["csv", "arquivo", "dados", "tabela"],
    params: {},
    vary: {},
    code: {
      node: `const fs = require("node:fs");
const arquivo = process.argv[2];
if (!arquivo) {
  console.error('Uso: node csv.js <arquivo.csv>');
  process.exit(1);
}
const texto = fs.readFileSync(arquivo, "utf8");
const linhas = texto.split(/\\r?\\n/).filter(Boolean);
const tabela = linhas.map((l) => l.split(";"));
const cab = tabela[0] || [];
const dados = tabela.slice(1);
console.log("Colunas:", cab.join(" | "));
console.log("Linhas:", dados.length);
`,
    },
  },

  // ============================ dados ============================
  {
    id: "dados-estatisticas", genre: "dados", name: "Estatísticas de uma lista",
    desc: "Média, mediana, desvio, mínimo e máximo (python).",
    tags: ["estatística", "média", "mediana", "desvio", "dados"],
    params: { TITLE: "Estatísticas" },
    vary: { TITLE: ["Estatísticas", "Análise", "Métricas", "Resumo"] },
    code: {
      python: `import statistics
valores = [float(x) for x in input("Números (espaçados): ").split()]
if valores:
    print("Média:", round(statistics.mean(valores), 2))
    print("Mediana:", round(statistics.median(valores), 2))
    print("Desvio padrão:", round(statistics.pstdev(valores), 2) if len(valores) > 1 else 0)
    print("Mínimo:", min(valores), "· Máximo:", max(valores))
    print("Soma:", sum(valores))
else:
    print("Nenhum número informado.")
`,
    },
  },
  {
    id: "dados-filtro-json", genre: "dados", name: "Filtrar JSON",
    desc: "Carrega registros JSON e filtra por idade mínima.",
    tags: ["json", "filtro", "arquivo", "registros"],
    params: { IDADE: 18 },
    vary: { IDADE: [18, 21, 30, 16] },
    code: {
      python: `import json
caminho = input("Arquivo JSON (ou Enter para exemplo): ").strip()
if not caminho:
    dados = [
        {"nome": "Ana", "idade": 25},
        {"nome": "Bruno", "idade": 17},
        {"nome": "Carla", "idade": 30},
    ]
else:
    with open(caminho, encoding="utf-8") as f:
        dados = json.load(f)
minimo = {{IDADE}}
selecionados = [x for x in dados if x.get("idade", 0) >= minimo]
print("Selecionados:", selecionados)
print("Total:", len(selecionados))
`,
    },
  },
  {
    id: "dados-gerar-csv", genre: "dados", name: "Gerar CSV",
    desc: "Grava uma tabela em arquivo CSV.",
    tags: ["csv", "arquivo", "exportar", "tabela"],
    params: { ARQUIVO: "dados.csv" },
    vary: { ARQUIVO: ["dados.csv", "clientes.csv", "vendas.csv", "relatorio.csv"] },
    code: {
      python: `import csv
linhas = [
    ["nome", "cidade", "valor"],
    ["Ana", "São Paulo", 100],
    ["Bruno", "Rio de Janeiro", 250],
    ["Carla", "Belo Horizonte", 180],
]
caminho = input("Arquivo de saída [{{ARQUIVO}}]: ") or "{{ARQUIVO}}"
with open(caminho, "w", newline="", encoding="utf-8") as f:
    writer = csv.writer(f)
    writer.writerows(linhas)
print("CSV gerado:", caminho)
print("Linhas:", len(linhas) - 1)
`,
    },
  },
  {
    id: "dados-totais", genre: "dados", name: "Totais de itens",
    desc: "Soma e média de valores de uma lista (node).",
    tags: ["total", "soma", "média", "node", "lista"],
    params: { ITEM_UM: "Produto A", ITEM_DOIS: "Produto B", ITEM_TRES: "Produto C" },
    vary: { ITEM_UM: ["Produto A", "Teclado", "Livro", "Licença"], ITEM_DOIS: ["Produto B", "Mouse", "Caneca", "Suporte"], ITEM_TRES: ["Produto C", "Webcam", "Curso", "Manutenção"] },
    code: {
      node: `const itens = [
  { nome: "{{ITEM_UM}}", valor: 100 },
  { nome: "{{ITEM_DOIS}}", valor: 250 },
  { nome: "{{ITEM_TRES}}", valor: 180 },
];
const total = itens.reduce((s, x) => s + x.valor, 0);
const media = total / itens.length;
console.log("Itens:", itens.map((x) => x.nome + " (" + x.valor + ")").join(", "));
console.log("Total:", total, "· Média:", media.toFixed(2));
`,
    },
  },

  // ============================ ia ============================
  {
    id: "ia-assistente-regras", genre: "ia", name: "Assistente por regras",
    desc: "Chatbot simples que responde por palavras-chave (node).",
    tags: ["chatbot", "regras", "assistente", "palavras-chave"],
    params: { ITEM_UM: "produtos", VALOR: 49.9, SAUDACAO: "oi" },
    vary: { ITEM_UM: ["produtos", "planos", "cursos", "ingressos"], VALOR: [49.9, 19.9, 99, 150], SAUDACAO: ["oi", "olá", "hello", "bom dia"] },
    code: {
      node: `const respostas = {
  "oi": "Olá! Como posso ajudar?",
  "ajuda": "Pergunte sobre horários, preços ou pedidos.",
  "preco": "Nossos {{ITEM_UM}} custam {{VALOR}} reais.",
  "horario": "Atendemos das 9h às 18h.",
  "obrigado": "Por nada!",
};
const padrao = "Desculpe, ainda não sei responder isso.";
const texto = (process.argv.slice(2).join(" ") || "{{SAUDACAO}}").toLowerCase();
const chave = Object.keys(respostas).find((k) => texto.includes(k));
console.log("Você:", texto);
console.log("Bot:", chave ? respostas[chave] : padrao);
`,
    },
  },
  {
    id: "ia-recomendador", genre: "ia", name: "Recomendador por categoria",
    desc: "Recomenda itens por nota + preferência da pessoa (python).",
    tags: ["recomendação", "preferência", "score", "python"],
    params: { ITEM_UM: "Filme A", ITEM_DOIS: "Filme B", ITEM_TRES: "Filme C" },
    vary: { ITEM_UM: ["Filme A", "Jogo A", "Série A", "App A"], ITEM_DOIS: ["Filme B", "Jogo B", "Série B", "App B"], ITEM_TRES: ["Filme C", "Jogo C", "Série C", "App C"] },
    code: {
      python: `itens = [
    {"nome": "{{ITEM_UM}}", "categoria": "acao", "nota": 9},
    {"nome": "{{ITEM_DOIS}}", "categoria": "aventura", "nota": 8},
    {"nome": "{{ITEM_TRES}}", "categoria": "comedia", "nota": 7},
]
preferencia = input("Categoria favorita (acao/aventura/comedia): ").strip().lower()

def score(item):
    return item["nota"] + (3 if item["categoria"] == preferencia else 0)

top = sorted(itens, key=score, reverse=True)[:2]
print("Recomendações para", preferencia or "todas")
for i, item in enumerate(top, 1):
    print(f"{i}. {item['nome']} ({item['categoria']}) — nota {item['nota']}")
`,
    },
  },
  {
    id: "ia-classificador", genre: "ia", name: "Classificador de texto",
    desc: "Classifica frases em urgente, dúvida, reclamação ou geral.",
    tags: ["classificação", "texto", "regras", "nlu"],
    params: {},
    vary: {},
    code: {
      python: `def classificar(texto):
    t = texto.lower()
    if any(p in t for p in ["urgente", "prazo", "imediato"]):
        return "urgente"
    if any(p in t for p in ["dúvida", "como", "?"]):
        return "dúvida"
    if any(p in t for p in ["reclama", "problema", "erro"]):
        return "reclamação"
    return "geral"

frases = ["Preciso urgente!", "Como faço isso?", "Tem um erro aqui", "Só informando"]
for f in frases:
    print(f, "→", classificar(f))
`,
    },
  },

  // ============================ jogos ============================
  {
    id: "jogo-adivinha", genre: "jogos", name: "Adivinhe o número",
    desc: "Adivinhe o número secreto com dicas (UI .vessie).",
    tags: ["adivinha", "número", "palpite", "jogo", "aleatório"],
    params: { APP: "Adivinha", TITLE: "Adivinhe o Número" },
    vary: {
      TITLE: ["Adivinhe o Número", "Número Secreto", "Palpite", "Adivinhação"],
      APP: ["Adivinha", "NumeroSecreto", "PalpiteApp"],
    },
    code: {
      vessie: `app {{APP}}

state segredo: number = math.randomInt(1, 10)
state tentativa: string = ""
state dica: string = "Tente adivinhar (1 a 10)."
state fim: boolean = false

fn chutar() {
  if fim { return }
  const p: number = math.floor(tentativa)
  if p == segredo {
    dica = "Acertou! 🎉 Jogue de novo."
    fim = true
  } else if p < segredo {
    dica = "Tente um número maior."
  } else {
    dica = "Tente um número menor."
  }
}

fn reiniciar() {
  segredo = math.randomInt(1, 10)
  tentativa = ""
  dica = "Tente adivinhar (1 a 10)."
  fim = false
}

ui App {
  page "{{TITLE}}" {
    column gap: 12 width: 360 {
      heading "{{TITLE}}"
      input bind:tentativa type: "number" placeholder: "Seu palpite" label: "Palpite"
      button "Chutar" on:click chutar
      text dica
      button "Jogar de novo" variant: "secondary" on:click reiniciar
    }
  }
}
`,
    },
  },
  {
    id: "jogo-dado", genre: "jogos", name: "Jogo de dado",
    desc: "Lança um dado de 6 faces no terminal (python).",
    tags: ["dado", "aleatório", "terminal", "python"],
    params: { FACES: 6 },
    vary: { FACES: [6, 12, 20, 8] },
    code: {
      python: `import random
print("=== Jogo de Dados ===")
while True:
    comando = input("Enter para lançar, 'sair' para encerrar: ").strip().lower()
    if comando == "sair":
        break
    print("Você tirou:", random.randint(1, {{FACES}}))
`,
    },
  },
  {
    id: "jogo-jokenpo", genre: "jogos", name: "Pedra, papel e tesoura",
    desc: "Jogue contra a máquina no terminal (python).",
    tags: ["jokenpo", "pedra", "papel", "tesoura", "jogo"],
    params: { RODADAS: 5 },
    vary: { RODADAS: [5, 3, 10, 1] },
    code: {
      python: `import random
opcoes = ["pedra", "papel", "tesoura"]

def vencedor(jogador, maquina):
    if jogador == maquina:
        return "Empate"
    if (jogador == "pedra" and maquina == "tesoura") or (jogador == "papel" and maquina == "pedra") or (jogador == "tesoura" and maquina == "papel"):
        return "Você venceu!"
    return "A máquina venceu"

print("Pedra, papel ou tesoura!")
while True:
    jogador = input("Sua jogada (ou 'sair'): ").strip().lower()
    if jogador == "sair":
        break
    if jogador not in opcoes:
        print("Escolha pedra, papel ou tesoura.")
        continue
    maquina = random.choice(opcoes)
    print("Você:", jogador, "· Máquina:", maquina, "→", vencedor(jogador, maquina))
`,
    },
  },

  // ============================ automação ============================
  {
    id: "auto-renomear", genre: "automacao", name: "Renomear arquivos",
    desc: "Renomeia arquivos de uma pasta com prefixo e contador.",
    tags: ["renomear", "arquivos", "pasta", "os", "batch"],
    params: { PREFIXO: "arquivo" },
    vary: { PREFIXO: ["arquivo", "foto", "doc", "item"] },
    code: {
      python: `import os
pasta = input("Pasta: ") or "."
prefixo = "{{PREFIXO}}"
cont = 0
for nome in os.listdir(pasta):
    origem = os.path.join(pasta, nome)
    if not os.path.isfile(origem):
        continue
    ext = os.path.splitext(nome)[1]
    destino = os.path.join(pasta, f"{prefixo}_{cont}{ext}")
    os.rename(origem, destino)
    cont += 1
    print("Renomeado:", nome, "→", os.path.basename(destino))
print("Total:", cont)
`,
    },
  },
  {
    id: "auto-backup", genre: "automacao", name: "Backup de pasta",
    desc: "Copia recursivamente uma pasta para um destino.",
    tags: ["backup", "cópia", "shutil", "arquivos", "segurança"],
    params: { DESTINO: "backup" },
    vary: { DESTINO: ["backup", "backup_2024", "reserva", "copia_seguranca"] },
    code: {
      python: `import os, shutil
origem = input("Pasta de origem: ") or "."
destino = input("Pasta de backup: ") or "{{DESTINO}}"
os.makedirs(destino, exist_ok=True)
copiados = 0
for raiz, _pastas, arquivos in os.walk(origem):
    for nome in arquivos:
        full = os.path.join(raiz, nome)
        rel = os.path.relpath(full, origem)
        alvo = os.path.join(destino, rel)
        os.makedirs(os.path.dirname(alvo), exist_ok=True)
        shutil.copy2(full, alvo)
        copiados += 1
print("Arquivos copiados:", copiados)
`,
    },
  },
  {
    id: "auto-limpeza", genre: "automacao", name: "Limpeza de temporários",
    desc: "Remove arquivos por extensão (com confirmação).",
    tags: ["limpeza", "temp", "remover", "extensão", "manutenção"],
    params: { EXT: "tmp" },
    vary: { EXT: ["tmp", "log", "bak", "old"] },
    code: {
      python: `import os
pasta = input("Pasta (Enter para temp): ") or os.environ.get("TEMP", ".")
ext = "{{EXT}}".lstrip(".")
confirmar = input(f"Remover .{ext} de {pasta}? (s/N): ").strip().lower()
if confirmar != "s":
    print("Cancelado.")
    raise SystemExit
removidos = 0
for nome in os.listdir(pasta):
    if nome.endswith("." + ext):
        caminho = os.path.join(pasta, nome)
        try:
            os.remove(caminho)
            removidos += 1
            print("Removido:", nome)
        except OSError as e:
            print("Ignorado:", nome, "—", e)
print("Total removido:", removidos)
`,
    },
  },

  // ============================ api ============================
  {
    id: "api-consulta-json", genre: "api", name: "Consumir API JSON",
    desc: "Faz fetch de uma API e exibe o JSON (node).",
    tags: ["api", "fetch", "json", "http", "consumo"],
    params: { URL: "https://jsonplaceholder.typicode.com/todos/1" },
    vary: { URL: ["https://jsonplaceholder.typicode.com/todos/1", "https://jsonplaceholder.typicode.com/users/1", "https://api.github.com/zen", "https://api.coindesk.com/v1/bpi/currentprice.json"] },
    code: {
      node: `async function main() {
  const url = process.argv[2] || "{{URL}}";
  const res = await fetch(url);
  const data = await res.json();
  console.log("Status:", res.status);
  console.log(JSON.stringify(data, null, 2));
}
main().catch((e) => {
  console.error("Erro:", e.message);
  process.exit(1);
});
`,
    },
  },
  {
    id: "api-rest-vessie", genre: "api", name: "Cliente REST na UI",
    desc: "Busca JSON de uma API e exibe na UI (.vessie).",
    tags: ["api", "http.getJson", "ui", "fetch", "assíncrono"],
    params: { APP: "ClienteAPI", TITLE: "Cliente REST", URL: "https://jsonplaceholder.typicode.com/todos/1" },
    vary: {
      TITLE: ["Cliente REST", "Busca de API", "Fetch na UI", "Consumidor JSON"],
      URL: ["https://jsonplaceholder.typicode.com/todos/1", "https://jsonplaceholder.typicode.com/users/1", "https://jsonplaceholder.typicode.com/todos/5"],
    },
    code: {
      vessie: `app {{APP}}

state dados: string = "Clique em Buscar para carregar."

async fn carregar() {
  const r = await http.getJson("{{URL}}")
  dados = json.stringify(r.data)
}

ui App {
  page "{{TITLE}}" {
    column gap: 16 {
      heading "{{TITLE}}"
      button "Buscar" on:click () => carregar()
      text dados
    }
  }
}
`,
    },
  },
  {
    id: "api-webhook", genre: "api", name: "Webhook local",
    desc: "Servidor que ecoa requisições recebidas como JSON (node).",
    tags: ["webhook", "http", "echo", "post", "callback"],
    params: { TITLE: "Webhook" },
    vary: { TITLE: ["Webhook", "Echo Server", "Listener", "Postback"] },
    code: {
      node: `const http = require("node:http");
const port = Number(process.env.PORT || 3000);
const server = http.createServer((req, res) => {
  let corpo = "";
  req.on("data", (c) => {
    corpo += c;
    if (corpo.length > 1e6) req.destroy();
  });
  req.on("end", () => {
    res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({
      rota: req.url,
      metodo: req.method,
      recebido: corpo || null,
      hora: new Date().toISOString(),
    }));
  });
});
server.listen(port, () => console.log("{{TITLE}} escutando em http://127.0.0.1:" + port));
`,
    },
  },

  // ============================ util ============================
  {
    id: "util-uuid", genre: "util", name: "Gerador de UUID v4",
    desc: "Gera UUIDs aleatórios (node).",
    tags: ["uuid", "id", "aleatório", "node"],
    params: { QUANTIDADE: 5 },
    vary: { QUANTIDADE: [5, 1, 10, 3] },
    code: {
      node: `function uuid() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
const n = Number(process.argv[2] || {{QUANTIDADE}});
for (let i = 0; i < n; i++) console.log(uuid());
`,
    },
  },
  {
    id: "util-datas", genre: "util", name: "Cálculo de datas",
    desc: "Soma dias à data atual e mostra o dia da semana (python).",
    tags: ["data", "datetime", "dias", "calendário", "python"],
    params: { DIAS: 7 },
    vary: { DIAS: [7, 30, 90, 1] },
    code: {
      python: `from datetime import datetime, timedelta
agora = datetime.now()
n = int(input("Dias à frente: ") or {{DIAS}})
futuro = agora + timedelta(days=n)
print("Agora:", agora.strftime("%d/%m/%Y %H:%M"))
print(f"Daqui a {n} dia(s):", futuro.strftime("%d/%m/%Y"))
print("Dia da semana:", ["seg", "ter", "qua", "qui", "sex", "sáb", "dom"][futuro.weekday()])
`,
    },
  },
  {
    id: "util-conversoes", genre: "util", name: "Conversor de unidades",
    desc: "Converte km↔m, MB↔KB, kg↔g, h↔min (python).",
    tags: ["conversor", "unidades", "medidas", "python"],
    params: { VALOR: 12 },
    vary: { VALOR: [12, 5, 100, 1.5] },
    code: {
      python: `valor = float(input("Valor: ") or {{VALOR}})
conversoes = {
    "km → m": valor * 1000,
    "m → cm": valor * 100,
    "cm → mm": valor * 10,
    "GB → MB": valor * 1024,
    "MB → KB": valor * 1024,
    "kg → g": valor * 1000,
    "h → min": valor * 60,
    "min → s": valor * 60,
}
print("Conversões:")
for chave, v in conversoes.items():
    print(f"  {chave}: {v}")
`,
    },
  },
  {
    id: "util-strings", genre: "util", name: "Análise de texto",
    desc: "Mostra várias transformações de uma frase (python).",
    tags: ["string", "texto", "análise", "python"],
    params: { FRASE: "A Vessie gera scripts variados!" },
    vary: { FRASE: ["A Vessie gera scripts variados!", "Python é ótimo para automação", "Node.js para servidores", "Multi-Base para todos"] },
    code: {
      python: `texto = input("Frase: ") or "{{FRASE}}"
print("Original:", texto)
print("Maiúsculas:", texto.upper())
print("Minúsculas:", texto.lower())
print("Título:", texto.title())
palavras = texto.split()
print("Palavras:", len(palavras))
print("Invertida:", " ".join(reversed(palavras)))
print("Sem espaços:", texto.replace(" ", ""))
`,
    },
  },

  // ============================ cli ============================
  {
    id: "cli-hello", genre: "cli", name: "Olá, terminal",
    desc: "Script mínimo nas duas linguagens (python e node).",
    tags: ["hello", "terminal", "cli", "exemplo"],
    params: { TITLE: "Olá da Vessie" },
    vary: { TITLE: ["Olá da Vessie", "Hello CLI", "Oi, terminal!", "Multi-Base CLI"] },
    code: {
      python: `print("{{TITLE}}")
print("Script gerado pela Multi-Base Vessie.")
`,
      node: `console.log("{{TITLE}}");
console.log("Script gerado pela Multi-Base Vessie (node).");
`,
    },
  },
  {
    id: "cli-menu", genre: "cli", name: "Menu interativo",
    desc: "Menu com opções repetindo até o usuário sair (python).",
    tags: ["menu", "interativo", "loop", "python"],
    params: { TITLE: "Menu Principal" },
    vary: { TITLE: ["Menu Principal", "Ferramentas", "Painel CLI", "Opções"] },
    code: {
      python: `def menu():
    print("=== {{TITLE}} ===")
    print("1. Opção A")
    print("2. Opção B")
    print("3. Sair")
    return input("Escolha: ").strip()

while True:
    opcao = menu()
    if opcao == "1":
        print("Você escolheu A.")
    elif opcao == "2":
        print("Você escolheu B.")
    elif opcao == "3":
        print("Até logo!")
        break
    else:
        print("Opção inválida.")
`,
    },
  },
  {
    id: "cli-progresso", genre: "cli", name: "Barra de progresso no terminal",
    desc: "Barra de progresso animada com percentual (python).",
    tags: ["progresso", "barra", "terminal", "anima", "python"],
    params: { TOTAL: 20 },
    vary: { TOTAL: [20, 30, 50, 10] },
    code: {
      python: `import time
total = int(input("Total de passos: ") or {{TOTAL}})
for i in range(1, total + 1):
    pct = int(i / total * 100)
    barra = "#" * (pct // 2) + "." * (50 - pct // 2)
    print(f"\\r[{barra}] {pct:3d}%  {i}/{total}", end="", flush=True)
    time.sleep(0.08)
print()
print("Concluído!")
`,
    },
  },

  // ============================ html ============================
  {
    id: "html-pagina", genre: "html", name: "Página HTML básica",
    desc: "Página mínima com título, texto e rodapé.",
    tags: ["html", "página", "site", "estático"],
    params: { TITLE: "Minha Página", TEXTO: "Conteúdo simples gerado pela Multi-Base Vessie." },
    vary: {
      TITLE: ["Minha Página", "Página Simples", "Site de Teste", "Primeiro Site"],
      TEXTO: ["Conteúdo simples gerado pela Multi-Base Vessie.", "Uma página estática sem dependências.", "HTML puro, pronto para hospedar.", "Bem-vindo ao meu site!"],
    },
    code: {
      html: `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{{TITLE}}</title>
<style>
  body { font-family: system-ui, sans-serif; max-width: 720px; margin: 40px auto; padding: 0 16px; line-height: 1.6; }
</style>
</head>
<body>
  <h1>{{TITLE}}</h1>
  <p>{{TEXTO}}</p>
  <footer><small>Gerado pela Multi-Base Vessie.</small></footer>
</body>
</html>
`,
    },
  },
  {
    id: "html-landing", genre: "html", name: "Landing page",
    desc: "Página de divulgação com chamada para ação.",
    tags: ["landing", "divulgação", "cta", "marketing"],
    params: { TITLE: "Meu Produto", SUBTITULO: "A solução que faltava.", TEXTO: "Feito com a Multi-Base Vessie.", CTA: "Começar agora", FOOTER: "© 2026" },
    vary: {
      TITLE: ["Meu Produto", "App Increível", "Sua Marca", "Serviço Pro"],
      SUBTITULO: ["A solução que faltava.", "Simples e rápido.", "Para todos.", "Feito por você."],
      CTA: ["Começar agora", "Saiba mais", "Testar grátis", "Comprar"],
    },
    code: {
      html: `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{{TITLE}}</title>
<style>
  body { font-family: system-ui, sans-serif; margin: 0; }
  header { padding: 48px 16px; background: #111; color: #fff; text-align: center; }
  .cta { display: inline-block; margin-top: 16px; padding: 12px 24px; background: #e63946; color: #fff; text-decoration: none; border-radius: 8px; }
  main { padding: 40px 16px; max-width: 720px; margin: 0 auto; }
  section { margin: 32px 0; }
</style>
</head>
<body>
  <header>
    <h1>{{TITLE}}</h1>
    <p>{{SUBTITULO}}</p>
  </header>
  <main>
    <section><h2>Sobre</h2><p>{{TEXTO}}</p></section>
    <section style="text-align:center"><a class="cta" href="#">{{CTA}}</a></section>
  </main>
  <footer style="text-align:center;padding:24px;color:#888"><small>{{FOOTER}}</small></footer>
</body>
</html>
`,
    },
  },
  {
    id: "html-formulario", genre: "html", name: "Formulário HTML",
    desc: "Formulário de contato com validação básica.",
    tags: ["formulário", "form", "contato", "html"],
    params: { TITLE: "Formulário de Contato", ALERTA: "Mensagem enviada!" },
    vary: {
      TITLE: ["Formulário de Contato", "Fale Conosco", "Cadastro Rápido", "Contato"],
      ALERTA: ["Mensagem enviada!", "Obrigado pelo contato!", "Recebemos seu envio!", "Tudo certo!"],
    },
    code: {
      html: `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{{TITLE}}</title>
<style>
  body { font-family: system-ui, sans-serif; max-width: 480px; margin: 40px auto; padding: 0 16px; }
  label { display: block; margin: 12px 0 4px; }
  input, select, button { width: 100%; padding: 8px; box-sizing: border-box; }
  button { margin-top: 16px; background: #2a6df4; color: #fff; border: 0; border-radius: 6px; cursor: pointer; }
</style>
</head>
<body>
  <h1>{{TITLE}}</h1>
  <form onsubmit="event.preventDefault();alert('{{ALERTA}}')">
    <label>Nome</label><input name="nome" required>
    <label>E-mail</label><input type="email" name="email" required>
    <label>Plano</label>
    <select name="plano"><option>Básico</option><option>Pro</option><option>Max</option></select>
    <button type="submit">Enviar</button>
  </form>
</body>
</html>
`,
    },
  },
  {
    id: "html-portfolio", genre: "html", name: "Portfólio em grade",
    desc: "Portfólio com cards em grid responsivo.",
    tags: ["portfolio", "grade", "grid", "cards"],
    params: { TITLE: "Meu Portfólio", SUBTITULO: "Projetos selecionados", TEXTO: "Descrição do projeto." },
    vary: {
      TITLE: ["Meu Portfólio", "Trabalhos", "Projetos", "Galeria"],
      SUBTITULO: ["Projetos selecionados", "Coisas que eu fiz", "Meus trabalhos", "Portfólio criativo"],
    },
    code: {
      html: `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{{TITLE}}</title>
<style>
  body { font-family: system-ui, sans-serif; margin: 0; color: #222; }
  .top { padding: 48px 16px; text-align: center; background: #f4f4f4; }
  .cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px; padding: 32px; max-width: 960px; margin: 0 auto; }
  .card { border: 1px solid #ddd; border-radius: 12px; padding: 16px; }
</style>
</head>
<body>
  <div class="top"><h1>{{TITLE}}</h1><p>{{SUBTITULO}}</p></div>
  <div class="cards">
    <div class="card"><h3>Projeto 1</h3><p>{{TEXTO}}</p></div>
    <div class="card"><h3>Projeto 2</h3><p>{{TEXTO}}</p></div>
    <div class="card"><h3>Projeto 3</h3><p>{{TEXTO}}</p></div>
  </div>
</body>
</html>
`,
    },
  },
  {
    id: "html-blog", genre: "html", name: "Artigo de blog",
    desc: "Página de artigo com citação em destaque.",
    tags: ["blog", "artigo", "texto", "post"],
    params: { TITLE: "Meu Primeiro Artigo", DATA: "22 de setembro de 2026", PARAGRAFO_UM: "Este é o primeiro parágrafo do artigo.", CITACAO: "Uma boa citação marca a leitura.", PARAGRAFO_DOIS: "E aqui encerramos com o segundo parágrafo." },
    vary: {
      TITLE: ["Meu Primeiro Artigo", "Como Comecei", "Guia Rápido", "Notas da Semana"],
      DATA: ["22 de setembro de 2026", "Hoje", "Publicado agora", "2026"],
    },
    code: {
      html: `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{{TITLE}}</title>
<style>
  body { font-family: system-ui, serif; max-width: 680px; margin: 40px auto; padding: 0 16px; line-height: 1.7; }
  time { color: #888; font-size: .9rem; }
  blockquote { border-left: 4px solid #ccc; margin: 16px 0; padding-left: 16px; color: #444; }
</style>
</head>
<body>
  <article>
    <h1>{{TITLE}}</h1>
    <time>{{DATA}}</time>
    <p>{{PARAGRAFO_UM}}</p>
    <blockquote>{{CITACAO}}</blockquote>
    <p>{{PARAGRAFO_DOIS}}</p>
  </article>
</body>
</html>
`,
    },
  },
  {
    id: "html-404", genre: "html", name: "Página 404",
    desc: "Página de erro 404 estilizada.",
    tags: ["404", "erro", "não encontrado", "página"],
    params: { TITLE: "Página não encontrada", TEXTO: "O endereço pode ter mudado ou não existir." },
    vary: {
      TITLE: ["Página não encontrada", "Ops! 404", "Link quebrado", "Não achei aqui"],
      TEXTO: ["O endereço pode ter mudado ou não existir.", "Verifique a URL e tente de novo.", "A página foi movida ou removida."],
    },
    code: {
      html: `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{{TITLE}}</title>
<style>
  body { font-family: system-ui, sans-serif; display: grid; place-items: center; min-height: 100vh; margin: 0; text-align: center; background: #fafafa; }
  h1 { font-size: 6rem; margin: 0; color: #e63946; }
</style>
</head>
<body>
  <div>
    <h1>404</h1>
    <p><strong>{{TITLE}}</strong></p>
    <p>{{TEXTO}}</p>
    <a href="/">Voltar ao início</a>
  </div>
</body>
</html>
`,
    },
  },

  // ============================ css ============================
  {
    id: "css-tema", genre: "css", name: "Tema com variáveis CSS",
    desc: "Tema claro/escuro com variáveis CSS.",
    tags: ["css", "tema", "variáveis", "dark", "light"],
    params: { COR: "#2a6df4" },
    vary: { COR: ["#2a6df4", "#e63946", "#16a34a", "#7c3aed"] },
    code: {
      css: `/* Tema claro/escuro com variáveis CSS */
:root {
  --fundo: #ffffff;
  --texto: #111827;
  --primaria: {{COR}};
  --borda: #e5e7eb;
}
[data-theme="dark"] {
  --fundo: #111827;
  --texto: #f9fafb;
  --primaria: {{COR}};
  --borda: #374151;
}
body { background: var(--fundo); color: var(--texto); font-family: system-ui, sans-serif; margin: 0; }
button { background: var(--primaria); color: #fff; border: 0; padding: 10px 18px; border-radius: 8px; cursor: pointer; }
.card { border: 1px solid var(--borda); border-radius: 12px; padding: 16px; }
`,
    },
  },
  {
    id: "css-grid", genre: "css", name: "Grid responsivo",
    desc: "Grade auto-ajustável com variantes de colunas.",
    tags: ["css", "grid", "responsivo", "layout"],
    params: { MINIMO: 220 },
    vary: { MINIMO: [220, 180, 260, 320] },
    code: {
      css: `/* Grade responsiva — copie e ajuste */
.grid { display: grid; grid-template-columns: repeat(auto-fit, minmax({{MINIMO}}px, 1fr)); gap: 16px; padding: 16px; }
.grid .item { background: #f4f4f5; border-radius: 12px; padding: 16px; min-height: 120px; }
.colunas-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.colunas-3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
@media (max-width: 640px) {
  .colunas-2, .colunas-3 { grid-template-columns: 1fr; }
}
`,
    },
  },
];

// Cada módulo declara `code` com chaves por linguagem (vessie, python, node,
// html, css) — deriva o campo `langs` automaticamente para os consumidores.
for (const m of MODULES) {
  if (!m.code || typeof m.code !== "object" || !Object.keys(m.code).length) {
    throw new Error(`Catálogo Multi-Base: módulo "${m.id}" sem campo code válido.`);
  }
  m.langs = Object.keys(m.code);
}

/* ===== src\multibase\index.js ===== */
// Sistema Multi-Base da Vessie: catálogo de módulos por gênero e geração de
// variações em várias linguagens (vessie, python, node/js, html, css).
// A "Multi-Base" é uma única base de módulos, mas cada módulo vira variações
// diferentes — dezenas de combinações por módulo, em várias linguagens.



const GENRES = [
  { id: "web", label: "Web / UI (.vessie)" },
  { id: "python", label: "Python / Lógica" },
  { id: "node", label: "Node.js / Scripts" },
  { id: "dados", label: "Dados / Arquivos" },
  { id: "ia", label: "IA / Regras" },
  { id: "jogos", label: "Jogos" },
  { id: "automacao", label: "Automação" },
  { id: "api", label: "APIs / HTTP" },
  { id: "util", label: "Utilitários" },
  { id: "cli", label: "Terminal / CLI" },
  { id: "html", label: "HTML / Sites" },
  { id: "css", label: "CSS / Estilo" },
];

const DEFAULT_LANG = {
  web: "vessie", python: "python", node: "node", dados: "python", ia: "node",
  jogos: "vessie", automacao: "python", api: "node", util: "python", cli: "python",
  html: "html", css: "css",
};

const LANGS = [
  { id: "vessie", label: "Vessie (.vessie)", ext: ".vessie" },
  { id: "python", label: "Python (.py)", ext: ".py" },
  { id: "node", label: "Node.js / JavaScript (.js)", ext: ".js" },
  { id: "html", label: "HTML (.html)", ext: ".html" },
  { id: "css", label: "CSS (.css)", ext: ".css" },
];

const MAX_VARIANTS = 64;

const genreLabel = (id) => GENRES.find((g) => g.id === id)?.label ?? id;
const langInfo = (id) => LANGS.find((l) => l.id === id);

/** Nome de arquivo seguro (sem extensão) a partir de um id de módulo. */
function defaultFileName(moduleId, lang) {
  const base = String(moduleId).replace(/[^A-Za-z0-9_-]/g, "-");
  return `${base}${langInfo(lang)?.ext ?? ".txt"}`;
}

/** Sanitiza um valor de APP/nome de identificador Vessie. */
function safeIdentifier(value, fallback) {
  let s = String(value ?? "").replace(/[^A-Za-z0-9_]/g, "");
  if (!s) s = String(fallback ?? "App");
  if (/^[0-9]/.test(s)) s = "_" + s;
  return s;
}

/**
 * Variações de parâmetros de um módulo (produto cartesiano dos pools, com limite).
 * Cada variação é um objeto de substituição dos placeholders {{PARAM}}.
 */
function variationsOf(module) {
  const pools = module.vary ?? {};
  const keys = Object.keys(pools);
  if (!keys.length) return [{}];
  const out = [];
  const rec = (i, acc) => {
    if (out.length >= MAX_VARIANTS) return;
    if (i === keys.length) { out.push({ ...acc }); return; }
    for (const v of pools[keys[i]]) rec(i + 1, { ...acc, [keys[i]]: v });
  };
  rec(0, {});
  return out;
}

/** Número de variações de código que o módulo pode gerar (linguagens × variações). */
function moduleVariantCount(module) {
  return module.langs.length * Math.max(1, variationsOf(module).length);
}

function totalVariations() {
  return MODULES.reduce((s, m) => s + moduleVariantCount(m), 0);
}

function countByGenre() {
  const map = {};
  for (const m of MODULES) map[m.genre] = (map[m.genre] ?? 0) + 1;
  return map;
}

/** Busca módulos por termos em nome/descrição/tags/id/gênero. */
function searchModules(term, { lang, genre } = {}) {
  const words = String(term ?? "")
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
  return MODULES.filter((m) => {
    if (lang && !m.langs.includes(lang)) return false;
    if (genre && m.genre !== genre) return false;
    if (!words.length) return true;
    const hay = `${m.name} ${m.desc} ${m.id} ${m.genre} ${m.tags.join(" ")}`.toLowerCase();
    return words.every((w) => hay.includes(w));
  });
}

function listModules({ lang, genre } = {}) {
  let list = MODULES;
  if (lang) list = list.filter((m) => m.langs.includes(lang));
  if (genre) list = list.filter((m) => m.genre === genre);
  return list;
}

function moduleById(id) {
  return MODULES.find((m) => m.id === id) ?? null;
}

/** Cabeçalho do arquivo gerado, por linguagem. */
function header(module, lang, variantIndex, total) {
  const stamp = `/* Módulo: ${module.name} (${module.id}) · gênero: ${genreLabel(module.genre)} · variação ${variantIndex + 1}/${total} · Multi-Base Vessie */`;
  switch (lang) {
    case "vessie": return stamp;
    case "python": return `# Módulo: ${module.name} (${module.id}) · Multi-Base Vessie\n# Variação ${variantIndex + 1}/${total} · gênero ${module.genre}`;
    case "node": return `// Módulo: ${module.name} (${module.id}) · Multi-Base Vessie\n// Variação ${variantIndex + 1}/${total} · gênero ${module.genre} · rode com: node este_arquivo.js`;
    case "html": case "css": return `<!-- Módulo: ${module.name} (${module.id}) · Multi-Base Vessie · variação ${variantIndex + 1}/${total} -->`;
    default: return stamp;
  }
}

/**
 * Gera o código de um módulo em uma linguagem, com uma variação específica.
 * @returns {{ok:boolean, code:string|null, error?:string, module:object, lang:string, variant:number}}
 */
function renderModule(module, lang, { variant = 0, values = {} } = {}) {
  if (!module) return { ok: false, code: null, error: "Módulo não encontrado.", module: null, lang };
  if (!module.langs.includes(lang)) {
    return {
      ok: false, code: null, module, lang,
      error: `O módulo "${module.id}" não tem código em "${lang}". Linguagens: ${module.langs.join(", ")}.`,
    };
  }
  const vars = variationsOf(module);
  const chosen = vars[Math.max(0, Math.min(variant, vars.length - 1))] ?? {};
  const merged = { ...(module.params ?? {}), ...chosen, ...values };
  let body = String(module.code[lang]);
  for (const [k, v] of Object.entries(merged)) {
    body = body.split(`{{${k}}}`).join(String(v));
  }
  // placeholders sem valor → texto vazio (evita "{{..." vazando)
  body = body.replace(/\{\{([A-Z0-9_]+)\}\}/g, (_, k) => {
    const v = merged[k];
    return v === undefined || v === null ? "" : String(v);
  });
  const head = header(module, lang, Math.min(variant, vars.length - 1), vars.length);
  return { ok: true, code: `${head}\n${body}`, module, lang, variant: Math.min(variant, vars.length - 1) };
}

/** Gera por id de módulo (atalho). */
function genModule(id, lang, opts = {}) {
  const module = moduleById(id);
  if (!module) return { ok: false, code: null, error: `Módulo "${id}" não existe no catálogo.`, module: null, lang };
  return renderModule(module, lang, opts);
}

/** Resumo do catálogo para a CLI (listagem). */
function catalogSummary() {
  return {
    modules: MODULES.length,
    genres: GENRES.length,
    languages: LANGS.map((l) => l.id),
    variations: totalVariations(),
    byGenre: countByGenre(),
    byLang: Object.fromEntries(
      LANGS.map((l) => [l.id, MODULES.filter((m) => m.langs.includes(l.id)).length]),
    ),
  };
}

/* ===== src\multibase\web.js ===== */
// Busca web para a Multi-Base: consulta fontes públicas (sem chave de API),
// resume conteúdo e gera variações de scripts a partir dos módulos do catálogo.
// Fontes: DuckDuckGo Instant Answer API e Wikipedia (API pública).


const TIMEOUT_MS = 12000;

async function fetchJson(url, timeoutMs = TIMEOUT_MS) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctl.signal, headers: { "user-agent": "vessie-multibase/0.1 (localhost)" } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

const clean = (s) => String(s ?? "")
  .replace(/\s+/g, " ")
  .trim()
  .slice(0, 600);

/** Resumo imediato do DuckDuckGo (Instant Answer). */
async function duckDuckGo(q) {
  const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(q)}&format=json&no_html=1&skip_disambig=1`;
  const data = await fetchJson(url);
  const parts = [];
  if (data.AbstractText) parts.push({ titulo: data.Heading ?? q, texto: clean(data.AbstractText), url: data.AbstractURL ?? null });
  const topics = (data.RelatedTopics ?? []).flatMap((t) => (t.Topics ? t.Topics : [t]));
  let n = 0;
  for (const t of topics) {
    if (t.Text && n < 5) { parts.push({ titulo: "Relacionado", texto: clean(t.Text), url: t.FirstURL ?? null }); n++; }
  }
  return parts;
}

/** Busca na Wikipedia e obtém a introdução dos primeiros títulos. */
async function wikipedia(q) {
  const searchUrl = `https://pt.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(q)}&format=json&origin=*&srlimit=4`;
  const data = await fetchJson(searchUrl);
  const hits = (data.query?.search ?? []).slice(0, 3);
  const parts = [];
  for (const hit of hits) {
    const title = encodeURIComponent(hit.title);
    const pageUrl = `https://pt.wikipedia.org/w/api.php?action=query&prop=extracts&explaintext=1&exintro=1&format=json&origin=*&titles=${title}`;
    try {
      const page = await fetchJson(pageUrl);
      const pages = page.query?.pages ?? {};
      const first = Object.values(pages)[0];
      if (first?.extract) {
        parts.push({ titulo: first.title, texto: clean(first.extract), url: `https://pt.wikipedia.org/wiki/${encodeURIComponent(first.title.replace(/ /g, "_"))}` });
      }
    } catch { /* segue para o próximo */ }
  }
  return parts;
}

/**
 * Busca web genérica sobre um termo.
 * @returns {{ok:boolean, query:string, sources:Array, summary:string, error?:string}}
 */
async function webSearch(term, { timeout = TIMEOUT_MS } = {}) {
  const query = String(term ?? "").trim();
  if (!query) return { ok: false, query, sources: [], summary: "", error: "Informe um termo de busca." };
  const sources = [];
  const failures = [];
  const jobs = [
    ["duckduckgo", duckDuckGo(query)],
    ["wikipedia", wikipedia(query)],
  ];
  const results = await Promise.all(jobs.map(async ([name, p]) => {
    try { return { name, parts: await p }; }
    catch (e) { failures.push(`${name}: ${e.message}`); return { name, parts: [] }; }
  }));
  for (const r of results) for (const p of r.parts) sources.push({ ...p, fonte: r.name });
  if (!sources.length) {
    return { ok: false, query, sources: [], summary: "", error: `Nenhum conteúdo encontrado para "${query}" (${failures.join("; ") || "sem resultados"}).` };
  }
  return { ok: true, query, sources, summary: sources.map((s) => `[${s.titulo}] ${s.texto}`).join("\n\n"), error: failures.length ? failures.join("; ") : null };
}

/**
 * Busca conteúdo na web e gera variações de scripts com os módulos relacionados.
 * @returns {{ok:boolean, query:string, sources:Array, modules:Array, scripts:Array, summary:string, error?:string}}
 */
async function searchAndGenerate(term, { lang, genre, maxScripts = 4, timeout = TIMEOUT_MS } = {}) {
  const web = await webSearch(term, { timeout });
  if (!web.ok) return { ok: false, query: term, sources: [], modules: [], scripts: [], summary: "", error: web.error };
  const matches = searchModules(term, { lang, genre });
  const scripts = [];
  const used = new Set();
  for (const m of matches) {
    if (scripts.length >= maxScripts || used.has(m.id)) continue;
    const l = lang ?? DEFAULT_LANG[m.genre];
    if (!m.langs.includes(l)) continue;
    const r = renderModule(m, l, { variant: 0 });
    if (r.ok) { scripts.push({ id: m.id, name: m.name, genre: m.genre, lang: l, code: r.code }); used.add(m.id); }
  }
  // Se nada casou, usa os primeiros módulos do gênero padrão do termo (heurística leve)
  if (!scripts.length) {
    const fallback = searchModules("", { genre });
    let added = 0;
    for (const m of fallback) {
      if (added >= maxScripts) break;
      const l = lang ?? DEFAULT_LANG[m.genre];
      if (!m.langs.includes(l)) continue;
      const r = renderModule(m, l, { variant: 0 });
      if (r.ok) { scripts.push({ id: m.id, name: m.name, genre: m.genre, lang: l, code: r.code }); added++; }
    }
  }
  return {
    ok: true, query: term, sources: web.sources, modules: matches.map((m) => ({
      id: m.id, name: m.name, genre: m.genre, langs: m.langs, tags: m.tags,
    })),
    scripts, summary: web.summary, error: web.error,
  };
}

/* ===== src\git\index.js ===== */
// Integração Git da Vessie: wrapper local e seguro sobre o git instalado na
// máquina. Sem shell (shell:false), com whitelist de comandos e rejeição de
// metacaracteres de shell nos argumentos. Nada é executado remotamente.


/** Comandos git liberados pela Vessie. */
const ALLOWED = new Set([
  "init", "add", "status", "commit", "log", "branch", "checkout",
  "remote", "pull", "push", "clone", "diff", "stash", "show", "tag", "mv", "rm",
]);

const FORBIDDEN_CHARS = /[;&|<>`\n\r]/;

export class VessieGitError extends Error {
  constructor(message) { super(message); this.name = "VessieGitError"; }
}

/** Valida os argumentos de um comando git (bloqueia injeção de shell). */
export function validateArgs(args) {
  const list = Array.isArray(args) ? args : [args];
  for (const a of list) {
    const s = String(a);
    if (FORMIDDEN_CHARS && FORBIDDEN_CHARS.test(s)) {
      throw new VessieGitError(`Argumento inválido (metacaractere de shell): ${JSON.stringify(a)}`);
    }
    if (Buffer.byteLength(s, "utf8") > 4096) throw new VessieGitError("Argumento muito longo.");
  }
  return list;
}

/** Verifica se o git está instalado e retorna a versão (ou null). */
export function gitVersion() {
  try {
    const r = spawnSync("git", ["--version"], { encoding: "utf8", timeout: 8000, shell: false, windowsHide: true });
    if (r.error || r.status !== 0) return null;
    return (r.stdout || r.stderr).trim().split("\n")[0] || "";
  } catch { return null; }
}

export const gitAvailable = () => !!gitVersion();

/**
 * Executa um comando git.
 * @returns {{ok:boolean, stdout:string, stderr:string, code:number|null, error?:string}}
 */
export function runGit(args, { cwd, timeout = 120000 } = {}) {
  let list;
  try { list = validateArgs(args); } catch (e) { return { ok: false, stdout: "", stderr: "", code: null, error: e.message }; }
  if (!list.length) return { ok: false, stdout: "", stderr: "", code: null, error: "Comando git vazio." };
  if (!ALLOWED.has(list[0])) {
    return { ok: false, stdout: "", stderr: "", code: null, error: `Comando git não liberado pela Vessie: "${list[0]}". Liberados: ${[...ALLOWED].join(", ")}.` };
  }
  if (!gitVersion()) return { ok: false, stdout: "", stderr: "", code: null, error: "Git não encontrado no PATH (instale o git)." };
  const r = spawnSync("git", list, { encoding: "utf8", timeout, shell: false, windowsHide: true, cwd });
  if (r.error) {
    const killed = r.error.code === "ETIMEDOUT" || r.signal === "SIGTERM";
    return { ok: false, stdout: r.stdout ?? "", stderr: r.stderr ?? "", code: r.status ?? null, error: killed ? `Tempo esgotado (${timeout}ms)` : r.error.message };
  }
  return { ok: r.status === 0, stdout: r.stdout ?? "", stderr: r.stderr ?? "", code: r.status, error: r.status === 0 ? null : `git ${list[0]} falhou (código ${r.status}).` };
}

const DEFAULT_GITIGNORE = `# Vessie
dist/
node_modules/
*.log
.DS_Store
Thumbs.db
`;

/**
 * Inicializa um repositório git no diretório (se ainda não for um) e garante o
 * .gitignore padrão. Retorna o resultado da execução.
 */
export function initProject(dir) {
  const cwd = path.resolve(dir);
  if (!fs.existsSync(cwd)) throw new VessieGitError(`Diretório não encontrado: ${dir}`);
  const r = runGit(["init"], { cwd });
  if (r.ok) {
    const gi = path.join(cwd, ".gitignore");
    if (!fs.existsSync(gi)) fs.writeFileSync(gi, DEFAULT_GITIGNORE);
    if (fs.existsSync(path.join(cwd, "vessie.json")) && !fs.existsSync(path.join(cwd, "src"))) {
      fs.mkdirSync(path.join(cwd, "src"), { recursive: true });
    }
  }
  return r;
}

/* ===== src\cli\index.js ===== */
// CLI oficial da Vessie. Códigos de saída: 0 = ok, 1 = erro de compilação/execução, 2 = uso incorreto ou comando planejado.

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PLANNED = {
  add: "gerenciador de pacotes (Fase 7)",
};

const HELP = `Vessie ${VERSION} — linguagem para web/UI (.vessie)

Uso: vessie <comando> [opções]

Comandos implementados:
  init [dir]            cria um projeto (vessie.json + src/main.vessie)
  create <nome>         cria um projeto em ./<nome>
  build [arquivo]       compila para dist/ (index.html, js/, css/, runtime/, sourcemaps/)
    --single            gera UM .js autocontido (app.bundle.js) + index.html mínimo
  compile/transpile <arquivo>  gera apenas o JavaScript (--out arquivo.js; senão, stdout)
    --single            gera UM script .js autocontido (sem imports; auto-inicializa)
  check [caminhos...]   diagnósticos sem gerar arquivos (--json, --strict)
  run [arquivo]         compila e serve em http://127.0.0.1:PORTA (--port, --node = execução headless)
  open [arquivo]        como run, mas tenta abrir a UI no navegador (--port, --no-browser p/ só servir)
  ui [list]             lista componentes de UI e comandos ui.open/ui.close/... (--json)
  dev [arquivo]         como run, recompilando ao salvar (recarregue o navegador)
  watch -- <comando...>  gatilho: reexecuta o comando quando .vessie mudam [--once] [--debounce ms]
  test [caminhos...]    executa arquivos *.test.vessie (usam assert)
  format [caminhos...]  formata arquivos .vessie (--check apenas verifica)
  clean [dir]           remove a pasta de saída (padrão: dist)
  doctor                verifica Node, Python, C, C++, .NET e CMake
  adapters              lista adaptadores de execução (python, node, c, c++, c#)
  exec                  executa código: --lang <id> (--code "..." | <arquivo>) [--timeout ms]
  console <arquivo>     gera UM script autocontido para colar no Console do Chrome (DevTools),
                        sem site/servidor próprio [--out arquivo.js] [--clip]
  gen <arquivo> --lang <python|node|website|web|console>  gera variação de script em outra
                        linguagem [--out] [--run (python/node)]
  base                  Multi-Base (módulos por gênero com variações): count | genres | list |
                        search <termo> | gen <id> | install <id> | web <termo>
  git <subcomando>      git integrado: init | add | status | commit | log | branch | pull |
                        push | remote | clone | ... (precisa do git instalado)
  cs convert <arq.cs>   adapta C# para Vessie (--out app.vessie; senão, stdout)
  cs run <arq.cs>       executa o C# original via .NET [--timeout ms]
  ai "<pedido>"         melhora o pedido p/ IAs pequenas (geração dupla) [--code|--system|--json|--out f]
  websearch <url> <termo>  busca site+subsites e gera prompt [--pages N] [--depth N] [--json]
  markdown <arq.md>     renderiza o markdown próprio p/ HTML [--out f.html] [--text]
  a11y <arq.vessie>      audita acessibilidade da UI [--json]
  sys [info|procs]      SO: consumo/desempenho/processos [--limit N] [--json]
  optimize [--game nome]  analisa jogos/processos e recomenda otimizações [--pid N --apply] [--json]
  info                  versão e estado das funcionalidades
  docs                  lista a documentação

Planejados (ainda não implementados): remove, ${Object.keys(PLANNED).join(", ")}
Opções globais: -q/--quiet, -v/--verbose, --mode development|production, --out <dir>, -h/--help
`;

function parseArgs(argv) {
  const opts = { _: [] };
  const withValue = new Set(["out", "port", "mode", "lang", "timeout", "pages", "depth", "limit", "debounce", "game", "pid", "variant", "genre", "scripts"]);
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--") { opts._.push(...argv.slice(i + 1)); break; } // resto vai literal p/ o subcomando (ex.: watch)
    if (a === "-q") opts.quiet = true;
    else if (a === "-v") opts.verbose = true;
    else if (a === "-h") opts.help = true;
    else if (a.startsWith("--")) {
      const [k, v] = a.slice(2).split("=");
      if (v !== undefined) opts[k] = v;
      else if (k === "code") {
        // --code "..." (exec) ou --code sozinho (ai --code): só consome o próximo se não for flag
        const nx = argv[i + 1];
        if (nx !== undefined && !nx.startsWith("-")) opts[k] = argv[++i];
        else opts[k] = true;
      } else if (withValue.has(k)) opts[k] = argv[++i];
      else opts[k] = true;
    } else opts._.push(a);
  }
  return opts;
}

function walkVessie(p, out = []) {
  const st = fs.statSync(p);
  if (st.isDirectory()) {
    for (const e of fs.readdirSync(p)) {
      if (e === "node_modules" || e === "dist" || e.startsWith(".")) continue;
      walkVessie(path.join(p, e), out);
    }
  } else if (p.endsWith(".vessie")) out.push(p);
  return out;
}

function collect(paths, cwd) {
  const list = paths.length ? paths : ["."];
  const files = [];
  for (const p of list) {
    const full = path.resolve(cwd, p);
    if (!fs.existsSync(full)) throw new Error(`Caminho não encontrado: ${p}`);
    walkVessie(full, files);
  }
  return files;
}

function loadProject(cwd) {
  const f = path.join(cwd, "vessie.json");
  if (!fs.existsSync(f)) return null;
  let cfg;
  try { cfg = JSON.parse(fs.readFileSync(f, "utf8")); } catch (e) { throw new Error(`vessie.json inválido: ${e.message}`); }
  if (typeof cfg.name !== "string" || typeof cfg.entry !== "string") throw new Error('vessie.json precisa de "name" e "entry" (strings)');
  resolveInside(cwd, cfg.entry);
  if (cfg.outDir) resolveInside(cwd, cfg.outDir);
  return cfg;
}

function resolveEntry(opts, cwd) {
  if (opts._[0]) return path.resolve(cwd, opts._[0]);
  const cfg = loadProject(cwd);
  if (cfg) return resolveInside(cwd, cfg.entry);
  throw new Error("Informe um arquivo .vessie ou execute dentro de um projeto (vessie.json).");
}

async function main(argv, io = {}) {
  const out = io.out ?? ((s) => process.stdout.write(s + "\n"));
  const err = io.err ?? ((s) => process.stderr.write(s + "\n"));
  const cwd = io.cwd ?? process.cwd();
  const opts = parseArgs(argv);
  const cmd = opts._.shift();
  const say = (s) => { if (!opts.quiet) out(s); };
  const verbose = (s) => { if (opts.verbose) out(s); };
  const report = (diags, sources) => { if (diags.length) err(formatDiagnostics(diags, sources)); };

  try {
    if (!cmd || opts.help || cmd === "help") { out(HELP); return cmd || opts.help ? 0 : 2; }
    if (PLANNED[cmd] || cmd === "remove") { err(`O comando "${cmd}" ainda não está implementado (${PLANNED[cmd] ?? "gerenciador de pacotes (Fase 7)"}).`); return 2; }

    // `transpile` é um nome mais direto para a conversão .vessie → .js.
    switch (cmd === "transpile" ? "compile" : cmd) {
      case "init": case "create": {
        if (cmd === "create" && !opts._[0]) { err("Uso: vessie create <nome>"); return 2; }
        const dir = resolveInside(cwd, opts._[0] ?? ".");
        const name = path.basename(dir).replace(/[^A-Za-z0-9_-]/g, "") || "vessie-app";
        if (fs.existsSync(path.join(dir, "vessie.json"))) { err("Já existe um vessie.json neste diretório."); return 1; }
        fs.mkdirSync(path.join(dir, "src"), { recursive: true });
        fs.writeFileSync(path.join(dir, "vessie.json"), JSON.stringify({ name, version: "0.1.0", entry: "src/main.vessie", outDir: "dist" }, null, 2) + "\n");
        const appName = name.replace(/[^A-Za-z0-9_]/g, "_").replace(/^(\d)/, "_$1");
        fs.writeFileSync(path.join(dir, "src", "main.vessie"), `app ${appName}\n\nstate count: number = 0\n\nfn increment() {\n  count += 1\n}\n\nui App {\n  page "${name}" {\n    column gap: 16 {\n      heading "Olá, Vessie!"\n      text \`Cliques: \${count}\`\n      button "Incrementar" on:click increment\n    }\n  }\n}\n`);
        fs.writeFileSync(path.join(dir, ".gitignore"), "dist/\nnode_modules/\n");
        say(`Projeto criado em ${dir}\nPróximos passos: cd ${opts._[0] ?? "."} && vessie run`);
        return 0;
      }

      case "check": {
        const files = collect(opts._, cwd);
        if (!files.length) { err("Nenhum arquivo .vessie encontrado."); return 1; }
        let errors = 0, warns = 0;
        const all = [];
        for (const f of files) {
          const src = fs.readFileSync(f, "utf8");
          const r = compile(src, { file: path.relative(cwd, f) });
          errors += r.diagnostics.filter((d) => d.severity === "error").length;
          warns += r.diagnostics.filter((d) => d.severity === "warning").length;
          if (opts.json) all.push(...r.diagnostics.map((d) => d.toJSON()));
          else report(r.diagnostics, { [path.relative(cwd, f)]: src });
          verbose(`verificado: ${path.relative(cwd, f)}`);
        }
        if (opts.json) out(JSON.stringify(all, null, 2));
        else say(`${files.length} arquivo(s): ${errors} erro(s), ${warns} aviso(s)`);
        return errors || (opts.strict && warns) ? 1 : 0;
      }

      case "compile": {
        if (!opts._[0]) { err("Uso: vessie compile <arquivo.vessie> [--out arquivo.js] [--single]"); return 2; }
        const f = path.resolve(cwd, opts._[0]);
        const src = fs.readFileSync(f, "utf8");
        if (opts.single) {
          const r = buildSingleBundle({ file: path.relative(cwd, f), source: src });
          report(r.diagnostics, { [path.relative(cwd, f)]: src });
          if (!r.ok) return 1;
          if (opts.out) { fs.writeFileSync(path.resolve(cwd, opts.out), r.code); say(`Bundle único gerado em ${opts.out} (1 arquivo .js autocontido)`); } else out(r.code);
          return 0;
        }
        const r = compile(src, { file: path.relative(cwd, f), sourceMap: false, runtimePath: opts.runtime ?? "./runtime/vessie-runtime.js" });
        report(r.diagnostics, { [path.relative(cwd, f)]: src });
        if (!r.ok) return 1;
        if (opts.out) { fs.writeFileSync(path.resolve(cwd, opts.out), r.code); say(`JavaScript gerado em ${opts.out}`); } else out(r.code);
        return 0;
      }

      case "build": {
        const entry = resolveEntry(opts, cwd);
        const cfg = loadProject(cwd);
        const outDir = path.resolve(cwd, opts.out ?? cfg?.outDir ?? "dist");
        if (opts.single) {
          say(`Compilando ${path.relative(cwd, entry)} para bundle único ...`);
          const r = buildWebSingle({ file: entry, outDir });
          report(r.diagnostics, { [entry]: r.source });
          if (!r.ok) { err("Build falhou."); return 1; }
          r.files.forEach((f) => verbose(`  + ${f}`));
          say(`Build único concluído: ${path.relative(cwd, outDir) || "."}/app.bundle.js (+ index.html que o carrega)`);
          return 0;
        }
        say(`Compilando ${path.relative(cwd, entry)} ...`);
        const r = buildWeb({ file: entry, outDir, mode: opts.mode ?? "development" });
        report(r.diagnostics, { [entry]: r.source });
        if (!r.ok) { err("Build falhou."); return 1; }
        r.files.forEach((f) => verbose(`  + ${f}`));
        say(`Build concluído: ${path.relative(cwd, outDir) || "."}/ (${r.files.length} arquivos, modo ${opts.mode ?? "development"})`);
        return 0;
      }

      case "run": case "dev": {
        const entry = resolveEntry(opts, cwd);
        if (opts.node) return await runHeadless(entry, { out, err, cwd, report });
        const outDir = fs.mkdtempSync(path.join(os.tmpdir(), "vessie-run-"));
        const rebuild = () => {
          const r = buildWeb({ file: entry, outDir, mode: "development" });
          report(r.diagnostics, { [entry]: r.source });
          return r.ok;
        };
        if (!rebuild()) return 1;
        const port = Number(opts.port ?? 5173);
        const server = createStaticServer(outDir);
        await new Promise((res, rej) => { server.once("error", rej); server.listen(port, "127.0.0.1", res); });
        say(`Vessie servindo ${path.basename(entry)} em http://127.0.0.1:${server.address().port}  (Ctrl+C para sair)`);
        if (cmd === "dev") {
          let timer = null;
          fs.watch(path.dirname(entry), { recursive: true }, (_e, name) => {
            if (!name || !name.endsWith(".vessie")) return;
            clearTimeout(timer);
            timer = setTimeout(() => { say(rebuild() ? "Recompilado." : "Recompilação falhou (veja os erros acima)."); }, 100);
          });
        }
        if (io.returnServer) return { server, outDir };
        await new Promise(() => {});
        return 0;
      }

      case "open": {
        // Abrir UI: compila, serve e tenta abrir o navegador no endereço local.
        // Fechar UI: Ctrl+C no terminal (encerra o servidor).
        const entry = resolveEntry(opts, cwd);
        const outDir = fs.mkdtempSync(path.join(os.tmpdir(), "vessie-open-"));
        const r = buildWeb({ file: entry, outDir, mode: "development" });
        report(r.diagnostics, { [entry]: r.source });
        if (!r.ok) return 1;
        const port = Number(opts.port ?? 5173);
        const server = createStaticServer(outDir);
        await new Promise((res, rej) => { server.once("error", rej); server.listen(port, "127.0.0.1", res); });
        const url = `http://127.0.0.1:${server.address().port}`;
        say(`Vessie abrindo ${path.basename(entry)} em ${url}  (Ctrl+C fecha a UI)`);
        if (!opts["no-browser"]) openBrowser(url, { err });
        if (io.returnServer) return { server, outDir, url };
        await new Promise(() => {});
        return 0;
      }

      case "ui": {
        // Conjunto de comandos da UI: lista componentes e comandos abrir/fechar.
        const sub = (opts._[0] ?? "list").toLowerCase();
        const commands = [
          { name: "ui.open(id)", desc: "abre modal/dialog/elemento com id: ..." },
          { name: "ui.show(id)", desc: "alias de open: mostra o elemento" },
          { name: "ui.close(id)", desc: "fecha modal/dialog/elemento com id: ..." },
          { name: "ui.hide(id)", desc: "alias de close: esconde o elemento" },
          { name: "ui.toggle(id)", desc: "alterna visível/oculto" },
          { name: "ui.isVisible(id)", desc: "true/false, ou null se o id não existe" },
          { name: "ui.isOpen(id)", desc: "alias de isVisible" },
        ];
        const comps = Object.entries(COMPONENTS).map(([name, c]) => ({
          name, args: c.args, container: c.container, props: c.props, events: [...c.events], bind: c.bind,
        }));
        if (opts.json) {
          out(JSON.stringify({ commands, components: comps }, null, 2));
          return 0;
        }
        if (sub !== "list" && sub !== "components" && sub !== "commands") {
          err(`Uso: vessie ui [list] [--json]\nEx.: vessie ui list`);
          return 2;
        }
        say("Comandos abrir/fechar UI (na linguagem .vessie):");
        for (const c of commands) say(`  ${c.name} — ${c.desc}`);
        say("\nExemplo:");
        say('  modal id: "ajuda" open: mostrar { text "Olá!" button "Fechar" on:click fechar }');
        say('  fn abrir() { ui.open("ajuda") }');
        say('  fn fechar() { ui.close("ajuda") }');
        say("\nComponentes de UI:");
        for (const c of comps) {
          say(`  ${c.name} (filhos: ${c.container ? "sim" : "não"})${c.props.length ? ` props: ${c.props.join(", ")}` : ""}${c.events.length ? ` eventos: ${c.events.join(", ")}` : ""}`);
        }
        say('\nAbrir no navegador: vessie open app.vessie  (Ctrl+C fecha)');
        return 0;
      }

      case "watch": {
        // Gatilho de arquivos: executa uma vez e reexecuta o subcomando a cada
        // mudança em .vessie/vessie.json (ignora dist, node_modules e ocultos).
        // Uso: vessie watch [--once] [--debounce ms] -- <comando...> [args...]
        // io.signal ({ aborted: bool }) é um gancho interno p/ encerrar o laço.
        const sub = opts._;
        if (!sub.length) { err("Uso: vessie watch [--once] [--debounce ms] -- <comando...> [args...]"); return 2; }
        const debounce = Math.max(50, Number(opts.debounce ?? 200) || 200);
        let running = false, lastCode = 0;
        const runSub = async () => {
          if (running) return;
          running = true;
          try { lastCode = await main(sub, io); } finally { running = false; }
        };
        await runSub();
        if (opts.once) return lastCode;
        say(`Observando .vessie em ${cwd} (Ctrl+C para sair) ...`);
        let timer = null, stopped = false;
        let watcher;
        try {
          watcher = fs.watch(cwd, { recursive: true }, (_e, name) => {
            if (!name || (!name.endsWith(".vessie") && !name.endsWith("vessie.json"))) return;
            if (name.includes("node_modules") || /(^|[\\/])dist([\\/]|$)/.test(name) || /(^|[\\/])\./.test(name)) return;
            clearTimeout(timer);
            timer = setTimeout(async () => {
              if (stopped || io.signal?.aborted) return;
              say("Mudança detectada; reexecutando...");
              await runSub();
            }, debounce);
          });
        } catch (e) { err(`Observação de arquivos indisponível: ${e.message}`); return 1; }
        await new Promise((res) => {
          const t = setInterval(() => { if (io.signal?.aborted) { clearInterval(t); res(); } }, 50);
        });
        stopped = true;
        clearTimeout(timer);
        watcher.close();
        return 0;
      }

      case "test": {
        const files = collect(opts._, cwd).filter((f) => f.endsWith(".test.vessie"));
        if (!files.length) { err("Nenhum arquivo *.test.vessie encontrado."); return 1; }
        let failed = 0;
        for (const f of files) {
          const code = await runHeadless(f, { out: () => {}, err, cwd, report, quietOutput: true });
          if (code === 0) say(`ok   ${path.relative(cwd, f)}`); else { failed++; err(`FALHOU ${path.relative(cwd, f)}`); }
        }
        say(`${files.length - failed}/${files.length} teste(s) passaram`);
        return failed ? 1 : 0;
      }

      case "format": {
        const files = collect(opts._, cwd);
        let changed = 0;
        for (const f of files) {
          const src = fs.readFileSync(f, "utf8");
          const fmt = formatSource(src);
          if (fmt !== src) {
            changed++;
            if (opts.check) err(`Precisa de formatação: ${path.relative(cwd, f)}`); else { fs.writeFileSync(f, fmt); verbose(`formatado: ${path.relative(cwd, f)}`); }
          }
        }
        say(opts.check ? `${changed} arquivo(s) fora do padrão` : `${changed} arquivo(s) formatado(s), ${files.length - changed} já estavam corretos`);
        return opts.check && changed ? 1 : 0;
      }

      case "clean": {
        const cfg = loadProject(cwd);
        const target = resolveInside(cwd, opts._[0] ?? cfg?.outDir ?? "dist");
        if (target === path.resolve(cwd)) { err("Recusado: não é permitido limpar o diretório atual."); return 1; }
        fs.rmSync(target, { recursive: true, force: true });
        say(`Removido: ${path.relative(cwd, target)}`);
        return 0;
      }

      case "doctor": return doctor({ out, err });

      case "adapters": {
        const rows = listAdapters();
        if (opts.json) { out(JSON.stringify(rows, null, 2)); return 0; }
        for (const a of rows) {
          say(`${a.available ? "✔" : "–"} ${a.id}${a.aliases.length ? ` (${a.aliases.join("/")})` : ""} — ${a.description}${a.version ? ` [${a.version}]` : " [não detectado]"}`);
        }
        say("Uso: vessie exec --lang <id> --code \"...\"  (só executa no seu próprio processo-filho)");
        return 0;
      }

      case "exec": {
        const lang = opts.lang ?? opts._[0];
        if (!lang) { err("Uso: vessie exec --lang <python|node|c|cpp|csharp> (--code \"...\" | <arquivo>) [--timeout ms]"); return 2; }
        let code = opts.code;
        const fileArg = opts.code !== undefined && opts.code !== true ? undefined : (opts.lang !== undefined ? opts._[0] : opts._[1]);
        if (code === undefined || code === true) {
          if (!fileArg) { err("Uso: vessie exec --lang <id> (--code \"...\" | <arquivo>)"); return 2; }
          code = fs.readFileSync(path.resolve(cwd, fileArg), "utf8");
        }
        const r = runCode(lang, code, { timeout: opts.timeout !== undefined ? Number(opts.timeout) : undefined });
        if (r.stdout) out(r.stdout.replace(/\n$/, ""));
        if (r.stderr) err(r.stderr.replace(/\n$/, ""));
        if (!r.ok) {
          err(r.timedOut ? `Tempo esgotado.` : (r.error ?? `Saída com código ${r.exitCode}.`));
          return 1;
        }
        return 0;
      }

      case "cs": {
        // Adaptação C# → Vessie: converte (convert) ou executa o original via .NET (run).
        const sub = opts._[0];
        const file = sub === "convert" || sub === "run" ? opts._[1] : sub;
        const mode = sub === "run" ? "run" : "convert";
        if (!file) { err("Uso: vessie cs convert <arq.cs> [--out app.vessie] | vessie cs run <arq.cs> [--timeout ms]"); return 2; }
        const full = path.resolve(cwd, file);
        if (!fs.existsSync(full)) { err(`Arquivo não encontrado: ${file}`); return 1; }
        const src = fs.readFileSync(full, "utf8");
        if (mode === "run") {
          const r = runCode("csharp", src, { timeout: opts.timeout !== undefined ? Number(opts.timeout) : undefined });
          if (r.stdout) out(r.stdout.replace(/\n$/, ""));
          if (r.stderr) err(r.stderr.replace(/\n$/, ""));
          if (!r.ok) {
            err(r.timedOut ? `Tempo esgotado.` : (r.error ?? `Saída com código ${r.exitCode}.`));
            return 1;
          }
          return 0;
        }
        const base = path.basename(file).replace(/\.cs$/i, "") || "App";
        const r = convertCSharp(src, { appName: opts.app ?? base });
        for (const wline of r.warnings) err(`aviso: ${wline}`);
        const rel = path.relative(cwd, full);
        const c = compile(r.code, { file: opts.out ?? rel.replace(/\.cs$/i, ".vessie"), warnings: true });
        if (!c.ok) {
          report(c.diagnostics, { [rel]: src });
          err("O resultado precisa de revisão manual (não compilou; veja acima).");
        } else if (c.diagnostics.length) {
          report(c.diagnostics, { [rel]: src });
        }
        if (opts.json) {
          out(JSON.stringify({ code: r.code, warnings: r.warnings, compiles: c.ok }, null, 2));
        } else if (opts.out) {
          fs.writeFileSync(path.resolve(cwd, opts.out), r.code);
          say(`C# adaptado para Vessie em ${opts.out} (${r.warnings.length} aviso(s))${c.ok ? "" : " — REVISAR (não compilou)"}`);
        } else out(r.code);
        if (opts.verbose) for (const l of CS_LIMITS) out(`limite: ${l}`);
        return c.ok ? 0 : 1;
      }

      case "ai": {
        if (opts.system && !opts._.length) { out(COMPACT_SPEC); return 0; }
        const pedido = opts._.join(" ").trim();
        if (!pedido) { err("Uso: vessie ai \"<pedido>\" [--code|--system|--json|--out arquivo]"); return 2; }
        let r;
        try {
          r = improvePrompt(pedido);
        } catch (e) { err(`Erro: ${e.message}`); return 1; }
        if (opts.json) {
          out(JSON.stringify(r, null, 2));
        } else if (opts.code) {
          if (opts.out) { fs.writeFileSync(path.resolve(cwd, opts.out), r.code + "\n"); say(`Código .vessie gerado em ${opts.out} (intenção: ${r.intent})`); }
          else out(r.code);
        } else if (opts.system) {
          out(combinedPrompt(r));
        } else {
          out(`Intenção: ${r.intentLabel} · app: ${r.app} · palavras: ${r.keywords.join(", ") || "—"}`);
          out(`\n--- PEDIDO APRIMORADO ---\n${r.improved}`);
          out(`\n--- SYSTEM PROMPT (envie junto) ---\n${r.systemPrompt}`);
          if (r.notes.length) r.notes.forEach((n) => err(n));
        }
        return 0;
      }

      case "websearch": {
        const [url, ...termParts] = opts._;
        const term = termParts.join(" ").trim();
        if (!url || !term) { err("Uso: vessie websearch <url> <termo> [--pages N] [--depth N] [--json] [--out prompt.md]"); return 2; }
        let r;
        try {
          r = await smartSearch(url, term, {
            maxPages: opts.pages !== undefined ? Number(opts.pages) : undefined,
            maxDepth: opts.depth !== undefined ? Number(opts.depth) : undefined,
          });
        } catch (e) { err(`Erro: ${e.message}`); return 1; }
        if (opts.json) out(JSON.stringify({ pages: r.pages, elements: r.elements, scripts: r.scripts }, null, 2));
        else if (opts.out) { fs.writeFileSync(path.resolve(cwd, opts.out), r.markdown + "\n"); say(`Resumo em ${opts.out}: ${r.pages.length} página(s), ${r.elements.length} elemento(s), ${r.scripts.length} script(s)`); }
        else out(r.prompt || "(nenhuma página relevante encontrada)");
        return 0;
      }

      case "markdown": {
        if (!opts._[0]) { err("Uso: vessie markdown <arquivo.md> [--out arquivo.html] [--text]"); return 2; }
        const src = fs.readFileSync(path.resolve(cwd, opts._[0]), "utf8");
        const result = opts.text ? renderText(src) : renderMarkdown(src);
        if (opts.out) { fs.writeFileSync(path.resolve(cwd, opts.out), result + "\n"); say(`Markdown renderizado em ${opts.out}`); }
        else out(result);
        return 0;
      }

      case "a11y": {
        const files = collect(opts._, cwd).filter((f) => f.endsWith(".vessie"));
        if (!files.length) { err("Nenhum arquivo .vessie encontrado."); return 1; }
        let total = 0;
        const all = [];
        for (const f of files) {
          const src = fs.readFileSync(f, "utf8");
          const r = auditSource(src, { file: path.relative(cwd, f) });
          if (!r.ok) { report(r.diagnostics, { [path.relative(cwd, f)]: src }); return 1; }
          total += r.issues.length;
          if (opts.json) all.push(...r.issues.map((i) => ({ file: path.relative(cwd, f), ...i })));
          else for (const i of r.issues) err(`${path.relative(cwd, f)}:${i.line}:${i.col} [${i.rule}] ${i.message}`);
          verbose(`${path.relative(cwd, f)}: ${r.counts.buttons} botão(ões), ${r.counts.images} imagem(ns), ${r.counts.inputs} campo(s)`);
        }
        if (opts.json) out(JSON.stringify(all, null, 2));
        else say(`${files.length} arquivo(s): ${total} problema(s) de acessibilidade`);
        return total ? 1 : 0;
      }

      case "sys": {
        const sub = opts._[0] ?? "info";
        if (sub === "info") {
          const i = sysInfo();
          if (opts.json) { out(JSON.stringify(i, null, 2)); return 0; }
          const mb = (b) => `${Math.round(b / 1048576)} MB`;
          out(`SO: ${i.platform}/${i.arch} (${i.release}) · CPU: ${i.cpus}x ${i.cpuModel}`);
          out(`Memória: ${mb(i.usedMem)} de ${mb(i.totalMem)} em uso (${i.usedPct}%) · livre: ${mb(i.freeMem)}`);
          out(`Carga média: ${i.loadAvg.map((v) => v.toFixed(2)).join(" ")} · uptime: ${Math.round(i.uptimeSec / 3600)}h · Node ${i.node}`);
          return 0;
        }
        if (sub === "procs") {
          const r = sysProcs({ limit: opts.limit !== undefined ? Number(opts.limit) : undefined });
          if (!r.available) { err("Lista de processos indisponível neste sistema."); return 1; }
          if (opts.json) { out(JSON.stringify(r.procs, null, 2)); return 0; }
          for (const p of r.procs) out(`${String(p.pid).padStart(7)}  ${p.name}`);
          say(`(${r.count} processo(s))`);
          return 0;
        }
        err("Uso: vessie sys [info|procs] [--limit N] [--json]");
        return 2;
      }

      case "optimize": {
        if (opts.apply && opts.pid === undefined) { err("Por segurança, --apply exige --pid <número> explícito."); return 2; }
        const result = opts.apply ? applyGamePriority(opts.pid) : optimizationReport({ game: opts.game, limit: opts.limit });
        if (opts.json) { out(JSON.stringify(result, null, 2)); return result.ok === false ? 1 : 0; }
        if (opts.apply) {
          if (result.ok) say(`Prioridade alta aplicada ao PID ${result.pid} pelo Python.`);
          else err(`Nenhuma alteração foi feita: ${result.error}`);
          return result.ok ? 0 : 1;
        }
        const mb = (b) => `${Math.round(b / 1048576)} MB`;
        out(`Diagnóstico: ${result.system.cpus} CPU(s) · memória ${mb(result.system.usedMem)}/${mb(result.system.totalMem)} (${result.system.usedPct}%)`);
        if (result.candidates.length) {
          out("Possíveis jogos/processos:");
          for (const p of result.candidates) out(`  ${String(p.pid).padStart(7)}  ${p.name}`);
        }
        out("Recomendações:");
        for (const item of result.recommendations) out(`  • ${item}`);
        say("Modo seguro: nenhuma prioridade foi alterada. Para aplicar no Windows: vessie optimize --pid <PID> --apply");
        return 0;
      }

      case "console": {
        // Script único autocontido para o Console do Chrome (DevTools): runtime +
        // app embutidos, sem imports e sem servidor. Também roda com `node arquivo.js`.
        if (!opts._[0]) { err("Uso: vessie console <arquivo.vessie> [--out arquivo.js] [--clip]"); return 2; }
        const cfile = path.resolve(cwd, opts._[0]);
        const csrc = fs.readFileSync(cfile, "utf8");
        const cb = buildSingleBundle({ file: path.relative(cwd, cfile), source: csrc });
        report(cb.diagnostics, { [path.relative(cwd, cfile)]: csrc });
        if (!cb.ok) return 1;
        if (opts.out) {
          fs.writeFileSync(path.resolve(cwd, opts.out), cb.code);
          say(`Script de console gerado em ${opts.out}`);
        } else {
          out("/* Vessie — Console do Chrome (DevTools)");
          out("   1) Copie todo o conteúdo abaixo e cole no console; 2) Enter para executar.");
          out("   Não precisa de site/servidor próprio: runtime e app estão embutidos no script.");
          out("   Também funciona com: node console.js */");
          out(cb.code);
        }
        if (opts.clip) {
          if (clipToClipboard(cb.code)) say("Copiado para a área de transferência.");
          else err("Não foi possível copiar (clipboard indisponível neste sistema).");
        }
        return 0;
      }

      case "gen": {
        // Variações de scripts: transpila o .vessie para outra linguagem de destino.
        const lang = opts.lang ?? "node";
        if (!opts._[0]) { err("Uso: vessie gen <arquivo.vessie> --lang <python|node|website|web|console> [--out alvo] [--run]"); return 2; }
        const gfile = path.resolve(cwd, opts._[0]);
        const gsrc = fs.readFileSync(gfile, "utf8");
        const grel = path.relative(cwd, gfile);
        if (lang === "python") {
          const c = compile(gsrc, { file: grel, sourceMap: false });
          report(c.diagnostics, { [grel]: gsrc });
          if (!c.ok) return 1;
          const py = generatePython(c.ast, c.analysis, { file: grel });
          for (const n of py.notes) err(`aviso: ${n}`);
          if (opts.out) { fs.writeFileSync(path.resolve(cwd, opts.out), py.code); say(`Script Python gerado em ${opts.out} (python3 ${opts.out})`); }
          else out(py.code);
          if (opts.run) {
            const pr = runCode("python", py.code, { timeout: opts.timeout !== undefined ? Number(opts.timeout) : undefined });
            if (pr.stdout) out(pr.stdout.replace(/\n$/, ""));
            if (pr.stderr) err(pr.stderr.replace(/\n$/, ""));
            if (!pr.ok) { err(pr.timedOut ? "Tempo esgotado." : (pr.error ?? `Saída com código ${pr.exitCode}.`)); return 1; }
          }
          return 0;
        }
        if (lang === "node" || lang === "console") {
          const b = buildSingleBundle({ file: grel, source: gsrc });
          report(b.diagnostics, { [grel]: gsrc });
          if (!b.ok) return 1;
          if (opts.out) {
            fs.writeFileSync(path.resolve(cwd, opts.out), b.code);
            if (lang === "node") say(`Script Node gerado em ${opts.out} (node ${opts.out})`);
            else say(`Script de console gerado em ${opts.out}`);
          } else {
            if (lang === "console") out("/* Vessie — Console do Chrome (DevTools): copie e cole; funciona sem site próprio. */");
            out(b.code);
          }
          return 0;
        }
        if (lang === "website" || lang === "web") {
          const outDir = path.resolve(cwd, opts.out ?? "dist");
          const r = lang === "web"
            ? buildWeb({ file: gfile, outDir, mode: opts.mode ?? "development" })
            : buildWebSingle({ file: gfile, outDir });
          report(r.diagnostics, { [grel]: gsrc });
          if (!r.ok) { err("Geração falhou."); return 1; }
          r.files.forEach((f) => verbose(`  + ${f}`));
          say(`${lang === "web" ? "Site" : "Website de arquivo único"} gerado em ${path.relative(cwd, outDir) || "."}/`);
          return 0;
        }
        err(`Linguagem de geração desconhecida: "${lang}". Use python, node, website, web ou console.`);
        return 2;
      }

      case "base": {
        // Multi-Base: catálogo de módulos por gênero com variações de scripts.
        const sub = (opts._.shift() ?? "list").toLowerCase();
        const summary = catalogSummary();
        const handleErr = (msg) => { err(msg); return 2; };
        if (sub === "count") {
          if (opts.json) { out(JSON.stringify(summary, null, 2)); return 0; }
          out(`Catálogo Multi-Base: ${summary.modules} módulo(s) · ${summary.genres} gênero(s) · ${summary.variations} variação(ões) de código`);
          for (const g of GENRES) out(`  ${g.id.padEnd(12)} ${summary.byGenre[g.id] ?? 0} módulo(s)`);
          out("Por linguagem:");
          for (const l of LANGS) out(`  ${l.id.padEnd(8)} ${summary.byLang[l.id] ?? 0} módulo(s)`);
          return 0;
        }
        if (sub === "genres") {
          const rows = GENRES.map((g) => ({ id: g.id, label: g.label, modules: summary.byGenre[g.id] ?? 0 }));
          if (opts.json) { out(JSON.stringify(rows, null, 2)); return 0; }
          for (const r of rows) out(`${r.id.padEnd(12)} ${r.label} (${r.modules} módulo(s))`);
          return 0;
        }
        if (sub === "list") {
          const rows = listModules({ lang: opts.lang, genre: opts.genre });
          const data = rows.map((m) => ({
            id: m.id, genre: m.genre, name: m.name, desc: m.desc, tags: m.tags,
            langs: m.langs, variations: moduleVariantCount(m),
          }));
          if (opts.json) { out(JSON.stringify({ total: data.length, variations: totalVariations(), modules: data }, null, 2)); return 0; }
          out(`${data.length} módulo(s)${opts.lang ? ` em "${opts.lang}"` : ""}${opts.genre ? ` no gênero "${opts.genre}"` : ""} · catálogo total: ${totalVariations()} variações`);
          for (const d of data) out(`  ${d.id.padEnd(22)} [${d.genre}] ${d.name} — ${d.desc} (${d.langs.join("/")}, ${d.variations} variações)`);
          return 0;
        }
        if (sub === "search") {
          const term = opts._.join(" ").trim();
          if (!term) return handleErr("Uso: vessie base search <termo> [--lang X] [--genre X]");
          const rows = searchModules(term, { lang: opts.lang, genre: opts.genre });
          const data = rows.map((m) => ({ id: m.id, genre: m.genre, name: m.name, desc: m.desc, tags: m.tags, langs: m.langs, variations: moduleVariantCount(m) }));
          if (opts.json) { out(JSON.stringify({ term, total: data.length, modules: data }, null, 2)); return 0; }
          out(`"${term}" → ${data.length} módulo(s):`);
          for (const d of data) out(`  ${d.id.padEnd(22)} [${d.genre}] ${d.name} — ${d.desc}`);
          return 0;
        }
        if (sub === "gen" || sub === "install") {
          const id = opts._[0];
          if (!id) return handleErr(`Uso: vessie base ${sub} <id> [--lang X] [--variant N] [--name "Nome"] [--out arquivo] [--run] [--check]`);
          const module = moduleById(id);
          if (!module) return handleErr(`Módulo "${id}" não existe. Use: vessie base list`);
          const l = opts.lang ?? DEFAULT_LANG[module.genre];
          if (!module.langs.includes(l)) return handleErr(`O módulo "${id}" não tem código em "${l}". Linguagens: ${module.langs.join(", ")}.`);
          const values = {};
          if (opts.name) {
            values.APP = opts.name.replace(/[^A-Za-z0-9_]/g, "");
            values.TITLE = opts.name;
            if (!values.APP) values.APP = "App";
            if (/^[0-9]/.test(values.APP)) values.APP = "_" + values.APP;
          }
          const r = renderModule(module, l, { variant: opts.variant !== undefined ? Number(opts.variant) : 0, values });
          if (!r.ok) return handleErr(r.error);
          if (opts.check && l === "vessie") {
            const c = compile(r.code, { file: `${id}.vessie`, sourceMap: false });
            if (!c.ok) {
              report(c.diagnostics, { [`${id}.vessie`]: r.code });
              err(`A variação gerada do módulo "${id}" não compilou (revise o catálogo).`);
              return 1;
            }
          }
          const outName = opts.out ?? (sub === "install" ? defaultFileName(id, l) : null);
          if (outName) {
            fs.writeFileSync(path.resolve(cwd, outName), r.code);
            say(`${sub === "install" ? "Instalado" : "Gerado"} em ${outName} (${module.name}, variação ${r.variant + 1}/${moduleVariantCount(module)})`);
          } else {
            out(r.code);
          }
          if (opts.run && (l === "python" || l === "node")) {
            const rr = runCode(l, r.code, { timeout: opts.timeout !== undefined ? Number(opts.timeout) : undefined });
            if (rr.stdout) out(rr.stdout.replace(/\n$/, ""));
            if (rr.stderr) err(rr.stderr.replace(/\n$/, ""));
            if (!rr.ok) { err(rr.timedOut ? "Tempo esgotado." : (rr.error ?? `Saída com código ${rr.exitCode}.`)); return 1; }
          }
          return 0;
        }
        if (sub === "web") {
          const term = opts._.join(" ").trim();
          if (!term) return handleErr("Uso: vessie base web <termo> [--lang X] [--genre X] [--scripts N] [--out prompt.md]");
          let r;
          try {
            r = await searchAndGenerate(term, {
              lang: opts.lang, genre: opts.genre,
              maxScripts: opts.scripts !== undefined ? Number(opts.scripts) : 4,
            });
          } catch (e) { err(`Erro: ${e.message}`); return 1; }
          if (!r.ok) { err(r.error); return 1; }
          if (opts.json) {
            out(JSON.stringify({ query: r.query, sources: r.sources, modules: r.modules, scripts: r.scripts.map((s) => ({ id: s.id, name: s.name, lang: s.lang, code: s.code })) }, null, 2));
            return 0;
          }
          if (opts.out) {
            const md = [`# Busca web: ${r.query}`, "", `- Fontes: ${r.sources.length} · módulos relacionados: ${r.modules.length}`, "", "## Conteúdo encontrado", "", r.summary, "", "## Scripts gerados", ""]
              .concat(r.scripts.map((s) => `### ${s.id} (${s.lang})\n\n\`\`\`\n${s.code}\n\`\`\``));
            fs.writeFileSync(path.resolve(cwd, opts.out), md.join("\n") + "\n");
            say(`Busca em ${opts.out}: ${r.sources.length} fonte(s), ${r.scripts.length} script(s) gerado(s)`);
          } else {
            out(`Busca web: "${r.query}" — ${r.sources.length} fonte(s), ${r.modules.length} módulo(s) relacionados, ${r.scripts.length} script(s) gerado(s).`);
            for (const s of r.sources) out(`  [${s.fonte}] ${s.titulo}: ${s.texto}`);
            if (r.error) err(`aviso: ${r.error}`);
            for (const s of r.scripts) {
              out(`\n--- ${s.id} (${s.lang}) ---`);
              out(s.code);
            }
          }
          return 0;
        }
        err(`Subcomando base desconhecido: "${sub}". Use count, genres, list, search, gen, install ou web.`);
        return 2;
      }

      case "git": {
        const sub = opts._.shift();
        if (!sub) {
          err("Uso: vessie git <subcomando> [args...]");
          err(`Comandos liberados: ${[...GIT_ALLOWED].join(", ")}`);
          err("Ex.: vessie git add .  ·  vessie git commit -m \"mensagem\"  ·  vessie git status");
          return 2;
        }
        if (sub === "init") {
          const r = initProject(cwd);
          if (!r.ok) { err(r.stderr.trim() || r.error || "Falha ao inicializar o git."); return 1; }
          say("Repositório git inicializado (e .gitignore padrão garantido).");
          return 0;
        }
        const args = [sub, ...opts._];
        const r = runGit(args, { cwd });
        if (r.stdout) out(r.stdout.replace(/\n$/, ""));
        if (r.stderr) err(r.stderr.replace(/\n$/, ""));
        if (!r.ok) { err(r.error ?? "Falha na execução do git."); return 1; }
        return 0;
      }

      case "info": {
        out(`Vessie ${VERSION}\nNode ${process.version}\nImplementado: lexer, parser, AST, semântica/tipos, backend JS (+source map por linha), bundle único, runtime web, UI declarativa (modal/dialog/tabs/table/icon/canvas + ui.open/ui.close/ui.show/ui.hide/ui.toggle), stdlib base (+js.* compatível com JavaScript + ui.*), blocos css/js/html/cs (HTML próprio + fonte C# embutida), adaptação C#→Vessie (vessie cs convert, vessie cs run), adaptadores de execução (python/node/c/c++/c#), assistente de IA local (geração dupla), smart-web-search, markdown próprio, auditoria a11y, sys, otimizador seguro de jogos/processos com Python, CLI (run/open/ui), console do Chrome (vessie console, script colável no DevTools sem site próprio), geração de variações (vessie gen: python/node/website/web), Multi-Base (vessie base: catálogo de módulos por gênero com variações + busca web), git integrado (vessie git)\nPlanejado: gráficos 2D/3D, LM Studio, servidor Node, pacotes, extensões, Adaptive Engine\nVeja docs/STATUS.md`);
        return 0;
      }

      case "docs": {
        const dir = path.join(ROOT, "docs");
        let files = null;
        try { files = fs.readdirSync(dir).sort(); } catch { files = null; }
        if (!files) {
          out("Documentação embutida no VessieLang.js:");
          for (const f of Object.keys(__EMBEDDED_DOCS__).sort()) out(`  ${f}`);
          return 0;
        }
        out(`Documentação em ${dir}:`);
        for (const f of files) out(`  ${f}`);
        return 0;
      }

      default:
        err(`Comando desconhecido: "${cmd}". Use "vessie --help".`);
        return 2;
    }
  } catch (e) {
    err(`Erro: ${e.message}`);
    if (opts.verbose) err(e.stack);
    return 1;
  }
}

async function runHeadless(entry, { out, err, cwd, report, quietOutput }) {
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), "vessie-node-"));
  try {
    const r = buildWeb({ file: entry, outDir, mode: "development" });
    report(r.diagnostics, { [entry]: r.source });
    if (!r.ok) return 1;
    const app = path.join(outDir, "js", "app.js");
    // .mjs copy não é necessário: package.json local força ESM
    fs.writeFileSync(path.join(outDir, "package.json"), '{"type":"module"}');
    const rt = await import(pathToFileURL(path.join(outDir, "runtime", "vessie-runtime.js")).href);
    if (quietOutput) rt.setOutput(() => {});
    else rt.setOutput((level, args) => { const line = args.map((a) => (typeof a === "string" ? a : JSON.stringify(a))).join(" "); (level === "error" || level === "warn" ? err : out)(line); });
    await import(pathToFileURL(app).href);
    return 0;
  } catch (e) {
    err(`Erro de execução: ${e.message}`);
    return 1;
  } finally {
    fs.rmSync(outDir, { recursive: true, force: true });
  }
}

const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json", ".map": "application/json", ".png": "image/png", ".svg": "image/svg+xml" };

function createStaticServer(root) {
  return http.createServer((req, res) => {
    let rel;
    try { rel = decodeURIComponent(new URL(req.url, "http://x").pathname); } catch { res.writeHead(400).end("Bad request"); return; }
    if (rel.endsWith("/")) rel += "index.html";
    let file;
    try { file = resolveInside(root, "." + rel); } catch { res.writeHead(403).end("Forbidden"); return; }
    fs.readFile(file, (e, data) => {
      if (e) { res.writeHead(404).end("Not found"); return; }
      res.writeHead(200, { "Content-Type": MIME[path.extname(file)] ?? "application/octet-stream", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" });
      res.end(data);
    });
  });
}

function probe(cmd, args = ["--version"]) {
  const r = spawnSync(cmd, args, { encoding: "utf8", timeout: 5000 });
  if (r.error || r.status !== 0) return null;
  return (r.stdout || r.stderr).split("\n")[0].trim();
}

/** Tenta abrir o navegador no URL (melhor esforço; nunca falha o comando). */
function openBrowser(url, { err } = {}) {
  try {
    const plat = process.platform;
    const cmd = plat === "win32" ? "cmd" : plat === "darwin" ? "open" : "xdg-open";
    const args = plat === "win32" ? ["/c", "start", "", url] : plat === "darwin" ? [url] : [url];
    const child = spawn(cmd, args, { stdio: "ignore", detached: true });
    child.on("error", () => {});
    child.unref?.();
  } catch (e) {
    err?.(`Não foi possível abrir o navegador automaticamente. Acesse ${url}`);
  }
}

/** Copia texto para a área de transferência (Windows: clip; macOS: pbcopy; Linux: xclip). */
function clipToClipboard(text) {
  const cmd = process.platform === "win32" ? "clip" : process.platform === "darwin" ? "pbcopy" : "xclip";
  const args = process.platform === "linux" ? ["-selection", "clipboard"] : [];
  try {
    const r = spawnSync(cmd, args, { input: String(text), encoding: "utf8", shell: false, windowsHide: true, timeout: 5000 });
    return !r.error && r.status === 0;
  } catch { return false; }
}

function doctor({ out }) {
  const nodeMajor = Number(process.versions.node.split(".")[0]);
  const rows = [
    ["Node.js (obrigatório, >=20)", nodeMajor >= 20 ? process.version : null, true],
    ["Git (vessie git)", gitVersion(), false],
    ["Python", probe("python3") ?? probe("python"), false],
    ["Compilador C (gcc/cc)", probe("gcc") ?? probe("cc"), false],
    ["Compilador C++ (g++/c++)", probe("g++") ?? probe("c++"), false],
    [".NET SDK", probe("dotnet"), false],
    ["CMake", probe("cmake"), false],
  ];
  let ok = true;
  for (const [label, v, required] of rows) {
    out(`${v ? "✔" : required ? "✘" : "–"} ${label}: ${v ?? (required ? "versão insuficiente" : "não encontrado (opcional; só necessário para o adaptador correspondente)")}`);
    if (required && !v) ok = false;
  }
  out("Nota: a detecção acima alimenta `vessie adapters`/`vessie exec`; cada execução roda em processo-filho próprio com timeout.");
  return ok ? 0 : 1;
}

/* ===== API pública ===== */
const parse__reexport = parse;
const tokenize__reexport = tokenize;
const MODULES__reexport = MODULES;
const main__reexport = main;
const createStaticServer__reexport = createStaticServer;
const compile__reexport = compile;
const compileOrThrow__reexport = compileOrThrow;
const VERSION__reexport = VERSION;
const buildWeb__reexport = buildWeb;
const buildWebSingle__reexport = buildWebSingle;
const createRuntimeBundle__reexport = createRuntimeBundle;
const baseCss__reexport = baseCss;
const buildSingleBundle__reexport = buildSingleBundle;
const singleBundleHtml__reexport = singleBundleHtml;
const formatDiagnostics__reexport = formatDiagnostics;
const resolveInside__reexport = resolveInside;
export { parse__reexport as parse, tokenize__reexport as tokenize, MODULES__reexport as MODULES, main__reexport as main, createStaticServer__reexport as createStaticServer, compile__reexport as compile, compileOrThrow__reexport as compileOrThrow, VERSION__reexport as VERSION, buildWeb__reexport as buildWeb, buildWebSingle__reexport as buildWebSingle, createRuntimeBundle__reexport as createRuntimeBundle, baseCss__reexport as baseCss, buildSingleBundle__reexport as buildSingleBundle, singleBundleHtml__reexport as singleBundleHtml, formatDiagnostics__reexport as formatDiagnostics, resolveInside__reexport as resolveInside };

/* ===== executa a CLI quando chamado diretamente ===== */
const __isMainEntry = (() => {
  try {
    const a = process.argv[1] ? path.resolve(process.argv[1]) : "";
    const b = fileURLToPath(import.meta.url);
    return a !== "" && (process.platform === "win32" ? a.toLowerCase() === b.toLowerCase() : a === b);
  } catch { return false; }
})();
if (__isMainEntry) { main(process.argv.slice(2)).then((code) => { process.exitCode = code; }); }
