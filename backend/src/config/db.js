/**
 * src/config/db.js
 * ───────────────────────────────────────────────────────────────────────────
 * Pool de conexão Postgres, criado sob demanda apenas se DATABASE_URL
 * estiver configurada. Se não estiver, `getPool()` retorna null e o
 * repositório em memória é usado automaticamente (ver repositories/).
 *
 * Isso permite rodar o projeto com ZERO configuração de banco (ideal para
 * avaliar/testar) e "ligar" persistência real depois, apenas definindo
 * DATABASE_URL — sem tocar em nenhuma rota ou serviço.
 */
const { env } = require("./env");

let pool = null;
let triedInit = false;

function getPool() {
  if (!env.DATABASE_URL) return null;
  if (pool) return pool;
  if (triedInit) return pool; // já tentou e falhou nesta execução

  triedInit = true;
  try {
    // Import tardio: se "pg" não estiver instalado e DATABASE_URL não for
    // usada, a aplicação nem tenta carregar esse módulo.
    const { Pool } = require("pg");
    pool = new Pool({
      connectionString: env.DATABASE_URL,
      ssl: env.DATABASE_URL.includes("localhost") ? false : { rejectUnauthorized: false },
      max: 5,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
    });

    pool.on("error", (err) => {
      // Erros em conexões ociosas não devem derrubar o processo.
      console.error("[DB][ERRO] Erro inesperado no pool Postgres:", err.message);
    });

    console.log("[DB] Pool Postgres inicializado.");
  } catch (err) {
    console.error(
      "[DB][ERRO] Falha ao inicializar Postgres. Verifique se 'pg' está instalado " +
      "e se DATABASE_URL é válida. Usando repositório em memória como fallback.",
      err.message
    );
    pool = null;
  }

  return pool;
}

async function runMigrations() {
  const p = getPool();
  if (!p) return;

  await p.query(`
    CREATE TABLE IF NOT EXISTS evaluations (
      id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      agent               TEXT NOT NULL,
      company             TEXT NOT NULL,
      type                TEXT NOT NULL CHECK (type IN ('Ligação', 'Chat')),
      protocol            TEXT NOT NULL,
      eval_date           DATE NOT NULL,
      score               NUMERIC(4,1) NOT NULL,
      criteria            JSONB NOT NULL,
      pontos_fortes       TEXT NOT NULL DEFAULT '',
      pontos_desenvolver  TEXT NOT NULL DEFAULT '',
      feedback            TEXT NOT NULL DEFAULT '',
      transcript          TEXT,
      has_audio           BOOLEAN NOT NULL DEFAULT FALSE,
      audio_name          TEXT,
      created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_evaluations_created_at ON evaluations (created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_evaluations_type ON evaluations (type);
  `).catch(async (err) => {
    // gen_random_uuid() requer a extensão pgcrypto em alguns provedores.
    if (/gen_random_uuid/i.test(err.message)) {
      await p.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto;`);
      return runMigrations();
    }
    throw err;
  });

  console.log("[DB] Migração aplicada (tabela 'evaluations' pronta).");
}

module.exports = { getPool, runMigrations };
