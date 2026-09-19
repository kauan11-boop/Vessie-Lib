# 📜 Especificação da Linguagem VSL (Vessie Script Language)

> **Versão:** 1.0  
> **Paradigma:** Imperativa + DSL para LLM  
> **Runtime:** Node.js >= 20

---

## Visão Geral

A **VSL (Vessie Script Language)** é uma Domain-Specific Language (DSL) leve criada para orquestrar operações de envio e recebimento de informações com modelos de IA via LM Studio. Sua sintaxe é minimalista e focada em clareza.

---

## Sintaxe

### Comentários
```vsl
# Este é um comentário de linha única
# Todos os comentários começam com #
```

### Configurações
```vsl
config {
  url = "http://localhost:1234/v1"
  model = "deepseek-r1"
  temperature = 0.7
  topP = 0.95
  stream = true
  systemPrompt = "Você é um assistente útil."
}
```

### Envio de Mensagem
```vsl
# Envia uma mensagem de texto
send "Olá, como você está?"

# Com variável
set $msg = "Qual é a previsão do tempo?"
send $msg
```

### Recebimento de Resposta
```vsl
# Recebe resposta não-streaming (completa)
receive

# Recebe em streaming (token a token)
receive stream

# Armazena resposta em variável
receive into $resposta
```

### Variáveis
```vsl
# Define uma variável (prefixo $ obrigatório)
set $nome = "Vessie"
set $contador = 0
set $temperatura = 0.7

# Usa a variável
print $nome
send $nome
```

### Loops
```vsl
# Repete N vezes
loop 3 {
  send "Conte uma curiosidade"
  receive
}

# Loop com variável
set $n = 2
loop $n {
  print "Iteração"
  receive
}
```

### Condicionais
```vsl
set $resposta = ""
receive into $resposta

# contains: verifica se string contém
if $resposta contains "sim" {
  print "Confirmado!"
}

# equals: igualdade
if $resposta equals "não" {
  print "Negado"
}

# else
if $resposta contains "erro" {
  print "Erro detectado"
} else {
  print "Ok"
}

# Comparações numéricas
if $contador > 5 {
  print "Muitas iterações"
}
```

### Batch
```vsl
batch {
  send "Pergunta 1"
  receive

  send "Pergunta 2"
  receive

  send "Pergunta 3"
  receive
}
```

### Espera
```vsl
# Pausa de 1 segundo
wait 1

# Pausa de 500ms
wait 500
```

### Modelos
```vsl
# Lista modelos disponíveis
model list

# Seleciona um modelo
model use "deepseek-r1"
```

### Print
```vsl
print "Olá, mundo!"
print $variavel
```

### Blocos Anônimos
```vsl
{
  send "teste"
  receive
}
```

---

## AST (Abstract Syntax Tree)

O parser converte código VSL em AST com os seguintes tipos de nós:

| Tipo | Campos | Descrição |
|------|--------|-----------|
| `program` | `body:[]` | Nó raiz |
| `config` | `assignments:[]` | Bloco de configuração |
| `send` | `message`, `to?` | Envio de mensagem |
| `receive` | `mode`, `into?` | Recebimento de resposta |
| `set` | `name`, `value` | Definição de variável |
| `loop` | `count`, `body:[]` | Repetição |
| `if` | `condition`, `body:[]`, `elseBody:?` | Condicional |
| `print` | `text` | Saída |
| `batch` | `body:[]` | Grupo de operações |
| `wait` | `duration` | Pausa |
| `model` | `action`, `model?` | Gerenciamento de modelos |
| `block` | `body:[]` | Bloco anônimo |

### Tipos de Valor
| Tipo | Exemplo |
|------|---------|
| `string` | `"texto"` |
| `number` | `42`, `3.14` |
| `boolean` | `true`, `false` |
| `null` | `null`, `none` |
| `var` | `$nome` |
| `identifier` | `identificador` |
| `group` | `(val1, val2)` |

---

## Comandos Disponíveis

| Comando | Descrição | Exemplo |
|--------|-----------|---------|
| `config { ... }` | Define configurações | `config { temperature = 0.7 }` |
| `send "texto"` | Envia mensagem ao modelo | `send "Olá"` |
| `receive` | Recebe resposta | `receive` |
| `receive stream` | Recebe em streaming | `receive stream` |
| `receive into $var` | Armazena resposta | `receive into $res` |
| `set $var = valor` | Define variável | `set $x = "texto"` |
| `loop N { ... }` | Repete N vezes | `loop 3 { send "oi" }` |
| `if $var contains "x"` | Condicional | `if $r contains "sim" { print "ok" }` |
| `print "texto"` | Imprime no console | `print "Pronto"` |
| `batch { ... }` | Grupo de operações | `batch { send "x"; receive }` |
| `wait N` | Pausa | `wait 1` |
| `model list` | Lista modelos | `model list` |
| `model use "id"` | Seleciona modelo | `model use "deepseek-r1"` |

---

## CLI (Command Line Interface)

```bash
# Execução direta
node Vessie/index.js vsl <arquivo.vsl>

# REPL interativo
node Vessie/index.js vsl --interactive
# ou
node Vessie/index.js interactive

# Ajuda
node Vessie/index.js vsl --help
```

### REPL

O REPL interativo permite executar comandos VSL linha por linha:

```
vsl> config { url = "http://localhost:1234/v1" }
vsl> send "Olá"
vsl> receive stream
```

---

## Variáveis Especiais

O runtime expõe variáveis especiais:

| Variável | Descrição |
|----------|-----------|
| `$this.model` | Modelo atualmente selecionado |
| `$this.url` | URL da API do LM Studio |
| `$this.history` | Histórico de mensagens |
| `$this.response` | Última resposta recebida |

---

## Bibliotecas Padrão (libs)

| Biblioteca | Módulo | Exporta |
|-----------|--------|---------|
| utils | `vsl/libs/utils.js` | `uid`, `Logger`, `debounce`, `throttle`, `formatDuration`, `escapeStr`, `isValidUrl`, `ensureDir` |
| tokens | `vsl/libs/tokens.js` | `estimateTokens`, `countMessageTokens`, `countConversationTokens`, `trimConversation`, `fitsInContext`, `tokenStats` |
| http | `vsl/libs/http.js` | `VessieHTTP`, `ConnectionPool`, `ResponseCache` |
| stream | `vsl/libs/stream.js` | `SSEStreamParser` |
| lmstudio | `vsl/libs/lmstudio.js` | `LMStudioClient` |

---

## Exemplos

### hello_world.vsl
```vsl
config {
  url = "http://localhost:1234/v1"
  model = ""
  temperature = 0.7
  systemPrompt = "Você é um assistente conciso e direto."
}

print "Conectando ao LM Studio..."
model list
send "Olá, qual é a capital do Brasil?"
receive
print "Pronto!"
```

### chat_loop.vsl
```vsl
config {
  url = "http://localhost:1234/v1"
  temperature = 0.7
  stream = true
}

set $topic = "programação"
loop 3 {
  send "Conte uma curiosidade sobre "
  receive
}
```

### batch_test.vsl
```vsl
config {
  url = "http://localhost:1234/v1"
  temperature = 0.3
  stream = false
}

batch {
  send "Qual a diferença entre HTTP e HTTPS?"
  receive
  send "O que é um algoritmo?"
  receive
}
```
