/**
 * src/services/evaluationService.js
 * ───────────────────────────────────────────────────────────────────────────
 * Regras de negócio da avaliação de QA.
 *
 * DECISÃO DE ARQUITETURA — saída estruturada via tool-calling:
 * A versão anterior pedia "responda em JSON" no prompt e fazia parsing de
 * texto livre. Isso é frágil: o modelo pode envolver o JSON em markdown,
 * adicionar texto antes/depois, ou truncar. Aqui forçamos o modelo a chamar
 * uma "function" (submit_evaluation) com um schema JSON explícito — o
 * provedor valida a forma da resposta antes de devolvê-la. Isso elimina a
 * quase totalidade das falhas de parsing observadas na versão anterior.
 * Mantemos, mesmo assim, um fallback por extração de texto (parseFromText)
 * como rede de segurança para o caso raro de um provedor não suportar
 * tool-calling para o modelo configurado.
 */
const { env } = require("../config/env");
const { chatCompletion, OpenRouterError } = require("./openrouterClient");
const { sanitize, extractJsonObject } = require("../utils/sanitize");

// ── Critérios + âncoras de rubrica ─────────────────────────────────────────
// Cada critério tem uma dica curta do que observar. Isso reduz a variância
// entre execuções: sem âncoras, "empatia 7" pode significar coisas diferentes
// em chamadas diferentes do mesmo modelo.
const CRITERIA = {
  Ligação: [
    ["saudacao", "Saudação", "apresentação completa: cumprimento, nome do agente, nome da empresa"],
    ["tom_voz", "Tom de Voz", "entonação, cordialidade e controle emocional percebidos na fala"],
    ["tempo_espera", "Tempo de Espera", "tempo até o início do atendimento efetivo"],
    ["tempo_atendimento", "Tempo de Atendimento", "duração total frente ao TMA esperado (~4 min)"],
    ["uso_mudo", "Utilização do Mudo", "avisa antes de mutar e agradece a espera ao retornar"],
    ["personalizacao", "Personalização", "usa o nome do cliente, evita tom robótico/genérico"],
    ["tratativa", "Tratativa, sondagem, resolução", "perguntas certas, solução correta, segue processo"],
    ["gramatica", "Gramática", "concordância, clareza, ausência de vícios de linguagem"],
    ["dados_obrigatorios", "Dados obrigatórios", "confirma nome completo e CPF antes de agir"],
    ["protocolo_encerramento", "Protocolo e Encerramento", "fornece o protocolo e encerra formalmente"],
  ],
  Chat: [
    ["saudacao", "Saudação", "apresentação completa: cumprimento, nome do agente, nome da empresa"],
    ["empatia", "Empatia", "reconhece o sentimento/contexto do cliente antes de resolver"],
    ["tempo_espera", "Tempo de Espera", "tempo até o início do atendimento efetivo"],
    ["tempo_atendimento", "Tempo de Atendimento", "duração total do atendimento"],
    ["tempo_resposta", "Tempo de Resposta", "intervalo entre a mensagem do cliente e a resposta"],
    ["gramatica", "Gramática", "concordância, clareza, ausência de vícios de linguagem"],
    ["sondagem", "Sondagem", "perguntas certas para entender a real necessidade"],
    ["confirmacao_dados", "Confirmação de Dados", "valida identidade/dados antes de tratar a solicitação"],
    ["personalizacao", "Personalização", "usa o nome do cliente, evita respostas copiadas/genéricas"],
    ["protocolo_encerramento", "Protocolo e Encerramento", "fornece o protocolo e encerra formalmente"],
  ],
};

function criteriaBlock(type) {
  return CRITERIA[type]
    .map(([id, label, hint]) => `- ${id} (${label}): ${hint}`)
    .join("\n");
}

function criterionIds(type) {
  return CRITERIA[type].map(([id]) => id);
}

/**
 * Prompt de avaliação (v2).
 *
 * Mudanças em relação à versão anterior (ver AUDITORIA.md para a análise
 * completa):
 *  - Cada critério agora tem uma âncora de uma linha do que observar,
 *    reduzindo ambiguidade e variância de nota entre execuções.
 *  - Escala 0-10 ganhou descrição textual por faixa (evita que "7" signifique
 *    coisas diferentes em avaliações diferentes).
 *  - Instrução explícita para tratar informação ausente como neutra (nota 5
 *    + observação dizendo que não há evidência), em vez de o modelo "chutar"
 *    uma nota alta ou baixa sem base no texto.
 *  - Instrução explícita contra feedback genérico: cada observação e o
 *    feedback final devem citar um comportamento específico do atendimento.
 *  - O exemplo de JSON com 10 objetos "score:8" foi REMOVIDO: como a saída
 *    agora é garantida via tool-calling (schema), o exemplo era só
 *    desperdício de tokens — e criava um viés de ancoragem observável (o
 *    modelo tende a gravitar em torno dos números de exemplo).
 */
function buildPrompt(agent, company, type, transcript) {
  return `Você é um Avaliador de Qualidade (QA) Sênior de Telecomunicações (N1/N2), avaliando um atendimento do tipo "${type}".

Agente avaliado: ${sanitize(agent, 100)}
Empresa: ${sanitize(company, 100)}

ESCALA DE NOTAS (use com rigor, para cada critério):
- 9-10: exemplar, sem falhas perceptíveis.
- 7-8: bom, com desvios pequenos e pontuais.
- 5-6: dentro do mínimo aceitável, com falhas relevantes.
- 2-4: abaixo do esperado, com impacto real no atendimento.
- 0-1: falha crítica de processo (ex.: não confirmar identidade, não fornecer protocolo).

REGRAS:
1. Nota 10 exige perfeição absoluta no critério — não seja permissivo.
2. Baseie-se SOMENTE no que está escrito na transcrição. Se não houver evidência suficiente para julgar um critério, atribua nota 5 e explique na observação que não há evidência no texto — nunca invente comportamento que não aparece.
3. Cada observação por critério deve citar um trecho ou comportamento específico do atendimento (nunca genérico como "atendimento adequado").
4. No campo "feedback", use o primeiro nome do agente e cite pelo menos um exemplo concreto observado — combine um elogio genuíno com um ponto de melhoria respeitoso.
5. "pontos_fortes" e "pontos_desenvolver": no máximo 2 frases diretas cada. "feedback": no máximo 3 frases.
6. Responda inteiramente em português do Brasil.

TRANSCRIÇÃO DO ATENDIMENTO:
"""
${sanitize(transcript, 7000)}
"""

CRITÉRIOS A AVALIAR (nota 0-10 cada, todos obrigatórios):
${criteriaBlock(type)}

Chame a função "submit_evaluation" com o resultado. Não responda em texto livre.`;
}

/** Schema JSON usado para forçar a estrutura da resposta via tool-calling. */
function buildEvaluationTool(type) {
  return {
    type: "function",
    function: {
      name: "submit_evaluation",
      description: "Envia o resultado estruturado da avaliação de qualidade do atendimento.",
      parameters: {
        type: "object",
        properties: {
          criteria: {
            type: "array",
            description: `Uma entrada para CADA um destes ids, nesta ordem: ${criterionIds(type).join(", ")}.`,
            items: {
              type: "object",
              properties: {
                id: { type: "string", enum: criterionIds(type) },
                score: { type: "number", minimum: 0, maximum: 10 },
                obs: { type: "string", description: "Observação específica citando o atendimento (1-2 frases)." },
              },
              required: ["id", "score", "obs"],
            },
            minItems: criterionIds(type).length,
            maxItems: criterionIds(type).length,
          },
          pontos_fortes: { type: "string" },
          pontos_desenvolver: { type: "string" },
          feedback: { type: "string" },
        },
        required: ["criteria", "pontos_fortes", "pontos_desenvolver", "feedback"],
      },
    },
  };
}

class EvalParseError extends Error {
  constructor(message, code) {
    super(message);
    this.name = "EvalParseError";
    this.code = code;
  }
}

/** Fallback: extrai JSON de uma resposta em texto livre (ver cabeçalho do arquivo). */
function parseFromText(raw) {
  if (!raw || !raw.trim()) throw new EvalParseError("Resposta vazia da IA.", "EMPTY");
  const jsonSlice = extractJsonObject(raw);
  if (!jsonSlice) throw new EvalParseError("Resposta da IA não contém um JSON reconhecível.", "NO_JSON");
  try {
    return JSON.parse(jsonSlice);
  } catch {
    throw new EvalParseError("Resposta da IA em formato inválido (JSON malformado).", "JSON");
  }
}

function validateParsed(parsed, type) {
  const expectedIds = criterionIds(type);
  if (!Array.isArray(parsed.criteria) || parsed.criteria.length < expectedIds.length) {
    throw new EvalParseError("Resposta da IA incompleta (critérios ausentes).", "INCOMPLETE");
  }
  return parsed;
}

/**
 * Chama o modelo de avaliação. Tenta tool-calling forçado primeiro; se o
 * provedor recusar (HTTP 400 — nem todo modelo/rota suporta tool_choice
 * forçado), refaz a chamada pedindo JSON em texto livre como fallback.
 */
async function callEvalModel(agent, company, type, transcript) {
  const promptText = buildPrompt(agent, company, type, transcript);
  const tool = buildEvaluationTool(type);

  const messages = [
    {
      role: "system",
      content: "Você é um avaliador de QA rigoroso e consistente. Nunca elogie sem base concreta na transcrição.",
    },
    { role: "user", content: promptText },
  ];

  try {
    const data = await chatCompletion({
      model: env.MODEL_EVAL,
      max_tokens: 1800,
      temperature: 0.2,
      messages,
      tools: [tool],
      tool_choice: { type: "function", function: { name: "submit_evaluation" } },
      provider: { sort: "price", allow_fallbacks: true },
    });
    return { data, mode: "tool" };
  } catch (err) {
    if (err instanceof OpenRouterError && err.code === "HTTP_400") {
      console.warn("[Evaluation] tool_choice forçado rejeitado pelo provedor; tentando modo texto/JSON...");
      const data = await chatCompletion({
        model: env.MODEL_EVAL,
        max_tokens: 1800,
        temperature: 0.2,
        messages: [
          { role: "system", content: "Responda SOMENTE em JSON válido, sem markdown, sem texto fora do JSON." },
          { role: "user", content: promptText },
        ],
        response_format: { type: "json_object" },
        provider: { sort: "price", allow_fallbacks: true },
      });
      return { data, mode: "text" };
    }
    throw err;
  }
}

function buildResult(parsed) {
  const avg = parsed.criteria.reduce((sum, c) => sum + Number(c.score || 0), 0) / parsed.criteria.length;
  const score = Math.round(avg * 10) / 10;

  return {
    criteria: parsed.criteria,
    score,
    pontos_fortes: parsed.pontos_fortes || "",
    pontos_desenvolver: parsed.pontos_desenvolver || "",
    feedback: parsed.feedback || "",
  };
}

/** Função de alto nível usada pelas rotas. */
async function evaluateTranscript({ agent, company, type, transcript }) {
  const { data, mode } = await callEvalModel(agent, company, type, transcript);

  if (data.usage) {
    console.log(
      `[TOKEN] prompt=${data.usage.prompt_tokens} completion=${data.usage.completion_tokens} ` +
      `total=${data.usage.total_tokens} cost=$${data.usage.cost ?? "?"}`
    );
  }
  console.log(`[Evaluation] Modelo: ${data.model || env.MODEL_EVAL} | modo: ${mode}`);

  const message = data.choices?.[0]?.message || {};
  let parsed;

  const toolCall = message.tool_calls?.find((t) => t.function?.name === "submit_evaluation");
  if (toolCall) {
    try {
      parsed = JSON.parse(toolCall.function.arguments);
    } catch {
      throw new EvalParseError("Argumentos da function call em formato inválido.", "JSON");
    }
  } else {
    // Fallback: modo texto/JSON ou modelo que ignorou o tool_choice.
    parsed = parseFromText(message.content || "");
  }

  validateParsed(parsed, type);

  return buildResult(parsed);
}

module.exports = {
  evaluateTranscript,
  buildPrompt,
  buildEvaluationTool,
  parseFromText,
  buildResult,
  EvalParseError,
  CRITERIA,
};
