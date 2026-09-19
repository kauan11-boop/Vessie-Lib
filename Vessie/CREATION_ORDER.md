# 📋 Ordem de Criação do Sistema Vessie

> **Antes de editar qualquer arquivo, este documento define o que será feito, códigos de exemplo e a ordem de criação.**

## Visão Geral

O **Sistema Vessie** implementa um sistema mais otimizado de enviar e receber informações do modelo de IA (LM Studio) através de:
- Uma linguagem de programação customizada (VSL - Vessie Script Language)
- Módulos otimizados de comunicação (connection pooling, streaming eficiente, retry, cache)
- Scripts individuais com logs para cada operação
- Relatórios técnicos automatizados
- O site é compatível com GitHub Pages (hospedagem estática)

## Ordem de Criação dos Arquivos

### Fase 1 — Infraestrutura Base
| # | Caminho | Descrição | Exemplo de uso |
|---|---------|-----------|----------------|
| 1 | `package.json` | Configuração do projeto Node.js | `node Vessie/index.js` |
| 2 | `Vessie/config/vessie.config.json` | Configurações padrão do sistema | `baseUrl`, `model`, `timeout` |
| 3 | `.nojekyll` | Desativa Jekyll no GitHub Pages | Necessário para GitHub Pages |

### Fase 2 — Linguagem VSL (Vessie Script Language)
| # | Caminho | Descrição | Exemplo de uso |
|---|---------|-----------|----------------|
| 4 | `Vessie/vsl/vsl.js` | Entry point da linguagem VSL | `new VSL().runFile('script.vsl')` |
| 5 | `Vessie/vsl/parser.js` | Parser: converte texto VSL em AST | `parse("send \"oi\"")` |
| 6 | `Vessie/vsl/interpreter.js` | Interpreter: executa AST com libs | `interpret(ast)` |
| 7 | `Vessie/vsl/runtime.js` | Runtime: contexto e variáveis globais | `runtime.set('model', '...')` |

### Fase 3 — Bibliotecas VSL (Libs)
| # | Caminho | Descrição | Exemplo de uso |
|---|---------|-----------|----------------|
| 8 | `Vessie/vsl/libs/utils.js` | Utilitários (UID, log, formatação) | `utils.uid()` |
| 9 | `Vessie/vsl/libs/tokens.js` | Contagem e limites de tokens | `tokens.count(text)` |
| 10 | `Vessie/vsl/libs/http.js` | Cliente HTTP otimizado (pooling, retry) | `http.post(url, body)` |
| 11 | `Vessie/vsl/libs/stream.js` | Parser SSE otimizado | `stream.parseSSE(reader)` |
| 12 | `Vessie/vsl/libs/lmstudio.js` | Integração LM Studio (envio/recebimento) | `lmstudio.chat(messages)` |

### Fase 4 — Módulo Core (Sistema Otimizado)
| # | Caminho | Descrição | Exemplo de uso |
|---|---------|-----------|----------------|
| 13 | `Vessie/core/optimizer.js` | Pipeline otimizado send/receive | `optimizer.chat(messages)` |
| 14 | `Vessie/index.js` | Entry point do sistema Vessie | `node Vessie/index.js` |

### Fase 5 — Scripts Individuais (com logs)
| # | Caminho | Log | Descrição |
|---|---------|-----|-----------|
| 15 | `Vessie/scripts/send_message.js` | `logs/send_message.log` | Envia mensagem ao modelo |
| 16 | `Vessie/scripts/receive_response.js` | `logs/receive_response.log` | Recebe resposta (non-stream) |
| 17 | `Vessie/scripts/stream_response.js` | `logs/stream_response.log` | Recebe resposta (streaming) |
| 18 | `Vessie/scripts/list_models.js` | `logs/list_models.log` | Lista modelos disponíveis |
| 19 | `Vessie/scripts/batch_request.js` | `logs/batch_request.log` | Processa batch de requisições |
| 20 | `Vessie/scripts/test_connection.js` | `logs/test_connection.log` | Testa conexão com LM Studio |
| 21 | `Vessie/scripts/config_manager.js` | `logs/config_manager.log` | Gerencia configurações |

### Fase 6 — Exemplos VSL
| # | Caminho | Descrição |
|---|---------|-----------|
| 22 | `Vessie/vsl/examples/hello_world.vsl` | Exemplo básico |
| 23 | `Vessie/vsl/examples/chat_loop.vsl` | Loop de conversa |
| 24 | `Vessie/vsl/examples/batch_test.vsl` | Batch processing |

### Fase 7 — Relatórios e Documentação
| # | Caminho | Descrição |
|---|---------|-----------|
| 25 | `Vessie/reports/system-report.md` | Relatório do sistema atual |
| 26 | `Vessie/reports/realotiro.md` | Relatório técnico sem IA |
| 27 | `Vessie/prompt.md` | Prompt completo explicando capacidades |
| 28 | `Vessie/README.md` | Documentação completa |
| 29 | `VSL.md` | Especificação da linguagem VSL |

### Fase 8 — Integração com Forja (frontend + GitHub Pages)
| # | Caminho | Descrição |
|---|---------|-----------|
| 30 | `js/optimizer.js` | Módulo de otimização para o frontend do Forja |
| 31 | `index.html` | Atualizado para incluir `js/optimizer.js` |

---
*Criado pela Vessie-Lib — sistema de otimização para LM Studio*
