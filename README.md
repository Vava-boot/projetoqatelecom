# QA Telecom Monitor — Sirius Assessoria e Consultoria

## URLs de Produção
- **Frontend (Vercel):** https://projetoqatelecom.vercel.app
- **Backend (Railway):** https://projetoqatelecom-production.up.railway.app

---

## Onde inserir a chave da API

No Railway → serviço `back-end` → aba **Variables** → adicionar:

```
OPENROUTER_API_KEY = sk-or-v1-SUA_CHAVE_AQUI
```

Obtenha a chave em: https://openrouter.ai/keys

---

## Estrutura

```
projeto/
├── backend/
│   ├── server.js          ← API Node.js
│   ├── package.json
│   ├── .env               ← coloque sua chave aqui para rodar local
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── App.jsx        ← interface completa
│   │   └── main.jsx
│   ├── index.html
│   ├── vite.config.js
│   ├── package.json
│   ├── .env               ← URL do Railway já configurada
│   └── .env.example
├── .gitignore
└── README.md
```

---

## Rodar local

### Backend
```bash
cd backend
npm install
# edite o .env e coloque sua chave
npm run dev
```

### Frontend
```bash
cd frontend
npm install
npm run dev
# acesse http://localhost:5173
```

---

## Deploy

### Railway (backend)
1. Conecte o repositório
2. Root Directory: `backend`
3. Variables: `OPENROUTER_API_KEY` = sua chave
4. `ALLOWED_ORIGINS` = `https://projetoqatelecom.vercel.app`

### Vercel (frontend)
1. Conecte o repositório
2. Root Directory: `frontend`
3. Variables: `VITE_API_URL` = `https://projetoqatelecom-production.up.railway.app`
4. Build: `npm run build` | Output: `dist`

---

## Como usar o upload de arquivo

Na tela "Nova Avaliação com IA":
1. Selecione o arquivo `.txt` com a transcrição do atendimento
2. Preencha Colaborador, Empresa e Tipo
3. Clique em **Gerar Avaliação com IA**

O sistema lê o arquivo automaticamente e manda para a IA — sem precisar copiar e colar o texto.

---

## Modelos de IA (fallback automático)

| Ordem | Modelo | Custo |
|---|---|---|
| 1º | `google/gemini-2.0-flash-exp:free` | Gratuito |
| 2º | `meta-llama/llama-3.3-70b-instruct:free` | Gratuito |
| 3º | `mistralai/mistral-7b-instruct:free` | Gratuito |

---

## Testar se o backend está funcionando

Acesse no browser:
```
https://projetoqatelecom-production.up.railway.app/api/health
```
Deve retornar: `{"status":"ok","key_configured":true,...}`
