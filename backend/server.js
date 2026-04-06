// server.js (compatível com Vercel)

require("dotenv").config();

const express = require("express");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json());

function sanitize(str, maxLen = 8000) {
  if (!str) return "";
  return str.replace(/<[^>]*>/g, "").trim().slice(0, maxLen);
}

function validate(body) {
  const { agent, company, type, transcript } = body;

  if (!agent) return "Agent inválido";
  if (!company) return "Company inválida";
  if (!["Chat", "Ligação"].includes(type)) return "Tipo inválido";
  if (!transcript || transcript.length < 10) return "Transcrição inválida";

  return null;
}

function buildPrompt(agent, company, type, transcript) {
  return `
Você é um QA SÊNIOR de telecom.

Analise o atendimento:

Agente: ${agent}
Empresa: ${company}
Tipo: ${type}

TRANSCRIÇÃO:
${transcript}

Responda SOMENTE JSON válido:

{
 "criteria":[
   {"id":"saudacao","score":0-10,"obs":"..."}
 ],
 "pontos_fortes":"...",
 "pontos_desenvolver":"...",
 "feedback":"..."
}
`;
}

app.get("/api/health", (_, res) => {
  res.json({ status: "ok" });
});

app.post("/api/evaluate", async (req, res) => {
  const error = validate(req.body);
  if (error) return res.status(400).json({ error });

  const { agent, company, type, transcript } = req.body;

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "google/gemini-2.0-flash-exp:free",
        messages: [
          {
            role: "user",
            content: buildPrompt(agent, company, type, sanitize(transcript))
          }
        ]
      })
    });

    const data = await response.json();
    const raw = data.choices?.[0]?.message?.content;

    let parsed = JSON.parse(raw.replace(/```json|```/g, ""));

    const avg =
      parsed.criteria.reduce((acc, c) => acc + Number(c.score), 0) /
      parsed.criteria.length;

    res.json({
      score: Number(avg.toFixed(1)),
      ...parsed
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = app;