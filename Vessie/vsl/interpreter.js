/* ============================================================
   Vessie Script Language — Interpreter
   Executa a AST gerada pelo parser usando o runtime e as libs.

   Comandos VSL suportados:
   - config { key = value; ... }      → atualiza configurações
   - send "texto" [to $var]          → envia mensagem ao modelo
   - receive [stream] [into $var]     → recebe resposta
   - set $var = value                → define variável
   - loop N { ... }                  → repete N vezes
   - if $var contains "x" { ... }    → condicional
   - print "texto"                    → imprime no console
   - batch { ... }                   → grupo de operações
   - wait N                          → pausa N segundos
   - model list / model use "id"     → gerencia modelos
   ============================================================ */
'use strict';

const { VSLRuntime } = require('./runtime');
const { LMStudioClient } = require('./libs/lmstudio');
const { parse } = require('./parser');
const utils = require('./libs/utils');
const tokens = require('./libs/tokens');
const path = require('path');
const fs = require('fs');

class VSLInterpreter {
  constructor(config = {}) {
    this.config = config;
    this.runtime = new VSLRuntime(config);
    this.client = null;
    this._initClient();
  }

  _initClient() {
    try {
      this.client = new LMStudioClient({
        ...this.config,
        logger: new utils.Logger({ level: this.config.logLevel || 'info' })
      });
    } catch (err) {
      this.runtime.log('error', 'Falha ao inicializar cliente LM Studio', { error: err.message });
      this.client = null;
    }
  }

  /** Executa código VSL (string) */
  async run(code) {
    const ast = parse(code);
    return await this.execute(ast);
  }

  /** Executa um arquivo VSL (.vsl) */
  async runFile(filePath) {
    const fullPath = path.resolve(filePath);
    if (!fs.existsSync(fullPath)) {
      throw new Error(`Arquivo não encontrado: ${fullPath}`);
    }
    const code = fs.readFileSync(fullPath, 'utf8');
    return await this.run(code);
  }

  /** Executa um nó de programa (lista de statements) */
  async execute(node) {
    if (!node || !node.body) return null;
    let result = null;
    for (const stmt of node.body) {
      result = await this.executeStatement(stmt);
    }
    return result;
  }

  /** Executa um statement individual */
  async executeStatement(stmt) {
    switch (stmt.type) {
      case 'config':     return this._execConfig(stmt);
      case 'send':       return await this._execSend(stmt);
      case 'receive':    return await this._execReceive(stmt);
      case 'set':        return this._execSet(stmt);
      case 'loop':       return await this._execLoop(stmt);
      case 'if':         return await this._execIf(stmt);
      case 'print':      return this._execPrint(stmt);
      case 'batch':      return await this._execBatch(stmt);
      case 'wait':       return await this._execWait(stmt);
      case 'model':      return await this._execModel(stmt);
      case 'block':      return await this.execute(stmt);
      default:
        this.runtime.log('warn', `Comando desconhecido: ${stmt.type}`);
        return null;
    }
  }

  /** Executa config { key = value; ... } */
  _execConfig(stmt) {
    for (const assign of stmt.assignments) {
      const val = this.runtime.resolveValue(assign.value);
      this.runtime.set('this.' + assign.name, val);
      this.runtime.log('debug', 'Config atualizada', { key: assign.name, value: val });
    }
    this._reinitClient();
    return stmt.assignments.length;
  }

  _reinitClient() {
    if (this.client) this.client.close();
    this._initClient();
  }

  /** Executa send "texto" [to $var] */
  async _execSend(stmt) {
    const message = this.runtime.resolveValue(stmt.message);
    if (!message) {
      this.runtime.log('warn', 'Mensagem vazia ignorada');
      return null;
    }

    const msg = this.runtime.addMessage('user', message);
    this.runtime.log('debug', 'Mensagem enviada', { content: message.slice(0, 100) });

    // Se seguido de receive, o sistema automaticamente faz a geração
    return msg;
  }

  /** Executa receive [stream] [into $var] */
  async _execReceive(stmt) {
    if (!this.client) {
      throw new Error('Cliente LM Studio não inicializado');
    }

    const mode = stmt.mode === 'stream';
    const messages = this.runtime.conversation;

    // Trim inteligente de tokens antes de enviar
    const contextLimit = this.runtime.get('this.contextLimit') || this.config.contextLimit || 4096;
    const reserve = this.runtime.get('this.reserveForCompletion') || this.config.reserveForCompletion || 512;
    const trimmed = tokens.trimConversation(messages, contextLimit, reserve);

    const opts = {
      model: this.runtime.get('this.model') || this.config.model,
      temperature: this.runtime.get('this.temperature') || this.config.temperature || 0.7,
      topP: this.runtime.get('this.topP') || this.config.topP || 0.95,
      maxTokens: this.runtime.get('this.maxTokens') || this.config.maxTokens || -1,
      stream: mode,
      contextLimit,
      reserveForCompletion: reserve,
      systemPrompt: this.runtime.get('this.systemPrompt') || this.config.systemPrompt
    };

    let result;
    if (mode) {
      // Streaming: coleta tokens via callback
      const onToken = (text, info) => {
        process.stdout.write(text);
        this.runtime.log('debug', 'Token recebido', { count: info.tokenCount });
      };
      result = await this.client.chatStream(trimmed, onToken, opts);
    } else {
      result = await this.client.chat(trimmed, opts);
    }

    // Armazena resposta
    this.runtime.lastResponse = result;
    this.runtime.variables.set('this.response', result);

    if (result.content) {
      this.runtime.addMessage('assistant', result.content);
    }

    // Se houver direcionamento "into $var"
    if (stmt.into) {
      this.runtime.set(stmt.into, result);
    }

    process.stdout.write('\n');
    this.runtime.log('info', 'Resposta recebida', {
      contentLength: result.content?.length || 0,
      duration: result.stats?.duration
    });

    return result;
  }

  /** Executa set $var = value */
  _execSet(stmt) {
    const val = this.runtime.resolveValue(stmt.value);
    this.runtime.set(stmt.name, val);
    this.runtime.log('debug', 'Variável definida', { name: stmt.name, value: val });
    return val;
  }

  /** Executa loop N { ... } */
  async _execLoop(stmt) {
    const count = typeof stmt.count === 'number' ? stmt.count : 1;
    for (let i = 0; i < count; i++) {
      this.runtime.log('debug', `Loop iteração ${i + 1}/${count}`);
      for (const subStmt of stmt.body) {
        await this.executeStatement(subStmt);
      }
    }
    return count;
  }

  /** Executa if $var contains "x" { ... } [else { ... }] */
  async _execIf(stmt) {
    const { left, op, right } = stmt.condition;
    let leftVal = null;
    let rightVal = null;

    if (left) { leftVal = left.type === 'var' ? this.runtime.get(left.name) : this.runtime.resolveValue(left); }
    if (right) { rightVal = right.type === 'var' ? this.runtime.get(right.name) : this.runtime.resolveValue(right); }

    let condResult = false;
    if (op === 'contains') {
      condResult = String(leftVal || '').includes(String(rightVal || ''));
    } else if (op === 'equals') {
      condResult = String(leftVal) === String(rightVal);
    } else if (op === '==' || op === 'equals') {
      condResult = leftVal == rightVal;
    } else if (op === '!=') {
      condResult = leftVal != rightVal;
    } else if (op === '>' || op === '<' || op === '>=' || op === '<=') {
      condResult = eval(`${leftVal} ${op} ${rightVal}`);
    }

    if (condResult) {
      for (const subStmt of stmt.body) {
        await this.executeStatement(subStmt);
      }
    } else if (stmt.elseBody) {
      for (const subStmt of stmt.elseBody) {
        await this.executeStatement(subStmt);
      }
    }

    return condResult;
  }

  /** Executa print "texto" */
  _execPrint(stmt) {
    const val = this.runtime.resolveValue(stmt.text);
    console.log(val);
    return val;
  }

  /** Executa batch { ... } */
  async _execBatch(stmt) {
    this.runtime.log('info', 'Iniciando batch de operações');
    const results = [];
    for (const subStmt of stmt.body) {
      const r = await this.executeStatement(subStmt);
      results.push(r);
    }
    this.runtime.log('info', 'Batch concluído', { count: results.length });
    return results;
  }

  /** Executa wait N */
  async _execWait(stmt) {
    const duration = this.runtime.resolveValue(stmt.duration);
    const ms = (typeof duration === 'number' && duration < 10) ? duration * 1000 : duration;
    this.runtime.log('debug', `Aguardando ${ms}ms`);
    return new Promise(r => setTimeout(r, ms));
  }

  /** Executa model list / model use "id" */
  async _execModel(stmt) {
    if (!this.client) {
      throw new Error('Cliente LM Studio não inicializado');
    }

    if (stmt.action === 'list') {
      const models = await this.client.listModels(true);
      console.log('\nModelos disponíveis:');
      models.forEach((m, i) => {
        console.log(`  ${i + 1}. ${m.id}${m.size ? ` (${m.size})` : ''}`);
      });
      return models;
    }

    if (stmt.action === 'use') {
      const modelName = this.runtime.resolveValue(stmt.model);
      this.runtime.set('this.model', modelName);
      this._reinitClient();
      console.log(`Modelo selecionado: ${modelName}`);
      return modelName;
    }
  }

  /** Fecha recursos */
  async close() {
    if (this.client) await this.client.close();
  }
}

module.exports = { VSLInterpreter };
