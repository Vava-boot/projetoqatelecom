/**
 * src/services/openrouterClient.js
 * ───────────────────────────────────────────────────────────────────────────
 * Única camada que fala HTTP com a OpenRouter. Nenhum outro módulo chama
 * `fetch` diretamente — isso centraliza timeout, retry e mapeamento de erros.
 */
const { env } = require("../config/env");

class OpenRouterError extends Error {
  constructor(message, { status = 502, code = "OPENROUTER_ERROR", cause } = {}) {
    super(message);
    this.name = "OpenRouterError";
    this.status = status;
    this.code = code;
    this.cause = cause;
  }
}

const STATUS_MESSAGES = {
  400: "Requisição inválida enviada à OpenRouter (parâmetros ou modelo incorretos).",
  401: "Chave de API inválida ou expirada. Verifique OPENROUTER_API_KEY.",
  402: "Saldo insuficiente na conta OpenRouter. Adicione créditos em openrouter.ai/credits.",
  404: "Modelo não encontrado na OpenRouter. Verifique o slug do modelo configurado (MODEL_EVAL).",
  408: "Requisição expirou do lado da OpenRouter. Tente novamente.",
  429: "Limite de requisições atingido. Aguarde alguns instantes e tente novamente.",
  502: "Modelo temporariamente indisponível. Tente novamente.",
  503: "Nenhum provedor disponível para o modelo solicitado no momento.",
};

function mapHttpError(status, rawBody) {
  const msg = STATUS_MESSAGES[status] || `Erro na API OpenRouter (HTTP ${status}).`;
  console.error(`[OpenRouter][ERRO] HTTP ${status}:`, String(rawBody).slice(0, 500));
  return new OpenRouterError(msg, { status: 502, code: `HTTP_${status}` });
}

function baseHeaders(extra = {}) {
  return {
    Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
    "HTTP-Referer": env.APP_REFERER,
    "X-Title": env.APP_TITLE,
    ...extra,
  };
}

const RETRYABLE_STATUS = new Set([408, 429, 502, 503]);

async function fetchWithRetry(url, options, { timeoutMs = 30_000, retries = 2, label = "request" } = {}) {
  let lastErr;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const tid = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(tid);

      if (res.ok) return res;

      if (RETRYABLE_STATUS.has(res.status) && attempt < retries) {
        const backoffMs = 500 * Math.pow(2, attempt);
        console.warn(`[OpenRouter] ${label}: HTTP ${res.status}, tentativa ${attempt + 1}/${retries + 1}. Retentando em ${backoffMs}ms...`);
        await new Promise((r) => setTimeout(r, backoffMs));
        continue;
      }

      const rawBody = await res.text().catch(() => "");
      throw mapHttpError(res.status, rawBody);

    } catch (err) {
      clearTimeout(tid);
      if (err instanceof OpenRouterError) throw err;

      if (err.name === "AbortError") {
        lastErr = new OpenRouterError(
          `A OpenRouter demorou muito para responder (${label}). Tente novamente.`,
          { status: 504, code: "TIMEOUT", cause: err }
        );
        if (attempt < retries) {
          console.warn(`[OpenRouter] ${label}: timeout, tentativa ${attempt + 1}/${retries + 1}.`);
          continue;
        }
        throw lastErr;
      }

      lastErr = new OpenRouterError(
        `Falha de conexão com a OpenRouter (${label}): ${err.message}`,
        { status: 502, code: "NETWORK_ERROR", cause: err }
      );
      if (attempt < retries) {
        console.warn(`[OpenRouter] ${label}: erro de rede, tentativa ${attempt + 1}/${retries + 1}.`);
        continue;
      }
      throw lastErr;
    }
  }

  throw lastErr;
}

async function chatCompletion(payload, { timeoutMs = env.EVAL_TIMEOUT_MS, retries = 2 } = {}) {
  const res = await fetchWithRetry(
    env.OPENROUTER_CHAT_URL,
    { method: "POST", headers: baseHeaders({ "Content-Type": "application/json" }), body: JSON.stringify(payload) },
    { timeoutMs, retries, label: "chat/completions" }
  );
  return res.json();
}

async function audioTranscription(formData, { timeoutMs = env.STT_TIMEOUT_MS, retries = 1 } = {}) {
  const res = await fetchWithRetry(
    env.OPENROUTER_STT_URL,
    { method: "POST", headers: baseHeaders(formData.getHeaders()), body: formData },
    { timeoutMs, retries, label: "audio/transcriptions" }
  );
  return res.json();
}

async function listModels() {
  const res = await fetchWithRetry(
    env.OPENROUTER_MODELS_URL,
    { method: "GET", headers: baseHeaders() },
    { timeoutMs: 15_000, retries: 1, label: "models" }
  );
  return res.json();
}

module.exports = { chatCompletion, audioTranscription, listModels, OpenRouterError };
