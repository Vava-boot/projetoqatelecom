/**
 * src/lib/api.js
 * ───────────────────────────────────────────────────────────────────────────
 * Única camada que fala com o back-end. Nenhum componente deve chamar
 * `fetch` diretamente — isso mantém tratamento de erro e a URL base
 * centralizados em um só lugar.
 */
const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3001";
// NOTA: VITE_API_URL é a URL do SEU back-end, não a chave da OpenRouter.
// A chave da OpenRouter fica SOMENTE no .env do back-end — nunca no navegador.

class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function handleResponse(response) {
  const isJson = response.headers.get("content-type")?.includes("application/json");
  const body = isJson ? await response.json().catch(() => null) : null;

  if (!response.ok) {
    throw new ApiError(body?.error || `Erro ${response.status} ao comunicar com o servidor.`, response.status);
  }
  return body;
}

/** Lista avaliações salvas no back-end (com filtros opcionais). */
export async function fetchEvaluations({ type, search } = {}) {
  const params = new URLSearchParams();
  if (type && type !== "Todos") params.set("type", type);
  if (search) params.set("search", search);

  const res = await fetch(`${API_BASE}/api/evaluations?${params.toString()}`);
  return handleResponse(res);
}

/** Avalia uma transcrição de texto. */
export async function createEvaluation(payload) {
  const res = await fetch(`${API_BASE}/api/evaluate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return handleResponse(res);
}

/** Transcreve e avalia um arquivo de áudio. */
export async function createEvaluationFromAudio({ agent, company, type, protocol, date, audioFile }) {
  const form = new FormData();
  form.append("agent", agent);
  form.append("company", company);
  form.append("type", type);
  if (protocol) form.append("protocol", protocol);
  if (date) form.append("date", date);
  form.append("audio", audioFile);

  const res = await fetch(`${API_BASE}/api/evaluate-audio`, { method: "POST", body: form });
  return handleResponse(res);
}

/** Remove uma avaliação. */
export async function deleteEvaluation(id) {
  const res = await fetch(`${API_BASE}/api/evaluations/${id}`, { method: "DELETE" });
  if (!res.ok && res.status !== 204) return handleResponse(res);
  return true;
}

export { ApiError, API_BASE };
