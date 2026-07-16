/**
 * src/components/EvaluationDetail.jsx
 * Tela de detalhe de uma avaliação: tabela de critérios, nota final e
 * feedback qualitativo.
 */
import AudioPlayer from "./AudioPlayer";
import Badge from "./Badge";
import { getCriteria } from "../data/criteria";
import { scoreColor } from "../lib/theme";

export default function EvaluationDetail({ evaluation, onBack }) {
  const criteriaLabels = getCriteria(evaluation.type);
  const avg = evaluation.score;
  const col = scoreColor(avg);

  return (
    <div style={{ minHeight: "100vh", background: "#0a0e1a", color: "#e8eaf0", fontFamily: "'Segoe UI', sans-serif" }}>
      <div style={{ background: "#0d1220", borderBottom: "1px solid #1e2a40", padding: "12px 28px", display: "flex", alignItems: "center", gap: 14 }}>
        <button onClick={onBack} aria-label="Voltar" style={{ background: "none", border: "none", color: "#00e5a0", cursor: "pointer", fontSize: 22 }}>
          ←
        </button>
        <span style={{ fontSize: 15, fontWeight: 700, color: "#00e5a0" }}>QA Telecom</span>
        <span style={{ color: "#556", fontSize: 12, marginLeft: "auto" }}>
          {evaluation.type} · {evaluation.date}
        </span>
      </div>

      <div style={{ maxWidth: 900, margin: "0 auto", padding: "28px 20px" }}>
        <div style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 12, color: "#00e5a0" }}>
            {evaluation.company} · {evaluation.protocol}
          </div>
          <h2 style={{ margin: "4px 0 0", fontSize: 22, fontWeight: 800 }}>{evaluation.agent}</h2>
        </div>

        {evaluation.audioUrl && <AudioPlayer src={evaluation.audioUrl} fileName={evaluation.audioName} />}

        <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 22 }}>
          <thead>
            <tr style={{ background: "#1a2444" }}>
              <th style={{ padding: "10px 14px", textAlign: "left", color: "#aab", fontSize: 12 }}>Critério</th>
              <th style={{ padding: "10px 14px", textAlign: "center", background: "#c62828", color: "#fff", fontSize: 12, width: 70 }}>Nota</th>
              <th style={{ padding: "10px 14px", textAlign: "center", color: "#aab", fontSize: 12, width: 120 }}>Desempenho</th>
              <th style={{ padding: "10px 14px", textAlign: "left", color: "#aab", fontSize: 12 }}>Observações</th>
            </tr>
          </thead>
          <tbody>
            {evaluation.criteria.map((c, i) => {
              const label = criteriaLabels.find((x) => x.id === c.id)?.label || c.id;
              return (
                <tr key={c.id} style={{ background: i % 2 === 0 ? "#0d1220" : "#111827", borderBottom: "1px solid #1a2340" }}>
                  <td style={{ padding: "11px 14px", fontWeight: 600, fontSize: 13, color: "#dde" }}>{label}</td>
                  <td style={{ padding: "11px 14px", textAlign: "center", fontWeight: 900, fontSize: 22, color: "#fff" }}>{c.score}</td>
                  <td style={{ padding: "11px 14px", textAlign: "center" }}>
                    <Badge score={Number(c.score)} />
                  </td>
                  <td style={{ padding: "11px 14px", fontSize: 12, color: "#99aacc", lineHeight: 1.6 }}>{c.obs}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div style={{ background: col.bg, borderRadius: 10, padding: "16px 28px", display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 22 }}>
          <div>
            <div style={{ fontSize: 13, color: col.text, opacity: 0.85 }}>Média Final</div>
            <div style={{ fontSize: 13, color: col.text, opacity: 0.85, marginTop: 6 }}>Desempenho Geral:</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 40, fontWeight: 900, color: col.text }}>{avg.toFixed(1)}</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: col.text }}>{col.label}</div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
          {[
            { color: "#00aaff", bdr: "#1a3a5f", title: "◎ Pontos Fortes", text: evaluation.pontos_fortes },
            { color: "#ffaa00", bdr: "#5f3a00", title: "⚠ Pontos a Desenvolver", text: evaluation.pontos_desenvolver },
            { color: "#aab", bdr: "#2a3040", title: "✉ Feedback ao Colaborador", text: evaluation.feedback },
          ].map((b) => (
            <div key={b.title} style={{ background: "#0d1220", border: `1px solid ${b.bdr}`, borderRadius: 8, padding: "14px 16px" }}>
              <div style={{ color: b.color, fontSize: 12, marginBottom: 6 }}>{b.title}</div>
              <div style={{ fontSize: 13, color: "#ccd", lineHeight: 1.6 }}>{b.text}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
