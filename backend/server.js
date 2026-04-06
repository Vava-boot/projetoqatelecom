require("dotenv").config();

const express = require("express");
const cors = require("cors");

const app = express();

// ✅ CORS CONFIGURADO CORRETAMENTE
const allowedOrigins = [
  "http://localhost:5173",
  "https://projetoqatelecom.vercel.app"
];

app.use(cors({
  origin: function (origin, callback) {
    // permite requests sem origin (ex: Postman)
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    } else {
      return callback(new Error("Not allowed by CORS"));
    }
  },
  methods: ["GET", "POST"],
  credentials: true
}));

app.use(express.json());

// ✅ HEALTH CHECK
app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

// ✅ IA - AVALIAÇÃO
app.post("/api/evaluate", async (req, res) => {
  try {
    const { text } = req.body;

    if (!text) {
      return res.status(400).json({ error: "Texto é obrigatório" });
    }

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "openai/gpt-3.5-turbo",
        messages: [
          {
            role: "user",
            content: `Avalie o seguinte atendimento:\n\n${text}`
          }
        ]
      })
    });

    const data = await response.json();

    res.json({
      result: data.choices?.[0]?.message?.content || "Sem resposta da IA"
    });

  } catch (error) {
    console.error("Erro na IA:", error);
    res.status(500).json({ error: "Erro ao processar avaliação" });
  }
});

// ✅ ROTA RAIZ (evita Cannot GET /)
app.get("/", (req, res) => {
  res.send("API rodando 🚀");
});

// ✅ PORTA DINÂMICA (Railway)
const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});