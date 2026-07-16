/**
 * src/middleware/errorHandler.js
 * Handler de 404 + handler de erro global (deve ser o ÚLTIMO app.use()).
 */
const multer = require("multer");
const { OpenRouterError } = require("../services/openrouterClient");
const { EvalParseError } = require("../services/evaluationService");

function notFoundHandler(req, res) {
  res.status(404).json({ error: `Rota não encontrada: ${req.method} ${req.originalUrl}` });
}

function globalErrorHandler(err, _req, res, _next) {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(413).json({ error: "Arquivo de áudio muito grande. Máximo: 25 MB." });
    }
    if (err.code === "LIMIT_UNEXPECTED_FILE") {
      return res.status(415).json({ error: "Formato não suportado. Envie um arquivo de áudio." });
    }
    return res.status(400).json({ error: `Erro no upload: ${err.message}` });
  }

  if (err instanceof OpenRouterError) {
    return res.status(err.status).json({ error: err.message });
  }

  if (err instanceof EvalParseError) {
    return res.status(502).json({ error: err.message });
  }

  if (err.type === "entity.parse.failed") {
    return res.status(400).json({ error: "Corpo da requisição não é um JSON válido." });
  }

  if (err.message === "Origem não permitida por CORS.") {
    return res.status(403).json({ error: err.message });
  }

  console.error("[ERRO][Global]", err.stack || err.message);
  return res.status(500).json({ error: "Erro interno. Tente novamente." });
}

module.exports = { notFoundHandler, globalErrorHandler };
