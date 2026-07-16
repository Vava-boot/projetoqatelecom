/**
 * src/App.jsx
 * ───────────────────────────────────────────────────────────────────────────
 * Componente raiz. Responsabilidades:
 *  - Buscar as avaliações do BACK-END ao carregar (antes, ficavam só em
 *    estado local React inicializado com dados fictícios (MOCK) e eram
 *    perdidas a cada F5 — agora persistem de verdade via /api/evaluations).
 *  - Alternar entre as telas (dashboard / detalhe / modal de nova avaliação).
 *
 * Toda a lógica de layout de cada tela vive em src/components/; toda
 * chamada de rede vive em src/lib/api.js.
 */
import { useState, useEffect, useCallback } from "react";
import Dashboard from "./components/Dashboard";
import EvaluationDetail from "./components/EvaluationDetail";
import NewEvaluationModal from "./components/NewEvaluationModal";
import { fetchEvaluations, ApiError } from "./lib/api";

export default function App() {
  const [evaluations, setEvaluations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [view, setView] = useState("dash"); // "dash" | "detail"
  const [selected, setSelected] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);

  const [fType, setFType] = useState("Todos");
  const [fClass, setFClass] = useState("Todas");
  const [search, setSearch] = useState("");

  const loadEvaluations = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const rows = await fetchEvaluations();
      setEvaluations(rows);
    } catch (err) {
      setLoadError(
        err instanceof ApiError
          ? `Não foi possível carregar as avaliações: ${err.message}`
          : "Não foi possível conectar ao servidor. Verifique se o back-end está no ar."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadEvaluations();
  }, [loadEvaluations]);

  const handleCreated = (novaAvaliacao) => {
    setEvaluations((prev) => [novaAvaliacao, ...prev]);
    setSelected(novaAvaliacao);
    setModalOpen(false);
    setView("detail");
  };

  const handleSelect = (ev) => {
    setSelected(ev);
    setView("detail");
  };

  if (view === "detail" && selected) {
    return <EvaluationDetail evaluation={selected} onBack={() => setView("dash")} />;
  }

  return (
    <>
      <Dashboard
        evaluations={evaluations}
        loading={loading}
        error={loadError}
        fType={fType}
        setFType={setFType}
        fClass={fClass}
        setFClass={setFClass}
        search={search}
        setSearch={setSearch}
        onSelect={handleSelect}
        onNew={() => setModalOpen(true)}
      />
      {modalOpen && <NewEvaluationModal onClose={() => setModalOpen(false)} onCreated={handleCreated} />}
    </>
  );
}
