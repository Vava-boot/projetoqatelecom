/**
 * src/lib/theme.js
 * Cores, classificações e estilos compartilhados entre componentes.
 * Centralizar aqui evita repetir os mesmos objetos de estilo em vários
 * arquivos (como acontecia no componente único anterior).
 *
 * NOTA DE EVOLUÇÃO: isto ainda é CSS-in-JS via objetos inline, não um
 * design system real. Ver AUDITORIA.md → "Lista de evoluções futuras" para
 * a recomendação de migrar para Tailwind ou CSS Modules.
 */

export const CLASS_COLORS = {
  Excelente: { bg: "#00c853", text: "#fff" },
  "Muito Bom": { bg: "#76ff03", text: "#1a1a1a" },
  Regular: { bg: "#ffd600", text: "#1a1a1a" },
  Insatisfatório: { bg: "#ff6d00", text: "#fff" },
  Crítico: { bg: "#d50000", text: "#fff" },
};

export function scoreColor(score) {
  if (score >= 9) return { ...CLASS_COLORS.Excelente, label: "Excelente" };
  if (score >= 7.5) return { ...CLASS_COLORS["Muito Bom"], label: "Muito Bom" };
  if (score >= 6) return { ...CLASS_COLORS.Regular, label: "Regular" };
  if (score >= 4) return { ...CLASS_COLORS.Insatisfatório, label: "Insatisfatório" };
  return { ...CLASS_COLORS.Crítico, label: "Crítico" };
}

export function fmtTime(s) {
  if (!s || Number.isNaN(s)) return "0:00";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

export const colors = {
  bg: "#0a0e1a",
  panel: "#0d1220",
  panelAlt: "#111827",
  border: "#1e2a40",
  text: "#e8eaf0",
  textMuted: "#aab",
  textFaint: "#556",
  accent: "#00e5a0",
};

export const inputStyle = {
  width: "100%",
  background: "#111827",
  border: "1px solid #1e2a40",
  color: "#eee",
  borderRadius: 7,
  padding: "8px 11px",
  fontSize: 13,
  boxSizing: "border-box",
  fontFamily: "inherit",
};

export const pageStyle = {
  minHeight: "100vh",
  background: colors.bg,
  color: colors.text,
  fontFamily: "'Segoe UI', sans-serif",
};
