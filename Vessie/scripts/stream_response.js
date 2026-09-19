/* ============================================================
   Script: stream_response.js
   Comando: Recebe a resposta do modelo em modo streaming
            (token a token), com SSE parser otimizado,
            heartbeat monitoring e backpressure handling.

   Log: Vessie/logs/stream_response.log
   Uso: node Vessie/scripts/stream_response.js "sua mensagem"
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
const logFile = path.join(logDir, 'stream_response.log');
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
    console.error('Uso: node Vessie/scripts/stream_response.js "sua mensagem"');
    process.exit(1);
  }

  logger.info('Iniciando streaming', { message: message.slice(0, 120) });
  const optimizer = new Optimizer({ ...config, logger });

  let tokenCount = 0;
  const onToken = (text, info) => {
    process.stdout.write(text);
    tokenCount++;
    if (tokenCount % 20 === 0) {
      logger.debug('Tokens recebidos', { count: tokenCount });
    }
  };

  const messages = [
    { role: 'user', content: message }
  ];
  if (config.systemPrompt) {
    messages.unshift({ role: 'system', content: config.systemPrompt });
  }

  process.stdout.write('\n🤖 ');

  try {
    const result = await optimizer.chatStream(messages, onToken, { stream: true });
    process.stdout.write('\n');

    console.log('\n--- Estatísticas ---');
    console.log(`Duração:       ${result.stats?.duration}s`);
    console.log(`Tokens enviados: ${result.tokenCount}`);
    console.log(`Token/s:       ${result.stats?.tokenPerSec}`);
    if (result.reasoning) {
      console.log(`(reasoning: ${result.reasoning.length} chars)`);
    }

    logger.info('Streaming concluído', {
      tokenCount: result.tokenCount,
      duration: result.stats?.duration,
      tokenPerSec: result.stats?.tokenPerSec
    });
  } catch (err) {
    logger.error('Erro no streaming', { error: err.message });
    console.error('\n❌ Erro:', err.message);
    process.exit(1);
  } finally {
    await optimizer.close();
  }
}

main();
