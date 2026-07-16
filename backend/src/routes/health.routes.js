/**
 * src/routes/health.routes.js
 * Rotas de diagnóstico do backend.
 */
const express = require("express");
const { env } = require("../config/env");
const { listModels, OpenRouterError } = require("../services/openrouterClient");
const repository = require("../repositories");

const router = express.Router();

// GET /api/health — não depende de serviços externos.
router.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    key_configured: !!env.OPENROUTER_API_KEY,
    model_eval: env.MODEL_EVAL,
    model_stt: env.MODEL_STT,
    storage: repository.kind,
    node: process.version,
    env: env.NODE_ENV,
  });
});

// GET /api/test-openrouter — confirma que a chave/rede estão OK.
router.get("/test-openrouter", async (_req, res, next) => {
  if (!env.OPENROUTER_API_KEY) {
    return res.status(500).json({ error: "Chave de API não configurada no servidor (OPENROUTER_API_KEY)." });
  }
  try {
    const data = await listModels();
    return res.json({ status: "ok", models_count: data.data?.length ?? 0 });
  } catch (err) {
    if (err instanceof OpenRouterError) return res.status(err.status).json({ error: err.message });
    return next(err);
  }
});

module.exports = router;
