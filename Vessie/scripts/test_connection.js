/* ============================================================
   Script: test_connection.js
   Comando: Testa a conexão com o servidor LM Studio,
            mede latência e lista modelos disponíveis.

   Log: Vessie/logs/test_connection.log
   Uso: node Vessie/scripts/test_connection.js
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
const logFile = path.join(logDir, 'test_connection.log');
const logger = new utils.Logger({ level: config.logLevel || 'info' });
const origWrite = logger._write.bind(logger);
logger._write = function (level, msg, data) {
  origWrite(level, msg, data);
  const ts = new Date().toISOString();
  const line = `[${ts}] [${level.toUpperCase()}] ${msg}${data ? ' | ' + JSON.stringify(data) : ''}\n`;
  try { fs.appendFileSync(logFile, line); } catch (e) { /* ignore */ }
};

async function main() {
  logger.info('Teste de conexão iniciado', { baseUrl: config.baseUrl });
  console.log(`\n🧪 Testando conexão com LM Studio`);
  console.log(`   URL: ${config.baseUrl}\n`);

  const optimizer = new Optimizer({ ...config, logger });

  try {
    const t0 = Date.now();
    const result = await optimizer.checkConnection();
    const totalDuration = Date.now() - t0;

    if (result.ok) {
      console.log(`✅ Conectado! (latência: ${result.ms}ms | total: ${utils.formatDuration(totalDuration)})`);
      console.log(`   Modelos disponíveis: ${result.count}`);
      console.log('');
      result.models.forEach((m, i) => {
        console.log(`   ${i + 1}. ${m}`);
      });
      console.log('');
      logger.info('Conexão bem-sucedida', {
        latency: result.ms,
        totalDuration,
        modelCount: result.count,
        models: result.models
      });
    } else {
      console.log(`❌ Falha na conexão: ${result.err}`);
      console.log('\n   Verifique:');
      console.log('   - O servidor LM Studio está em execução? (aba Developer → Start Server)');
      console.log('   - A URL base está correta?');
      console.log('   - O CORS está habilitado nas configurações do servidor?');
      logger.error('Conexão falhou', { error: result.err, latency: result.ms });
    }
  } catch (err) {
    logger.error('Erro no teste de conexão', { error: err.message });
    console.error('❌ Erro:', err.message);
    process.exit(1);
  } finally {
    await optimizer.close();
  }
}

main();
