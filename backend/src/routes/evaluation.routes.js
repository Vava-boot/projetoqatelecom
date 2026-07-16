/**
 * src/routes/evaluation.routes.js
 * POST   /api/evaluate         — avalia uma transcrição de texto e persiste
 * POST   /api/evaluate-audio   — transcreve um áudio, avalia e persiste
 * GET    /api/evaluations      — lista avaliações (filtros: type, search)
 * GET    /api/evaluations/:id  — detalhe de uma avaliação
 * DELETE /api/evaluations/:id  — remove uma avaliação
 *
 * Rotas ficam finas: validam entrada, chamam serviço/repositório e devolvem
 * a resposta. Toda regra de negócio vive em src/services/ e src/repositories/.
 */
const express = require("express");
const { env } = require("../config/env");
const upload = require("../middleware/upload");
const { validateEvalRequest, validateAudioRequest } = require("../utils/validators");
const { evaluateTranscript } = require("../services/evaluationService");
const { transcribeAudio } = require("../services/transcriptionService");
const repository = require("../repositories");

const router = express.Router();

function ensureApiKeyConfigured(res) {
  if (!env.OPENROUTER_API_KEY) {
    res.status(500).json({ error: "Chave de API não configurada no servidor (OPENROUTER_API_KEY)." });
    return false;
  }
  return true;
}

function buildProtocol(provided) {
  return (provided && provided.trim()) || String(Date.now());
}

// ── POST /api/evaluate ────────────────────────────────────────────────────
router.post("/evaluate", async (req, res, next) => {
  const validationError = validateEvalRequest(req.body);
  if (validationError) return res.status(400).json({ error: validationError });
  if (!ensureApiKeyConfigured(res)) return;

  const { agent, company, type, transcript, protocol, date } = req.body;

  try {
    console.log(`[Evaluate] ${agent} | ${company} | ${type} | ${transcript.length} chars`);
    const result = await evaluateTranscript({ agent, company, type, transcript });

    const saved = await repository.create({
      agent: agent.trim(),
      company: company.trim(),
      type,
      protocol: buildProtocol(protocol),
      date: date || new Date().toISOString().slice(0, 10),
      score: result.score,
      criteria: result.criteria,
      pontos_fortes: result.pontos_fortes,
      pontos_desenvolver: result.pontos_desenvolver,
      feedback: result.feedback,
      transcript,
      hasAudio: false,
      audioName: null,
    });

    console.log(`[Evaluate] Score: ${result.score} | id: ${saved.id}`);
    return res.status(201).json(saved);
  } catch (err) {
    return next(err);
  }
});

// ── POST /api/evaluate-audio ──────────────────────────────────────────────
router.post("/evaluate-audio", upload.single("audio"), async (req, res, next) => {
  const validationError = validateAudioRequest(req.body, req.file);
  if (validationError) return res.status(400).json({ error: validationError });
  if (!ensureApiKeyConfigured(res)) return;

  const { agent, company, type, protocol, date } = req.body;
  const sizeMB = (req.file.size / 1024 / 1024).toFixed(2);
  console.log(`[EvaluateAudio] ${agent} | ${company} | ${type} | ${sizeMB}MB | ${req.file.originalname}`);

  try {
    // 1) Transcrição real do áudio (nunca fabricamos conteúdo)
    const transcript = await transcribeAudio(req.file);

    // 2) Avaliação a partir da transcrição obtida
    const result = await evaluateTranscript({ agent, company, type, transcript });

    const saved = await repository.create({
      agent: agent.trim(),
      company: company.trim(),
      type,
      protocol: buildProtocol(protocol),
      date: date || new Date().toISOString().slice(0, 10),
      score: result.score,
      criteria: result.criteria,
      pontos_fortes: result.pontos_fortes,
      pontos_desenvolver: result.pontos_desenvolver,
      feedback: result.feedback,
      transcript,
      hasAudio: true,
      audioName: req.file.originalname,
    });

    console.log(`[EvaluateAudio] Score: ${result.score} | id: ${saved.id}`);
    return res.status(201).json(saved);
  } catch (err) {
    return next(err);
  } finally {
    if (req.file) req.file.buffer = null; // libera o buffer o quanto antes
  }
});

// ── GET /api/evaluations ──────────────────────────────────────────────────
router.get("/evaluations", async (req, res, next) => {
  try {
    const { type, search } = req.query;
    const rows = await repository.findAll({ type, search });
    return res.json(rows);
  } catch (err) {
    return next(err);
  }
});

// ── GET /api/evaluations/:id ──────────────────────────────────────────────
router.get("/evaluations/:id", async (req, res, next) => {
  try {
    const row = await repository.findById(req.params.id);
    if (!row) return res.status(404).json({ error: "Avaliação não encontrada." });
    return res.json(row);
  } catch (err) {
    return next(err);
  }
});

// ── DELETE /api/evaluations/:id ───────────────────────────────────────────
router.delete("/evaluations/:id", async (req, res, next) => {
  try {
    const ok = await repository.remove(req.params.id);
    if (!ok) return res.status(404).json({ error: "Avaliação não encontrada." });
    return res.status(204).send();
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
