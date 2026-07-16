/**
 * src/repositories/index.js
 * ───────────────────────────────────────────────────────────────────────────
 * Ponto único de acesso ao repositório de avaliações. Rotas e serviços
 * importam SOMENTE este arquivo — nunca as implementações diretamente.
 * Isso torna trivial trocar a fonte de dados no futuro (ex.: outro banco)
 * sem tocar em nenhuma rota.
 */
const { env } = require("../config/env");

const repository = env.DATABASE_URL
  ? require("./postgresEvaluationRepository")
  : require("./memoryEvaluationRepository");

if (repository.kind === "memory") {
  console.warn(
    "[DB] DATABASE_URL não configurada — usando repositório EM MEMÓRIA. " +
    "Os dados serão perdidos a cada reinício. Defina DATABASE_URL para persistência real."
  );
}

module.exports = repository;
