/* ============================================================
   Script: list_models.js
   Comando: Lista todos os modelos disponíveis no LM Studio,
            com cache de 30s para evitar requisições repetidas.

   Log: Vessie/logs/list_models.log
   Uso: node Vessie/scripts/list_models.js [--refresh]
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
const logFile = path.join(logDir, 'list_models.log');
const logger = new utils.Logger({ level: config.logLevel || 'info' });
const origWrite = logger._write.bind(logger);
logger._write = function (level, msg, data) {
  origWrite(level, msg, data);
  const ts = new Date().toISOString();
  const line = `[${ts}] [${level.toUpperCase()}] ${msg}${data ? ' | ' + JSON.stringify(data) : ''}\n`;
  try { fs.appendFileSync(logFile, line); } catch (e) { /* ignore */ }
};

async function main() {
  const forceRefresh = process.argv.includes('--refresh') || process.argv.includes('-r');
  logger.info('Listando modelos', { forceRefresh });

  const optimizer = new Optimizer({ ...config, logger });

  try {
    const t0 = Date.now();
    const models = await optimizer.listModels(forceRefresh);
    const duration = Date.now() - t0;

    console.log('\n🤖 Modelos disponíveis no LM Studio:\n');
    models.forEach((m, i) => {
      const num = String(i + 1).padStart(2, ' ');
      console.log(`  ${num}. ${m.id}${m.size ? ` (${m.size})` : ''}${m.format ? ` [${m.format}]` : ''}`);
    });
    console.log(`\nTotal: ${models.length} modelo(s) | Tempo: ${utils.formatDuration(duration)}\n`);

    logger.info('Modelos listados', {
      count: models.length,
      duration,
      forceRefresh
    });
  } catch (err) {
    logger.error('Erro ao listar modelos', { error: err.message });
    console.error('❌ Erro:', err.message);
    process.exit(1);
  } finally {
    await optimizer.close();
  }
}

main();
