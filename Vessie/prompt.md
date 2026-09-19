# 🎯 Prompt Completo — Vessie-Lib Capabilities

> **Documento que explica o que o sistema Vessie pode fazer, o que pode ser melhorado e como utilizá-lo.**

---

## 📌 O que é o Vessie-Lib?

O **Vessie-Lib** é um sistema de otimização para envio e recebimento de informações do modelo de IA (LM Studio). Ele complementa o frontend "Forja" com uma camada Node.js que oferece comunicação otimizada, linguagem de script customizada e ferramentas avançadas.

---

## ✅ O que o Vessie pode fazer?

### 1. Comunicação Otimizada com LM Studio
- **Connection pooling** (keep-alive): reutiliza conexões HTTP para reduzir latência
- **Retry automático** com exponential backoff + jitter (até 3 tentativas)
- **Cache de respostas** (TTL configurável, cache de modelos por 30s)
- **SSE parser otimizado**: correção de chunk boundary, heartbeat monitoring, backpressure handling
- **Token-aware trimming**: sliding window que preserva system prompt e mensagens recentes
- **Batch processing**: envia múltiplas mensagens em paralelo com controle de concorrência
- **Parallel model queries**: compara respostas de múltiplos modelos simultaneamente
- **Adaptive throttling**: ajusta dinamicamente a taxa de renderização baseado no RTT

### 2. Linguagem VSL (Vessie Script Language)
- **DSL leve** para orquestração de operações LLM
- Comandos: `config`, `send`, `receive`, `set`, `loop`, `if`, `print`, `batch`, `wait`, `model`
- Parser + Interpreter + Runtime completos
- REPL interativo (`node Vessie/index.js interactive`)
- Execução de arquivos `.vsl` (`node Vessie/index.js vsl script.vsl`)

### 3. Scripts Individuais com Logs
Cada comando tem seu próprio script e arquivo de log:

| Script | Log | Função |
|--------|-----|--------|
| `scripts/send_message.js` | `logs/send_message.log` | Envia mensagem (non-streaming) |
| `scripts/receive_response.js` | `logs/receive_response.log` | Recebe resposta com estatísticas |
| `scripts/stream_response.js` | `logs/stream_response.log` | Recebe streaming token a token |
| `scripts/list_models.js` | `logs/list_models.log` | Lista modelos (com cache) |
| `scripts/batch_request.js` | `logs/batch_request.log` | Processamento batch |
| `scripts/test_connection.js` | `logs/test_connection.log` | Testa conexão + latência |
| `scripts/config_manager.js` | `logs/config_manager.log` | Gerencia configurações |

### 4. Relatórios Automatizados
- **system-report.md**: análise detalhada do sistema (gerado com IA)
- **realotiro.md**: relatório técnico sem IA para aprimoramento pelo modelo

### 5. Integração Front-end (Browser)
- **js/optimizer.js**: módulo de otimização para o frontend Forja
- Compatível com GitHub Pages (JavaScript puro, sem dependências Node.js)
- SSE parser otimizado para browser
- Cache via localStorage
- Adaptive throttling no cliente

### 6. GitHub Pages
- Arquivo `.nojekyll` configurado
- HTML/CSS/JS puro — pronto para deploy
- PWA configurado (theme-color, viewport, etc.)

---

## 🚀 Como usar?

### CLI (Node.js)
```bash
# Testar conexão
node Vessie/index.js test

# Enviar mensagem
node Vessie/index.js send "Qual é a capital do Brasil?"

# Streaming
node Vessie/index.js stream "Conte uma história"

# Listar modelos
node Vessie/index.js models

# Batch
node Vessie/index.js batch "Pergunta 1" "Pergunta 2"

# Executar script VSL
node Vessie/index.js vsl Vessie/vsl/examples/hello_world.vsl

# REPL interativo
node Vessie/index.js interactive

# Gerenciar configurações
node Vessie/index.js config
node Vessie/index.js config set baseUrl http://localhost:1234/v1
node Vessie/index.js config validate
```

### Scripts individuais
```bash
node Vessie/scripts/send_message.js "Olá"
node Vessie/scripts/stream_response.js "Conte uma história"
node Vessie/scripts/test_connection.js
node Vessie/scripts/list_models.js --refresh
```

### Linguagem VSL
```vsl
config {
  url = "http://localhost:1234/v1"
  model = "deepseek-r1"
  temperature = 0.7
  systemPrompt = "Você é um assistente conciso."
}

send "Qual é a diferença entre IA e ML?"
receive stream
```

### Frontend (Forja)
O arquivo `js/optimizer.js` é carregado automaticamente pelo `index.html` e otimiza:
- A conexão com o LM Studio (keep-alive via fetch)
- O parsing SSE (chunk boundary, heartbeat)
- O gerenciamento de tokens (trim automático)
- O throttle adaptativo

---

## 🔧 Configurações Disponíveis

| Chave | Tipo | Padrão | Descrição |
|-------|------|--------|-----------|
| `baseUrl` | string | `http://localhost:1234/v1` | URL da API do LM Studio |
| `model` | string | `""` | ID do modelo (vazio = primeiro da lista) |
| `temperature` | float | `0.7` | Criatividade (0-2) |
| `topP` | float | `0.95` | Nucleus sampling (0-1) |
| `maxTokens` | int | `-1` | Máximo de tokens (-1 = ilimitado) |
| `timeout` | int | `30000` | Timeout em ms |
| `maxRetries` | int | `3` | Número de tentativas |
| `retryBaseDelay` | int | `500` | Delay base do retry em ms |
| `contextLimit` | int | `4096` | Limite de contexto |
| `reserveForCompletion` | int | `512` | Tokens reservados para resposta |

---

## 🛠️ O que pode ser melhorado?

1. **WebSocket fallback** — Adicionar suporte a WebSocket como alternativa ao SSE
2. **Compression** — Implementar gzip/deflate nas requisições HTTP
3. **Browser compatibility** — Migrar `require()` para ESM para uso direto no browser
4. **Prompt templates** — Sistema de templates para prompts recorrentes
5. **Metrics dashboard** — Dashboard web de métricas de performance
6. **Testes unitários** — Cobertura de testes para parser.js e stream.js
7. **Model routing** — Rotear mensagens automaticamente ao modelo mais adequado
8. **WebSocket streaming** — Streaming bidirecional para interações em tempo real
9. **Local storage enhanced** — Cache avançado de conversas no browser
10. **Offline mode** — Modo offline com fila de mensagens para sincronizar quando online

---

## 📁 Estrutura do Projeto

```
Vessie-Lib/
├── index.html                    # Frontend Forja (GitHub Pages)
├── css/                          # Estilos
├── js/
│   ├── app.js                    # Lógica principal do chat
│   ├── responsive.js             # Responsividade
│   └── optimizer.js              # Módulo de otimização (browser)
├── Vessie/                       # Sistema Vessie (Node.js)
│   ├── index.js                  # Entry point CLI
│   ├── CREATION_ORDER.md         # Ordem de criação
│   ├── config/vessie.config.json # Configurações
│   ├── core/optimizer.js         # Pipeline otimizado
│   ├── vsl/                      # Linguagem VSL
│   ├── scripts/                  # Scripts individuais
│   ├── logs/                     # Arquivos de log
│   └── reports/                  # Relatórios
├── package.json                  # Config Node.js
├── .nojekyll                     # GitHub Pages
├── VSL.md                        # Especificação VSL
└── CREATION_ORDER.md             # (raíz) Documento de planejamento
```
