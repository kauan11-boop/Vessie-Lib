/* ============================================================
   Script: config_manager.js
   Comando: Gerencia as configurações do sistema Vessie.
            Permite visualizar, atualizar e validar o arquivo
            de configuração (vessie.config.json).

   Log: Vessie/logs/config_manager.log
   Uso:
     node Vessie/scripts/config_manager.js              → mostra config
     node Vessie/scripts/config_manager.js show baseUrl  → lê um valor
     node Vessie/scripts/config_manager.js set baseUrl http://localhost:1234/v1  → atualiza
     node Vessie/scripts/config_manager.js reset         → reseta para padrão
   ============================================================ */
'use strict';

const path = require('path');
const fs = require('fs');
const utils = require('../vsl/libs/utils');

const configPath = path.resolve(__dirname, '../config/vessie.config.json');
const logDir = path.resolve(__dirname, '../logs');
utils.ensureDir(logDir);
const logFile = path.join(logDir, 'config_manager.log');
const logger = new utils.Logger({ level: 'info' });
const origWrite = logger._write.bind(logger);
logger._write = function (level, msg, data) {
  origWrite(level, msg, data);
  const ts = new Date().toISOString();
  const line = `[${ts}] [${level.toUpperCase()}] ${msg}${data ? ' | ' + JSON.stringify(data) : ''}\n`;
  try { fs.appendFileSync(logFile, line); } catch (e) { /* ignore */ }
};

const DEFAULT_CONFIG = {
  name: 'vessie-config',
  version: '1.0.0',
  description: 'Configuracao padrao do sistema Vessie para LM Studio',
  baseUrl: 'http://localhost:1234/v1',
  model: '',
  timeout: 30000,
  maxRetries: 3,
  retryBaseDelay: 500,
  stream: {
    enabled: true,
    highWaterMark: 65536,
    throttleMs: 30,
    heartbeatMs: 15000
  },
  connection: {
    keepAlive: true,
    keepAliveMsecs: 1000,
    maxSockets: 50,
    maxFreeSockets: 10,
    timeout: 60000
  },
  tokens: {
    contextLimit: 4096,
    reserveForCompletion: 512,
    trimStrategy: 'sliding-window'
  },
  cache: {
    ttl: 300000,
    maxEntries: 100
  },
  logging: {
    level: 'info',
    dir: 'Vessie/logs',
    maxFileSize: 10485760,
    maxFiles: 5
  }
};

function loadConfig() {
  if (fs.existsSync(configPath)) {
    return JSON.parse(fs.readFileSync(configPath, 'utf8'));
  }
  return { ...DEFAULT_CONFIG };
}

function saveConfig(config) {
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
}

function deepMerge(target, source) {
  for (const key of Object.keys(source)) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      target[key] = deepMerge(target[key] || {}, source[key]);
    } else {
      target[key] = source[key];
    }
  }
  return target;
}

async function main() {
  const cmd = process.argv[2];
  const config = loadConfig();

  logger.info('Config manager iniciado', { cmd, configPath });

  if (!cmd || cmd === 'show' || cmd === 'get') {
    const key = process.argv[3];
    if (key) {
      // Lê um valor específico
      const value = key.split('.').reduce((obj, k) => obj?.[k], config);
      if (value !== undefined) {
        console.log(`${key} = ${JSON.stringify(value)}`);
        logger.info('Config lida', { key, value: JSON.stringify(value).slice(0, 100) });
      } else {
        console.log(`Chave não encontrada: ${key}`);
        logger.warn('Chave de config não encontrada', { key });
      }
    } else {
      // Mostra tudo
      console.log('\n📋 Configuração atual:\n');
      console.log(JSON.stringify(config, null, 2));
      console.log('');
    }
    return;
  }

  if (cmd === 'set') {
    const key = process.argv[3];
    const value = process.argv[4];
    if (!key || value === undefined) {
      console.error('Uso: node Vessie/scripts/config_manager.js set <key> <value>');
      process.exit(1);
    }

    // Parseia o valor (JSON ou string)
    let parsedValue;
    try { parsedValue = JSON.parse(value); } catch { parsedValue = value; }

    // Navega e define a chave (suporta dot notation)
    const parts = key.split('.');
    let obj = config;
    for (let i = 0; i < parts.length - 1; i++) {
      if (!obj[parts[i]]) obj[parts[i]] = {};
      obj = obj[parts[i]];
    }
    obj[parts[parts.length - 1]] = parsedValue;

    // Validação
    if (key === 'baseUrl' && !utils.isValidUrl(value)) {
      console.error('❌ URL inválida');
      process.exit(1);
    }

    saveConfig(config);
    console.log(`✅ ${key} = ${value}`);
    logger.info('Config atualizada', { key, value: JSON.stringify(parsedValue).slice(0, 100) });
    return;
  }

  if (cmd === 'reset') {
    saveConfig({ ...DEFAULT_CONFIG });
    console.log('✅ Configuração resetada para padrão');
    logger.info('Config resetada para padrão');
    return;
  }

  if (cmd === 'validate') {
    const issues = [];
    if (!config.baseUrl) issues.push('baseUrl não definida');
    if (!utils.isValidUrl(config.baseUrl)) issues.push('baseUrl inválida');
    if (config.timeout < 1000) issues.push('timeout muito baixo');
    if (config.maxRetries < 0) issues.push('maxRetries inválido');

    if (issues.length === 0) {
      console.log('✅ Configuração válida');
      logger.info('Config validada com sucesso');
    } else {
      console.log('❌ Problemas encontrados:');
      issues.forEach(i => console.log(`   - ${i}`));
      logger.warn('Config tem problemas', { issues });
    }
    return;
  }

  console.error('Comando desconhecido. Comandos: show, set, reset, validate');
  process.exit(1);
}

main();
