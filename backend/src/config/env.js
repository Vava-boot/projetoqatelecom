/**
 * src/config/env.js
 * ───────────────────────────────────────────────────────────────────────────
 * Única fonte de leitura de `process.env`. Nenhum outro módulo deve acessar
 * variáveis de ambiente diretamente.
 */
require("dotenv").config();

const REQUIRED_VARS = ["OPENROUTER_API_KEY"];

function parseOrigins(raw) {
  return (raw || "http://localhost:5173")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
}

function readEnv() {
  const missing = REQUIRED_VARS.filter((k) => !process.env[k]);

  return {
    // ── Servidor ────────────────────────────────────────────────────────
    PORT: process.env.PORT || 3001,
    NODE_ENV: process.env.NODE_ENV || "development",

    // ── CORS ────────────────────────────────────────────────────────────
    ALLOWED_ORIGINS: parseOrigins(process.env.ALLOWED_ORIGINS),

    // ── Banco de dados (opcional) ───────────────────────────────────────
    // Se DATABASE_URL não estiver definida, a aplicação usa um repositório
    // em memória automaticamente (zero-config). Ver src/repositories/.
    DATABASE_URL: process.env.DATABASE_URL || null,

    // ── OpenRouter ──────────────────────────────────────────────────────
    OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY || null,
    OPENROUTER_CHAT_URL: "https://openrouter.ai/api/v1/chat/completions",
    OPENROUTER_STT_URL: "https://openrouter.ai/api/v1/audio/transcriptions",
    OPENROUTER_MODELS_URL: "https://openrouter.ai/api/v1/models",
    APP_REFERER: process.env.APP_REFERER || "http://localhost:5173",
    APP_TITLE: process.env.APP_TITLE || "QA Telecom Monitor",

    // ── Modelos ─────────────────────────────────────────────────────────
    // anthropic/claude-haiku-4.5: melhor equilíbrio custo/qualidade/consistência
    // para este caso de uso (ver AUDITORIA.md, seção "Revisão da IA utilizada").
    MODEL_EVAL: process.env.MODEL_EVAL || "anthropic/claude-haiku-4.5",
    MODEL_STT: process.env.MODEL_STT || "openai/whisper-1",

    // ── Limites e timeouts ──────────────────────────────────────────────
    MAX_AUDIO_SIZE_MB: 25,
    EVAL_TIMEOUT_MS: 45_000,
    STT_TIMEOUT_MS: 90_000,
    RATE_LIMIT_WINDOW_MS: 15 * 60 * 1000,
    RATE_LIMIT_MAX: 30,

    _missing: missing,
  };
}

const env = readEnv();

function assertRequiredEnv() {
  if (env._missing.length > 0) {
    console.error(
      `[BOOT][ERRO] Variáveis de ambiente ausentes: ${env._missing.join(", ")}. ` +
      `Configure-as no arquivo .env (local) ou no painel do Render (produção).`
    );
    return false;
  }
  console.log("[BOOT] Variáveis de ambiente obrigatórias: OK");
  return true;
}

module.exports = { env, assertRequiredEnv };
