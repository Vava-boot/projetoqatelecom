/**
 * src/utils/validators.js
 * Validação dos campos de entrada das rotas de avaliação.
 */

function validateCommonFields({ agent, company, type }) {
  if (!agent || typeof agent !== "string" || agent.trim().length < 2) {
    return "Campo 'agent' inválido.";
  }
  if (!company || typeof company !== "string" || company.trim().length < 1) {
    return "Campo 'company' inválido.";
  }
  if (!["Ligação", "Chat"].includes(type)) {
    return "Campo 'type' deve ser 'Ligação' ou 'Chat'.";
  }
  return null;
}

function validateEvalRequest(body) {
  const err = validateCommonFields(body);
  if (err) return err;
  const { transcript } = body;
  if (!transcript || typeof transcript !== "string" || transcript.trim().length < 10) {
    return "Transcrição muito curta ou ausente.";
  }
  return null;
}

function validateAudioRequest(body, file) {
  if (!file) return "Nenhum arquivo de áudio enviado. Use o campo 'audio'.";
  return validateCommonFields(body);
}

module.exports = { validateEvalRequest, validateAudioRequest };
