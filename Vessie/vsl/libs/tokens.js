/* ============================================================
   Vessie Script Language — Biblioteca tokens
   Contagem e limites de tokens, trimming de histórico
   ============================================================ */
'use strict';

/**
 * Estimativa de tokens baseada em caracteres.
 * Taxa média: ~3.8 caracteres por token (modelos Llama/DeepSeek).
 * Mais preciso que contagem exata sem precisar de tokenizador.
 */
function estimateTokens(text) {
  if (!text) return 0;
  // Ajuste para espaços e pontuação
  const clean = text.trim();
  if (clean.length === 0) return 0;
  // Contagem baseada em palavras + ajuste
  const words = clean.split(/\s+/).length;
  return Math.round((clean.length / 3.8) + (words * 0.3));
}

/**
 * Conta tokens de uma mensagem (role + content)
 */
function countMessageTokens(message) {
  let tokens = 0;
  if (message.role) tokens += 1;       // overhead do role
  if (message.content) tokens += estimateTokens(message.content);
  if (message.reasoning_content) tokens += estimateTokens(message.reasoning_content);
  tokens += 3; // overhead de formatação da mensagem
  return tokens;
}

/**
 * Calcula o total de tokens de um array de mensagens
 */
function countConversationTokens(messages) {
  const total = messages.reduce((sum, m) => sum + countMessageTokens(m), 0);
  return total + 3; // overhead final do conversacional
}

/**
 * Trim strategty: sliding window
 * Remove mensagens mais antigos (preservando system + últimas mensagens)
 * mantém o total abaixo do límite
 */
function trimConversation(messages, contextLimit, reserveForCompletion = 512) {
  const available = contextLimit - reserveForCompletion;
  const result = [];

  // Preserva system prompt
  const systemMsgs = messages.filter(m => m.role === 'system');
  const otherMsgs = messages.filter(m => m.role !== 'system');

  let used = systemMsgs.reduce((s, m) => s + countMessageTokens(m), 0);
  result.push(...systemMsgs);

  // Sliding window: mantém mensagens mais recentes
  for (let i = otherMsgs.length - 1; i >= 0; i--) {
    const t = countMessageTokens(otherMsgs[i]);
    if (used + t > available) break;
    result.unshift(otherMsgs[i]);
    used += t;
  }

  return result;
}

/**
 * Verifica se o histórico cabe no contexto
 */
function fitsInContext(messages, contextLimit) {
  return countConversationTokens(messages) <= contextLimit;
}

/**
 * Calcula estatísticas de tokens de uma conversa
 */
function tokenStats(messages, contextLimit = 4096) {
  const total = countConversationTokens(messages);
  return {
    totalTokens: total,
    contextLimit,
    available: Math.max(0, contextLimit - total),
    usagePercent: Math.round((total / contextLimit) * 100),
    fits: total <= contextLimit
  };
}

module.exports = {
  estimateTokens,
  countMessageTokens,
  countConversationTokens,
  trimConversation,
  fitsInContext,
  tokenStats
};
