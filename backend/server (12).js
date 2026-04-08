require("dotenv").config();
const express   = require("express");
const cors      = require("cors");
const rateLimit = require("express-rate-limit");
const multer    = require("multer");
const FormData  = require("form-data");

// ── App ───────────────────────────────────────────────────────────────────────
const app = express();
app.set("trust proxy", 1);

// ── CORS ──────────────────────────────────────────────────────────────────────
app.use(cors({ origin: true, methods: ["GET", "POST", "OPTIONS"], credentials: false }));
app.options("*", cors());

// ── Body parser ───────────────────────────────────────────────────────────────
app.use(express.json({ limit: "1mb" }));

// ── Rate limiting ─────────────────────────────────────────────────────────────
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Muitas requisições. Tente novamente em alguns minutos." }
});
app.use("/api/", limiter);

// ── Multer (áudio em memória, máx 25 MB) ─────────────────────────────────────
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ["audio/mpeg", "audio/mp4", "audio/wav", "audio/ogg",
                     "audio/webm", "audio/aac", "audio/flac", "audio/x-m4a",
                     "application/octet-stream"];
    if (allowed.includes(file.mimetype) || file.mimetype.startsWith("audio/")) {
      cb(null, true);
    } else {
      cb(new Error("Formato de áudio não suportado."));
    }
  }
});

// ── Constantes ────────────────────────────────────────────────────────────────
const OR_BASE    = "https://openrouter.ai/api/v1";
const REFERER    = "https://projetoqatelecom.vercel.app";
const APP_TITLE  = "QA Telecom Monitor";
const MODEL_EVAL = "anthropic/claude-3.5-sonnet";
const MODEL_STT  = "openai/whisper-1";

// ── Helpers ───────────────────────────────────────────────────────────────────
function getKey(res) {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) {
    console.error("[ERRO] OPENROUTER_API_KEY não configurada");
    if (res) res.status(500).json({ error: "Chave de API não configurada no servidor." });
    return null;
  }
  return key;
}

function orHeaders(key, extra = {}) {
  return {
    "Authorization": `Bearer ${key}`,
    "HTTP-Referer":  REFERER,
    "X-Title":       APP_TITLE,
    ...extra
  };
}

function handleOrError(status, text, res) {
  console.error(`[ERRO] OpenRouter HTTP ${status}:`, text.slice(0, 300));
  const map = {
    401: "Chave de API inválida. Verifique sua OPENROUTER_API_KEY.",
    402: "Saldo insuficiente na conta OpenRouter. Adicione créditos.",
    429: "Limite de requisições atingido. Aguarde alguns instantes."
  };
  res.status(502).json({ error: map[status] || `Erro ao consultar IA (HTTP ${status}).` });
}

function sanitize(str, maxLen = 8000) {
  if (typeof str !== "string") return "";
  return str.replace(/<[^>]*>/g, "").trim().slice(0, maxLen);
}

// ── Validação (não alterada) ──────────────────────────────────────────────────
function validateEvalRequest(body) {
  const { agent, company, type, transcript } = body;
  if (!agent    || typeof agent    !== "string" || agent.trim().length < 2)          return "Campo 'agent' inválido.";
  if (!company  || typeof company  !== "string" || company.trim().length < 1)         return "Campo 'company' inválido.";
  if (!["Ligação", "Chat"].includes(type))                                            return "Campo 'type' deve ser 'Ligação' ou 'Chat'.";
  if (!transcript || typeof transcript !== "string" || transcript.trim().length < 10) return "Transcrição muito curta ou ausente.";
  return null;
}

// ── buildPrompt (não alterada) ────────────────────────────────────────────────
function buildPrompt(agent, company, type, transcript) {
  const criteriosLigacao = `saudacao (Saudação), tom_voz (Tom de Voz), tempo_espera (Tempo de Espera), tempo_atendimento (Tempo de Atendimento), uso_mudo (Utilização do Mudo), personalizacao (Personalização), tratativa (Tratativa sondagem resolução), gramatica (Gramática), dados_obrigatorios (Dados obrigatórios), protocolo_encerramento (Protocolo e Encerramento)`;
  const criteriosChat    = `saudacao (Saudação), empatia (Empatia), tempo_espera (Tempo de Espera), tempo_atendimento (Tempo de Atendimento), tempo_resposta (Tempo de Resposta), gramatica (Gramática), sondagem (Sondagem), confirmacao_dados (Confirmação de Dados), personalizacao (Personalização), protocolo_encerramento (Protocolo e Encerramento)`;

  return `Você atua como Avaliador de Qualidade (QA) Sênior de Telecomunicações (N1/N2).
Analise o ${type} do agente ${sanitize(agent, 100)} na empresa ${sanitize(company, 100)}.

REGRAS:
- Nota 10 exige perfeição absoluta.
- Falhas críticas de processo (não confirmar CPF/dados, não fornecer protocolo) resultam em nota 0-4 no critério.
- Seja rigoroso. Não invente dados que não estejam na transcrição.
- Use o primeiro nome do agente no feedback (ex: "Artur, ...").
- Feedbacks construtivos: elogio genuíno + ponto de melhoria respeitoso.
- Pontos Fortes e Pontos a Desenvolver: máximo 2 frases diretas cada.

CONTEÚDO DO ATENDIMENTO:
${sanitize(transcript, 7000)}

CRITÉRIOS PARA AVALIAR (0-10 cada):
${type === "Chat" ? criteriosChat : criteriosLigacao}

Responda SOMENTE em JSON válido, sem markdown, sem explicações fora do JSON:
{"criteria":[{"id":"saudacao","score":8,"obs":"observação detalhada"},{"id":"tom_voz","score":7,"obs":"..."},{"id":"tempo_espera","score":9,"obs":"..."},{"id":"tempo_atendimento","score":7,"obs":"..."},{"id":"uso_mudo","score":6,"obs":"..."},{"id":"personalizacao","score":7,"obs":"..."},{"id":"tratativa","score":8,"obs":"..."},{"id":"gramatica","score":8,"obs":"..."},{"id":"dados_obrigatorios","score":9,"obs":"..."},{"id":"protocolo_encerramento","score":6,"obs":"..."}],"pontos_fortes":"texto curto e direto","pontos_desenvolver":"texto curto e direto","feedback":"Feedback construtivo usando primeiro nome do agente"}`;
}

// ── Avaliação com Claude (reutilizável) ───────────────────────────────────────
async function runEvaluation(key, agent, company, type, transcript) {
  const controller = new AbortController();
  const timeout    = setTimeout(() => controller.abort(), 55000); // 55s — Vercel max 60s

  let orRes;
  try {
    orRes = await fetch(`${OR_BASE}/chat/completions`, {
      method:  "POST",
      signal:  controller.signal,
      headers: orHeaders(key, { "Content-Type": "application/json" }),
      body: JSON.stringify({
        model:       MODEL_EVAL,
        max_tokens:  1500,
        temperature: 0.3,
        provider: {
          order:           ["Anthropic"],
          allow_fallbacks: false
        },
        messages: [
          {
            role:    "system",
            content: "Você é um avaliador extremamente rigoroso de qualidade em telecom. Seja crítico, técnico e objetivo. Não seja excessivamente positivo. Responda SOMENTE em JSON válido."
          },
          {
            role:    "user",
            content: buildPrompt(agent, company, type, transcript)
          }
        ]
      })
    });
  } finally {
    clearTimeout(timeout);
  }

  return orRes;
}

// ── Parsear resposta da avaliação ─────────────────────────────────────────────
function parseEvalResponse(raw) {
  if (!raw) throw new Error("EMPTY");
  const clean = raw.replace(/```json|```/gi, "").trim();
  const parsed = JSON.parse(clean);
  if (!Array.isArray(parsed.criteria) || parsed.criteria.length < 10) {
    throw new Error("INCOMPLETE");
  }
  return parsed;
}

function buildEvalResult(parsed) {
  const avg   = parsed.criteria.reduce((s, c) => s + Number(c.score), 0) / parsed.criteria.length;
  const score = Math.round(avg * 10) / 10;
  return {
    criteria:           parsed.criteria,
    score,
    pontos_fortes:      parsed.pontos_fortes      || "",
    pontos_desenvolver: parsed.pontos_desenvolver  || "",
    feedback:           parsed.feedback            || ""
  };
}

// ── GET /api/health ───────────────────────────────────────────────────────────
app.get("/api/health", (_req, res) => {
  res.json({
    status:         "ok",
    key_configured: !!process.env.OPENROUTER_API_KEY,
    model_eval:     MODEL_EVAL,
    model_stt:      MODEL_STT,
    node:           process.version
  });
});

// ── GET /api/test-openrouter ──────────────────────────────────────────────────
app.get("/api/test-openrouter", async (_req, res) => {
  const key = getKey(res);
  if (!key) return;
  try {
    const r    = await fetch(`${OR_BASE}/models`, { headers: orHeaders(key) });
    const data = await r.json();
    if (!r.ok) return res.status(r.status).json({ error: data });
    return res.json({ status: "ok", models_count: data.data?.length });
  } catch (err) {
    console.error("[ERRO] test-openrouter:", err.message);
    return res.status(500).json({ error: err.message });
  }
});

// ── POST /api/evaluate (texto) ────────────────────────────────────────────────
app.post("/api/evaluate", async (req, res) => {
  const validationError = validateEvalRequest(req.body);
  if (validationError) return res.status(400).json({ error: validationError });

  const key = getKey(res);
  if (!key) return;

  const { agent, company, type, transcript } = req.body;

  try {
    console.log(`[INFO] /evaluate — ${agent} | ${company} | ${type}`);

    const orRes = await runEvaluation(key, agent, company, type, transcript);

    if (!orRes.ok) {
      const errText = await orRes.text();
      return handleOrError(orRes.status, errText, res);
    }

    const data = await orRes.json();
    const raw  = data.choices?.[0]?.message?.content || "";
    console.log(`[INFO] Modelo usado: ${data.model}`);

    let parsed;
    try {
      parsed = parseEvalResponse(raw);
    } catch (e) {
      console.error("[ERRO] Parse:", e.message, "| Raw:", raw.slice(0, 200));
      const msg = e.message === "EMPTY"      ? "Resposta vazia da IA. Tente novamente."
                : e.message === "INCOMPLETE" ? "Resposta da IA incompleta. Tente novamente."
                :                              "Resposta da IA em formato inválido. Tente novamente.";
      return res.status(502).json({ error: msg });
    }

    const result = buildEvalResult(parsed);
    console.log(`[INFO] Score: ${result.score}`);
    return res.json(result);

  } catch (err) {
    if (err.name === "AbortError") {
      console.error("[ERRO] Timeout /evaluate");
      return res.status(502).json({ error: "A IA demorou muito para responder. Tente novamente." });
    }
    console.error("[ERRO] /evaluate:", err.message);
    return res.status(500).json({ error: "Erro interno. Tente novamente." });
  }
});

// ── POST /api/evaluate-audio ──────────────────────────────────────────────────
app.post("/api/evaluate-audio", upload.single("audio"), async (req, res) => {
  // 1. Validar arquivo
  if (!req.file) {
    return res.status(400).json({ error: "Nenhum arquivo de áudio enviado. Use o campo 'audio'." });
  }

  // 2. Validar campos do corpo
  const { agent, company, type } = req.body;
  if (!agent   || typeof agent   !== "string" || agent.trim().length < 2)  return res.status(400).json({ error: "Campo 'agent' inválido." });
  if (!company || typeof company !== "string" || company.trim().length < 1) return res.status(400).json({ error: "Campo 'company' inválido." });
  if (!["Ligação", "Chat"].includes(type))                                  return res.status(400).json({ error: "Campo 'type' deve ser 'Ligação' ou 'Chat'." });

  const key = getKey(res);
  if (!key) return;

  const fileSizeMB = (req.file.size / 1024 / 1024).toFixed(2);
  console.log(`[INFO] /evaluate-audio — ${agent} | ${company} | ${type} | ${fileSizeMB} MB | ${req.file.originalname}`);

  // 3. Transcrição via Whisper
  let transcript;
  try {
    const form = new FormData();
    form.append("file",  req.file.buffer, {
      filename:    req.file.originalname || "audio.mp3",
      contentType: req.file.mimetype     || "audio/mpeg"
    });
    form.append("model", MODEL_STT);
    form.append("language", "pt");

    const controller  = new AbortController();
    const timeout     = setTimeout(() => controller.abort(), 30000);
    let   transcRes;
    try {
      transcRes = await fetch(`${OR_BASE}/audio/transcriptions`, {
        method:  "POST",
        signal:  controller.signal,
        headers: orHeaders(key, form.getHeaders()),
        body:    form
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!transcRes.ok) {
      const errText = await transcRes.text();
      console.error(`[ERRO] Transcrição HTTP ${transcRes.status}:`, errText.slice(0, 300));
      const map = {
        401: "Chave inválida para transcrição.",
        402: "Saldo insuficiente para transcrição.",
        429: "Rate limit atingido na transcrição. Tente novamente."
      };
      return res.status(502).json({ error: map[transcRes.status] || `Erro na transcrição (HTTP ${transcRes.status}).` });
    }

    const transcData = await transcRes.json();
    transcript = transcData.text || transcData.transcript || "";

    if (!transcript || transcript.trim().length < 5) {
      console.error("[ERRO] Transcrição vazia:", JSON.stringify(transcData));
      return res.status(502).json({ error: "Áudio transcrito está vazio ou ininteligível." });
    }

    console.log(`[INFO] Transcrição concluída — ${transcript.length} chars`);

  } catch (err) {
    if (err.name === "AbortError") {
      console.error("[ERRO] Timeout na transcrição");
      return res.status(502).json({ error: "Transcrição demorou muito. Tente com um áudio menor." });
    }
    console.error("[ERRO] Transcrição exceção:", err.message);
    return res.status(500).json({ error: "Erro ao transcrever o áudio." });
  } finally {
    // Liberar buffer da memória
    if (req.file) req.file.buffer = null;
  }

  // 4. Avaliação com Claude
  try {
    const orRes = await runEvaluation(key, agent, company, type, transcript);

    if (!orRes.ok) {
      const errText = await orRes.text();
      return handleOrError(orRes.status, errText, res);
    }

    const data = await orRes.json();
    const raw  = data.choices?.[0]?.message?.content || "";
    console.log(`[INFO] Modelo avaliação: ${data.model}`);

    let parsed;
    try {
      parsed = parseEvalResponse(raw);
    } catch (e) {
      console.error("[ERRO] Parse avaliação:", e.message, "| Raw:", raw.slice(0, 200));
      const msg = e.message === "EMPTY"      ? "Resposta vazia da IA. Tente novamente."
                : e.message === "INCOMPLETE" ? "Resposta da IA incompleta. Tente novamente."
                :                              "Resposta da IA em formato inválido. Tente novamente.";
      return res.status(502).json({ error: msg });
    }

    const result = buildEvalResult(parsed);
    console.log(`[INFO] Score: ${result.score}`);

    return res.json({
      transcript,
      ...result
    });

  } catch (err) {
    if (err.name === "AbortError") {
      console.error("[ERRO] Timeout /evaluate-audio (avaliação)");
      return res.status(502).json({ error: "A IA demorou muito para responder. Tente novamente." });
    }
    console.error("[ERRO] /evaluate-audio avaliação:", err.message);
    return res.status(500).json({ error: "Erro interno na avaliação. Tente novamente." });
  }
});

// ── Middleware de erro do Multer ───────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  if (err.code === "LIMIT_FILE_SIZE") {
    return res.status(413).json({ error: "Arquivo de áudio muito grande. Máximo: 25 MB." });
  }
  if (err.message === "Formato de áudio não suportado.") {
    return res.status(415).json({ error: err.message });
  }
  console.error("[ERRO] Middleware:", err.message);
  return res.status(500).json({ error: "Erro interno." });
});

// ── Export Vercel (serverless) + listen local ─────────────────────────────────
if (process.env.NODE_ENV !== "production" || process.env.LOCAL_DEV === "true") {
  const PORT = process.env.PORT || 3001;
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`✅ Servidor rodando na porta ${PORT}`);
    console.log(`🔑 Chave: ${process.env.OPENROUTER_API_KEY ? "configurada ✓" : "NÃO CONFIGURADA ✗"}`);
    console.log(`🤖 Modelo: ${MODEL_EVAL}`);
  });
}

module.exports = app;
