# Vessie

> **A linguagem de programação feita para web/UI.** Compila `.vessie` para JavaScript, gera páginas prontas com HTML+CSS+runtime embutidos e roda com apenas **Node.js ≥ 20** — sem `npm install`, sem configuração, sem dependências.

```
.vessie  →  Lexer → Parser → AST → Semântica/Tipos → JS (+ source map) → Web (HTML/CSS/JS + runtime)
```

---

## Índice

- [O que é](#o-que-é)
- [Requisitos](#requisitos)
- [Início rápido](#início-rápido)
- [A linguagem](#a-linguagem)
- [UI declarativa](#ui-declarativa)
- [Estado reativo](#estado-reativo)
- [Biblioteca padrão](#biblioteca-padrão)
- [JavaScript, CSS e HTML diretos](#javascript-css-e-html-diretos)
- [CLI `vessie`](#cli-vessie)
- [API programática](#api-programática)
- [Execução multilinguagem](#execução-multilinguagem)
- [Adaptação C# → Vessie](#adaptação-c--vessie)
- [Assistente de IA local](#assistente-de-ia-local)
- [Multi-Base (variações de scripts)](#multi-base-variações-de-scripts)
- [Segurança](#segurança)
- [Estado das funcionalidades](#estado-das-funcionalidades)
- [Documentação](#documentação)
- [Como contribuir](#como-contribuir)

---

## O que é

**Vessie** é uma linguagem de programação declarativa para construir aplicações web e interfaces. Você descreve o estado e a UI, e o compilador gera um site completo — HTML, CSS, runtime reativo e JavaScript — pronto para abrir no navegador.

A distribuição principal é o **`VessieLang.js`**: o sistema inteiro (compilador, CLI, runtime, biblioteca padrão e documentação) em **um único arquivo**. Basta o Node.js para compilar, rodar, servir e testar código `.vessie` em qualquer lugar.

Pontos-chave:

- **Um arquivo, zero dependências** — `node VessieLang.js <comando>` funciona em qualquer máquina com Node ≥ 20.
- **UI declarativa** — componentes (`page`, `column`, `card`, `button`, `input`, `modal`, `tabs`, `table`…) com props, eventos e `bind:` bidirecional.
- **Estado reativo profundo** — alterou o `state`, a UI se atualiza (patch incremental do DOM, sem re-render completo).
- **JS/CSS/HTML compatíveis** — blocos `css`, `js` e `html` permitem JavaScript verbatim, CSS customizado e markup próprio dentro da linguagem.
- **Multilíngue** — gera e executa scripts em Python, Node.js, C, C++, C# e HTML/CSS pela Multi-Base.
- **Assistente de IA local** — `vessie ai` melhora pedidos para modelos pequenos, offline.

---

## Requisitos

- **Node.js ≥ 20** (obrigatório).
- Opcionais, apenas para recursos específicos:
  - `python3`/`python` — adaptador Python e Multi-Base.
  - `gcc`/`cc` e `g++`/`c++` — adaptadores C e C++.
  - `.NET SDK` — adaptador C# (`vessie cs run`).
  - `git` — integração `vessie git`.

Use `vessie doctor` para verificar tudo de uma vez.

---

## Início rápido

### 1. Baixe o `VessieLang.js`

```bash
git clone <este-repositório>
cd <repositório>
node VessieLang.js --help
```

No Windows, use o `Vessie.bat` (ele gera o `VessieLang.js` automaticamente se estiver ausente):

```cmd
Vessie --help
```

### 2. Crie um projeto

```bash
node VessieLang.js create meu-app
cd meu-app
node ../VessieLang.js run
```

Abra <http://127.0.0.1:5173> — a UI é recarregada ao salvar (`run` recompila automaticamente; recarregue o navegador).

### 3. Compile, teste, distribua

```bash
node ../VessieLang.js check src/main.vessie           # diagnósticos
node ../VessieLang.js build --single --out dist       # UM .js autocontido + index.html
node ../VessieLang.js test                            # arquivos *.test.vessie
```

---

## A linguagem

### Estrutura básica

```vessie
app MeuApp

// Estado (só no nível superior). Mudanças re-renderizam a UI.
state count: number = 0
state nome: string = ""

// Valores derivados: recalculados a cada render.
computed dobro: number = count * 2

// Funções (síncronas ou `async fn`).
fn incrementar() { count += 1 }

async fn buscar() {
  const r = await http.getJson("https://exemplo.com/dados")
  print(r.data)
}

// Interface declarativa.
ui App {
  page "MeuApp" {
    column gap: 16 {
      heading "Contador"
      text `Valor: ${count} (dobro: ${dobro})`
      button "Incrementar" on:click incrementar
    }
  }
}
```

### Tipos

| Tipo | Exemplo |
|---|---|
| `number` | `let n: number = 42` |
| `string` | `let s: string = "olá"` |
| `boolean` | `let ok: boolean = true` |
| `any` | compatível com tudo |
| `void` | funções sem retorno |
| `T[]` | listas: `let xs: number[] = [1, 2, 3]` |

A tipagem é **gradual**: sem anotação, o tipo é inferido do valor inicial (e o retorno de `fn` é inferido do corpo).

### Controle de fluxo

```vessie
if x > 0 { ... } else if x < 0 { ... } else { ... }
while condicao { ... }
for item in lista { ... }
break / continue
return valor
```

### Expressões

Números, strings (`"..."`, `'...'`), templates (`` `x ${expr}` ``), `true/false/null`, listas (`[1, 2, 3]`), objetos (`{a: 1, b: 2}`), membros (`a.b`), índices (`a[0]`), chamadas, operadores aritméticos/lógicos/comparação, ternário (`c ? a : b`), funções anônimas (`(a, b) => a + b`) e `await`.

> **Nota:** condições (`if`, `while`, `?:`) exigem `boolean` ou `any` — compare explicitamente (`valor != 0`).

### Blocos `css`, `js`, `html`, `cs`

```vessie
css tema = `.cta { border: 2px solid #4f46e5; padding: 10px; }`

js util = `
  globalThis.dobro = (n) => n * 2
`

html cartao = `<strong>HTML próprio:</strong> markup cru reutilizável.`

cs original = `Console.WriteLine("oi");`
```

- **`css`** — CSS injetado uma vez. Também aceita regras estruturadas:
  ```vessie
  css tema {
    rule ".cta" { border: "2px solid #4f46e5" padding: "10px" }
  }
  ```
- **`js`** — JavaScript executado **verbatim** no bundle final (mesmo escopo do app; `$`, `$c`, `$ui`, `$std`, `h` disponíveis).
- **`html`** — string reutilizável via `html nome`.
- **`cs`** — fonte C# guardada como string (`$cs["nome"]`).

---

## UI declarativa

Sintaxe de um elemento:

```
tag [argumento] [prop: valor]... [on:evento handler] [bind:alvo] [{ filhos }]
```

Cada elemento em sua **própria linha** (ou separado por `;`).

### Componentes

| Categoria | Componentes |
|---|---|
| Layout | `page`, `container`, `row`, `column`, `grid`, `card`, `list`, `item` |
| Texto | `text`, `heading`, `link`, `badge`, `alert`, `summary`, `details` |
| Formulário | `input`, `textarea`, `checkbox`, `switch`, `select`, `option` |
| Ação | `button` |
| Mídia | `image`, `icon`, `canvas` |
| Janelas | `modal`, `dialog`, `tabs`, `tab`, `table` |
| Diversos | `divider`, `progress`, `html` |

Tabela completa com props e eventos: `vessie ui list`.

### Exemplo completo

```vessie
app Demo

state nome: string = ""
state aceito: boolean = false
state mostrar: boolean = false

fn abrir() { ui.open("ajuda") }
fn fechar() { ui.close("ajuda") }

ui App {
  page "Demo" theme: "dark" {
    column gap: 16 {
      heading "Cadastro" level: 1
      input bind:nome placeholder: "Seu nome" label: "Nome"
      checkbox bind:aceito label: "Aceito os termos"
      row gap: 8 {
        button "Enviar" on:click enviar
        button "Ajuda" variant: "secondary" on:click abrir
      }
      modal id: "ajuda" title: "Ajuda" open: mostrar {
        text "Conteúdo do modal."
        button "Fechar" on:click fechar
      }
    }
  }
}
```

### Abrir/fechar UI

Duas formas complementares:

1. **Reativa** — pelo `open: <boolean>` (ligado a um `state`).
2. **Por comandos** — com `id:` no elemento:

   ```vessie
   ui.open("ajuda")     ui.close("ajuda")
   ui.show("painel")    ui.hide("painel")
   ui.toggle("menu")    ui.isVisible("menu")
   ```

### Temas e responsividade

- Tema automático claro/escuro via `prefers-color-scheme`.
- `theme: "dark"` / `theme: "light"` na `page`.
- Layout responsivo abaixo de 640 px.
- Foco visível, `aria-label` via `label:`, `prefers-reduced-motion`.

---

## Estado reativo

```vessie
state usuario: any = { nome: "Ana", tags: ["admin", "beta"] }
```

O estado é **profundo**: mutações em qualquer nível disparam atualização.

```vessie
usuario.nome = "Bia"                    // re-renderiza
array.push(usuario.tags, "novo")        // re-renderiza
usuario.tags = array.remove(usuario.tags, "beta")  // re-renderiza
```

Mutações são agrupadas por microtask e o DOM é atualizado por **patch incremental** — nós são reutilizados sempre que possível.

### `computed`

Valores derivados, recalculados a cada render. **Somente leitura.**

```vessie
computed total: number = count * preco
computed filtradas: string[] = array.filter(itens, (x) => string.includes(x, termo))
```

### `bind:`

Vínculo bidirecional para campos de formulário:

| Componente | Tipo esperado |
|---|---|
| `input`, `textarea`, `select` | `string` |
| `checkbox`, `switch` | `boolean` |
| `text`, `heading`, `badge` | somente leitura |

---

## Biblioteca padrão

### Globais

```
print(...)         log(...)          warn(...)         error(...)
assert(cond, msg?) typeof(v)        isNull(v)         isDefined(v)
range(fim)         range(ini, fim)
```

### Namespaces

| Namespace | Exemplos |
|---|---|
| `math` | `PI`, `abs`, `floor`, `ceil`, `round`, `sqrt`, `pow`, `clamp`, `lerp`, `random`, `randomInt`, `sign`, `modulo`, `radians`, `degrees`, `min`, `max` |
| `string` | `length`, `upper`, `lower`, `trim`, `split`, `replace`, `includes`, `startsWith`, `endsWith`, `repeat`, `chars`, `format` |
| `array` | `length`, `map`, `filter`, `reduce`, `find`, `sort`, `forEach`, `includes`, `push`, `join`, `first`, `last`, `reverse`, `slice`, `concat`, `unique`, `remove` |
| `object` | `keys`, `values`, `has` |
| `json` | `parse`, `stringify` |
| `date` | `now`, `iso`, `format` |
| `storage` | `get`, `set`, `remove`, `clear` |
| `http` | `get`, `getJson`, `postJson` (assíncronos) |
| `js` | `run`, `eval`, `get`, `set`, `on` |
| `ui` | `show`, `open`, `hide`, `close`, `toggle`, `isVisible`, `isOpen` |

Exemplo:

```vessie
fn media(xs: number[]) -> number {
  return array.reduce(xs, (a, b) => a + b, 0) / array.length(xs)
}

let n = media([10, 20, 30])   // 20
print(string.format("Média: {0}", n))
```

---

## JavaScript, CSS e HTML diretos

Vessie **não impede** JavaScript. Ao contrário: você pode misturar tudo.

```vessie
css main = `.destaque { border: 2px dashed #4f46e5; padding: 10px; }`
js util = `globalThis.dobro = (n) => n * 2`
html cartao = `<strong>HTML próprio:</strong> reutilizável.`

state n: number = 21

ui App {
  page "JS + CSS + HTML" {
    column gap: 8 {
      text `Dobro via JS: ${js.get("dobro")(n)}`
      text `Avaliado na hora: ${js.run("6 * 7")}`
      html cartao
    }
  }
}
```

- Blocos `js` rodam **verbatim** no bundle final. Exponha funções em `globalThis` e chame com `js.get("nome")(...)`.
- `js.run` / `js.eval` avaliam trechos autocontidos.
- `js.get` / `js.set` / `js.on` acessam globals, DOM e eventos.
- O resultado final é **um HTML próprio** com CSS+JS embutidos.

---

## CLI `vessie`

Códigos de saída: **`0` ok · `1` erro · `2` uso incorreto ou comando planejado.**

### Projeto e compilação

```bash
vessie init [dir]              # cria vessie.json + src/main.vessie
vessie create <nome>           # igual, mas exige nome
vessie build [arquivo]         # dist/ (html, js/, css/, runtime/, sourcemaps/)
vessie build --single          # UM .js autocontido + index.html mínimo
vessie compile <arquivo>       # JS no stdout (--out arquivo.js)
vessie compile --single        # bundle único, sem imports, auto-inicializa
```

### Diagnóstico e execução

```bash
vessie check [caminhos...]     # só diagnósticos (--json, --strict)
vessie run [arquivo]           # serve em http://127.0.0.1:5173
vessie run --node              # execução headless no terminal
vessie open [arquivo]          # como run + abre o navegador (Ctrl+C fecha)
vessie ui [list]               # componentes + comandos abrir/fechar (--json)
vessie dev [arquivo]           # run + recompila ao salvar
vessie watch -- <cmd> ...      # reexecuta o comando a cada save
vessie test [caminhos...]      # arquivos *.test.vessie (usam assert)
vessie format [caminhos...]    # formata .vessie (--check só verifica)
vessie clean [dir]             # remove a pasta de saída
```

### Geração e variações

```bash
vessie console app.vessie      # script único p/ colar no DevTools do Chrome
vessie gen app.vessie --lang python --out app.py
vessie gen app.vessie --lang website --out dist/
vessie base count              # catálogo Multi-Base
vessie base list --genre web
vessie base gen counter --lang vessie --name "MeuContador"
vessie base install todolist --lang python --run
vessie base web "contador" --scripts 3
```

### Integrações

```bash
vessie adapters                # lista adaptadores (python, node, c, c++, c#)
vessie exec --lang python --code "print(6 * 7)"
vessie exec --lang c prog.c --timeout 30000
vessie cs convert prog.cs --out prog.vessie
vessie cs run prog.cs
vessie git status / add . / commit -m "msg" / log / push ...
vessie ai "contador com botão" --code --out gen.vessie
vessie websearch https://exemplo.com menu --pages 8 --depth 1
vessie markdown doc.md --out doc.html
vessie a11y src/ --json
vessie sys info / procs
vessie optimize --game steam
vessie optimize --pid 1234 --apply   # Windows, exige --pid explícito
vessie doctor
vessie info / docs
```

### Opções globais

```
-q / --quiet      -v / --verbose
--mode development|production    --out <dir|arquivo>
-h / --help
```

---

## API programática

Além da CLI, o `VessieLang.js` exporta uma API ES:

```js
import {
  compile, compileOrThrow, parse, tokenize,
  buildWeb, buildWebSingle, buildSingleBundle, singleBundleHtml,
  createRuntimeBundle, baseCss,
  formatDiagnostics, createStaticServer, resolveInside,
  main, VERSION,
} from "./VessieLang.js";

// Compilar
const r = compile(srcVessie, { file: "app.vessie", sourceMap: false });
if (!r.ok) console.error(r.diagnostics);

// Build completo
const b = buildWeb({ file: "app.vessie", outDir: "dist", mode: "production" });

// Bundle único
const s = buildSingleBundle({ file: "app.vessie", source: src });
```

---

## Execução multilinguagem

`vessie exec` executa Python, Node.js, C, C++ e C# em **processo-filho próprio**, sem shell, com timeout.

```bash
vessie exec --lang python --code "print(40 + 2)"
vessie exec --lang node --code "console.log('oi')"
vessie exec --lang c --code "#include <stdio.h>
int main(){printf(\"oi\\n\");}"
vessie exec --lang cpp prog.cpp
vessie exec --lang csharp --code 'Console.WriteLine("oi");' --timeout 30000
```

| Id | Aliases | Precisa de |
|---|---|---|
| `python` | `py` | `python3` ou `python` |
| `node` | `js`, `javascript`, `nodejs` | Node.js (sempre) |
| `c` | — | `gcc` ou `cc` |
| `cpp` | `c++`, `cxx` | `g++` ou `c++` |
| `csharp` | `c#`, `cs`, `dotnet` | .NET SDK |

Limites: 256 KB por trecho, timeout padrão 15 s (máx. 120 s), **sem shell e sem rede**.

---

## Adaptação C# → Vessie

Converta C# estilo console para `.vessie` ou execute o original via .NET.

```bash
vessie cs convert programa.cs --out programa.vessie
vessie cs convert programa.cs --json      # código + avisos + se compilou
vessie cs run programa.cs --timeout 30000
```

Conversões típicas:

| C# | Vessie |
|---|---|
| `static void Main()` | `fn main()` |
| `Console.WriteLine(x)` | `print(x)` |
| `for (int i=0; i<n; i++)` | `for i in range(n)` |
| `foreach (var x in xs)` | `for x in xs` |
| `$"Olá, {nome}"` | `` `Olá, ${nome}` `` |
| `Math.Sqrt/Pow/...` | `math.sqrt/pow/...` |
| `.Where/.Select/.Count()` | `array.filter/map/length` |
| `throw ...` | `assert(false, ...)` |

O que não tem equivalente vira `// [cs]` no código + aviso na linha. Se o resultado não compilar, `vessie cs convert` sai com código `1`.

---

## Assistente de IA local

`vessie ai` melhora pedidos para IAs, inclusive **modelos pequenos**: geração dupla (pedido aprimorado + system prompt com exemplos isolados). Tudo **offline** e determinístico.

```bash
vessie ai "contador com botão"                    # visão completa
vessie ai "formulário de cadastro" --system       # system + aprimorado (colar no modelo)
vessie ai "lista de tarefas" --code               # só o .vessie gerado
vessie ai "painel" --code --out gen.vessie        # salva para compilar depois
vessie ai --system                                # só a referência da linguagem
```

Fluxo compilável:

```bash
vessie ai "contador com botão" --code --out gen.vessie
vessie check gen.vessie && vessie run --node gen.vessie
```

---

## Multi-Base (variações de scripts)

Um **catálogo de módulos por gênero**, cada um gerando variações em **várias linguagens**:

```bash
vessie base count          # estatísticas gerais
vessie base genres         # gêneros disponíveis
vessie base list           # todos os módulos
vessie base search "api"   # busca por termo
vessie base gen counter --lang vessie --name "MeuApp"
vessie base install todolist --lang python --run
vessie base web "dashboard" --scripts 3 --out pesquisa.md
```

Gêneros: **web**, **python**, **node**, **dados**, **ia**, **jogos**, **automacao**, **api**, **util**, **cli**, **html**, **css**.

Cada módulo pode gerar dezenas de variações; `vessie base install` salva no disco e, com `--run`, executa em Python ou Node.

---

## Segurança

Implementado e testado:

- `resolveInside()` bloqueia path traversal em `--out`, `clean`, `vessie.json` e no servidor estático (403/404 para `..`, `%2e%2e`, `..%2f`).
- `clean` recusa remover o diretório atual ou qualquer coisa fora do projeto.
- Servidor de `run`/`dev` escuta **apenas em `127.0.0.1`** e envia `X-Content-Type-Options: nosniff`.
- Páginas geradas têm **CSP** restritiva (`default-src 'self'`, `object-src 'none'`); textos são inseridos como nós de texto (sem `innerHTML`); URLs de `src` e `href` bloqueiam `javascript:`.
- `vessie exec` cria **processo-filho temporário próprio** (sem shell) com timeout — o Vessie **não injeta código** em processos de terceiros.
- `vessie websearch` só lê páginas `http/https` de mesma origem, com limites de páginas/bytes/timeout, **sem executar JavaScript**.
- `vessie optimize --apply` exige PID explícito; nunca encerra processos nem altera serviços/arquivos.

> **Atenção:** `vessie run --node` executa o `.vessie` com os privilégios do seu usuário. Não rode `.vessie` de origem não confiável.

---

## Estado das funcionalidades

Legenda: ✅ implementado e testado · 🟡 parcial · ⏳ pendente

| Fase | Status |
|---|---|
| **1. Fundação** (CLI, lexer, parser, AST, compilador, build) | ✅ |
| **2. Linguagem** (variáveis, funções, tipos, condicionais, laços, closures, diagnósticos) | 🟡 (sem import/export, enums, classes, try/catch) |
| **3. Web e UI** (runtime, HTML/CSS gerados, componentes, eventos, estado reativo, computed, bind, patch DOM, temas) | ✅ (sem scene, animações, `if`/`for` na UI, `watch`) |
| **Biblioteca padrão** (core, math, string, array, object, json, date, storage, http, js, ui) | ✅ |
| **Adaptadores** (python, node, c, c++, c#) | ✅ |
| **Assistente de IA local** | ✅ |
| **Smart-web-search** | ✅ |
| **Multi-Base** (catálogo de módulos por gênero) | ✅ |
| **Git integrado** | ✅ |
| **C# → Vessie** | ✅ |
| **Engine 2D/3D, LM Studio, servidor Node, pacotes, extensões** | ⏳ |

Relatório completo: `vessie docs` (ou `docs/STATUS.md`).

---

## Documentação

| Documento | Conteúdo |
|---|---|
| `syntax.md` | Sintaxe completa (implementada) |
| `ui.md` | UI declarativa em detalhe |
| `components.md` | Tabela de componentes (props, eventos, bind) |
| `stdlib.md` | Biblioteca padrão |
| `cli.md` / `commands.md` | Referência da CLI |
| `compiler.md` | Pipeline do compilador |
| `adapters.md` | Adaptadores de execução |
| `csharp.md` | Adaptação C# → Vessie |
| `ai.md` | Assistente de IA local |
| `websearch.md` | Smart-web-search |
| `security.md` | Estado de segurança |
| `diagnostics.md` | Códigos de diagnóstico |
| `optimizer.md` | Otimizador de processos/jogos |
| `getting-started.md` | Primeiros passos |
| `STATUS.md` | Estado geral das funcionalidades |

Liste tudo com:

```bash
vessie docs
```

---

## Como contribuir

1. **Regenerar o bundle** após alterar `src/`:
   ```bash
   npm run bundle        # gera VessieLang.js a partir de src/
   ```
   O script valida sintaxe, compara saídas com o sistema original e faz um `build --single` fora da árvore.

2. **Rodar os testes**:
   ```bash
   npm test              # 48 testes (lexer, parser, semântica, geração, runtime, CLI, segurança)
   ```

3. **Formatação**:
   ```bash
   vessie format --check src/
   ```

4. **Estilo de código**: a linguagem privilegia clareza e segurança. Diagnósticos têm código, arquivo, linha, coluna, trecho e (quando possível) dica. Veja `docs/diagnostics.md`.

5. **Idioma**: o projeto é escrito em **português** (variáveis, mensagens, docs). Mantenha o padrão.

---

## Licença

Consulte o arquivo `LICENSE` do repositório.

---

<p align="center">
  <strong>Vessie</strong> — descreva o estado e a UI; o resto o compilador faz.
</p>