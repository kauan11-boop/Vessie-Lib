# Vessie-Lib 🌟

> **Sistema otimizado de envio e recebimento de informações do modelo de IA (LM Studio)**

Um sistema completo que otimiza a comunicação com modelos de linguagem via LM Studio, incluindo uma linguagem de programação customizada (VSL), connection pooling, retry com backoff, streaming eficiente, cache e processamento em lote.

---

## 🚀 Recursos

- **🔌 Connection Pooling** — Keep-alive reutilizável reduz latência
- **🔄 Retry com Backoff** — Exponential backoff + jitter (3 tentativas)
- **💾 Cache de Respostas** — TTL configurável (modelos: 30s)
- **🌊 Streaming Otimizado** — SSE parser com chunk boundary, heartbeat, backpressure
- **🧠 Token-aware Trimming** — Sliding window preserva system prompt + mensagens recentes
- **📦 Batch Processing** — Múltiplas requisições em paralelo
- **⚖️ Adaptive Throttling** — Throttle dinâmico baseado no RTT
- **📜 VSL (Vessie Script Language)** — DSL customizada para orquestração LLM
- **📝 Scripts Individuais** — Um por comando, cada um com log próprio
- **📊 Relatórios Automatizados** — System report + realotiro técnico
- **📱 GitHub Pages Ready** — Frontend puro, PWA configurada

---

## 📦 Instalação

```bash
# Clone o repositório
git clone https://github.com/kauan11-boop/Vessie-Lib.git
cd Vessie-Lib

# Requer Node.js >= 20 (fetch nativo)
node --version  # deve ser >= 20
```

Nenhuma dependência externa é necessária (`npm install` não é obrigatório).

---

## 🎯 Uso Rápido

### CLI
```bash
# Testar conexão
node Vessie/index.js test

# Enviar mensagem (resposta completa)
node Vessie/index.js send "Qual é a capital do Brasil?"

# Streaming token a token
node Vessie/index.js stream "Conte uma história curta"

# Listar modelos
node Vessie/index.js models

# Batch processing
node Vessie/index.js batch "Qual é 2+2?" "Qual é a raiz de 16?" "Quantos planetas há no sistema solar?"

# Usar linguagem VSL
node Vessie/index.js vsl Vessie/vsl/examples/hello_world.vsl

# REPL interativo
node Vessie/index.js interactive
```

### Scripts Individuais
```bash
node Vessie/scripts/send_message.js "Olá, mundo!"
node Vessie/scripts/receive_response.js "Explique machine learning"
node Vessie/scripts/stream_response.js "Conte uma piada"
node Vessie/scripts/list_models.js --refresh
node Vessie/scripts/batch_request.js "Pergunta 1" "Pergunta 2" --parallel=3
node Vessie/scripts/test_connection.js
node Vessie/scripts/config_manager.js set baseUrl http://localhost:1234/v1
```

### Linguagem VSL
```vsl
config {
  url = "http://localhost:1234/v1"
  model = "deepseek-r1"
  temperature = 0.7
  systemPrompt = "Você é um assistente conciso e direto."
}

print "Conectando ao LM Studio..."
model list

send "Qual é a diferença entre HTTP e HTTPS?"
receive stream

loop 3 {
  send "Conte uma curiosidade sobre IA"
  receive
}
```

---

## 📁 Estrutura do Projeto

```
Vessie-Lib/
├── index.html                     # Frontend Forja (GitHub Pages)
├── css/
│   ├── style.css                  # Estilos desktop
│   └── responsive.css             # Media queries mobile
├── js/
│   ├── app.js                     # Lógica principal do chat (720 linhas)
│   ├── responsive.js              # Responsividade (228 linhas)
│   └── optimizer.js               # Módulo de otimização (browser)
├── Vessie/
│   ├── index.js                   # Entry point CLI
│   ├── CREATION_ORDER.md          # Ordem de criação
│   ├── config/
│   │   └── vessie.config.json     # Configurações do sistema
│   ├── core/
│   │   └── optimizer.js           # Pipeline otimizado (Node.js)
│   ├── vsl/
│   │   ├── vsl.js                 # CLI entry (VSL)
│   │   ├── parser.js              # Parser VSL → AST
│   │   ├── interpreter.js         # Interpreter AST → execução
│   │   ├── runtime.js             # Runtime (variáveis, estado)
│   │   ├── libs/
│   │   │   ├── utils.js           # Utilitários (uid, Logger, etc.)
│   │   │   ├── tokens.js          # Contagem de tokens + trimming
│   │   │   ├── http.js            # HTTP client (pool, retry, cache)
│   │   │   ├── stream.js          # SSE parser otimizado
│   │   │   └── lmstudio.js        # Cliente LM Studio
│   │   └── examples/
│   │       ├── hello_world.vsl    # Exemplo básico
│   │       ├── chat_loop.vsl      # Loop de conversa
│   │       └── batch_test.vsl     # Batch processing
│   ├── scripts/                   # Scripts individuais
│   │   ├── send_message.js
│   │   ├── receive_response.js
│   │   ├── stream_response.js
│   │   ├── list_models.js
│   │   ├── batch_request.js
│   │   ├── test_connection.js
│   │   └── config_manager.js
│   ├── logs/                      # Arquivos de log (gerados em runtime)
│   └── reports/
│       ├── system-report.md       # Relatório do sistema
│       └── realotiro.md           # Relatório técnico sem IA
├── package.json                   # Configuração Node.js
├── .nojekyll                      # GitHub Pages
├── VSL.md                         # Especificação da linguagem VSL
├── CREATION_ORDER.md              # Ordem de criação
└── Vessie/prompt.md               # Documento de capabilities

```

---

## ⚙️ Configuração

Edite `Vessie/config/vessie.config.json`:

```json
{
  "baseUrl": "http://localhost:1234/v1",
  "model": "",
  "temperature": 0.7,
  "topP": 0.95,
  "maxTokens": -1,
  "maxRetries": 3,
  "retryBaseDelay": 500,
  "timeout": 30000,
  "stream": {
    "enabled": true,
    "highWaterMark": 65536,
    "throttleMs": 30,
    "heartbeatMs": 15000
  }
}
```

---

## 📊 Métricas

O sistema rastreia:
- Latência de conexão (ms)
- Tokens de entrada/saída
- Tokens por segundo (tok/s)
- Número de retries
- Hits/misses de cache
- Status de heartbeat

---

## 📄 Licença

MIT

---

## 🙏 Créditos

- [Forja](https://github.com/kauan11-boop/Vessie-Lib) — Interface web original
- [LM Studio](https://lmstudio.ai/) — Backend de modelos locais
- [Marked.js](https://github.com/markedjs/marked) — Markdown rendering
- [DOMPurify](https://github.com/turndesk/turndesk) — Sanitização HTML
- [Highlight.js](https://highlightjs.org/) — Code highlighting
