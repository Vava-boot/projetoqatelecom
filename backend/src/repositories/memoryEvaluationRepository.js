/**
 * src/repositories/memoryEvaluationRepository.js
 * ───────────────────────────────────────────────────────────────────────────
 * Implementação em memória do repositório de avaliações. É o padrão quando
 * DATABASE_URL não está configurada — permite rodar e avaliar o projeto sem
 * nenhuma infraestrutura de banco.
 *
 * ⚠️ Limitação importante (documentada, não escondida): os dados somem a
 * cada reinício do processo e, em ambientes com múltiplas instâncias, cada
 * instância tem sua própria cópia. Para persistência real entre deploys e
 * instâncias, defina DATABASE_URL (ver postgresEvaluationRepository.js).
 */
const { randomUUID } = require("crypto");

let store = [];

async function create(evaluation) {
  const row = { id: randomUUID(), created_at: new Date().toISOString(), ...evaluation };
  store.unshift(row);
  return row;
}

async function findAll({ type, search } = {}) {
  let rows = store;
  if (type && type !== "Todos") rows = rows.filter((r) => r.type === type);
  if (search) {
    const q = search.toLowerCase();
    rows = rows.filter(
      (r) =>
        r.agent.toLowerCase().includes(q) ||
        r.company.toLowerCase().includes(q) ||
        r.protocol.toLowerCase().includes(q)
    );
  }
  return rows;
}

async function findById(id) {
  return store.find((r) => r.id === id) || null;
}

async function remove(id) {
  const before = store.length;
  store = store.filter((r) => r.id !== id);
  return store.length < before;
}

/** Exposto apenas para testes. */
function _reset() {
  store = [];
}

module.exports = { create, findAll, findById, remove, _reset, kind: "memory" };
