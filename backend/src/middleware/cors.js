/**
 * src/middleware/cors.js
 * ───────────────────────────────────────────────────────────────────────────
 * A versão anterior aceitava QUALQUER subdomínio "*.vercel.app" via regex —
 * isso permite que qualquer projeto de terceiro hospedado na Vercel (inclusive
 * de um atacante) chame esta API a partir do navegador de um usuário, já que
 * qualquer pessoa pode publicar algo em *.vercel.app gratuitamente. Aqui a
 * lista de origens permitidas é fechada: vem exclusivamente de
 * ALLOWED_ORIGINS (.env). Sem essa variável, cai no padrão de desenvolvimento
 * (localhost:5173) — nunca em "aceitar qualquer coisa".
 */
const cors = require("cors");
const { env } = require("../config/env");

module.exports = cors({
  origin(origin, callback) {
    // Requisições sem header Origin (curl, health checks, apps mobile) são
    // permitidas — elas não representam um navegador de terceiro.
    if (!origin) return callback(null, true);
    if (env.ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
    return callback(new Error("Origem não permitida por CORS."));
  },
  methods: ["GET", "POST", "DELETE", "OPTIONS"],
  credentials: false,
});
