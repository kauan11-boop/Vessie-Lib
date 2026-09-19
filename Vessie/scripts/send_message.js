/* ============================================================
   Script: send_message.js
   Comando: Envia uma mensagem ao modelo LM Studio e recebe
            a resposta completa (non-streaming).

   Log: Vessie/logs/send_message.log
   Uso: node Vessie/scripts/send_message.js "sua mensagem"
   ============================================================ */
'use strict';

const path = require('path');
const fs = require('fs');
const { Optimizer } = require('../core/optimizer');
const utils = require('../vsl/libs/utils');

// Carrega config
const configPath = path.resolve(__dirname, '../config/vessie.config.json');
const config = fs.existsSync(configPath)
  ? JSON.parse(fs.readFileSync(configPath, 'utf8'))
  : { baseUrl: 'http://localhost:1234/v1', timeout: 30000, maxRetries: 3 };

// Logger com escrita em arquivo
const logDir = path.resolve(config.logging?.dir || path.join(__dirname, '../logs'));
utils.ensureDir(logDir);
const logFile = path.join(logDir, 'send_message.log');
const logger = new utils.Logger({ level: config.logLevel || 'info' });
const origWrite = logger._write.bind(logger);
logger._write = function (level, msg, data) {
  origWrite(level, msg, data);
  const ts = new Date().toISOString();
  const line = `[${ts}] [${level.toUpperCase()}] ${msg}${data ? ' | ' + JSON.stringify(data) : ''}\n`;
  try { fs.appendFileSync(logFile, line); } catch (e) { /* ignore */ }
};

async function main() {
  const message = process.argv[2];
  if (!message) {
    console.error('Uso: node Vessie/scripts/send_message.js "sua mensagem"');
    process.exit(1);
  }

  logger.info('Iniciando envio de mensagem', { message: message.slice(0, 120) });
  const optimizer = new Optimizer({ ...config, logger });

  try {
    const result = await optimizer.sendMessage(message, { stream: false });
    console.log('\n📥 Resposta:\n');
    console.log(result.content);
    console.log('\n---');
    console.log(`Duração: ${result.stats?.duration}s | Tokens: ${result.stats?.totalTokens} | ${result.stats?.tokenPerSec} tok/s`);
    logger.info('Mensagem processada com sucesso', {
      contentLength: result.content.length,
      duration: result.stats?.duration,
      totalTokens: result.stats?.totalTokens
    });
  } catch (err) {
    logger.error('Falha no envio', { error: err.message });
    console.error('❌ Erro:', err.message);
    process.exit(1);
  } finally {
    await optimizer.close();
  }
}

main();
