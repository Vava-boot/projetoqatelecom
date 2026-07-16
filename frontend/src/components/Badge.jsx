/**
 * src/components/Badge.jsx
 * Selo de classificação (Excelente / Muito Bom / Regular / ...).
 */
import { scoreColor } from "../lib/theme";

export default function Badge({ score }) {
  const c = scoreColor(score);
  return (
    <span
      style={{
        background: c.bg,
        color: c.text,
        borderRadius: 6,
        padding: "2px 10px",
        fontSize: 12,
        fontWeight: 700,
      }}
    >
      {c.label}
    </span>
  );
}
