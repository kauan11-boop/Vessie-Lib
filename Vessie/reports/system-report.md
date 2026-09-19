# 📊 Relatório do Sistema — Forja + Vessie-Lib

> **Gerado por:** Vessie-Lib System Reporter  
> **Data:** 2026-09-19  
> **Sistema:** Forja — chat cliente para LM Studio  
> **Ambiente:** GitHub Pages (hospedagem estática)

---

## 1. Visão Geral do Sistema

### 1.1 O que é o Forja?

O **Forja** é uma aplicação web cliente de chat projetada para se conectar ao **LM Studio** — uma plataforma local para execução de modelos de linguagem de grande porte (LLM). A aplicação funciona como uma interface de usuário moderna que permite conversar com modelos locais via API compatível com OpenAI.

### 1.2 Arquitetura Atual

```
┌─────────────────────────────────────────────────────────┐
│                    Navegador (Browser)                   │
├─────────────────────────────────────────────────────────┤
│  Forja (index.html)                                      │
│  ├── css/style.css, css/responsive.css                  │
│  ├── js/app.js          ← lógica principal (720 linhas) │
│  ├── js/responsive.js   ← responsividade (228 linhas)  │
│  └── [CDN] marked.js, dompurify.js, highlight.js       │
└──────────────┬──────────────────────────────────────────┘
               │ HTTP (fetch API)
               ▼
┌─────────────────────────────────────────────────────────┐
│                 LM Studio (localhost:1234)              │
│  ┌─────────────────────────────────────────────────┐   │
│  │  GET  /v1/models                    → lista      │   │
│  │  POST /v1/chat/completions          → streaming  │   │
│  │         (SSE: data: {...}\n\n[DONE])            │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

### 1.3 Principais Componentes

| Arquivo               | Tamanho | Função                                      |
|-----------------------|---------|---------------------------------------------|
| `index.html`          | ~200 linhas | Estrutura HTML + metadados PWA         |
| `js/app.js`           | ~720 linhas | Lógica de chat, API, UI, eventos       |
| `js/responsive.js`    | 228 linhas | Responsividade, toque, viewport         |
| `js/optimizer.js`     | 650 linhas | Otimização (SSE, cache, trimming)      |
| `js/preview.js`       | 314 linhas | Preview de HTML/SVG/Markdown (NOVO)     |
| `css/style.css`       | 229 linhas | Estilos base (desktop)                  |
| `css/responsive.css`  | 246 linhas | Media queries (mobile/tablet)           |
| `css/preview.css`     | ~96 linhas | Estilos do modal de preview (NOVO)     |

### 1.4 Funcionalidades do Forja

- ✅ Listagem de conversas (persistidas no localStorage)
- ✅ Conexão com LM Studio (API compatível com OpenAI)
- ✅ Streaming token-a-token (SSE parsing manual)
- ✅ Suporte a reasoning_content (modelos como DeepSeek-R1)
- ✅ Markdown rendering (marked.js + DOMPurify)
- ✅ Code highlighting (highlight.js)
- ✅ Tema dark com design moderno
- ✅ Responsivo (mobile, tablet, desktop)
- ✅ PWA (web app capable, theme-color)
- ✅ Exportação em Markdown
- ✅ Edição de mensagens
- ✅ Regeneração de respostas
- ✅ **Preview de arquivos/código** (HTML, SVG, Markdown, XML) em modal com iframe sandbox
- ✅ **Drag & drop** de arquivos locais para visualização imediata

---

## 2. Sistema Vessie — Novo Sistema de Otimização

### 2.1 Visão Geral

O **Sistema Vessie** foi criado como uma camada de otimização que melhora o envio e recebimento de informações ao modelo de IA. Ele consiste em:

- **VSL (Vessie Script Language):** linguagem de programação customizada leve
- **Módulo Core (Optimizer):** pipeline otimizado de comunicação
- **Bibliotecas:** HTTP, Stream SSE, Tokens, Utils
- **Scripts individuais:** um por comando, com logs

### 2.2 Otimizações Implementadas

| # | Otimização                          | Localização                          | Descrição                           |
|---|-------------------------------------|------------------------------------------------------------|-------------------------------------|
| 1 | Connection pooling (keep-alive)     | `libs/http.js` → `ConnectionPool` | Reutiliza sockets HTTP            |
| 2 | Retry com exponential backoff       | `libs/http.js` → `VessieHTTP`     | Retry automático com jitter       |
| 3 | Cache de respostas (TTL)            | `libs/http.js` → `ResponseCache`  | Cache de LIST models (30s)        |
| 4 | SSE Parser otimizado                | `libs/stream.js` → `SSEStreamParser` | Chunk boundary + heartbeat  |
| 5 | Heartbeat monitoring                | `libs/stream.js`                  | Detecta conexões mortas           |
| 6 | Backpressure handling               | `libs/stream.js`                  | Pausa quando buffer > 2x HWM      |
| 7 | Token-aware trimming                | `libs/tokens.js` → `trimConversation` | Sliding window de histórico  |
| 8 | Batch processing                    | `core/optimizer.js` → `batch()`   | Paralelismo controlável           |
| 9 | Parallel model queries              | `core/optimizer.js` → `compareModels()` | Compara N modelos          |
| 10| Adaptive throttling                 | `core/optimizer.js` → `_adaptiveThrottleMs()` | Baseado em RTT     |

### 2.3 Linguagem VSL (Vessie Script Language)

Uma DSL (Domain-Specific Language) leve para orquestração de operações LLM:

```vsl
config {
  url = "http://localhost:1234/v1"
  model = "deepseek-r1"
  temperature = 0.7
}
send "Olá, como você está?"
receive stream
model list
```

**Comandos suportados:**
- `config { key = value; }` — configurações
- `send "texto"` — envia mensagem
- `receive [stream] [into $var]` — recebe resposta
- `set $var = value` — variáveis
- `loop N { ... }` — repetição
- `if $var contains "x" { }` — condicional
- `print "texto"` — saída
- `batch { ... }` — grupo de operações
- `wait N` — pausa
- `model list` / `model use "id"` — gerenciamento de modelos

---

## 3. O que foi melhorado

### 3.1 Antes (Forja original)
- Conexão única por requisição (sem keep-alive)
- SSE parsing manual sem heartbeat
- Retry não implementado (falha imediata)
- Sem cache de modelos
- Sem gerenciamento inteligente de tokens
- Sem batch processing
- Limitado a uma única conversa

### 3.2 Depois (Vessie)
- Connection pool com keep-alive (`http.Agent` configurado)
- SSE parser com chunk boundary correction + heartbeat
- Retry com exponential backoff + jitter (3 tentativas)
- Cache de modelos (TTL 30s) e cache de respostas GET
- Token-aware trimming (sliding window, preserva system prompt)
- Batch processing com controle de paralelismo
- Comparação paralela de modelos
- Throttle adaptativo baseado em RTT
- Linguagem VSL para automação de workflows
- Scripts individuais com logs estruturados
- Entry point CLI unificado (`node Vessie/index.js`)
- **Sistema de preview** (`js/preview.js`): botão "visualizar" em codeblocks HTML/SVG/MD + modal com iframe sandbox + drag & drop de arquivos locais

---

## 4. Integração com GitHub Pages

O site Forja é compatível com GitHub Pages pois:
- Usa apenas HTML, CSS e JavaScript puro (sem build)
- Arquivo `.nojekyll` criado para desativar Jekyll
- CDN externa para dependências (marked.js, dompurify, highlight.js)
- Configuração PWA (theme-color, viewport, etc.)

O sistema Vessie (Node.js) roda localmente ou no servidor, complementando o frontend.

---

## 5. Próximos passos / Melhorias sugeridas

1. **Integração direta VSL → Forja:** permitir que scripts VSL sejam carregados via frontend
2. **WebSocket fallback:** para conexões onde SSE falha
3. **Worker threads:** para processar SSE em background sem bloquear UI
4. **Compression:** suporte a gzip/deflate nas requisições
5. **Model routing:** roteamento automático baseado no conteúdo da mensagem
6. **Prompt templates:** sistema de templates para prompts recorrentes
7. **Metrics dashboard:** dashboard de métricas de performance
8. **Preview avançado:** detecção de encoding (BOM/Latin-1), "abrir em nova aba" via Blob URL, pretty-print de JSON e realce de sintaxe dentro do iframe
9. **Sandbox configurável:** permitir alternar `allow-scripts` por parâmetro na visualização

---
*Relatório gerado automaticamente pelo sistema Vessie-Lib*
