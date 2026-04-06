require("dotenv").config();

const express = require("express");
const cors = require("cors");

const app = express();

// ==============================
// ✅ CORS CONFIGURADO
// ==============================
const allowedOrigins = [
  "http://localhost:5173",
  "https://projetoqatelecom.vercel.app"
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    } else {
      console.log("❌ CORS bloqueado:", origin);
      return callback(new Error("Not allowed by CORS"));
    }
  },
  methods: ["GET", "POST"],
  credentials: true
}));

app.use(express.json());

// ==============================
// ✅ HEALTH CHECK
// ==============================
app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

// ==============================
// ✅ ROTA RAIZ
// ==============================
app.get("/", (req, res) => {
  res.send("API rodando 🚀");
});

// ==============================
// 🤖 FUNÇÃO IA
// ==============================
async function callAI(content) {
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
          content: `Avalie o atendimento e dê um feedback profissional:\n\n${content}`
        }
      ]
    })
  });

  const data = await response.json();

  return data.choices?.[0]?.message?.content || "Sem resposta da IA";
}

// ==============================
// 🚀 ROTA PRINCIPAL
// ==============================
app.post("/api/evaluate", async (req, res) => {
  try {
    const { type, text, audioUrl } = req.body;

    console.log("📥 Request:", req.body);

    let content = "";

    // 💬 CHAT
    if (type === "chat") {
      if (!text) {
        return res.status(400).json({
          error: "Texto é obrigatório para chat"
        });
      }

      content = text;
    }

    // 📞 CALL
    else if (type === "call") {
      if (!audioUrl) {
        return res.status(400).json({
          error: "audioUrl é obrigatório para call"
        });
      }

      content = `Avalie esta ligação com base no áudio: ${audioUrl}`;
    }

    // ❌ ERRO
    else {
      return res.status(400).json({
        error: "Tipo inválido. Use 'chat' ou 'call'"
      });
    }

    const result = await callAI(content);

    res.json({ result });

  } catch (error) {
    console.error("❌ Erro:", error);

    res.status(500).json({
      error: "Erro interno do servidor"
    });
  }
});

// ==============================
// ▶️ START
// ==============================
const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
});