/* ============================================================
   Script: receive_response.js
   Comando: Recebe a resposta do modelo em modo non-streaming
            (útil para testes e validação de output).

   Log: Vessie/logs/receive_response.log
   Uso: node Vessie/scripts/receive_response.js "sua mensagem"
   ============================================================ */
'use strict';

const path = require('path');
const fs = require('fs');
const { Optimizer } = require('../core/optimizer');
const utils = require('../vsl/libs/utils');
const tokens = require('../vsl/libs/tokens');

const configPath = path.resolve(__dirname, '../config/vessie.config.json');
const config = fs.existsSync(configPath)
  ? JSON.parse(fs.readFileSync(configPath, 'utf8'))
  : { baseUrl: 'http://localhost:1234/v1', timeout: 30000, maxRetries: 3 };

const logDir = path.resolve(config.logging?.dir || path.join(__dirname, '../logs'));
utils.ensureDir(logDir);
const logFile = path.join(logDir, 'receive_response.log');
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
    console.error('Uso: node Vessie/scripts/receive_response.js "sua mensagem"');
    process.exit(1);
  }

  logger.info('Recebendo resposta (non-streaming)', { message: message.slice(0, 120) });
  const optimizer = new Optimizer({ ...config, logger, stream: false });

  const messages = [
    { role: 'user', content: message }
  ];

  if (config.systemPrompt) {
    messages.unshift({ role: 'system', content: config.systemPrompt });
  }

  const stats = tokens.tokenStats(messages, config.contextLimit || 4096);
  logger.debug('Estatísticas de tokens', stats);

  try {
    const result = await optimizer.chat(messages, { stream: false });
    console.log('\n📥 Resposta completa:\n');
    console.log(result.content);
    console.log('\n--- Estatísticas ---');
    console.log(`Duração:     ${result.stats?.duration}s`);
    console.log(`Input tokens:  ${result.stats?.inputTokens}`);
    console.log(`Output tokens: ${result.stats?.outputTokens}`);
    console.log(`Total tokens:  ${result.stats?.totalTokens}`);
    console.log(`Token/s:       ${result.stats?.tokenPerSec}`);
    console.log(`Finish reason: ${result.finishReason}`);

    logger.info('Resposta recebida com sucesso', {
      contentLength: result.content.length,
      inputTokens: result.stats?.inputTokens,
      outputTokens: result.stats?.outputTokens,
      totalTokens: result.stats?.totalTokens,
      tokenPerSec: result.stats?.tokenPerSec,
      finishReason: result.finishReason
    });
  } catch (err) {
    logger.error('Falha ao receber resposta', { error: err.message });
    console.error('❌ Erro:', err.message);
    process.exit(1);
  } finally {
    await optimizer.close();
  }
}

main();
