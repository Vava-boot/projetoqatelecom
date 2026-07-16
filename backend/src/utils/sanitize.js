/**
 * src/utils/sanitize.js
 * Funções puras de higienização/extração de texto. Sem dependências externas.
 */

/** Remove tags HTML/XML e corta o texto em maxLen caracteres. */
function sanitize(str, maxLen = 8000) {
  if (typeof str !== "string") return "";
  return str.replace(/<[^>]*>/g, "").trim().slice(0, maxLen);
}

/**
 * Extrai o primeiro objeto JSON válido de uma string, tolerando texto extra
 * antes/depois ou cercas de markdown (```json ... ```). Usado como rede de
 * segurança quando o modelo não retorna via tool-calling (ver evaluationService).
 */
function extractJsonObject(raw) {
  if (typeof raw !== "string") return null;
  const withoutFences = raw.replace(/```json|```/gi, "").trim();
  const start = withoutFences.indexOf("{");
  const end = withoutFences.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) return null;
  return withoutFences.slice(start, end + 1);
}

module.exports = { sanitize, extractJsonObject };
