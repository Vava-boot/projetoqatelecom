require("dotenv").config();
const express   = require("express");
const cors      = require("cors");
const rateLimit = require("express-rate-limit");

const app  = express();
const PORT = process.env.PORT || 3001;

// Modelos em ordem de prioridade — fallback automático
const MODELS = [
  "openai/gpt-4o-mini",
  "mistralai/mistral-7b-instruct",
  "google/gemini-2.0-flash-001",
];

app.use(express.json({ limit: "1mb" }));

const allowedOrigins = (process.env.ALLOWED_ORIGINS || "http://localhost:5173").split(",");
app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    const ok = allowedOrigins.some(o => origin === o) ||
               /\.vercel\.app$/.test(origin) ||
               origin === "http://localhost:5173" ||
               origin === "http://localhost:3000";
    if (ok) return cb(null, true);
    cb(new Error("Not allowed by CORS"));
  }
}));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: { error: "Muitas requisições. Tente novamente em alguns minutos." }
});
app.use("/api/", limiter);

function sanitize(str, maxLen = 8000) {
  if (typeof str !== "string") return "";
  return str.replace(/<[^>]*>/g, "").trim().slice(0, maxLen);
}

function validateEvalRequest(body) {
  const { agent, company, type, transcript } = body;
  if (!agent || typeof agent !== "string" || agent.trim().length < 2)
    return "Campo 'agent' inválido.";
  if (!company || typeof company !== "string" || company.trim().length < 1)
    return "Campo 'company' inválido.";
  if (!["Ligação", "Chat"].includes(type))
    return "Campo 'type' deve ser 'Ligação' ou 'Chat'.";
  if (!transcript || typeof transcript !== "string" || transcript.trim().length < 10)
    return "Transcrição muito curta ou ausente.";
  return null;
}

function buildPrompt(agent, company, type, transcript) {
  const criteriosLigacao = `saudacao (Saudação), tom_voz (Tom de Voz), tempo_espera (Tempo de Espera), tempo_atendimento (Tempo de Atendimento), uso_mudo (Utilização do Mudo), personalizacao (Personalização), tratativa (Tratativa sondagem resolução), gramatica (Gramática), dados_obrigatorios (Dados obrigatórios), protocolo_encerramento (Protocolo e Encerramento)`;
  const criteriosChat    = `saudacao (Saudação), empatia (Empatia), tempo_espera (Tempo de Espera), tempo_atendimento (Tempo de Atendimento), tempo_resposta (Tempo de Resposta), gramatica (Gramática), sondagem (Sondagem), confirmacao_dados (Confirmação de Dados), personalizacao (Personalização), protocolo_encerramento (Protocolo e Encerramento)`;
  const criterios        = type === "Chat" ? criteriosChat : criteriosLigacao;

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
${criterios}

Responda SOMENTE em JSON válido, sem markdown, sem explicações fora do JSON:
{"criteria":[{"id":"saudacao","score":8,"obs":"observação detalhada"},{"id":"tom_voz","score":7,"obs":"..."},{"id":"tempo_espera","score":9,"obs":"..."},{"id":"tempo_atendimento","score":7,"obs":"..."},{"id":"uso_mudo","score":6,"obs":"..."},{"id":"personalizacao","score":7,"obs":"..."},{"id":"tratativa","score":8,"obs":"..."},{"id":"gramatica","score":8,"obs":"..."},{"id":"dados_obrigatorios","score":9,"obs":"..."},{"id":"protocolo_encerramento","score":6,"obs":"..."}],"pontos_fortes":"texto curto e direto","pontos_desenvolver":"texto curto e direto","feedback":"Feedback construtivo usando primeiro nome do agente"}`;
}

async function callOpenRouter(apiKey, model, prompt) {
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type":  "application/json",
      "Authorization": `Bearer ${apiKey}`,
      "HTTP-Referer":  "https://qa-telecom-jzym.vercel.app",
      "X-Title":       "QA Telecom Monitor"
    },
    body: JSON.stringify({
      model,
      max_tokens:  1200,
      temperature: 0.3,
      messages: [
        {
          role:    "system",
          content: "Você é um sistema de avaliação de qualidade de atendimento. Responda SEMPRE e SOMENTE em JSON válido, sem markdown."
        },
        {
          role:    "user",
          content: prompt
        }
      ]
    })
  });
  return response;
}

app.post("/api/evaluate", async (req, res) => {
  const validationError = validateEvalRequest(req.body);
  if (validationError) return res.status(400).json({ error: validationError });

  const { agent, company, type, transcript } = req.body;
  const apiKey = (process.env.OPENROUTER_API_KEY || "").trim();

  if (!apiKey) {
    console.error("[ERRO CRÍTICO] OPENROUTER_API_KEY não configurada.");
    return res.status(500).json({ error: "Chave de API não configurada no servidor." });
  }

  console.log(`[INFO] Avaliando — ${agent} | ${company} | ${type}`);

  const prompt = buildPrompt(agent, company, type, transcript);
  let lastError = null;

  for (const model of MODELS) {
    console.log(`[INFO] Tentando modelo: ${model}`);
    try {
      const response = await callOpenRouter(apiKey, model, prompt);
      console.log(`[INFO] Status OpenRouter: ${response.status} | modelo: ${model}`);

      // 401 — chave inválida, não adianta tentar outro modelo
      if (response.status === 401) {
        const body = await response.text();
        console.error(`[ERRO CRÍTICO] 401 chave inválida:`, body);
        return res.status(500).json({ error: "Chave de API inválida. Verifique as configurações do servidor." });
      }

      // 429 ou 402 — tentar próximo modelo
      if (response.status === 429 || response.status === 402) {
        const body = await response.text();
        console.warn(`[FALLBACK] ${response.status} em ${model}: ${body.slice(0, 200)}`);
        lastError = `HTTP ${response.status} em ${model}`;
        continue;
      }

      if (!response.ok) {
        const body = await response.text();
        console.error(`[ERRO] HTTP ${response.status} em ${model}:`, body.slice(0, 200));
        lastError = `HTTP ${response.status} em ${model}`;
        continue;
      }

      const data = await response.json();
      const raw  = data.choices?.[0]?.message?.content || "";

      let parsed;
      try {
        parsed = JSON.parse(raw.replace(/```json|```/gi, "").trim());
      } catch {
        console.error(`[ERRO] JSON inválido da IA (${model}):`, raw.slice(0, 200));
        lastError = `JSON inválido do modelo ${model}`;
        continue;
      }

      if (!Array.isArray(parsed.criteria) || parsed.criteria.length < 10) {
        console.warn(`[AVISO] Resposta incompleta do modelo ${model}`);
        lastError = `Resposta incompleta do modelo ${model}`;
        continue;
      }

      const avg   = parsed.criteria.reduce((s, c) => s + Number(c.score), 0) / parsed.criteria.length;
      const score = Math.round(avg * 10) / 10;

      console.log(`[OK] Avaliação gerada — modelo: ${model} | score: ${score}`);

      return res.json({
        criteria:           parsed.criteria,
        score,
        pontos_fortes:      parsed.pontos_fortes      || "",
        pontos_desenvolver: parsed.pontos_desenvolver  || "",
        feedback:           parsed.feedback            || ""
      });

    } catch (err) {
      console.error(`[ERRO] Exceção com modelo ${model}:`, err.message);
      lastError = err.message;
      continue;
    }
  }

  // Todos os modelos falharam
  console.error("[ERRO] Todos os modelos falharam. Último erro:", lastError);
  return res.status(502).json({ error: "Serviço de IA temporariamente indisponível. Tente novamente em alguns minutos." });
});

app.get("/api/health", (_req, res) => res.json({ status: "ok" }));

app.listen(PORT, () => {
  console.log(`✅ Servidor rodando na porta ${PORT}`);
  console.log(`🔑 Chave: ${process.env.OPENROUTER_API_KEY ? "configurada ✓" : "NAO CONFIGURADA ✗"}`);
  console.log(`🤖 Modelos disponíveis: ${MODELS.join(" → ")}`);
});
