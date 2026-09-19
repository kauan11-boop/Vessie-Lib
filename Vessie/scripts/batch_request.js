/* ============================================================
   Script: batch_request.js
   Comando: Processa múltiplas mensagens em paralelo
            (batch processing) com controle de paralelismo
            e retry automático.

   Log: Vessie/logs/batch_request.log
   Uso: node Vessie/scripts/batch_request.js "q1" "q2" "q3" [--parallel=2]
   ============================================================ */
'use strict';

const path = require('path');
const fs = require('fs');
const { Optimizer } = require('../core/optimizer');
const utils = require('../vsl/libs/utils');

const configPath = path.resolve(__dirname, '../config/vessie.config.json');
const config = fs.existsSync(configPath)
  ? JSON.parse(fs.readFileSync(configPath, 'utf8'))
  : { baseUrl: 'http://localhost:1234/v1', timeout: 30000, maxRetries: 3 };

const logDir = path.resolve(config.logging?.dir || path.join(__dirname, '../logs'));
utils.ensureDir(logDir);
const logFile = path.join(logDir, 'batch_request.log');
const logger = new utils.Logger({ level: config.logLevel || 'info' });
const origWrite = logger._write.bind(logger);
logger._write = function (level, msg, data) {
  origWrite(level, msg, data);
  const ts = new Date().toISOString();
  const line = `[${ts}] [${level.toUpperCase()}] ${msg}${data ? ' | ' + JSON.stringify(data) : ''}\n`;
  try { fs.appendFileSync(logFile, line); } catch (e) { /* ignore */ }
};

// Parseia argumentos: filtra flags --parallel=N
function parseArgs(argv) {
  const args = [];
  let parallelism = 2;
  for (const arg of argv.slice(2)) {
    if (arg.startsWith('--parallel=')) {
      parallelism = parseInt(arg.split('=')[1], 10);
    } else {
      args.push(arg);
    }
  }
  return { args, parallelism };
}

async function main() {
  const { args, parallelism } = parseArgs(process.argv);

  if (args.length === 0) {
    console.error('Uso: node Vessie/scripts/batch_request.js "q1" "q2" "q3" [--parallel=2]');
    process.exit(1);
  }

  logger.info('Batch iniciado', { count: args.length, parallelism });
  const optimizer = new Optimizer({ ...config, logger });

  const messages = args.map(q => ({ role: 'user', content: q }));

  try {
    const t0 = Date.now();
    const results = await optimizer.batch(messages, { parallelism, stream: false });
    const duration = Date.now() - t0;

    console.log(`\n⏱️  Batch concluído em ${utils.formatDuration(duration)}\n`);
    results.forEach((r, i) => {
      const num = String(i + 1).padStart(args.length.toString().length, '0');
      console.log(`=== [${num}/${args.length}] "${args[i].slice(0, 60)}..." ===`);
      if (r.status === 'fulfilled') {
        console.log(r.result.content);
        console.log(`→ ${r.result.stats?.totalTokens} tokens | ${r.result.stats?.duration}s`);
      } else {
        console.log(`❌ Erro: ${r.error}`);
      }
      console.log('');
    });

    const ok = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;
    logger.info('Batch concluído', {
      success: ok,
      failed,
      total: results.length,
      duration
    });
  } catch (err) {
    logger.error('Erro no batch', { error: err.message });
    console.error('❌ Erro:', err.message);
    process.exit(1);
  } finally {
    await optimizer.close();
  }
}

main();
