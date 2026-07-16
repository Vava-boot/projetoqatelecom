# 📊 QA Telecom Monitor

Sistema de monitoria e avaliação de qualidade de atendimentos (Ligação e Chat) com análise automatizada por IA.

> 📋 Para a auditoria completa do projeto (problemas encontrados, decisões de arquitetura, comparação de modelos de IA, prompt reescrito, nota de qualidade e roadmap), veja **[AUDITORIA.md](./AUDITORIA.md)**.

---

## ✨ Funcionalidades

- Avaliação automática de atendimentos via IA (padrão: `anthropic/claude-haiku-4.5` via OpenRouter)
- Suporte a **Ligações** e **Chats** com critérios específicos para cada tipo
- Upload de **áudio** com transcrição real no servidor (Whisper) — nunca fabrica avaliação sem conteúdo real
- Upload de **transcrição** em arquivo (`.txt`, `.csv`, `.md`) ou colagem direta
- **Persistência real** das avaliações (Postgres opcional; memória por padrão)
- Painel de dashboard com estatísticas, filtros e busca
- Detalhamento por critério com notas, observações e feedback personalizado
- API Key protegida no back-end — nunca exposta no navegador
- Saída da IA estruturada via *tool-calling* (schema JSON garantido pelo provedor, não por parsing de texto)

---

## 🗂️ Estrutura do Projeto

```
qa-telecom/
├── render.yaml              ← Blueprint de deploy do back-end no Render
├── AUDITORIA.md             ← Auditoria completa do projeto
├── backend/
│   ├── server.js            ← Monta o app Express
│   ├── package.json
│   ├── .env.example
│   └── src/
│       ├── config/          ← env.js (variáveis), db.js (pool Postgres opcional)
│       ├── middleware/      ← cors, rate limit, upload, tratamento de erro
│       ├── routes/          ← health.routes.js, evaluation.routes.js
│       ├── services/        ← openrouterClient, evaluationService, transcriptionService
│       ├── repositories/    ← persistência (memória ou Postgres, automático)
│       └── utils/           ← sanitize, validators
│
├── frontend/
│   ├── src/
│   │   ├── main.jsx
│   │   ├── App.jsx          ← orquestra as telas, busca dados do back-end
│   │   ├── lib/              ← api.js (chamadas HTTP), theme.js (estilos)
│   │   ├── data/criteria.js ← rótulos dos critérios por tipo
│   │   └── components/      ← Dashboard, EvaluationDetail, NewEvaluationModal, AudioPlayer, Badge
│   ├── index.html
│   ├── vite.config.js
│   ├── package.json
│   └── .env.example
│
└── .gitignore
```

---

## 🚀 Como Rodar (Desenvolvimento)

### Pré-requisitos

- [Node.js](https://nodejs.org/) v18 ou superior
- Chave de API da [OpenRouter](https://openrouter.ai/keys)

### 1. Back-end

```bash
cd backend
npm install
cp .env.example .env
# edite .env e insira sua OPENROUTER_API_KEY
npm run dev
```

Teste: `curl http://localhost:3001/api/health`

Sem `DATABASE_URL` configurada, o backend usa um repositório **em memória**
(ótimo para testar — os dados somem a cada reinício). Para persistência real
já em desenvolvimento, suba um Postgres local ou use um free tier (Render,
Neon, Supabase) e defina `DATABASE_URL` no `.env`.

### 2. Front-end

Em outro terminal:

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

Interface em `http://localhost:5173`.

---

## 🌐 Deploy em Produção

### Back-end → Render

**Opção A — Blueprint (recomendado):** no painel do Render, "New" →
"Blueprint", aponte para este repositório. O `render.yaml` na raiz já
provisiona o serviço web (`backend/`) e um banco Postgres gerenciado
conectados automaticamente via `DATABASE_URL`.

**Opção B — manual:** crie um "Web Service" apontando para a pasta
`backend/`, build command `npm install`, start command `npm start`, health
check path `/api/health`. Configure as variáveis de ambiente:

| Variável | Valor |
|---|---|
| `OPENROUTER_API_KEY` | sua chave da OpenRouter |
| `ALLOWED_ORIGINS` | URL exata do front-end na Vercel (sem barra no final) |
| `DATABASE_URL` | connection string do Postgres (se estiver usando um) |

> O Render define `PORT` automaticamente — o código já respeita `process.env.PORT`.
> O plano gratuito hiberna após 15 min de inatividade (cold start de 30-60s
> na próxima requisição); para uso em produção real, considere um plano pago.

### Front-end → Vercel

1. Importe o repositório na Vercel com **Root Directory = `frontend`**.
2. Configure a variável de ambiente `VITE_API_URL` com a URL do back-end no Render.
3. Build command `npm run build`, output directory `dist` (detectado automaticamente pelo preset Vite).
4. Depois do primeiro deploy, volte no Render e atualize `ALLOWED_ORIGINS` com a URL final da Vercel — sem isso, o CORS bloqueia o front-end.

---

## 🤖 Modelo de IA

| Configuração | Valor |
|---|---|
| Provedor | [OpenRouter](https://openrouter.ai) (ver justificativa na AUDITORIA.md) |
| Modelo de avaliação | `anthropic/claude-haiku-4.5` |
| Modelo de transcrição | `openai/whisper-1` |
| Temperatura | `0.2` |
| Saída estruturada | tool-calling forçado (`tool_choice`), com fallback em JSON de texto |

Para trocar o modelo sem editar código, defina `MODEL_EVAL` no `.env` do back-end.

---

## 🔐 Segurança

| Proteção | Onde | Como |
|---|---|---|
| API Key protegida | Back-end | Variável de ambiente, nunca vai ao navegador |
| CORS restrito | Back-end | Lista fechada de origens (`ALLOWED_ORIGINS`) — sem regex permissiva |
| Rate limiting | Back-end | 30 req / 15 min por IP nas rotas `/api/*` |
| Sanitização de input | Back-end | Remove HTML, limita tamanho |
| Validação de campos | Back-end + Front-end | Campos obrigatórios e tipos verificados |
| Retry com backoff | Back-end | Erros transitórios da IA (429/502/503) não derrubam a requisição |
| Sem fabricação de dados | Back-end | Áudio é sempre transcrito de verdade antes de avaliar |

---

## 📋 Critérios de Avaliação

### Ligação (10 critérios)
Saudação · Tom de Voz · Tempo de Espera · Tempo de Atendimento · Utilização do Mudo · Personalização · Tratativa/Sondagem/Resolução · Gramática · Dados Obrigatórios · Protocolo e Encerramento

### Chat (10 critérios)
Saudação · Empatia · Tempo de Espera · Tempo de Atendimento · Tempo de Resposta · Gramática · Sondagem · Confirmação de Dados · Personalização · Protocolo e Encerramento

### Escala de Notas
| Nota | Classificação |
|---|---|
| 9.0 – 10.0 | ✅ Excelente |
| 7.5 – 8.9 | 🟢 Muito Bom |
| 6.0 – 7.4 | 🟡 Regular |
| 4.0 – 5.9 | 🟠 Insatisfatório |
| 0.0 – 3.9 | 🔴 Crítico |

---

## 🛠️ Stack Tecnológica

**Back-end:** Node.js · Express · express-rate-limit · dotenv · cors · multer · form-data · pg (opcional)

**Front-end:** React 18 · Vite · JavaScript puro (sem bibliotecas de UI externas)

**IA:** OpenRouter → Claude Haiku 4.5 (avaliação) + Whisper (transcrição)

**Persistência:** Postgres (opcional, recomendado em produção) ou memória (padrão, para testes)

---

## 📄 Licença

MIT — fique à vontade para usar, modificar e distribuir.
