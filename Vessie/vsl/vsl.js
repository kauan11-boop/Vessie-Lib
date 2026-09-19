/* ============================================================
   Vessie Script Language — Entry Point (vsl.js)
   Interface de linha de comando para a linguagem VSL.

   Uso:
     node Vessie/vsl/vsl.js <arquivo.vsl>          → executa script VSL
     node Vessie/vsl/vsl.js --interactive          → modo interativo
     node Vessie/vsl/vsl.js --help                   → ajuda
   ============================================================ */
'use strict';

const path = require('path');
const fs = require('fs');
const readline = require('readline');
const { VSLInterpreter } = require('./interpreter');
const { parse } = require('./parser');
const utils = require('./libs/utils');

/** Carrega configuração do arquivo config/vessie.config.json */
function loadConfig() {
  const configPath = path.resolve(__dirname, '../config/vessie.config.json');
  if (fs.existsSync(configPath)) {
    const raw = fs.readFileSync(configPath, 'utf8');
    return JSON.parse(raw);
  }
  return {};
}

/** Processa argumentos da linha de comando */
function parseArgs(argv) {
  const args = argv.slice(2);
  const result = { files: [], interactive: false, help: false, config: {} };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--help' || arg === '-h') result.help = true;
    else if (arg === '--interactive' || arg === '-i') result.interactive = true;
    else if (arg === '--config' || arg === '-c') {
      const cfgPath = args[++i];
      if (cfgPath) result.configPath = path.resolve(cfgPath);
    } else if (!arg.startsWith('-')) {
      result.files.push(arg);
    }
  }

  return result;
}

/** Imprime ajuda */
function printHelp() {
  const help = `
========================================
  Vessie Script Language (VSL) v1.0
========================================

Uso:
  vsl <arquivo.vsl>          Executa um script VSL
  vsl --interactive          Inicia o REPL interativo
  vsl --help                 Mostra esta ajuda

Comandos VSL:
  config { key = value; }    Define configurações
  send "texto"                Envia mensagem ao modelo
  receive [stream]            Recebe resposta (streaming ou não)
  receive into $var           Armazena resposta em variável
  set $var = value            Define uma variável
  loop N { ... }              Repete N vezes
  if $var contains "x" { }    Condicional
  print "texto"               Imprime no console
  batch { ... }               Grupo de operações
  wait N                      Pausa N segundos
  model list                  Lista modelos disponíveis
  model use "id"              Seleciona um modelo

Exemplo:
  config {
    url = "http://localhost:1234/v1"
    model = "deepseek-r1"
    temperature = 0.7
  }
  send "Olá, como você está?"
  receive stream
  `;
  console.log(help);
}

/** REPL interativo */
async function startInteractive(config) {
  const interpreter = new VSLInterpreter(config);
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: 'vsl> '
  });

  console.log('Vessie Script Language — REPL (Ctrl+C para sair)\n');
  rl.prompt();

  let buffer = '';
  let depth = 0;

  rl.on('line', async (line) => {
    buffer += line + '\n';

    // Conta blocos abertos/fechados
    for (const ch of line) {
      if (ch === '{') depth++;
      if (ch === '}') depth--;
    }

    // Se há blocos abertos, espera mais input
    if (depth > 0) {
      rl.prompt();
      return;
    }

    if (buffer.trim()) {
      try {
        await interpreter.run(buffer);
      } catch (err) {
        console.error(`Erro: ${err.message}`);
      }
    }
    buffer = '';
    depth = 0;
    rl.prompt();
  });

  rl.on('close', async () => {
    await interpreter.close();
    process.exit(0);
  });
}

/** Executa um ou mais arquivos VSL */
async function runFiles(files, config) {
  const interpreter = new VSLInterpreter(config);
  let hasError = false;

  for (const file of files) {
    const fullPath = path.resolve(file);
    if (!fs.existsSync(fullPath)) {
      console.error(`Erro: Arquivo não encontrado: ${fullPath}`);
      hasError = true;
      continue;
    }

    console.log(`\n=== Executando: ${path.basename(fullPath)} ===\n`);
    try {
      await interpreter.runFile(fullPath);
    } catch (err) {
      console.error(`Erro ao executar ${fullPath}: ${err.message}`);
      hasError = true;
    }
  }

  await interpreter.close();
  if (hasError) process.exit(1);
}

/** Entry point principal */
async function main() {
  const args = parseArgs(process.argv);
  const baseConfig = loadConfig();

  // Merge config da linha de comando
  let config = { ...baseConfig };
  if (args.configPath && fs.existsSync(args.configPath)) {
    const extra = JSON.parse(fs.readFileSync(args.configPath, 'utf8'));
    config = { ...config, ...extra };
  }

  if (args.help) {
    printHelp();
    process.exit(0);
  }

  if (args.interactive) {
    await startInteractive(config);
    return;
  }

  if (args.files.length === 0) {
    printHelp();
    process.exit(0);
  }

  await runFiles(args.files, config);
}

// Executa se chamado diretamente (não importado)
if (require.main === module) {
  main().catch(err => {
    console.error('Erro fatal:', err.message);
    process.exit(1);
  });
}

module.exports = {
  VSLInterpreter,
  parse,
  loadConfig,
  parseArgs,
  main
};
