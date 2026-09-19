# Realotiro Técnico — Vessie-Lib (Sem IA)

> **Tipo:** Relatório técnico objetivo (gerado sem inteligência artificial)  
> **Objetivo:** Fornecer ao modelo de IA uma visão precisa e detalhada do sistema para aprimoramento  
> **Data:** 2026-09-19  
> **Projeto:** Vessie-Lib — Sistema otimizado de envio/recebimento de LM Studio  

---

## Estrutura de Arquivos

```
Vessie-Lib/
├── index.html                              — UI do Forja
├── PREVIEW_ORDER.md                        — ordem de criação do preview
├── css/
│   ├── style.css                           [229 linhas] — estilos desktop
│   ├── responsive.css                      [246 linhas] — media queries mobile
│   └── preview.css                         — estilos do preview de arquivos
├── js/
│   ├── app.js                              — lógica principal
│   ├── optimizer.js                        — otimização browser
│   ├── preview.js                          — preview de HTML/SVG/MD
│   └── responsive.js                       — responsividade
├── Vessie/
│   ├── CREATION_ORDER.md                  — ordem de criação
│   ├── index.js                           [entry point CLI]
│   ├── config/
│   │   └── vessie.config.json             — configurações
│   ├── core/
│   │   └── optimizer.js                   [Optimizer class]
│   ├── vsl/
│   │   ├── vsl.js                         [CLI entry]
│   │   ├── parser.js                      [VSLParser class]
│   │   ├── interpreter.js                 [VSLInterpreter class]
│   │   ├── runtime.js                     [VSLRuntime class]
│   │   ├── libs/
│   │   │   ├── utils.js                   [uid, Logger, debounce, throttle]
│   │   │   ├── tokens.js                  [estimateTokens, trimConversation]
│   │   │   ├── http.js                    [VessieHTTP, ConnectionPool, ResponseCache]
│   │   │   ├── stream.js                  [SSEStreamParser]
│   │   │   └── lmstudio.js                [LMStudioClient]
│   │   └── examples/
│   │       ├── hello_world.vsl
│   │       ├── chat_loop.vsl
│   │       └── batch_test.vsl
│   ├── scripts/
│   │   ├── send_message.js
│   │   ├── receive_response.js
│   │   ├── stream_response.js
│   │   ├── list_models.js
│   │   ├── batch_request.js
│   │   ├── test_connection.js
│   │   └── config_manager.js
│   ├── logs/                              [gerado em runtime]
│   └── reports/
│       ├── system-report.md               [relatório com IA]
│       └── realotiro.md                   [este arquivo]
├── package.json                           — config Node.js
├── .nojekyll                              — GitHub Pages
├── VSL.md                                 — especificação VSL
└── Vessie/prompt.md                        — capabilities

DEPENDÊNCIAS:
  - Node.js >= 20
  - fetch (native, Node 18+)
  - http/https (Node built-in)
  - crypto (Node built-in)

NENHUMA dependência externa (npm install) é necessária.
```

---

## API Endpoints do LM Studio

| Método | Endpoint              | Request Body                                          | Response                              |
|--------|-----------------------|-------------------------------------------------------|---------------------------------------|
| GET    | `/v1/models`          | (nenhum)                                              | `{ data: [{ id, format, size }] }`   |
| POST   | `/v1/chat/completions`| `{ model, messages, temperature, top_p, max_tokens, stream }` | JSON ou SSE streaming            |

### SSE Streaming Format
```
data: {"id":"...","object":"chat.completion.chunk","choices":[{"delta":{"content":"texto"}}]}
data: {"id":"...","choices":[{"delta":{"reasoning_content":"pensamento"}}]}
data: [DONE]
```

---

## Código-Fonte Analisado

### js/preview.js — Módulo de preview (novo)

**enhanceCodeBlocks() → FilePreview.enhance(pre):**
```javascript
// app.js injeta o botão "visualizar" em blocos previewáveis
if(window.FilePreview && window.FilePreview.enhance) {
  try { window.FilePreview.enhance(pre); } catch {}
}
```
- **Linguagens previewáveis:** `html`, `htm`, `svg`, `xml`, `md`, `markdown`, `xhtml`
- **Tipos de renderização:** HTML completo/fragmento (iframe `srcdoc`), SVG centralizado, Markdown via marked+DOMPurify, texto em `<pre>`
- **Segurança:** iframe `sandbox="allow-scripts allow-forms allow-modals allow-popups"` + `referrerpolicy="no-referrer"`
- **Entrada adicional:** drag & drop de arquivos locais (`.html`, `.svg`, `.md`, `.xml`, `.txt`, `.json`, `.css`, `.js`)
- **Limitações:** iframe com `allow-scripts` sem `allow-same-origin` (scripts não acessam o DOM pai — correto); downloads usam Blob; sem detecção de encoding além de UTF-8 default
- **Melhoria aplicada:** preview integrado sem bundler, compatível com GitHub Pages

---

### js/app.js — Linhas críticas

**checkConnection() — linhas 132-142:**
```javascript
async function checkConnection(url){
  const t0 = performance.now();
  try{
    const res = await fetch(url.replace(/\/+$/,'') + '/models', {signal: timeoutSignal(5000)});
    if(!res.ok) throw new Error('HTTP ' + res.status);
    const j = await res.json();
    return {ok:true, ms:Math.round(performance.now() - t0), models:(j.data || []).map(m => m.id)};
  }catch(e){
    return {ok:false, err: e.name === 'AbortError' ? 'tempo esgotado' : e.message};
  }
}
```
- **Limitações:** sem retry, sem keep-alive, timeout fixo 5s, sem cache
- **Melhoria aplicada:** VessieHTTP com retry exponencial, cache TTL, keep-alive

**generate() — linhas 450-564:**
```javascript
const res = await fetch(state.settings.baseUrl.replace(/\/+$/,'') + '/chat/completions', {
  method:'POST',
  headers:{'Content-Type':'application/json'},
  body: JSON.stringify(body),
  signal: state.controller.signal
});
```
- **SSE parsing manual** — linhas 511-531:
```javascript
const reader = res.body.getReader();
const dec = new TextDecoder();
let buf = '';
while(true){
  const {done, value} = await reader.read();
  if(done) break;
  buf += dec.decode(value, {stream:true});
  let idx;
  while((idx = buf.indexOf('\n')) >= 0){
    const line = buf.slice(0, idx).trim();
    buf = buf.slice(idx + 1);
    if(!line.startsWith('data:')) continue;
    // ... parse JSON
  }
}
```
- **Limitações:** sem heartbeat, sem backpressure, sem retry, throttle fixo 60ms
- **Melhoria aplicada:** SSEStreamParser com heartbeat, backpressure, chunk boundary correct

---

## Problemas Identificados (Technical Debt)

1. **app.js:911** — `setInterval` para ping a cada 20s, mas sem backoff exponencial em falhas
2. **app.js:484** — `model: state.settings.model || state.models[0] || 'local-model'` — fallback genérico pode falhar
3. **app.js:488** — `max_tokens` envia `-1` quando não configurado; alguns servidores podem rejeitar
4. **app.js:524** — `payload === '[DONE]' continue;` — ignora o evento DONE, não emite evento de conclusão
5. **app.js:538** — `am.stats = {dur, tokens: usage?.completion_tokens || Math.round(am.content.length / 3.8)}` — fallback de token não preciso
6. **http.js:103** — `res.ok` não distingue 4xx (cliente) de 5xx (servidor); retry só para 5xx
7. **stream.js: parser** — sem verificação de duplicidade de chunks
8. **runtime.js:60** — `eval()` usado em condicionais (injection risk)
9. **lmstudio.js:101** — `_chatStream` como generator async — implementação incompleta (processReader não yield token a token)
10. **Todas as libs usam `require()`** — não compatíveis com o frontend browser sem bundler

---

## Métricas de Performance (esperadas)

| Métrica                  | Before (Forja)    | After (Vessie)    |
|--------------------------|--------------------|--------------------|
| Latência de conexão      | ~100-500ms         | ~50-200ms (pool)   |
| Retry em falha           | Não               | 3x (backoff)       |
| Cache de modelos         | Não               | 30s TTL            |
| Heartbeat SSE            | Não               | Sim (15s)          |
| Backpressure             | Não               | Sim                |
| Token trimming           | Não               | Sliding window     |
| Batch processing         | Não               | Sim (paralelo)     |
| Adaptive throttle        | Fixo 60ms          | Baseado em RTT     |

---

## Sistema de Preview de Arquivos (NOVO — 2026-09-19)

| Aspecto | Implementação |
|---------|---------------|
| Arquivo principal | `js/preview.js` (módulo IIFE, API global `FilePreview`) |
| Estilos | `css/preview.css` |
| Ativação nos codeblocks | `app.js → enhanceCodeBlocks()` chama `FilePreview.enhance(pre)` |
| Modal | iframe `sandbox` com `srcdoc` construído dinamicamente |
| Drag & drop | listeners globais em `window` (`dragenter`/`dragover`/`dragleave`/`drop`) |
| Tipos suportados | html, htm, xhtml, svg, md, markdown, xml, txt, json, css, js |
| Ícones | `window.icon('eye', n)` (exposto por `app.js`) com fallback inline |
| Acessibilidade | `role="dialog"`, `aria-modal`, fechamento por ESC/clique no backdrop |
| Persistência | nenhuma (preview é efêmero, não polui o localStorage) |

### Fluxo de dados do preview
```
[modelo gera bloco de código]
        │
        ▼
marked.parse() → DOMPurify → HTML com <pre><code class="language-html">
        │
        ▼
app.js: enhanceCodeBlocks() embrulha em .codeblock e chama FilePreview.enhance(pre)
        │
        ▼
FilePreview.enhance() detecta a linguagem → adiciona botão "visualizar"
        │
        ▼
[clique] → FilePreview.open(content, lang) → buildSrcDoc() → iframe.srcdoc
        │
        ▼
modal .preview-overlay.open (iframe sandbox renderiza o resultado)
```

---

## Pontos para Aprimoramento (enviados ao IA)

> **Este relatório será enviado ao modelo de IA com o objetivo de aprimorar o sistema.**
> O IA deve focar em:
> 1. Completar a implementação de `_chatStream` no lmstudio.js (generator async incompleto)
> 2. Adicionar suporte a WebSocket como fallback para SSE
> 3. Implementar compression (gzip/deflate) nas requisições HTTP
> 4. Migrar utils.js de `require()` para formato browser-compatible (ESM)
> 5. Implementar prompt templates e model routing
> 6. Criar dashboard de métricas
> 7. Adicionar testes unitários para parser.js e stream.js
> 8. Preview: detectar codificação de arquivos (UTF-8 / Latin-1 / BOM) antes do `readAsText`
> 9. Preview: botão "abrir em nova aba" via Blob URL (hoje só há download e iframe interno)
> 10. Preview: suporte a JSON formatado (pretty-print) e realce de sintaxe no iframe
> 11. Preview: sandbox configurável (permitir/negar scripts por parâmetro)
> 12. Preview: suportar assets relativos em fragmentos HTML (CSS/JS embutidos já funcionam)
