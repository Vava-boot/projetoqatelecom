/**
 * src/components/NewEvaluationModal.jsx
 * ───────────────────────────────────────────────────────────────────────────
 * Formulário de nova avaliação.
 *
 * ⚠️ CORREÇÃO IMPORTANTE em relação à versão anterior: quando havia apenas
 * áudio (sem transcrição em texto), o código antigo montava um prompt
 * fictício pedindo para a IA "gerar uma avaliação realista baseada em
 * padrões típicos de call center" — ou seja, pedia para a IA INVENTAR nota e
 * feedback sem nenhum conteúdo real do atendimento. Agora, quando só há
 * áudio, o arquivo é enviado ao back-end (/api/evaluate-audio), que faz uma
 * transcrição real (Whisper) antes de avaliar. Nunca fabricamos avaliação.
 */
import { useState, useRef } from "react";
import AudioPlayer from "./AudioPlayer";
import { inputStyle as inp } from "../lib/theme";
import { createEvaluation, createEvaluationFromAudio, ApiError } from "../lib/api";

const initialForm = {
  agent: "",
  type: "Ligação",
  company: "",
  protocol: "",
  date: new Date().toISOString().split("T")[0],
  transcript: "",
  audioFile: null,
  audioUrl: null,
  audioName: "",
  textFileName: "",
};

export default function NewEvaluationModal({ onClose, onCreated }) {
  const [form, setForm] = useState(initialForm);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState("");
  const [apiError, setApiError] = useState("");
  const audioInputRef = useRef();
  const textInputRef = useRef();

  const upd = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleAudio = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    if (form.audioUrl?.startsWith("blob:")) URL.revokeObjectURL(form.audioUrl);
    const url = URL.createObjectURL(f);
    setForm((s) => ({ ...s, audioFile: f, audioUrl: url, audioName: f.name }));
  };

  const handleText = async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    const txt = await f.text();
    setForm((s) => ({ ...s, textFileName: f.name, transcript: txt }));
  };

  const generate = async () => {
    setApiError("");
    if (!form.agent || !form.company) {
      setApiError("Preencha Colaborador e Empresa.");
      return;
    }
    if (!form.transcript && !form.audioFile) {
      setApiError("Adicione áudio, arquivo de texto ou escreva a transcrição.");
      return;
    }

    setLoading(true);
    try {
      const base = {
        agent: form.agent.trim(),
        company: form.company.trim(),
        type: form.type,
        protocol: form.protocol.trim(),
        date: form.date,
      };

      let saved;
      if (form.transcript.trim()) {
        setStep("Analisando critérios de qualidade...");
        saved = await createEvaluation({ ...base, transcript: form.transcript.trim() });
      } else {
        setStep("Transcrevendo áudio...");
        saved = await createEvaluationFromAudio({ ...base, audioFile: form.audioFile });
        setStep("Analisando critérios de qualidade...");
      }

      // O player de áudio na tela de detalhe usa o blob local (o back-end
      // não armazena o arquivo de áudio em si, apenas a transcrição).
      onCreated({ ...saved, audioUrl: form.audioUrl, audioName: form.audioName || saved.audioName });
    } catch (err) {
      setApiError(err instanceof ApiError ? err.message : "Erro ao gerar avaliação. Tente novamente.");
    } finally {
      setLoading(false);
      setStep("");
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.82)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: "#0d1220", border: "1px solid #1e2a40", borderRadius: 14, padding: 26, width: "100%", maxWidth: 600, maxHeight: "92vh", overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>Nova Avaliação com IA</h3>
          <button onClick={onClose} aria-label="Fechar" style={{ background: "none", border: "none", color: "#aab", cursor: "pointer", fontSize: 24 }}>
            ×
          </button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
          <div>
            <label style={{ display: "block", fontSize: 11, color: "#aab", marginBottom: 4 }}>Colaborador *</label>
            <input value={form.agent} onChange={(e) => upd("agent", e.target.value)} placeholder="Nome do agente" style={inp} maxLength={100} />
          </div>
          <div>
            <label style={{ display: "block", fontSize: 11, color: "#aab", marginBottom: 4 }}>Empresa *</label>
            <input value={form.company} onChange={(e) => upd("company", e.target.value)} placeholder="Ex: SUSTENTA" style={inp} maxLength={100} />
          </div>
          <div>
            <label style={{ display: "block", fontSize: 11, color: "#aab", marginBottom: 4 }}>Protocolo</label>
            <input value={form.protocol} onChange={(e) => upd("protocol", e.target.value)} placeholder="Nº do protocolo (opcional)" style={inp} maxLength={50} />
          </div>
          <div>
            <label style={{ display: "block", fontSize: 11, color: "#aab", marginBottom: 4 }}>Tipo</label>
            <select value={form.type} onChange={(e) => upd("type", e.target.value)} style={{ ...inp, padding: "9px 11px" }}>
              <option>Ligação</option>
              <option>Chat</option>
            </select>
          </div>
          <div>
            <label style={{ display: "block", fontSize: 11, color: "#aab", marginBottom: 4 }}>Data</label>
            <input type="date" value={form.date} onChange={(e) => upd("date", e.target.value)} style={inp} />
          </div>
        </div>

        <div style={{ height: 1, background: "#1e2a40", margin: "16px 0" }} />

        <label style={{ display: "block", fontSize: 12, color: "#00e5a0", fontWeight: 700, marginBottom: 8 }}>🎵 Arquivo de Áudio</label>
        <div
          onClick={() => audioInputRef.current.click()}
          style={{ border: `2px dashed ${form.audioName ? "#00e5a0" : "#1e3a5f"}`, borderRadius: 10, padding: "16px 20px", textAlign: "center", cursor: "pointer", marginBottom: 12 }}
        >
          {form.audioName ? (
            <>
              <div style={{ color: "#00e5a0", fontSize: 14, marginBottom: 2 }}>✓ {form.audioName}</div>
              <div style={{ color: "#556", fontSize: 11 }}>Clique para trocar</div>
            </>
          ) : (
            <>
              <div style={{ fontSize: 30, marginBottom: 4 }}>🎙️</div>
              <div style={{ color: "#aab", fontSize: 13, marginBottom: 2 }}>Arraste ou clique para selecionar</div>
              <div style={{ color: "#556", fontSize: 11 }}>MP3 · WAV · OGG · M4A · AAC · WEBM — o áudio é transcrito de verdade pelo servidor</div>
            </>
          )}
        </div>
        <input ref={audioInputRef} type="file" accept="audio/*" onChange={handleAudio} style={{ display: "none" }} />

        {form.audioUrl && <AudioPlayer src={form.audioUrl} fileName={form.audioName} />}

        <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "14px 0" }}>
          <div style={{ flex: 1, height: 1, background: "#1e2a40" }} />
          <span style={{ color: "#556", fontSize: 12 }}>ou</span>
          <div style={{ flex: 1, height: 1, background: "#1e2a40" }} />
        </div>

        <div style={{ marginBottom: 10 }}>
          <label style={{ display: "block", fontSize: 12, color: "#aab", marginBottom: 6 }}>📄 Arquivo de Transcrição</label>
          <div
            onClick={() => textInputRef.current.click()}
            style={{ border: `1.5px dashed ${form.textFileName ? "#00aaff" : "#1e2a40"}`, borderRadius: 8, padding: "10px 16px", cursor: "pointer", display: "flex", alignItems: "center", gap: 10 }}
          >
            <span style={{ fontSize: 18 }}>📂</span>
            <span style={{ fontSize: 13, color: form.textFileName ? "#00aaff" : "#556" }}>{form.textFileName || "Selecionar .txt / .csv / .md"}</span>
          </div>
          <input ref={textInputRef} type="file" accept=".txt,.csv,.md,.json" onChange={handleText} style={{ display: "none" }} />
        </div>

        <div style={{ marginBottom: 18 }}>
          <label style={{ display: "block", fontSize: 12, color: "#aab", marginBottom: 6 }}>✍️ Ou cole a transcrição</label>
          <textarea
            value={form.transcript}
            onChange={(e) => upd("transcript", e.target.value)}
            placeholder="Cole aqui o texto completo do atendimento..."
            rows={5}
            maxLength={8000}
            style={{ ...inp, resize: "vertical" }}
          />
          <div style={{ textAlign: "right", fontSize: 11, color: "#556", marginTop: 3 }}>{form.transcript.length}/8000 caracteres</div>
        </div>

        {apiError && (
          <div style={{ background: "#2a0a0a", border: "1px solid #d50000", borderRadius: 8, padding: "10px 14px", marginBottom: 14, color: "#ff6b6b", fontSize: 13 }}>
            ⚠ {apiError}
          </div>
        )}

        {loading ? (
          <div style={{ textAlign: "center", padding: "18px 0" }}>
            <div style={{ fontSize: 30, marginBottom: 8 }}>🤖</div>
            <div style={{ color: "#00e5a0", fontSize: 14, fontWeight: 700, marginBottom: 5 }}>{step}</div>
            <div style={{ color: "#556", fontSize: 12 }}>Analisando e gerando feedback completo com IA...</div>
            <div style={{ marginTop: 12, display: "flex", justifyContent: "center", gap: 6 }}>
              {[0, 1, 2].map((i) => (
                <div key={i} style={{ width: 8, height: 8, borderRadius: "50%", background: "#00e5a0", opacity: 0.4, animation: `blink 1.2s ${i * 0.35}s infinite` }} />
              ))}
            </div>
            <style>{`@keyframes blink{0%,100%{opacity:.3}50%{opacity:1}}`}</style>
          </div>
        ) : (
          <button
            onClick={generate}
            style={{ width: "100%", background: "#00e5a0", color: "#0a0e1a", border: "none", borderRadius: 9, padding: "13px", fontWeight: 900, fontSize: 15, cursor: "pointer" }}
          >
            🤖 Gerar Avaliação com IA
          </button>
        )}
      </div>
    </div>
  );
}
