require("dotenv").config();
const express   = require("express");
const cors      = require("cors");
const rateLimit = require("express-rate-limit");
const multer    = require("multer");
const FormData  = require("form-data");

// ── App ───────────────────────────────────────────────────────────────────────
const app = express();
app.set("trust proxy", 1);

app.use(cors({ origin: true, methods: ["GET", "POST", "OPTIONS"], credentials: false }));
app.options("*", cors());
app.use(express.json({ limit: "1mb" }));

app.use("/api/", rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Muitas requisições. Tente novamente em alguns minutos." }
}));

// ── Multer — áudio em memória, máx 25 MB ─────────────────────────────────────
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("audio/") || file.mimetype === "application/octet-stream") {
      cb(null, true);
    } else {
      cb(new Error("Formato não suportado. Envie um arquivo de áudio."));
    }
  }
});

// ── Configuração OpenRouter ───────────────────────────────────────────────────
const OR_URL    = "https://openrouter.ai/api/v1/chat/completions";
const OR_STT    = "https://openrouter.ai/api/v1/audio/transcriptions";
const REFERER   = "https://projetoqatelecom.vercel.app";
const APP_TITLE = "QA Telecom Monitor";

// Modelo principal: GPT-4o Mini — estável, custo-benefício excelente para JSON estruturado
// Fallback: GPT-4.1 Mini — alternativa estável caso o principal falhe
const MODEL_EVAL         = "openai/gpt-4o-mini";
const MODEL_EVAL_FALLBACK = "openai/gpt-4.1-mini";

// Modelo de transcrição: Whisper via OpenRouter
const MODEL_STT = "openai/whisper-1";

// ── Headers padrão OpenRouter ─────────────────────────────────────────────────
function orHeaders(key, extra = {}) {
  return {
    "Authorization": `Bearer ${key}`,
    "HTTP-Referer":  REFERER,
    "X-Title":       APP_TITLE,
    "Content-Type":  "application/json",
    ...extra,
  };
}

// ── Verificar chave ───────────────────────────────────────────────────────────
function getKey(res) {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) {
    console.error("[ERRO] OPENROUTER_API_KEY não definida");
    if (res) res.status(500).json({ error: "Chave de API não configurada no servidor." });
    return null;
  }
  return key;
}

// ── Mapear erros HTTP do OpenRouter ──────────────────────────────────────────
function mapOrError(status, raw) {
  const msgs = {
    401: "Chave de API inválida ou expirada. Verifique a OPENROUTER_API_KEY.",
    402: "Saldo insuficiente na conta OpenRouter. Adicione créditos em openrouter.ai/credits.",
    408: "Requisição expirou. Tente novamente.",
    429: "Limite de requisições atingido. Aguarde alguns instantes e tente novamente.",
    502: "Modelo temporariamente indisponível. Tente novamente.",
    503: "Nenhum provedor disponível para o modelo solicitado.",
  };
  const msg = msgs[status] || `Erro na API OpenRouter (HTTP ${status}).`;
  console.error(`[ERRO] OpenRouter HTTP ${status}:`, String(raw).slice(0, 400));
  return msg;
}

// ── Sanitize ──────────────────────────────────────────────────────────────────
function sanitize(str, maxLen = 8000) {
  if (typeof str !== "string") return "";
  return str.replace(/<[^>]*>/g, "").trim().slice(0, maxLen);
}

// ── Validação ─────────────────────────────────────────────────────────────────
function validateEvalRequest(body) {
  const { agent, company, type, transcript } = body;
  if (!agent    || typeof agent    !== "string" || agent.trim().length < 2)          return "Campo 'agent' inválido.";
  if (!company  || typeof company  !== "string" || company.trim().length < 1)         return "Campo 'company' inválido.";
  if (!["Ligação", "Chat"].includes(type))                                            return "Campo 'type' deve ser 'Ligação' ou 'Chat'.";
  if (!transcript || typeof transcript !== "string" || transcript.trim().length < 10) return "Transcrição muito curta ou ausente.";
  return null;
}

// ── buildPrompt ───────────────────────────────────────────────────────────────
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

// ── Retry com backoff exponencial ────────────────────────────────────────────
// Tenta até maxRetries vezes em caso de erro 429 (rate limit) ou 5xx
async function fetchWithRetry(url, options, maxRetries = 3) {
  let lastError;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(url, options);
      // Retry apenas em 429 e erros 5xx (exceto 501)
      if ((res.status === 429 || (res.status >= 500 && res.status !== 501)) && attempt < maxRetries) {
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 8000); // 1s, 2s, 4s (máx 8s)
        console.warn(`[RETRY] HTTP ${res.status} — tentativa ${attempt}/${maxRetries}, aguardando ${delay}ms...`);
        await new Promise(r => setTimeout(r, delay));
        continue;
      }
      return res;
    } catch (err) {
      lastError = err;
      if (attempt < maxRetries) {
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 8000);
        console.warn(`[RETRY] Erro de rede — tentativa ${attempt}/${maxRetries}, aguardando ${delay}ms...`);
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }
  throw lastError || new Error("Todas as tentativas falharam.");
}

// ── Chamar modelo de avaliação (com fallback de modelo) ───────────────────────
async function callEvalModel(key, agent, company, type, transcript, model = MODEL_EVAL) {
  const controller = new AbortController();
  const tid = setTimeout(() => controller.abort(), 55000);

  try {
    const res = await fetchWithRetry(OR_URL, {
      method: "POST",
      signal: controller.signal,
      headers: orHeaders(key),
      body: JSON.stringify({
        model,
        max_tokens:  1000,
        temperature: 0.1,
        response_format: { type: "json_object" },
        provider: {
          sort:            "price",
          allow_fallbacks: true,
        },
        messages: [
          {
            role:    "system",
            content: "Avaliador QA Telecom. Responda SOMENTE JSON válido conforme solicitado."
          },
          {
            role:    "user",
            content: buildPrompt(agent, company, type, transcript)
          }
        ]
      })
    }, 3);
    return res;
  } finally {
    clearTimeout(tid);
  }
}

// ── Chamar modelo com fallback automático ─────────────────────────────────────
async function callEvalWithFallback(key, agent, company, type, transcript) {
  // Tenta modelo principal
  let res = await callEvalModel(key, agent, company, type, transcript, MODEL_EVAL);

  // Se falhar com 429 ou 5xx, tenta modelo de fallback
  if (!res.ok && (res.status === 429 || res.status >= 500)) {
    console.warn(`[FALLBACK] Modelo principal falhou (HTTP ${res.status}). Tentando fallback: ${MODEL_EVAL_FALLBACK}`);
    res = await callEvalModel(key, agent, company, type, transcript, MODEL_EVAL_FALLBACK);
  }

  return res;
}

// ── Parsear e validar resposta de avaliação ───────────────────────────────────
function parseEval(raw) {
  if (!raw || !raw.trim()) throw Object.assign(new Error("Resposta vazia da IA."), { code: "EMPTY" });
  const clean = raw.replace(/```json|```/gi, "").trim();
  let parsed;
  try   { parsed = JSON.parse(clean); }
  catch { throw Object.assign(new Error("Resposta da IA em formato inválido."), { code: "JSON" }); }
  if (!Array.isArray(parsed.criteria) || parsed.criteria.length < 10)
    throw Object.assign(new Error("Resposta da IA incompleta."), { code: "INCOMPLETE" });
  return parsed;
}

function buildResult(parsed) {
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
    model_fallback: MODEL_EVAL_FALLBACK,
    model_stt:      MODEL_STT,
    node:           process.version,
  });
});

// ── GET /api/test-openrouter ──────────────────────────────────────────────────
app.get("/api/test-openrouter", async (_req, res) => {
  const key = getKey(res);
  if (!key) return;
  try {
    const r    = await fetch("https://openrouter.ai/api/v1/models", {
      headers: { "Authorization": `Bearer ${key}`, "HTTP-Referer": REFERER }
    });
    const data = await r.json();
    if (!r.ok) return res.status(r.status).json({ error: data });
    return res.json({ status: "ok", models_count: data.data?.length });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ── POST /api/evaluate ────────────────────────────────────────────────────────
app.post("/api/evaluate", async (req, res) => {
  const err = validateEvalRequest(req.body);
  if (err) return res.status(400).json({ error: err });

  const key = getKey(res);
  if (!key) return;

  const { agent, company, type, transcript } = req.body;

  try {
    console.log(`[INFO] /evaluate — ${agent} | ${company} | ${type} | ${transcript.length} chars`);

    const orRes = await callEvalWithFallback(key, agent, company, type, transcript);

    if (!orRes.ok) {
      const errText = await orRes.text();
      return res.status(502).json({ error: mapOrError(orRes.status, errText) });
    }

    const data  = await orRes.json();
    const raw   = data.choices?.[0]?.message?.content || "";

    if (data.usage) {
      console.log(`[TOKEN] prompt=${data.usage.prompt_tokens} completion=${data.usage.completion_tokens} total=${data.usage.total_tokens} cost=$${data.usage.cost || "?"}`);
    }
    console.log(`[INFO] Modelo usado: ${data.model}`);

    let parsed;
    try   { parsed = parseEval(raw); }
    catch (e) {
      console.error(`[ERRO] Parse: ${e.message} | raw: ${raw.slice(0, 200)}`);
      return res.status(502).json({ error: e.message });
    }

    const result = buildResult(parsed);
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
  if (!req.file) return res.status(400).json({ error: "Nenhum arquivo de áudio enviado. Use o campo 'audio'." });

  // 2. Validar campos
  const { agent, company, type } = req.body;
  if (!agent   || typeof agent   !== "string" || agent.trim().length < 2)  return res.status(400).json({ error: "Campo 'agent' inválido." });
  if (!company || typeof company !== "string" || company.trim().length < 1) return res.status(400).json({ error: "Campo 'company' inválido." });
  if (!["Ligação", "Chat"].includes(type))                                  return res.status(400).json({ error: "Campo 'type' deve ser 'Ligação' ou 'Chat'." });

  const key = getKey(res);
  if (!key) return;

  const sizeMB = (req.file.size / 1024 / 1024).toFixed(2);
  console.log(`[INFO] /evaluate-audio — ${agent} | ${company} | ${type} | ${sizeMB}MB | ${req.file.originalname}`);

  // 3. Transcrição via Whisper
  let transcript;
  try {
    const form = new FormData();
    form.append("file", req.file.buffer, {
      filename:    req.file.originalname || "audio.mp3",
      contentType: req.file.mimetype     || "audio/mpeg",
    });
    form.append("model",    MODEL_STT);
    form.append("language", "pt");

    const ctrl = new AbortController();
    const tid  = setTimeout(() => ctrl.abort(), 60000);
    let sttRes;
    try {
      sttRes = await fetchWithRetry(OR_STT, {
        method:  "POST",
        signal:  ctrl.signal,
        headers: {
          "Authorization": `Bearer ${key}`,
          "HTTP-Referer":  REFERER,
          "X-Title":       APP_TITLE,
          ...form.getHeaders(),
        },
        body: form,
      }, 2);
    } finally {
      clearTimeout(tid);
    }

    if (!sttRes.ok) {
      const errText = await sttRes.text();
      return res.status(502).json({ error: mapOrError(sttRes.status, errText) });
    }

    const sttData  = await sttRes.json();
    transcript     = sttData.text || sttData.transcript || "";

    if (!transcript || transcript.trim().length < 5) {
      console.error("[ERRO] Transcrição vazia:", JSON.stringify(sttData));
      return res.status(502).json({ error: "Áudio transcrito está vazio ou ininteligível." });
    }

    console.log(`[INFO] Transcrição: ${transcript.length} chars`);

  } catch (err) {
    if (err.name === "AbortError") return res.status(502).json({ error: "Timeout na transcrição. Envie um áudio menor." });
    console.error("[ERRO] Transcrição:", err.message);
    return res.status(500).json({ error: "Erro ao transcrever o áudio." });
  } finally {
    // Liberar buffer da memória imediatamente
    if (req.file) req.file.buffer = null;
  }

  // 4. Avaliação com fallback
  try {
    const orRes = await callEvalWithFallback(key, agent, company, type, transcript);

    if (!orRes.ok) {
      const errText = await orRes.text();
      return res.status(502).json({ error: mapOrError(orRes.status, errText) });
    }

    const data = await orRes.json();
    const raw  = data.choices?.[0]?.message?.content || "";

    if (data.usage) {
      console.log(`[TOKEN] prompt=${data.usage.prompt_tokens} completion=${data.usage.completion_tokens} total=${data.usage.total_tokens} cost=$${data.usage.cost || "?"}`);
    }
    console.log(`[INFO] Modelo usado: ${data.model}`);

    let parsed;
    try   { parsed = parseEval(raw); }
    catch (e) {
      console.error(`[ERRO] Parse áudio: ${e.message}`);
      return res.status(502).json({ error: e.message });
    }

    const result = buildResult(parsed);
    console.log(`[INFO] Score: ${result.score}`);

    return res.json({ transcript, ...result });

  } catch (err) {
    if (err.name === "AbortError") return res.status(502).json({ error: "A IA demorou muito. Tente novamente." });
    console.error("[ERRO] /evaluate-audio avaliação:", err.message);
    return res.status(500).json({ error: "Erro interno na avaliação." });
  }
});

// ── Error handler Multer ──────────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  if (err.code === "LIMIT_FILE_SIZE")
    return res.status(413).json({ error: "Arquivo de áudio muito grande. Máximo: 25 MB." });
  if (err.message?.includes("Formato não suportado"))
    return res.status(415).json({ error: err.message });
  console.error("[ERRO] Global:", err.message);
  return res.status(500).json({ error: "Erro interno." });
});

// ── Export (Vercel serverless) + listen (Railway/local) ──────────────────────
const PORT = process.env.PORT || 3001;

if (process.env.NODE_ENV !== "production" || process.env.LOCAL_DEV === "true") {
  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`\x1b[32m✅ Servidor na porta ${PORT}\x1b[0m`);
    console.log(`🔑 Chave: ${process.env.OPENROUTER_API_KEY ? "configurada ✓" : "NÃO CONFIGURADA ✗"}`);
    console.log(`🤖 Modelo principal: ${MODEL_EVAL}`);
  });

  // Tratamento para evitar erro EADDRINUSE no Windows durante o --watch
  server.on('error', (e) => {
    if (e.code === 'EADDRINUSE') {
      console.error(`\x1b[31m❌ A porta ${PORT} está ocupada. Tentando novamente em 1 segundo...\x1b[0m`);
      setTimeout(() => {
        server.close();
        server.listen(PORT);
      }, 1000);
    }
  });
}

module.exports = app;
