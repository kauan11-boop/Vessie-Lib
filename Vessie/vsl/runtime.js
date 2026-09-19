/* ============================================================
   Vessie Script Language — Runtime
   Contexto de execução, variáveis, estado global e libs
   ============================================================ */
'use strict';

const utils = require('./libs/utils');
const tokens = require('./libs/tokens');
const http = require('./libs/http');
const stream = require('./libs/stream');
const lmstudio = require('./libs/lmstudio');

/** Estado global do runtime VSL */
class VSLRuntime {
  constructor(config = {}) {
    this.variables = new Map();
    this.config = { ...config };
    this.conversation = [];
    this.lastResponse = null;
    this.logs = [];

    // Registro de bibliotecas disponíveis
    this.libs = {
      utils,
      tokens,
      http,
      stream,
      lmstudio
    };

    // Variáveis especiais predefinidas
    this.variables.set('this.model', config.model || '');
    this.variables.set('this.url', config.baseUrl || 'http://localhost:1234/v1');
    this.variables.set('this.history', []);
    this.variables.set('this.response', null);
  }

  /** Define ou atualiza uma variável */
  set(name, value) {
    this.variables.set(name, value);
    if (name.startsWith('this.')) this.config[name.slice(5)] = value;
  }

  /** Lê o valor de uma variável */
  get(name) {
    if (!this.variables.has(name)) {
      return undefined;
    }
    return this.variables.get(name);
  }

  /** Resolve um nó de valor da AST para um valor JavaScript */
  resolveValue(node) {
    if (!node) return undefined;
    switch (node.type) {
      case 'string':  return node.value;
      case 'number':  return node.value;
      case 'boolean': return node.value;
      case 'null':    return null;
      case 'identifier': return node.value;
      case 'var':     return this.get(node.name);
      case 'group':   return node.values.map(v => this.resolveValue(v));
      default:        return node.value;
    }
  }

  /** Reseta o histórico da conversa atual */
  resetConversation() {
    this.conversation = [];
    this.variables.set('this.history', []);
  }

  /** Adiciona uma mensagem ao histórico */
  addMessage(role, content) {
    const msg = { id: utils.uid(), role, content, ts: Date.now() };
    this.conversation.push(msg);
    this.variables.set('this.history', [...this.conversation]);
    return msg;
  }

  /** Log estruturado no runtime */
  log(level, msg, data) {
    const entry = { level, msg, data, ts: new Date().toISOString() };
    this.logs.push(entry);
    if (this.libs.utils) {
      const logger = new this.libs.utils.Logger({ level: this.config.logLevel || 'info' });
      logger[level] ? logger[level](msg, data) : logger.info(msg, data);
    }
  }

  /** Serializa o estado atual para inspeção */
  inspect() {
    return {
      variables: Object.fromEntries(this.variables),
      config: this.config,
      conversationLength: this.conversation.length,
      lastResponse: this.lastResponse ? { role: this.lastResponse.role, content: this.lastResponse.content?.slice(0, 100) } : null
    };
  }
}

module.exports = { VSLRuntime };
