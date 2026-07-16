/**
 * server.js
 * ───────────────────────────────────────────────────────────────────────────
 * Ponto de entrada. Monta o app Express (middlewares + rotas + erro) e sobe
 * um servidor HTTP tradicional — modelo de deploy: Render (ver render.yaml
 * na raiz do projeto e README.md).
 *
 * Estrutura:
 *   server.js                        → monta o app e inicia o processo
 *   src/config/env.js                → leitura/validação de variáveis de ambiente
 *   src/config/db.js                 → pool Postgres (opcional, lazy)
 *   src/middleware/                  → cors, rate limit, upload, error handler
 *   src/routes/                      → rotas HTTP (finas)
 *   src/services/                    → regras de negócio + integração com a OpenRouter
 *   src/repositories/                → persistência (memória ou Postgres)
 *   src/utils/                       → funções puras auxiliares
 */
const express = require("express");

const { env, assertRequiredEnv } = require("./src/config/env");
const { runMigrations } = require("./src/config/db");
const corsMiddleware = require("./src/middleware/cors");
const rateLimiter = require("./src/middleware/rateLimiter");
const { notFoundHandler, globalErrorHandler } = require("./src/middleware/errorHandler");

const healthRoutes = require("./src/routes/health.routes");
const evaluationRoutes = require("./src/routes/evaluation.routes");

const app = express();

// Necessário para que express-rate-limit identifique o IP real do cliente
// atrás do proxy reverso do Render.
app.set("trust proxy", 1);

// ── Middlewares globais ─────────────────────────────────────────────────
app.use(corsMiddleware);
app.use(express.json({ limit: "1mb" }));
app.use("/api/", rateLimiter);

app.get("/", (_req, res) => {
  res.json({ service: "qa-telecom-backend", status: "online" });
});

app.use("/api", healthRoutes);
app.use("/api", evaluationRoutes);

app.use(notFoundHandler);
app.use(globalErrorHandler);

async function start() {
  assertRequiredEnv();

  try {
    await runMigrations();
  } catch (err) {
    console.error("[BOOT][ERRO] Falha ao migrar o banco de dados:", err.message);
    console.error("[BOOT] Continuando com o repositório em memória para esta execução.");
  }

  app.listen(env.PORT, "0.0.0.0", () => {
    console.log(`✅ Servidor rodando na porta ${env.PORT}`);
    console.log(`🔑 OPENROUTER_API_KEY: ${env.OPENROUTER_API_KEY ? "configurada ✓" : "NÃO CONFIGURADA ✗"}`);
    console.log(`🤖 Modelo de avaliação: ${env.MODEL_EVAL}`);
    console.log(`🎙️  Modelo de transcrição: ${env.MODEL_STT}`);
    console.log(`💾 Persistência: ${env.DATABASE_URL ? "Postgres" : "memória (efêmera)"}`);
    console.log(`🌐 Origens CORS permitidas: ${env.ALLOWED_ORIGINS.join(", ")}`);
  });
}

start();

module.exports = app;
