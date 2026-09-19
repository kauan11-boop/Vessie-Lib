/* ============================================================
   Vessie Script Language — Biblioteca utils
   Utilitários gerais: UID, timestamp, log, formatação, validação
   ============================================================ */
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

/** Gera um ID único curto e seguro */
function uid() {
  return crypto.randomBytes(8).toString('hex');
}

/** Timestamp Unix em milissegundos */
function now() {
  return Date.now();
}

/** Formata duração em ms para string legível */
function formatDuration(ms) {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(2)}s`;
  const m = Math.floor(ms / 60000);
  const s = Math.round((ms % 60000) / 1000);
  return `${m}m ${s}s`;
}

/** Formata bytes para string legível */
function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

/** Escapa string para uso seguro */
function escapeStr(str) {
  return String(str)
    .replace(/[&]/g, '&')
    .replace(/</g, '<')
    .replace(/>/g, '>')
    .replace(/"/g, '"')
    .replace(/'/g, '&#39;');
}

/** Valida se uma string é uma URL válida */
function isValidUrl(str) {
  try {
    new URL(str);
    return true;
  } catch {
    return false;
  }
}

/** Garante que um diretório existe (cria se necessário) */
function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

/** Sistema de log estruturado com níveis */
class Logger {
  constructor(opts = {}) {
    this.level = opts.level || 'info';
    this.dir = opts.dir || './logs';
    this.levels = { debug: 0, info: 1, warn: 2, error: 3 };
  }

  _shouldLog(level) {
    return this.levels[level] >= this.levels[this.level];
  }

  _write(level, msg, data) {
    if (!this._shouldLog(level)) return;
    const ts = new Date().toISOString();
    const line = `[${ts}] [${level.toUpperCase()}] ${msg}${data ? ' | ' + JSON.stringify(data) : ''}`;
    console.log(line);
  }

  debug(msg, data) { this._write('debug', msg, data); }
  info(msg, data) { this._write('info', msg, data); }
  warn(msg, data) { this._write('warn', msg, data); }
  error(msg, data) { this._write('error', msg, data); }
}

/** Função debounce para otimização de chamadas */
function debounce(fn, wait) {
  let timeout;
  return function (...args) {
    const later = () => { timeout = null; fn.apply(this, args); };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/** Função throttle para limitar taxa de execução */
function throttle(fn, limit) {
  let inThrottle;
  return function (...args) {
    if (!inThrottle) {
      fn.apply(this, args);
      inThrottle = true;
      setTimeout(() => { inThrottle = false; }, limit);
    }
  };
}

module.exports = {
  uid,
  now,
  formatDuration,
  formatBytes,
  escapeStr,
  isValidUrl,
  ensureDir,
  Logger,
  debounce,
  throttle
};
