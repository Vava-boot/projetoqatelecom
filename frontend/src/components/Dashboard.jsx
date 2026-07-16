/**
 * src/components/Dashboard.jsx
 * Painel principal: estatísticas, filtros, busca e lista de avaliações.
 */
import Badge from "./Badge";
import { scoreColor } from "../lib/theme";

export default function Dashboard({
  evaluations,
  loading,
  error,
  fType,
  setFType,
  fClass,
  setFClass,
  search,
  setSearch,
  onSelect,
  onNew,
}) {
  const mediaGeral = evaluations.length
    ? (evaluations.reduce((s, e) => s + e.score, 0) / evaluations.length).toFixed(1)
    : "—";
  const ligacoes = evaluations.filter((e) => e.type === "Ligação").length;
  const chats = evaluations.filter((e) => e.type === "Chat").length;

  const cc = { Excelente: 0, "Muito Bom": 0, Regular: 0, Insatisfatório: 0, Crítico: 0 };
  evaluations.forEach((e) => cc[scoreColor(e.score).label]++);

  const list = evaluations.filter((e) => {
    if (fType !== "Todos" && e.type !== fType) return false;
    if (fClass !== "Todas" && scoreColor(e.score).label !== fClass) return false;
    const q = search.toLowerCase();
    if (q && !e.agent.toLowerCase().includes(q) && !e.company.toLowerCase().includes(q) && !e.protocol.toLowerCase().includes(q)) {
      return false;
    }
    return true;
  });

  return (
    <div style={{ minHeight: "100vh", background: "#0a0e1a", color: "#e8eaf0", fontFamily: "'Segoe UI', sans-serif" }}>
      <div style={{ background: "#0d1220", borderBottom: "1px solid #1e2a40", padding: "12px 28px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 32, height: 32, background: "#00e5a0", borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ color: "#0a0e1a", fontWeight: 900, fontSize: 16 }}>~</span>
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15 }}>QA Telecom</div>
            <div style={{ fontSize: 11, color: "#556" }}>Sistema de Monitoria</div>
          </div>
        </div>
        <button
          onClick={onNew}
          style={{ background: "#00e5a0", color: "#0a0e1a", border: "none", borderRadius: 8, padding: "8px 18px", fontWeight: 700, fontSize: 13, cursor: "pointer" }}
        >
          + Nova Avaliação
        </button>
      </div>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "30px 20px" }}>
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ margin: "0 0 4px", fontSize: 24, fontWeight: 800 }}>Painel de Monitoria</h1>
          <div style={{ fontSize: 13, color: "#556" }}>Avaliações de qualidade em atendimentos de telecomunicações</div>
        </div>

        {error && (
          <div style={{ background: "#2a0a0a", border: "1px solid #d50000", borderRadius: 8, padding: "10px 14px", marginBottom: 14, color: "#ff6b6b", fontSize: 13 }}>
            ⚠ {error}
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 18 }}>
          {[["≡", "Total de Avaliações", evaluations.length], ["~", "Média Geral", mediaGeral], ["☏", "Ligações", ligacoes], ["✉", "Chats", chats]].map(
            ([icon, label, val]) => (
              <div key={label} style={{ background: "#0d1220", border: "1px solid #1e2a40", borderRadius: 10, padding: "14px 18px" }}>
                <div style={{ fontSize: 12, color: "#556", marginBottom: 5 }}>
                  {icon} {label}
                </div>
                <div style={{ fontSize: 26, fontWeight: 800 }}>{val}</div>
              </div>
            )
          )}
        </div>

        <div style={{ background: "#0d1220", border: "1px solid #1e2a40", borderRadius: 10, padding: "12px 18px", marginBottom: 14 }}>
          <div style={{ fontSize: 12, color: "#aab", marginBottom: 8 }}>Distribuição por Classificação</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {Object.entries(cc).map(([k, v]) => (
              <button
                key={k}
                onClick={() => setFClass(fClass === k ? "Todas" : k)}
                style={{
                  background: scoreColor(k === "Excelente" ? 10 : k === "Muito Bom" ? 8 : k === "Regular" ? 6.5 : k === "Insatisfatório" ? 5 : 2).bg,
                  color: scoreColor(k === "Excelente" ? 10 : k === "Muito Bom" ? 8 : k === "Regular" ? 6.5 : k === "Insatisfatório" ? 5 : 2).text,
                  border: fClass === k ? "2px solid #fff" : "2px solid transparent",
                  borderRadius: 20,
                  padding: "3px 14px",
                  fontWeight: 700,
                  fontSize: 12,
                  cursor: "pointer",
                }}
              >
                {k} {v}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por colaborador, empresa ou protocolo..."
            style={{ flex: 1, minWidth: 200, background: "#0d1220", border: "1px solid #1e2a40", color: "#eee", borderRadius: 8, padding: "8px 14px", fontSize: 13 }}
          />
          <select value={fType} onChange={(e) => setFType(e.target.value)} style={{ background: "#0d1220", border: "1px solid #1e2a40", color: "#eee", borderRadius: 8, padding: "8px 12px", fontSize: 13 }}>
            <option>Todos</option>
            <option>Ligação</option>
            <option>Chat</option>
          </select>
          <select value={fClass} onChange={(e) => setFClass(e.target.value)} style={{ background: "#0d1220", border: "1px solid #1e2a40", color: "#eee", borderRadius: 8, padding: "8px 12px", fontSize: 13 }}>
            <option value="Todas">Todas</option>
            {Object.keys(cc).map((k) => (
              <option key={k}>{k}</option>
            ))}
          </select>
        </div>

        {loading ? (
          <div style={{ textAlign: "center", padding: 40, color: "#556" }}>Carregando avaliações...</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {list.map((ev) => {
              const c = scoreColor(ev.score);
              return (
                <div
                  key={ev.id}
                  onClick={() => onSelect(ev)}
                  style={{
                    background: "#0d1220",
                    border: `1.5px solid ${c.bg}33`,
                    borderLeft: `4px solid ${c.bg}`,
                    borderRadius: 10,
                    padding: "13px 20px",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "#111827")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "#0d1220")}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                    <span style={{ color: ev.type === "Ligação" ? "#00aaff" : "#00e5a0", fontSize: 18 }}>{ev.type === "Ligação" ? "☏" : "✉"}</span>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>
                        {ev.agent}
                        <span style={{ color: "#556", fontWeight: 400, fontSize: 12 }}> {ev.type}</span>
                        {ev.hasAudio && <span style={{ marginLeft: 8, background: "#0a2a1a", color: "#00e5a0", fontSize: 11, padding: "1px 7px", borderRadius: 4 }}>🎵 áudio</span>}
                      </div>
                      <div style={{ fontSize: 12, color: "#556", marginTop: 2 }}>
                        🏢 {ev.company} · {ev.protocol} · {ev.date}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <span style={{ fontWeight: 900, fontSize: 22 }}>{ev.score.toFixed(1)}</span>
                    <Badge score={ev.score} />
                    <span style={{ color: "#556" }}>›</span>
                  </div>
                </div>
              );
            })}
            {list.length === 0 && <div style={{ textAlign: "center", padding: 40, color: "#556" }}>Nenhuma avaliação encontrada.</div>}
          </div>
        )}
      </div>
    </div>
  );
}
