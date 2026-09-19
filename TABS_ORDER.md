# 🗂️ Prompt de Implementação — Sistema de Abas + Rotas (Forja)

> **Antes de editar qualquer arquivo, este documento define o que será feito, os códigos de exemplo e a ordem de script** (conforme `.clinerules/Obrigatorio.md` e a skill `lm-studio`).

##  Objetivo

Criar um **sistema de abas completo** com **uma rota por aba**, de forma que URLs limpas funcionem:

- `…/Vessie-Lib/chat` → aba **chat**
- `…/Vessie-Lib/preview` → aba **preview de arquivos**
- `…/Vessie-Lib/settings` → aba **configurações**
- `…/Vessie-Lib/metrics` → aba **métricas**

Cada aba tem conteúdo avançado próprio (não é só um painel vazio).

---

## ⚠️ Desafio: URLs limpas em GitHub Pages

GitHub Pages é **estático**: `/Vessie-Lib/settings` não existe como arquivo → retorna **404**.
Solução padrão (spa-github-pages):

1. `404.html` captura qualquer rota desconhecida e redireciona para
   `/Vessie-Lib/?/settings` (guardando o caminho original).
2. `index.html` lê `?/settings`, corrige a URL com `history.replaceState('/settings')`
   e abre a aba certa.

Também há **fallback por hash** (`#/settings`) para rodar localmente via `file://`.

---

## 🧩 Abas e conteúdo avançado

| Rota | Aba | Conteúdo |
|------|-----|----------|
| `/chat` | Chat | Conversas + streaming (atual) |
| `/preview` | Preview | Editor + iframe ao vivo, seletor de linguagem, abrir em nova aba, baixar, arrastar arquivo |
| `/settings` | Configurações | Conexão, modelo, geração, dados (exportar/limpar tudo, uso de armazenamento) |
| `/metrics` | Métricas | Latência, RTT, cache, tokens, snapshot da configuração, limpar cache |

---

## 🗂️ Ordem de criação

| # | Arquivo | Ação | Descrição |
|---|---------|------|-----------|
| 1 | `TABS_ORDER.md` | criar | Este documento |
| 2 | `js/router.js` | criar | Router: base path, rotas, `pushState`, popstate, `?/` e `#/` |
| 3 | `css/tabs.css` | criar | Estilos da barra de abas, painéis, editor de preview, métricas |
| 4 | `js/panels.js` | criar | Lógica das abas preview e métricas + ferramentas de dados |
| 5 | `404.html` | criar | Redireciona rotas do GitHub Pages para o app |
| 6 | `index.html` | reescrever | Barra de abas + painéis por rota + scripts |
| 7 | `js/app.js` | editar | `openSettings()` → navega para aba; close → volta ao chat |
| 8 | `CREATION_ORDER.md` | atualizar | Registrar Fase 10 |
| 9 | `Vessie/reports/*.md` | atualizar | Relatórios |

---

## 💡 Código de exemplo

### Router (js/router.js)
```js
// Detecta o base path pelo próprio <script src=".../js/router.js">
var BASE = new URL(document.currentScript.src).pathname.replace(/\/js\/router\.js$/, '');

var ROUTES = ['chat','preview','settings','metrics'];
var USE_HASH = location.protocol === 'file:';

function readRoute(){
  var s = location.search;
  if (s[0]==='?' && s[1]==='/') return s.slice(2).split('&')[0]; // ?/settings (GitHub Pages)
  if (location.hash.indexOf('#/')===0) return location.hash.slice(2);
  var p = location.pathname;
  if (BASE && p.indexOf(BASE)===0) p = p.slice(BASE.length);
  return p.replace(/^\/+|\/+$/g,'') || 'chat';
}
```

### Painel por aba (index.html)
```html
<nav class="tabbar" role="tablist">
  <a class="tab" data-tab-link="chat" href="chat" role="tab">chat</a>
  <a class="tab" data-tab-link="preview" href="preview" role="tab">preview</a>
  <a class="tab" data-tab-link="settings" href="settings" role="tab">config</a>
  <a class="tab" data-tab-link="metrics" href="metrics" role="tab">métricas</a>
</nav>

<section class="tabpanel" data-tab="chat" role="tabpanel">…</section>
<section class="tabpanel" data-tab="settings" role="tabpanel" hidden>…</section>
```

### 404.html (GitHub Pages)
```html
<script>
  var l = window.location, seg = 1; // projeto: /Vessie-Lib/
  l.replace(
    l.protocol + '//' + l.hostname + (l.port ? ':' + l.port : '') +
    l.pathname.split('/').slice(0, 1 + seg).join('/') + '/?/' +
    l.pathname.slice(1).split('/').slice(seg).join('/') +
    (l.search ? '&' + l.search.slice(1) : '') + l.hash
  );
</script>
```

---

## ✅ Critérios de aceite

- [ ] Navegar entre abas muda a URL (limpa ou hash)
- [ ] Recarregar numa aba mantém a aba (via 404.html em produção)
- [ ] Botão voltar/avançar do navegador troca de aba
- [ ] Aba de preview renderiza HTML/SVG/MD ao vivo
- [ ] Aba de configurações salva/testa (reutiliza a lógica existente)
- [ ] Aba de métricas mostra números reais do `ForjaOptimizer`
- [ ] Nada do chat atual quebra (mensagens, streaming, sidebar, preview modal)

---
*Criado pela Vessie-Lib — sistema de abas/rotas para LM Studio / Forja*