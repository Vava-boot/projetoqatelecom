require("dotenv").config();
const express   = require("express");
const cors      = require("cors");
const rateLimit = require("express-rate-limit");
const multer    = require("multer");
const FormData  = require("form-data");

// ─────────────────────────────────────────────────────────────────────────────
//  CONFIGURAÇÃO
// ─────────────────────────────────────────────────────────────────────────────
const OR_BASE   = "https://openrouter.ai/api/v1";
const REFERER   = "https://projetoqatelecom.vercel.app";
const APP_TITLE = "QA Telecom Monitor";

// Avaliação: gpt-4o-mini — pago, direto pela OpenAI, sem providers intermediários
// Custo: ~$0.15/MTok entrada, ~$0.60/MTok saída — centavos por avaliação
const MODEL_EVAL = "openai/gpt-4o-mini";

// Transcrição: Whisper via OpenAI diretamente (OpenRouter não expõe /audio/transcriptions)
// A chave OpenRouter NÃO funciona para Whisper — use a chave OpenAI se quiser transcrição real
// Por ora: endpoint recebe áudio e retorna instruções para o usuário transcrever manualmente
// ou usar a chave OpenAI separada via OPENAI_API_KEY
const MODEL_STT = "whisper-1";

// ─────────────────────────────────────────────────────────────────────────────
//  APP
// ─────────────────────────────────────────────────────────────────────────────
const app = express();
app.set("trust proxy", 1);

// CORS — aceita qualquer origem Vercel + localhost
app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    const ok =
      /\.vercel\.app$/.test(origin)      ||
      origin === "http://localhost:5173" ||
      origin === "http://localhost:3000" ||
      (process.env.ALLOWED_ORIGINS || "").split(",").map(s => s.trim()).includes(origin);
    ok ? cb(null, true) : cb(new Error("CORS: origem não permitida"));
  },
  methods: ["GET", "POST", "OPTIONS"],
  credentials: false
}));
app.options("*", cors());
app.use(express.json({ limit: "1mb" }));

// Rate limiting
app.use("/api/", rateLimit({
  windowMs:       15 * 60 * 1000,
  max:            30,
  standardHeaders: true,
  legacyHeaders:  false,
  message: { error: "Muitas requisições. Tente novamente em alguns minutos." }
}));

// Multer — áudio em memória, máx 25 MB
const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 25 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("audio/") || file.mimetype === "application/octet-stream") {
      cb(null, true);
    } else {
      cb(new Error("Formato de áudio não suportado."));
    }
  }
});

// ─────────────────────────────────────────────────────────────────────────────
//  HELPERS
// ─────────────────────────────────────────────────────────────────────────────
function getKey() {
  return (process.env.OPENROUTER_API_KEY || "").trim();
}

function orHeaders(key, extra = {}) {
  return {
    "Authorization": `Bearer ${key}`,
    "HTTP-Referer":  REFERER,
    "X-Title":       APP_TITLE,
    "Content-Type":  "application/json",
    ...extra
  };
}

function respondOrError(status, text, res) {
  console.error(`[ERRO] OpenRouter HTTP ${status}:`, text.slice(0, 300));
  const map = {
    401: "Chave de API inválida. Verifique sua OPENROUTER_API_KEY.",
    402: "Saldo insuficiente na conta OpenRouter. Adicione créditos em openrouter.ai/credits.",
    429: "Limite de requisições atingido. Aguarde alguns instantes."
  };
  res.status(502).json({ error: map[status] || `Erro ao consultar IA (HTTP ${status}).` });
}

function sanitize(str, maxLen = 7000) {
  if (typeof str !== "string") return "";
  return str.replace(/<[^>]*>/g, "").trim().slice(0, maxLen);
}

function validate({ agent, company, type, transcript }) {
  if (!agent      || agent.trim().length      < 2)  return "Campo 'agent' inválido.";
  if (!company    || company.trim().length     < 1)  return "Campo 'company' inválido.";
  if (!["Ligação","Chat"].includes(type))            return "Campo 'type' deve ser 'Ligação' ou 'Chat'.";
  if (!transcript || transcript.trim().length < 10)  return "Transcrição ausente ou muito curta.";
  return null;
}

function buildPrompt(agent, company, type, transcript) {
  const isChat = type === "Chat";

  const criterios = isChat
    ? "saudacao (Saudação), empatia (Empatia), tempo_espera (Tempo de Espera), tempo_atendimento (Tempo de Atendimento), tempo_resposta (Tempo de Resposta), gramatica (Gramática), sondagem (Sondagem), confirmacao_dados (Confirmação de Dados), personalizacao (Personalização), protocolo_encerramento (Protocolo e Encerramento)"
    : "saudacao (Saudação), tom_voz (Tom de Voz), tempo_espera (Tempo de Espera), tempo_atendimento (Tempo de Atendimento), uso_mudo (Utilização do Mudo), personalizacao (Personalização), tratativa (Tratativa/Sondagem/Resolução), gramatica (Gramática), dados_obrigatorios (Dados obrigatórios), protocolo_encerramento (Protocolo e Encerramento)";

  return `Você atua como Avaliador de Qualidade (QA) Sênior de Telecomunicações (N1/N2).
Analise o ${type} do agente ${sanitize(agent, 80)} na empresa ${sanitize(company, 60)}.

REGRAS:
- Nota 10 exige perfeição absoluta.
- Não confirmar CPF/dados ou não fornecer protocolo = nota 0-4 no critério.
- Seja rigoroso. Não invente dados que não estejam na transcrição.
- Use o primeiro nome do agente no feedback.
- Feedbacks construtivos: elogio genuíno + ponto de melhoria respeitoso.
- Pontos Fortes e Pontos a Desenvolver: máximo 2 frases diretas cada.

CONTEÚDO DO ATENDIMENTO:
${sanitize(transcript, 5500)}

CRITÉRIOS PARA AVALIAR (nota 0-10 cada):
${criterios}

Responda SOMENTE em JSON válido, sem markdown, sem texto fora do JSON:
{"criteria":[{"id":"saudacao","score":8,"obs":"observação detalhada"},{"id":"tom_voz","score":7,"obs":"..."},{"id":"tempo_espera","score":9,"obs":"..."},{"id":"tempo_atendimento","score":7,"obs":"..."},{"id":"uso_mudo","score":6,"obs":"..."},{"id":"personalizacao","score":7,"obs":"..."},{"id":"tratativa","score":8,"obs":"..."},{"id":"gramatica","score":8,"obs":"..."},{"id":"dados_obrigatorios","score":9,"obs":"..."},{"id":"protocolo_encerramento","score":6,"obs":"..."}],"pontos_fortes":"texto curto e direto","pontos_desenvolver":"texto curto e direto","feedback":"Feedback construtivo usando primeiro nome do agente"}`;
}

// Chamada principal ao OpenRouter — gpt-4o-mini via OpenAI direta
async function callEvaluation(key, agent, company, type, transcript) {
  const controller = new AbortController();
  const timeout    = setTimeout(() => controller.abort(), 55000);

  try {
    return await fetch(`${OR_BASE}/chat/completions`, {
      method:  "POST",
      signal:  controller.signal,
      headers: orHeaders(key),
      body: JSON.stringify({
        model:    MODEL_EVAL,
        provider: {
          order:           ["OpenAI"],  // Força OpenAI oficial — sem Venice, sem Llama
          allow_fallbacks: false
        },
        max_tokens:  1200,
        temperature: 0.2,
        messages: [
          {
            role:    "system",
            content: "Você é um avaliador rigoroso de qualidade em telecomunicações. Seja crítico e objetivo. Responda SOMENTE em JSON válido sem markdown."
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
}

function parseEval(raw) {
  if (!raw) throw new Error("EMPTY");
  const clean  = raw.replace(/```json|```/gi, "").trim();
  const parsed = JSON.parse(clean);
  if (!Array.isArray(parsed.criteria) || parsed.criteria.length < 10) throw new Error("INCOMPLETE");
  return parsed;
}

function buildResult(parsed) {
  const avg   = parsed.criteria.reduce((s, c) => s + Number(c.score || 0), 0) / parsed.criteria.length;
  const score = Math.round(avg * 10) / 10;
  return {
    criteria:           parsed.criteria,
    score,
    pontos_fortes:      parsed.pontos_fortes      || "",
    pontos_desenvolver: parsed.pontos_desenvolver  || "",
    feedback:           parsed.feedback            || ""
  };
}

// ─────────────────────────────────────────────────────────────────────────────
//  ROTAS
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/health
app.get("/api/health", (_req, res) => {
  res.json({
    status:         "ok",
    key_configured: !!getKey(),
    model_eval:     MODEL_EVAL,
    provider:       "OpenAI (direto)",
    node:           process.version
  });
});

// GET /api/test-openrouter — testa conectividade e validade da chave
app.get("/api/test-openrouter", async (_req, res) => {
  const key = getKey();
  if (!key) return res.status(500).json({ error: "OPENROUTER_API_KEY não configurada." });

  try {
    const r    = await fetch(`${OR_BASE}/models`, {
      headers: { "Authorization": `Bearer ${key}`, "HTTP-Referer": REFERER }
    });
    const data = await r.json();
    if (!r.ok) return res.status(r.status).json({ error: data });
    const models = data.data?.map(m => m.id) || [];
    const hasGpt = models.includes("openai/gpt-4o-mini");
    return res.json({ status: "ok", models_count: models.length, gpt4o_mini_available: hasGpt });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/evaluate — avaliação por transcrição de texto
app.post("/api/evaluate", async (req, res) => {
  const valErr = validate(req.body);
  if (valErr) return res.status(400).json({ error: valErr });

  const key = getKey();
  if (!key) return res.status(500).json({ error: "Chave de API não configurada no servidor." });

  const { agent, company, type, transcript } = req.body;
  console.log(`[INFO] /evaluate — ${agent} | ${company} | ${type} | ${transcript.length} chars`);

  let orRes;
  try {
    orRes = await callEvaluation(key, agent, company, type, transcript);
  } catch (err) {
    if (err.name === "AbortError") {
      console.error("[ERRO] Timeout /evaluate");
      return res.status(502).json({ error: "A IA demorou muito para responder. Tente novamente." });
    }
    console.error("[ERRO] /evaluate conexão:", err.message);
    return res.status(503).json({ error: "Sem conexão com a IA. Tente novamente." });
  }

  console.log(`[INFO] OpenRouter → HTTP ${orRes.status} | modelo: ${MODEL_EVAL}`);

  if (!orRes.ok) {
    const errText = await orRes.text();
    return respondOrError(orRes.status, errText, res);
  }

  const data = await orRes.json();
  const raw  = data.choices?.[0]?.message?.content || "";
  const usage = data.usage;
  console.log(`[INFO] Tokens: ${usage?.total_tokens ?? "?"} | Custo: $${usage?.cost?.toFixed(5) ?? "?"}`);

  let parsed;
  try {
    parsed = parseEval(raw);
  } catch (e) {
    console.error("[ERRO] Parse:", e.message, "| Raw:", raw.slice(0, 200));
    const msg = {
      EMPTY:      "Resposta vazia da IA. Tente novamente.",
      INCOMPLETE: "Resposta da IA incompleta. Tente novamente."
    }[e.message] || "Resposta da IA em formato inválido. Tente novamente.";
    return res.status(502).json({ error: msg });
  }

  const result = buildResult(parsed);
  console.log(`[OK] Score: ${result.score}`);
  return res.json(result);
});

// POST /api/evaluate-audio — transcrição Whisper + avaliação
// REQUISITO: variável OPENAI_API_KEY configurada (chave OpenAI direta, não OpenRouter)
// O OpenRouter não expõe o endpoint /audio/transcriptions
app.post("/api/evaluate-audio", upload.single("audio"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "Nenhum arquivo de áudio enviado. Use o campo 'audio'." });

  const { agent, company, type } = req.body;
  if (!agent   || agent.trim().length   < 2)  return res.status(400).json({ error: "Campo 'agent' inválido." });
  if (!company || company.trim().length  < 1)  return res.status(400).json({ error: "Campo 'company' inválido." });
  if (!["Ligação","Chat"].includes(type))      return res.status(400).json({ error: "Campo 'type' inválido." });

  const openaiKey = (process.env.OPENAI_API_KEY || "").trim();
  if (!openaiKey) {
    return res.status(500).json({
      error: "Transcrição de áudio requer OPENAI_API_KEY configurada no servidor. Configure essa variável no Railway/Vercel."
    });
  }

  const evalKey = getKey();
  if (!evalKey) return res.status(500).json({ error: "OPENROUTER_API_KEY não configurada." });

  const fileMB = (req.file.size / 1024 / 1024).toFixed(2);
  console.log(`[INFO] /evaluate-audio — ${agent} | ${company} | ${type} | ${fileMB} MB`);

  // 1. Transcrição com Whisper (OpenAI direta)
  let transcript;
  try {
    const form = new FormData();
    form.append("file", req.file.buffer, {
      filename:    req.file.originalname || "audio.mp3",
      contentType: req.file.mimetype     || "audio/mpeg"
    });
    form.append("model",    MODEL_STT);
    form.append("language", "pt");

    const controller = new AbortController();
    const timeout    = setTimeout(() => controller.abort(), 60000);
    let transcRes;
    try {
      transcRes = await fetch("https://api.openai.com/v1/audio/transcriptions", {
        method:  "POST",
        signal:  controller.signal,
        headers: {
          "Authorization": `Bearer ${openaiKey}`,
          ...form.getHeaders()
        },
        body: form
      });
    } finally {
      clearTimeout(timeout);
      if (req.file) req.file.buffer = null; // libera memória
    }

    if (!transcRes.ok) {
      const errText = await transcRes.text();
      console.error(`[ERRO] Whisper HTTP ${transcRes.status}:`, errText.slice(0, 300));
      const map = { 401: "Chave OpenAI inválida.", 429: "Rate limit OpenAI atingido." };
      return res.status(502).json({ error: map[transcRes.status] || `Erro na transcrição (HTTP ${transcRes.status}).` });
    }

    const transcData = await transcRes.json();
    transcript = transcData.text || "";
    if (!transcript || transcript.trim().length < 5) {
      return res.status(502).json({ error: "Áudio transcrito está vazio ou ininteligível." });
    }
    console.log(`[INFO] Transcrição: ${transcript.length} chars`);

  } catch (err) {
    if (err.name === "AbortError") return res.status(502).json({ error: "Transcrição demorou muito. Use um áudio menor." });
    console.error("[ERRO] Whisper:", err.message);
    return res.status(500).json({ error: "Erro ao transcrever o áudio." });
  }

  // 2. Avaliação com gpt-4o-mini
  let orRes;
  try {
    orRes = await callEvaluation(evalKey, agent, company, type, transcript);
  } catch (err) {
    if (err.name === "AbortError") return res.status(502).json({ error: "A IA demorou muito para responder." });
    console.error("[ERRO] /evaluate-audio avaliação:", err.message);
    return res.status(503).json({ error: "Sem conexão com a IA." });
  }

  if (!orRes.ok) {
    const errText = await orRes.text();
    return respondOrError(orRes.status, errText, res);
  }

  const data = await orRes.json();
  const raw  = data.choices?.[0]?.message?.content || "";

  let parsed;
  try {
    parsed = parseEval(raw);
  } catch (e) {
    console.error("[ERRO] Parse áudio:", e.message);
    return res.status(502).json({ error: "Resposta da IA em formato inválido." });
  }

  const result = buildResult(parsed);
  console.log(`[OK] Score: ${result.score}`);
  return res.json({ transcript, ...result });
});

// Middleware de erro Multer
app.use((err, _req, res, _next) => {
  if (err.code === "LIMIT_FILE_SIZE")               return res.status(413).json({ error: "Arquivo muito grande. Máximo: 25 MB." });
  if (err.message === "Formato de áudio não suportado.") return res.status(415).json({ error: err.message });
  console.error("[ERRO] Middleware:", err.message);
  return res.status(500).json({ error: "Erro interno." });
});

// ─────────────────────────────────────────────────────────────────────────────
//  START — funciona tanto no Railway quanto no Vercel
// ─────────────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ Servidor rodando na porta ${PORT}`);
  console.log(`🔑 OpenRouter key: ${getKey() ? "configurada ✓" : "NÃO CONFIGURADA ✗"}`);
  console.log(`🤖 Modelo avaliação: ${MODEL_EVAL}`);
  console.log(`🏢 Provider: OpenAI (allow_fallbacks: false)`);
  console.log(`🎙️  Transcrição: ${process.env.OPENAI_API_KEY ? "OPENAI_API_KEY configurada ✓" : "OPENAI_API_KEY ausente (evaluate-audio desabilitado)"}`);
});

module.exports = app;
