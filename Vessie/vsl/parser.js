/* ============================================================
   Vessie Script Language — Parser
   Converte texto VSL em uma AST (Abstract Syntax Tree)
   ============================================================ */
'use strict';

/**
 * Tipos de nó AST suportados:
 *  - program: { type: 'program', body: [...] }
 *  - config: { type: 'config', assignments: [...] }
 *  - assignment: { type: 'assignment', name, value }
 *  - send: { type: 'send', message, to? }
 *  - receive: { type: 'receive', mode: 'stream'|'block', into? }
 *  - set: { type: 'set', name, value }
 *  - loop: { type: 'loop', count, body: [...] }
 *  - if: { type: 'if', condition, body: [...] }
 *  - print: { type: 'print', text }
 *  - batch: { type: 'batch', body: [...] }
 */

class VSLParser {
  constructor() {
    this.tokens = [];
    this.pos = 0;
  }

  /** Tokeniza o código VSL */
  tokenize(code) {
    const tokens = [];
    let i = 0;
    const len = code.length;

    while (i < len) {
      const ch = code[i];

      // Comentários
      if (ch === '#') {
        while (i < len && code[i] !== '\n') i++;
        continue;
      }

      // Whitespace
      if (/\s/.test(ch)) { i++; continue; }

      // Strings entre aspas duplas
      if (ch === '"') {
        i++;
        let str = '';
        while (i < len && code[i] !== '"') {
          if (code[i] === '\\' && i + 1 < len) {
            str += code[i + 1];
            i += 2;
          } else {
            str += code[i];
            i++;
          }
        }
        i++; // skip closing quote
        tokens.push({ type: 'string', value: str });
        continue;
      }

      // Numbers
      if (/\d/.test(ch)) {
        let num = '';
        while (i < len && /[\d.]/.test(code[i])) {
          num += code[i];
          i++;
        }
        tokens.push({ type: 'number', value: parseFloat(num) });
        continue;
      }

      // Identifiers e palavras-chave
      if (/[a-zA-Z_]/.test(ch)) {
        let word = '';
        while (i < len && /[a-zA-Z0-9_]/.test(code[i])) {
          word += code[i];
          i++;
        }
        tokens.push({ type: 'word', value: word });
        continue;
      }

      // Operadores e delimitadores
      const twoCharOps = ['==', '!=', '>=', '<=', '->'];
      const twoChar = code.slice(i, i + 2);
      if (twoCharOps.includes(twoChar)) {
        tokens.push({ type: 'op', value: twoChar });
        i += 2;
        continue;
      }

      const singleOps = ['{', '}', '(', ')', '=', ';', '$', ':', ',', '[', ']', '>', '<', '!'];
      if (singleOps.includes(ch)) {
        tokens.push({ type: 'op', value: ch });
        i++;
        continue;
      }

      // Caractere desconhecido - pula
      i++;
    }

    return tokens;
  }

  /** Parser de tokens para AST */
  parse(code) {
    this.tokens = this.tokenize(code);
    this.pos = 0;
    const body = this.parseBlock();
    return { type: 'program', body };
  }

  peek() {
    return this.tokens[this.pos];
  }

  peekNext() {
    return this.tokens[this.pos + 1];
  }

  consume(type, value) {
    const tok = this.tokens[this.pos];
    if (!tok) throw new Error('Token inesperado: fim do input');
    if (type && tok.type !== type) {
      throw new Error(`Token inesperado: esperado ${type} mas recebido ${tok.type} (${tok.value})`);
    }
    if (value && tok.value !== value) {
      throw new Error(`Token inesperado: esperado '${value}' mas recebido '${tok.value}'`);
    }
    this.pos++;
    return tok;
  }

  matchWord(words) {
    const tok = this.peek();
    if (tok && tok.type === 'word' && words.includes(tok.value)) {
      this.pos++;
      return tok.value;
    }
    return null;
  }

  parseBlock() {
    const body = [];
    while (this.pos < this.tokens.length) {
      const tok = this.peek();
      if (tok.type === 'op' && tok.value === '}') break;
      body.push(this.parseStatement());
    }
    return body;
  }

  parseStatement() {
    const tok = this.peek();

    // Config block: config { ... }
    if (tok.type === 'word' && tok.value === 'config') {
      return this.parseConfig();
    }

    // Keyword-based statements
    if (tok.type === 'word') {
      switch (tok.value) {
        case 'send': return this.parseSend();
        case 'receive': return this.parseReceive();
        case 'set': return this.parseSet();
        case 'loop': return this.parseLoop();
        case 'if': return this.parseIf();
        case 'print': return this.parsePrint();
        case 'batch': return this.parseBatch();
        case 'wait': return this.parseWait();
        case 'model': return this.parseModel();
      }
    }

    // Bloco anônimo: { ... }
    if (tok.type === 'op' && tok.value === '{') {
      this.consume('op', '{');
      const body = this.parseBlock();
      this.consume('op', '}');
      return { type: 'block', body };
    }

    throw new Error(`Declaração desconhecida: ${tok.value}`);
  }

  parseConfig() {
    this.consume('word', 'config');
    this.consume('op', '{');
    const assignments = [];
    while (this.peek().type !== 'op' || this.peek().value !== '}') {
      const name = this.consume('word').value;
      this.consume('op', '=');
      const value = this.parseValue();
      assignments.push({ name, value });
      if (this.peek().type === 'op' && this.peek().value === ';') this.consume('op', ';');
    }
    this.consume('op', '}');
    return { type: 'config', assignments };
  }

  parseSend() {
    this.consume('word', 'send');
    const message = this.parseValue();
    let to = null;
    if (this.matchWord(['to'])) {
      to = this.parseValue();
    }
    return { type: 'send', message, to };
  }

  parseReceive() {
    this.consume('word', 'receive');
    let mode = 'block';
    if (this.matchWord(['stream', 'block'])) {
      mode = mode === 'stream' ? 'stream' : 'block';
    }
    let into = null;
    if (this.matchWord(['into'])) {
      into = this.consume('word').value;
    }
    return { type: 'receive', mode, into };
  }

  parseSet() {
    this.consume('word', 'set');
    const tok = this.peek();
    if (tok.type === 'op' && tok.value === '$') {
      this.consume('op', '$');
      const name = this.consume('word').value;
      this.consume('op', '=');
      const value = this.parseValue();
      return { type: 'set', name, value };
    }
    // set name = value (sem $)
    const name = this.consume('word').value;
    this.consume('op', '=');
    const value = this.parseValue();
    return { type: 'set', name, value };
  }

  parseLoop() {
    this.consume('word', 'loop');
    const countTok = this.peek();
    let count;
    if (countTok.type === 'number') {
      count = this.consume('number').value;
    } else if (countTok.type === 'word' && /^\d+$/.test(countTok.value)) {
      count = parseInt(this.consume('word').value, 10);
    } else {
      count = 1;
    }
    this.consume('op', '{');
    const body = this.parseBlock();
    this.consume('op', '}');
    return { type: 'loop', count, body };
  }

  parseIf() {
    this.consume('word', 'if');
    const condition = this.parseCondition();
    this.consume('op', '{');
    const body = this.parseBlock();
    this.consume('op', '}');
    let elseBody = null;
    if (this.matchWord(['else'])) {
      if (this.peek().type === 'op' && this.peek().value === '{') {
        this.consume('op', '{');
        elseBody = this.parseBlock();
        this.consume('op', '}');
      } else {
        elseBody = [this.parseStatement()];
      }
    }
    return { type: 'if', condition, body, elseBody };
  }

  parseCondition() {
    // Ex: $var contains "text"  |  $var == "value"
    let left = null;
    let op = null;
    let right = null;

    const tok = this.peek();
    if (tok.type === 'op' && tok.value === '$') {
      this.consume('op', '$');
      left = { type: 'var', name: this.consume('word').value };
    } else if (tok.type === 'word') {
      left = this.parseValue();
    }

    const opTok = this.peek();
    if (opTok && opTok.type === 'word' && ['contains', 'equals', '>', '<', '==', '!='].includes(opTok.value)) {
      op = this.consume('word').value;
      right = this.parseValue();
    }

    return { left, op, right };
  }

  parsePrint() {
    this.consume('word', 'print');
    const value = this.parseValue();
    return { type: 'print', text: value };
  }

  parseBatch() {
    this.consume('word', 'batch');
    this.consume('op', '{');
    const body = this.parseBlock();
    this.consume('op', '}');
    return { type: 'batch', body };
  }

  parseWait() {
    this.consume('word', 'wait');
    const value = this.parseValue();
    return { type: 'wait', duration: value };
  }

  parseModel() {
    this.consume('word', 'model');
    const action = this.peek().value;
    if (action === 'list') {
      this.consume();
      return { type: 'model', action: 'list' };
    }
    if (action === 'use') {
      this.consume();
      const model = this.parseValue();
      return { type: 'model', action: 'use', model };
    }
    throw new Error('Comando model inválido');
  }

  parseValue() {
    const tok = this.peek();
    if (tok.type === 'string') {
      this.pos++;
      return { type: 'string', value: tok.value };
    }
    if (tok.type === 'number') {
      this.pos++;
      return { type: 'number', value: tok.value };
    }
    if (tok.type === 'op' && tok.value === '$') {
      this.consume('op', '$');
      const name = this.consume('word').value;
      return { type: 'var', name };
    }
    if (tok.type === 'word') {
      // Boolean / literal
      if (tok.value === 'true') { this.pos++; return { type: 'boolean', value: true }; }
      if (tok.value === 'false') { this.pos++; return { type: 'boolean', value: false }; }
      if (tok.value === 'null' || tok.value === 'none') { this.pos++; return { type: 'null' }; }
      this.pos++;
      return { type: 'identifier', value: tok.value };
    }
    if (tok.type === 'op' && tok.value === '(') {
      this.consume('op', '(');
      const args = [];
      while (this.peek().type !== 'op' || this.peek().value !== ')') {
        args.push(this.parseValue());
        if (this.peek().type === 'op' && this.peek().value === ',') this.consume('op', ',');
      }
      this.consume('op', ')');
      return { type: 'group', values: args };
    }
    throw new Error(`Valor inesperado: ${tok.type} (${tok.value})`);
  }
}

const parser = new VSLParser();
module.exports = { VSLParser, parse: (code) => parser.parse(code) };
