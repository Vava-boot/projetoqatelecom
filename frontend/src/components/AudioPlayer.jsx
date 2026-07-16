/**
 * src/components/AudioPlayer.jsx
 * Player de áudio customizado com controle de velocidade/volume.
 */
import { useState, useRef, useEffect } from "react";
import { fmtTime } from "../lib/theme";

export default function AudioPlayer({ src, fileName }) {
  const audioRef = useRef();
  const [playing, setPlaying] = useState(false);
  const [cur, setCur] = useState(0);
  const [dur, setDur] = useState(0);
  const [vol, setVol] = useState(1);
  const [speed, setSpeed] = useState(1);

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const onTime = () => setCur(a.currentTime);
    const onMeta = () => setDur(a.duration || 0);
    const onEnd = () => setPlaying(false);
    a.addEventListener("timeupdate", onTime);
    a.addEventListener("loadedmetadata", onMeta);
    a.addEventListener("ended", onEnd);
    return () => {
      a.removeEventListener("timeupdate", onTime);
      a.removeEventListener("loadedmetadata", onMeta);
      a.removeEventListener("ended", onEnd);
    };
  }, [src]);

  // Revoga o object URL ao desmontar, para evitar vazamento de memória.
  useEffect(() => {
    return () => {
      if (src?.startsWith("blob:")) URL.revokeObjectURL(src);
    };
  }, [src]);

  const toggle = () => {
    const a = audioRef.current;
    if (!a) return;
    if (playing) {
      a.pause();
      setPlaying(false);
    } else {
      a.play().catch(() => {});
      setPlaying(true);
    }
  };
  const seek = (e) => {
    const v = parseFloat(e.target.value);
    audioRef.current.currentTime = v;
    setCur(v);
  };
  const changeVol = (e) => {
    const v = parseFloat(e.target.value);
    audioRef.current.volume = v;
    setVol(v);
  };
  const changeSpeed = (s) => {
    audioRef.current.playbackRate = s;
    setSpeed(s);
  };
  const skip = (n) => {
    const a = audioRef.current;
    a.currentTime = Math.max(0, Math.min(dur, a.currentTime + n));
  };
  const pct = dur ? (cur / dur) * 100 : 0;

  return (
    <div style={{ background: "#0a0f1e", border: "1px solid #1e3a5f", borderRadius: 12, padding: "16px 20px", marginBottom: 16 }}>
      <audio ref={audioRef} src={src} preload="metadata" />
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <span style={{ fontSize: 16 }}>🎵</span>
        <span style={{ fontSize: 13, color: "#aab", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {fileName}
        </span>
        {dur > 0 && <span style={{ fontSize: 12, color: "#556", whiteSpace: "nowrap" }}>{fmtTime(dur)}</span>}
      </div>

      <div style={{ position: "relative", height: 6, background: "#1e2a40", borderRadius: 3, marginBottom: 12, cursor: "pointer" }}>
        <div style={{ height: "100%", width: `${pct}%`, background: "#00e5a0", borderRadius: 3, pointerEvents: "none" }} />
        <input
          type="range"
          min={0}
          max={dur || 1}
          step={0.1}
          value={cur}
          onChange={seek}
          aria-label="Posição da reprodução"
          style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer", width: "100%", margin: 0, height: "100%" }}
        />
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button onClick={() => skip(-10)} aria-label="Voltar 10 segundos" style={{ background: "none", border: "none", color: "#aab", cursor: "pointer", fontSize: 20, padding: 0 }}>
            ⏮
          </button>
          <button
            onClick={toggle}
            aria-label={playing ? "Pausar" : "Reproduzir"}
            style={{ width: 42, height: 42, borderRadius: "50%", background: "#00e5a0", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, color: "#0a0e1a", fontWeight: 900, flexShrink: 0 }}
          >
            {playing ? "⏸" : "▶"}
          </button>
          <button onClick={() => skip(10)} aria-label="Avançar 10 segundos" style={{ background: "none", border: "none", color: "#aab", cursor: "pointer", fontSize: 20, padding: 0 }}>
            ⏭
          </button>
          <span style={{ fontSize: 12, color: "#556", minWidth: 80 }}>
            {fmtTime(cur)} / {fmtTime(dur)}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 13, color: "#556" }}>🔊</span>
          <input type="range" min={0} max={1} step={0.05} value={vol} onChange={changeVol} aria-label="Volume" style={{ width: 70, accentColor: "#00e5a0" }} />
          <div style={{ display: "flex", gap: 3 }}>
            {[0.75, 1, 1.25, 1.5, 2].map((s) => (
              <button
                key={s}
                onClick={() => changeSpeed(s)}
                style={{
                  background: speed === s ? "#00e5a0" : "#1e2a40",
                  color: speed === s ? "#0a0e1a" : "#aab",
                  border: "none",
                  borderRadius: 4,
                  padding: "3px 7px",
                  fontSize: 11,
                  cursor: "pointer",
                  fontWeight: speed === s ? 700 : 400,
                }}
              >
                {s}x
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
