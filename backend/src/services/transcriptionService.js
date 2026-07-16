/**
 * src/services/transcriptionService.js
 * ───────────────────────────────────────────────────────────────────────────
 * Transcrição real de áudio via endpoint /audio/transcriptions da OpenRouter.
 *
 * ⚠️ Isto substitui um comportamento grave da versão anterior do front-end:
 * quando havia áudio mas nenhuma transcrição de texto, o front-end montava
 * um prompt fictício ("Gere avaliação realista baseada em padrões típicos de
 * call center") e pedia para a IA INVENTAR uma avaliação plausível sem
 * nenhum conteúdo real do atendimento. Isso produzia notas e feedbacks
 * fabricados, apresentados ao usuário como se fossem uma análise real — um
 * risco sério para uma ferramenta de compliance/qualidade. Agora o áudio é
 * sempre transcrito de verdade antes de qualquer avaliação.
 */
const FormData = require("form-data");
const { env } = require("../config/env");
const { audioTranscription, OpenRouterError } = require("./openrouterClient");

async function transcribeAudio(file) {
  const form = new FormData();
  form.append("file", file.buffer, {
    filename: file.originalname || "audio.mp3",
    contentType: file.mimetype || "audio/mpeg",
  });
  form.append("model", env.MODEL_STT);
  form.append("language", "pt");

  const data = await audioTranscription(form);
  const transcript = data.text || data.transcript || "";

  if (!transcript || transcript.trim().length < 5) {
    console.error("[Transcription][ERRO] Transcrição vazia ou muito curta:", JSON.stringify(data).slice(0, 300));
    throw new OpenRouterError(
      "Não foi possível transcrever o áudio (arquivo vazio, corrompido ou inaudível).",
      { status: 502, code: "EMPTY_TRANSCRIPT" }
    );
  }

  console.log(`[Transcription] ${transcript.length} caracteres transcritos.`);
  return transcript;
}

module.exports = { transcribeAudio };
