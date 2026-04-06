<<<<<<< HEAD
# projetoqatelecom.
=======
# 📊 QA Telecom Monitor — Sirius Assessoria e Consultoria

Sistema de monitoria e avaliação de qualidade de atendimentos (Ligação e Chat) com análise automatizada por IA.

---

## 🗂️ Estrutura do Projeto

```
qa-telecom/
├── backend/
│   ├── server.js          ← API Node.js + Express
│   ├── package.json
│   ├── .env               ← CRIAR MANUALMENTE (não commitar!)
│   └── .env.example       ← Template do .env
│
├── frontend/
│   ├── src/
│   │   ├── main.jsx       ← Entry point React
│   │   └── App.jsx        ← Interface completa
│   ├── index.html
│   ├── vite.config.js
│   ├── package.json
│   ├── .env               ← CRIAR MANUALMENTE (não commitar!)
│   └── .env.example       ← Template do .env
│
├── .gitignore
└── README.md
```

---

## 🚀 Como Rodar (Desenvolvimento)

### Pré-requisitos
- [Node.js](https://nodejs.org/) v18 ou superior
- Conta na [OpenRouter](https://openrouter.ai) com chave de API

### 1. Clonar o repositório

```bash
git clone https://github.com/seu-usuario/qa-telecom.git
cd qa-telecom
```

### 2. Configurar o Back-end

```bash
cd backend
npm install
cp .env.example .env
```

Edite o `.env` e insira sua chave:

```env
OPENROUTER_API_KEY=sk-or-v1-SUA_CHAVE_AQUI
PORT=3001
ALLOWED_ORIGINS=http://localhost:5173
```

Inicie o servidor:

```bash
npm run dev    # com hot-reload
# ou
npm start      # sem hot-reload
```

Teste: `http://localhost:3001/api/health`

### 3. Configurar o Front-end

Em outro terminal:

```bash
cd frontend
npm install
cp .env.example .env
```

O `.env` já vem configurado para desenvolvimento. Inicie:

```bash
npm run dev
```

Acesse: `http://localhost:5173`

---

## 🌐 Deploy em Produção

### Back-end → Railway

1. Conecte o repositório no Railway
2. Configure **Root Directory**: `backend`
3. Adicione as variáveis de ambiente no painel:
   - `OPENROUTER_API_KEY` — sua chave (começa com `sk-or-v1-`)
   - `ALLOWED_ORIGINS` — URL do seu front-end Vercel
4. O Railway detecta o `package.json` e roda `npm start` automaticamente

### Front-end → Vercel

1. Conecte o repositório na Vercel
2. Configure **Root Directory**: `frontend`
3. Adicione a variável de ambiente:
   - `VITE_API_URL` — URL do seu back-end Railway (sem barra no final)
4. O comando de build é `npm run build`, diretório de saída `dist`

---

## 🤖 Modelos de IA

O sistema usa o OpenRouter com fallback automático entre modelos:

| Prioridade | Modelo | Custo |
|---|---|---|
| 1º | `google/gemini-2.0-flash-exp:free` | Gratuito |
| 2º | `meta-llama/llama-3.3-70b-instruct:free` | Gratuito |
| 3º | `mistralai/mistral-7b-instruct:free` | Gratuito |

Se quiser usar o Gemini 2.0 Flash pago (melhor qualidade), adicione créditos na conta OpenRouter e troque para `google/gemini-2.0-flash-001`.

---

## 🔐 Segurança

| Proteção | Onde | Como |
|---|---|---|
| API Key protegida | Back-end | Variável de ambiente, nunca vai ao browser |
| CORS | Back-end | `trust proxy` + origem liberada corretamente |
| Rate limiting | Back-end | 30 req / 15 min por IP |
| Sanitização | Back-end | Remove HTML, limita tamanho |
| `.gitignore` | Raiz | Protege `.env` e `node_modules` |

---

## ✅ Rotas da API

| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/health` | Status do servidor e chave |
| GET | `/api/test-openrouter` | Valida conexão com OpenRouter |
| POST | `/api/evaluate` | Gera avaliação com IA |

---

## 📋 Critérios de Avaliação

**Ligação:** Saudação · Tom de Voz · Tempo de Espera · Tempo de Atendimento · Utilização do Mudo · Personalização · Tratativa/Sondagem/Resolução · Gramática · Dados Obrigatórios · Protocolo e Encerramento

**Chat:** Saudação · Empatia · Tempo de Espera · Tempo de Atendimento · Tempo de Resposta · Gramática · Sondagem · Confirmação de Dados · Personalização · Protocolo e Encerramento

---

## 🛠️ Stack

**Back-end:** Node.js · Express · express-rate-limit · dotenv · cors

**Front-end:** React 18 · Vite · DM Sans (Google Fonts)

**IA:** OpenRouter → Gemini 2.0 Flash (com fallback Llama + Mistral)

**Deploy:** Railway (back-end) · Vercel (front-end)
>>>>>>> 133ce1c (adicionando o projeto)
