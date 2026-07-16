/**
 * src/repositories/postgresEvaluationRepository.js
 * ───────────────────────────────────────────────────────────────────────────
 * Implementação Postgres do repositório de avaliações. Usada automaticamente
 * quando DATABASE_URL está definida (ver repositories/index.js). A tabela é
 * criada por src/config/db.js::runMigrations() na inicialização.
 */
const { getPool } = require("../config/db");

function mapRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    agent: row.agent,
    company: row.company,
    type: row.type,
    protocol: row.protocol,
    date: row.eval_date instanceof Date ? row.eval_date.toISOString().slice(0, 10) : row.eval_date,
    score: Number(row.score),
    criteria: row.criteria,
    pontos_fortes: row.pontos_fortes,
    pontos_desenvolver: row.pontos_desenvolver,
    feedback: row.feedback,
    transcript: row.transcript,
    hasAudio: row.has_audio,
    audioName: row.audio_name,
    created_at: row.created_at,
  };
}

async function create(evaluation) {
  const pool = getPool();
  const { rows } = await pool.query(
    `INSERT INTO evaluations
       (agent, company, type, protocol, eval_date, score, criteria, pontos_fortes, pontos_desenvolver, feedback, transcript, has_audio, audio_name)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
     RETURNING *`,
    [
      evaluation.agent,
      evaluation.company,
      evaluation.type,
      evaluation.protocol,
      evaluation.date,
      evaluation.score,
      JSON.stringify(evaluation.criteria),
      evaluation.pontos_fortes,
      evaluation.pontos_desenvolver,
      evaluation.feedback,
      evaluation.transcript || null,
      !!evaluation.hasAudio,
      evaluation.audioName || null,
    ]
  );
  return mapRow(rows[0]);
}

async function findAll({ type, search } = {}) {
  const pool = getPool();
  const conditions = [];
  const params = [];

  if (type && type !== "Todos") {
    params.push(type);
    conditions.push(`type = $${params.length}`);
  }
  if (search) {
    params.push(`%${search.toLowerCase()}%`);
    conditions.push(
      `(LOWER(agent) LIKE $${params.length} OR LOWER(company) LIKE $${params.length} OR LOWER(protocol) LIKE $${params.length})`
    );
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const { rows } = await pool.query(`SELECT * FROM evaluations ${where} ORDER BY created_at DESC LIMIT 500`, params);
  return rows.map(mapRow);
}

async function findById(id) {
  const pool = getPool();
  const { rows } = await pool.query(`SELECT * FROM evaluations WHERE id = $1`, [id]);
  return mapRow(rows[0]);
}

async function remove(id) {
  const pool = getPool();
  const { rowCount } = await pool.query(`DELETE FROM evaluations WHERE id = $1`, [id]);
  return rowCount > 0;
}

module.exports = { create, findAll, findById, remove, kind: "postgres" };
