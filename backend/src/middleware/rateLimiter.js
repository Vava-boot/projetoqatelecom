/**
 * src/middleware/rateLimiter.js
 * Limite de requisições por IP nas rotas /api/*.
 *
 * Nota de arquitetura: em uma única instância de servidor (como no Render,
 * modelo padrão deste projeto) o limite em memória funciona de forma
 * correta e global. Se o projeto crescer para múltiplas instâncias, será
 * necessário um store externo compartilhado (ex.: Redis) — deixado como
 * evolução futura documentada na AUDITORIA.md.
 */
const rateLimit = require("express-rate-limit");
const { env } = require("../config/env");

module.exports = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Muitas requisições. Tente novamente em alguns minutos." },
});
