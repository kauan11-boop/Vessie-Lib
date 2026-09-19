/* ============================================================
   Vessie — Entry Point Principal
   Sistema otimizado de envio e recebimento de informações
   do modelo de IA (LM Studio).

   Este módulo é o ponto central de entrada. Expõe:
   - Optimizer (pipeline otimizado)
   - VSL (linguagem de script customizada)
   - CLI para execução de scripts e arquivos .vsl

   Uso:
     node Vessie/index.js                    → mostra ajuda
     node Vessie/index.js send "texto"       → envia mensagem
     node Vessie/index.js stream "texto"     → streaming
     node Vessie/index.js models             → lista modelos
     node Vessie/index.js batch "q1" "q2"    → batch
     node Vessie/index.js test               → testa conexão
     node Vessie/index.js vsl <arquivo.vsl>  → executa script VSL
     node Vessie/index.js interactive        → REPL VSL
   ============================================================ */
'use strict';

const path = require('path');
const fs = require('fs');
const { Optimizer } = require('./core/optimizer');
const { VSLInterpreter } = require('./vsl/interpreter');
const utils = require('./vsl/libs/utils');

// Carrega configuração
function loadConfig() {
  const configPath = path.resolve(__dirname, 'config/vessie.config.json');
  if (fs.existsSync(configPath)) {
    return JSON.parse(fs.readFileSync(configPath, 'utf8'));
  }
  return {
    baseUrl: 'http://localhost:1234/v1',
    timeout: 30000,
    maxRetries: 3
  };
}

/** Registro baseado no nome do script */
function getScriptLogger(scriptName) {
  const config = loadConfig();
  const logDir = path.resolve(config.logging?.dir || path.join(__dirname, 'logs'));
  utils.ensureDir(logDir);

  const logFile = path.join(logDir, `${scriptName}.log`);
  const baseLogger = new utils.Logger({ level: config.logLevel || 'info' });

  // Extende o logger para também escrever no arquivo
  const originalWrite = baseLogger._write.bind(baseLogger);
  baseLogger._write = function (level, msg, data) {
    originalWrite(level, msg, data);
    const ts = new Date().toISOString();
    const line = `[${ts}] [${level.toUpperCase()}] ${msg}${data ? ' | ' + JSON.stringify(data) : ''}\n`;
    try { fs.appendFileSync(logFile, line); } catch (e) { /* ignore */ }
  };

  return baseLogger;
}

/** Parseia argumentos da CLI */
function parseArgs(argv) {
  const args = argv.slice(2);
  const result = { command: null, args: [], opts: {}, interactive: false, help: false };

  if (args.length === 0) return result;

  const first = args[0];
  if (first === '--help' || first === '-h') result.help = true;
  else if (first === 'vsl') result.command = 'vsl';
  else if (first === 'interactive' || first === '--interactive' || first === '-i') result.interactive = true;
  else {
    result.command = first;
    for (let i = 1; i < args.length; i++) {
      const arg = args[i];
      if (arg.startsWith('--')) {
        const [key, val] = arg.slice(2).split('=');
        result.opts[key] = val || true;
      } else {
        result.args.push(arg);
      }
    }
  }

  return result;
}

/** Imprime banner de boas-vindas */
function printBanner() {
  const banner = `
====================================
  Vessie-Lib — Sistema Otimizado
  Envio/Recebimento LM Studio
====================================
  Versão: 1.0.0
  Status: ${'Pronto'}
  Comandos: send, receive, stream, models, batch, test, config, vsl, interactive
  Documentação: Vessie/README.md
`;
  console.log(banner);
}

/** Executa o comando send */
async function cmdSend(args, opts) {
  const logger = getScriptLogger('send_message');
  const config = { ...loadConfig(), ...opts, logger };
  const optimizer = new Optimizer(config);

  try {
    const message = args[0];
    if (!message) {
      console.error('Uso: node Vessie/index.js send "sua mensagem"');
      process.exit(1);
    }

    logger.info('Enviando mensagem', { message: message.slice(0, 100) });
    const result = await optimizer.sendMessage(message, { stream: false });
    console.log('\n📥 Resposta:\n');
    console.log(result.content);
    logger.info('Resposta recebida', { length: result.content.length, duration: result.stats?.duration });
  } catch (err) {
    logger.error('Erro no envio', { error: err.message });
    console.error('Erro:', err.message);
  } finally {
    await optimizer.close();
  }
}

/** Executa o comando stream */
async function cmdStream(args, opts) {
  const logger = getScriptLogger('stream_response');
  const config = { ...loadConfig(), ...opts, logger };
  const optimizer = new Optimizer(config);

  try {
    const message = args[0];
    if (!message) {
      console.error('Uso: node Vessie/index.js stream "sua mensagem"');
      process.exit(1);
    }

    logger.info('Streaming mensagem', { message: message.slice(0, 100) });
    process.stdout.write('\n🤖 ');

    const result = await optimizer.sendMessage(message, {
      onToken: (text) => process.stdout.write(text),
      stream: true
    });

    process.stdout.write('\n');
    logger.info('Stream concluído', {
      tokenCount: result.tokenCount,
      duration: result.stats?.duration,
      tokenPerSec: result.stats?.tokenPerSec
    });
  } catch (err) {
    logger.error('Erro no streaming', { error: err.message });
    console.error('\nErro:', err.message);
  } finally {
    await optimizer.close();
  }
}

/** Executa o comando models */
async function cmdModels(args, opts) {
  const logger = getScriptLogger('list_models');
  const config = { ...loadConfig(), ...opts, logger };
  const optimizer = new Optimizer(config);

  try {
    logger.info('Listando modelos');
    const models = await optimizer.listModels(true);
    console.log('\n🤖 Modelos disponíveis no LM Studio:\n');
    models.forEach((m, i) => {
      console.log(`  ${i + 1}. ${m.id}${m.size ? ` (${m.size})` : ''}`);
    });
    console.log(`\nTotal: ${models.length} modelo(s)\n`);
    logger.info('Modelos listados', { count: models.length });
  } catch (err) {
    logger.error('Erro ao listar modelos', { error: err.message });
    console.error('Erro:', err.message);
  } finally {
    await optimizer.close();
  }
}

/** Executa o comando batch */
async function cmdBatch(args, opts) {
  const logger = getScriptLogger('batch_request');
  const config = { ...loadConfig(), ...opts, logger };
  const optimizer = new Optimizer(config);

  try {
    const messages = args.map(m => ({ role: 'user', content: m }));
    if (messages.length === 0) {
      console.error('Uso: node Vessie/index.js batch "q1" "q2" ...');
      process.exit(1);
    }

    logger.info('Batch iniciado', { count: messages.length });
    const results = await optimizer.batch(messages, { parallelism: 2 });

    results.forEach((r, i) => {
      console.log(`\n--- Resultado [${i + 1}] ---`);
      if (r.status === 'fulfilled') {
        console.log(r.result.content);
      } else {
        console.log(`Erro: ${r.error}`);
      }
    });

    const ok = results.filter(r => r.status === 'fulfilled').length;
    logger.info('Batch concluído', { success: ok, failed: results.length - ok });
  } catch (err) {
    logger.error('Erro no batch', { error: err.message });
    console.error('Erro:', err.message);
  } finally {
    await optimizer.close();
  }
}

/** Executa o comando test */
async function cmdTest(args, opts) {
  const logger = getScriptLogger('test_connection');
  const config = { ...loadConfig(), ...opts, logger };
  const optimizer = new Optimizer(config);

  try {
    logger.info('Testando conexão');
    console.log('Verificando conexão com LM Studio...\n');
    const result = await optimizer.checkConnection();

    if (result.ok) {
      console.log(`✅ Conectado! (${result.ms}ms)`);
      console.log(`   Modelos disponíveis: ${result.count}`);
      result.models.forEach(m => console.log(`   - ${m}`));
      logger.info('Conexão bem-sucedida', { ms: result.ms, models: result.count });
    } else {
      console.log(`❌ Falha: ${result.err}`);
      logger.error('Conexão falhou', { error: result.err });
    }
  } catch (err) {
    logger.error('Erro no teste', { error: err.message });
    console.error('❌ Erro:', err.message);
  } finally {
    await optimizer.close();
  }
}

/** Executa comando VSL */
async function cmdVSL(args, opts) {
  const config = { ...loadConfig(), ...opts };
  const interpreter = new VSLInterpreter(config);

  try {
    if (args.length === 0) {
      console.error('Uso: node Vessie/index.js vsl <arquivo.vsl>');
      process.exit(1);
    }
    await interpreter.runFile(args[0]);
  } catch (err) {
    console.error('Erro:', err.message);
  } finally {
    await interpreter.close();
  }
}

/** Inicia REPL interativo */
async function cmdInteractive(args, opts) {
  const { startInteractive } = require('./vsl/vsl');
  await startInteractive({ ...loadConfig(), ...opts });
}

/** Comando de configuração */
async function cmdConfig(args, opts) {
  const logger = getScriptLogger('config_manager');
  const config = loadConfig();
  const key = args[0];
  const value = args[1];

  if (!key) {
    console.log('\nConfiguração atual:');
    console.log(JSON.stringify(config, null, 2));
    return;
  }

  if (value === undefined) {
    // Lê uma config
    console.log(`${key} = ${JSON.stringify(config[key])}`);
  } else {
    // Atualiza uma config
    let val;
    try { val = JSON.parse(value); } catch { val = value; }
    config[key] = val;
    const configPath = path.resolve(__dirname, 'config/vessie.config.json');
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    console.log(`Configuração atualizada: ${key} = ${value}`);
    logger.info('Config atualizada', { key, value });
  }
}

/** Entry point principal */
async function main() {
  const args = parseArgs(process.argv);

  if (args.help) {
    printBanner();
    console.log('Uso: node Vessie/index.js <comando> [argumentos]\n');
    console.log('Comandos:');
    console.log('  send "msg"          Envia mensagem e recebe resposta');
    console.log('  stream "msg"        Envia e recebe streaming token a token');
    console.log('  receive             Recebe resposta da última mensagem');
    console.log('  models              Lista modelos disponíveis');
    console.log('  batch "q1" "q2"     Processa múltiplas mensagens em paralelo');
    console.log('  test                Testa conexão com LM Studio');
    console.log('  config [key] [val]  Gerencia configurações');
    console.log('  vsl <arquivo.vsl>   Executa script VSL');
    console.log('  interactive         Inicia REPL VSL');
    process.exit(0);
  }

  if (args.interactive) {
    await cmdInteractive(args.args, args.opts);
    return;
  }

  printBanner();

  const commands = {
    send: cmdSend,
    receive: cmdSend,
    stream: cmdStream,
    models: cmdModels,
    batch: cmdBatch,
    test: cmdTest,
    config: cmdConfig,
    vsl: cmdVSL
  };

  const fn = commands[args.command];
  if (!fn) {
    console.log('Comando desconhecido. Use --help para ver os comandos disponíveis.');
    process.exit(1);
  }

  await fn(args.args, args.opts);
}

// Exporta módulos para uso programático
module.exports = {
  Optimizer,
  VSLInterpreter,
  loadConfig,
  getScriptLogger,
  parseArgs
};

// Executa se chamado diretamente
if (require.main === module) {
  main().catch(err => {
    console.error('Erro fatal:', err.message);
    process.exit(1);
  });
}
