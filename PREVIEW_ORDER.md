# 🖼️ Prompt de Implementação — Preview de Arquivos (Forja)

> **Antes de editar qualquer arquivo, este documento define o que será feito, os códigos de exemplo e a ordem de criação** (conforme `.clinerules/Obrigatorio.md`).

## 🎯 Objetivo

Permitir que **alguns tipos de arquivo possam ser abertos com uma preview tipo HTML** dentro do Forja:

1. **Blocos de código gerados pelo modelo** (`html`, `svg`, `markdown`) ganham um botão **"visualizar"** que abre o conteúdo renderizado num modal com `iframe sandbox`.
2. **Arquivos locais** podem ser arrastados/soltos (drag & drop) ou carregados via seletor para preview imediato (`.html`, `.htm`, `.svg`, `.md`, `.xml`, `.txt`, `.json`).

---

## 🧩 Tipos de arquivo suportados

| Extensão | Renderização | Método |
|----------|--------------|--------|
| `.html` / `.htm` | Página completa | iframe `srcdoc` + `sandbox="allow-scripts allow-forms allow-modals"` |
| `.svg` | Vetor inline | iframe `srcdoc` envolvendo o SVG em container centralizado |
| `.md` / `.markdown` | Markdown → HTML | `marked` + `DOMPurify` → iframe |
| `.xml` | Texto destacado | iframe com `<pre>` |
| `.txt` / `.json` / `.css` / `.js` | Texto puro | iframe com `<pre>` |

---

## 🗂️ Ordem de criação

| # | Arquivo | Ação | Descrição |
|---|---------|------|-----------|
| 1 | `PREVIEW_ORDER.md` | criar | Este documento de planejamento |
| 2 | `js/preview.js` | criar | Módulo `FilePreview`: detecta codeblocks, botão "preview", modal, drag&drop |
| 3 | `css/preview.css` | criar | Estilos do botão, modal de preview, área de drop |
| 4 | `index.html` | editar | Incluir `css/preview.css` e `js/preview.js`; adicionar overlay de preview |
| 5 | `js/app.js` | editar | `enhanceCodeBlocks()` chama `FilePreview.enhance(pre)` se disponível |
| 6 | `Vessie/reports/system-report.md` | atualizar | Registrar o novo recurso |
| 7 | `Vessie/reports/realotiro.md` | atualizar | Relatório técnico sem IA |

---

## 💡 Código de exemplo

### Botão de preview no codeblock
```js
// js/preview.js (extrato)
function enhance(pre) {
  const code = pre.querySelector('code');
  const lang = detectLang(code);
  if (!PREVIEWABLE.includes(lang)) return; // html, svg, md...
  const head = pre.closest('.codeblock').querySelector('.codeblock-head');
  if (head.querySelector('.code-preview')) return;
  const btn = document.createElement('button');
  btn.className = 'code-preview';
  btn.innerHTML = icon('eye', 12) + ' visualizar';
  btn.addEventListener('click', () => open(code.textContent, lang));
  head.appendChild(btn);
}
```

### Modal com iframe sandbox
```js
function open(content, lang) {
  const src = buildSrcDoc(content, lang);
  els.iframe.srcdoc = src;
  els.overlay.classList.add('open');
}
```

### Drag & drop de arquivos locais
```js
window.addEventListener('dragover', e => { e.preventDefault(); showDropzone(); });
window.addEventListener('drop', async e => {
  e.preventDefault(); hideDropzone();
  const file = e.dataTransfer.files[0];
  if (file && isPreviewable(file.name)) openFile(file);
});
```

---

## ✅ Critérios de aceite

- [ ] Blocos `html`/`svg`/`md` mostram botão "visualizar"
- [ ] Preview abre em modal com iframe seguro (`sandbox`)
- [ ] Suporta arrastar arquivo local e visualizar
- [ ] Botão fechar / ESC / clique no backdrop fecham o modal
- [ ] Não quebra o Markdown/realce existente
- [ ] Recursos JS inline do iframe funcionam (allow-scripts)

---
*Criado pela Vessie-Lib — sistema de preview para LM Studio / Forja*