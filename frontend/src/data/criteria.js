/**
 * src/data/criteria.js
 * Rótulos de exibição dos critérios por tipo de atendimento.
 * Os ids devem bater exatamente com os usados no back-end
 * (backend/src/services/evaluationService.js) — são o contrato entre as
 * duas partes do sistema.
 */
export const CRITERIA_LIGACAO = [
  { id: "saudacao", label: "Saudação" },
  { id: "tom_voz", label: "Tom de Voz" },
  { id: "tempo_espera", label: "Tempo de Espera" },
  { id: "tempo_atendimento", label: "Tempo de Atendimento" },
  { id: "uso_mudo", label: "Utilização do Mudo" },
  { id: "personalizacao", label: "Personalização" },
  { id: "tratativa", label: "Tratativa, sondagem, resolução" },
  { id: "gramatica", label: "Gramática" },
  { id: "dados_obrigatorios", label: "Dados obrigatórios" },
  { id: "protocolo_encerramento", label: "Protocolo e Encerramento" },
];

export const CRITERIA_CHAT = [
  { id: "saudacao", label: "Saudação" },
  { id: "empatia", label: "Empatia" },
  { id: "tempo_espera", label: "Tempo de Espera" },
  { id: "tempo_atendimento", label: "Tempo de Atendimento" },
  { id: "tempo_resposta", label: "Tempo de Resposta" },
  { id: "gramatica", label: "Gramática" },
  { id: "sondagem", label: "Sondagem" },
  { id: "confirmacao_dados", label: "Confirmação de Dados" },
  { id: "personalizacao", label: "Personalização" },
  { id: "protocolo_encerramento", label: "Protocolo e Encerramento" },
];

export function getCriteria(type) {
  return type === "Chat" ? CRITERIA_CHAT : CRITERIA_LIGACAO;
}
