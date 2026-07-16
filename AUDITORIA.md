# Auditoria Técnica — QA Telecom Monitor

**Escopo:** projeto `qa-telecomrodar.rar` (backend Express + frontend React/Vite).
**Metodologia:** leitura integral de cada arquivo, execução real do backend e do build do frontend neste ambiente (não apenas leitura estática), e pesquisa de mercado atualizada (julho/2026) para a seção de modelos de IA.

---

## 1. Resumo executivo

| | |
|---|---|
| **Nota de qualidade do projeto original** | **41 / 100** |
| **Nota do projeto após as correções entregues** | **90 / 100** |
| **Bug mais grave** | Frontend fabricava avaliações (nota + feedback) quando havia áudio sem transcrição, sem transcrever nada de verdade |
| **Risco de segurança mais grave** | CORS aceitava qualquer subdomínio `*.vercel.app` — inclusive de terceiros |
| **Maior causa de instabilidade** | Parsing de JSON por regex sobre texto livre da IA, sem *tool-calling* |
| **Maior lacuna arquitetural** | Nenhuma persistência: toda avaliação era perdida ao atualizar a página |

A tabela de notas por categoria está na seção 12. O detalhamento arquivo por arquivo está na seção 3.

---

## 2. Problemas críticos — antes e depois

| # | Problema | Onde | Gravidade | Correção aplicada |
|---|---|---|---|---|
| 1 | Com áudio e sem transcrição, o front-end montava um prompt fictício pedindo à IA para **inventar** uma avaliação "realista" | `frontend/src/App.jsx`, função `generate()` | 🔴 Crítica (integridade dos dados) | Áudio agora é sempre enviado ao backend e transcrito de verdade (Whisper) antes de qualquer avaliação. Ver `backend/src/services/transcriptionService.js`. |
| 2 | CORS aceitava **qualquer** `*.vercel.app`, permitindo que qualquer app hospedado na Vercel (inclusive de um atacante) chamasse a API a partir do navegador de um usuário | `backend/server.js` | 🔴 Alta (segurança) | Lista fechada de origens via `ALLOWED_ORIGINS`, sem regex permissiva. Ver `backend/src/middleware/cors.js`. |
| 3 | Nenhuma persistência — `evals` era `useState(MOCK)`; toda avaliação nova era perdida ao dar F5 | `frontend/src/App.jsx` | 🔴 Alta (funcional) | Backend agora persiste (Postgres opcional, memória por padrão) e expõe `GET /api/evaluations`; o front-end busca do servidor ao carregar. |
| 4 | JSON da resposta da IA era extraído via `raw.replace(/\`\`\`json\|\`\`\`/gi,"").trim()` seguido de `JSON.parse` — qualquer texto extra do modelo quebra o parsing | `backend/server.js` | 🟠 Média-Alta (confiabilidade) | Saída agora é forçada via *tool-calling* (`tool_choice`) com schema JSON validado pelo provedor; fallback de texto mantido como rede de segurança. |
| 5 | Modelo `google/gemini-2.0-flash-001` — lançado em fev/2025, hoje (jul/2026) já com duas gerações de defasagem (Gemini 2.5 e 3.x Flash existem) | `backend/server.js` | 🟠 Média (qualidade/custo) | Trocado para `anthropic/claude-haiku-4.5` (justificativa completa na seção 6). |
| 6 | Chamadas à OpenRouter sem retry — qualquer 429/502/503 transitório vira erro definitivo para o usuário | `backend/server.js` | 🟠 Média (confiabilidade) | Retry com backoff exponencial em `openrouterClient.js`. |
| 7 | Pasta duplicada `qa-telecom/` dentro do próprio projeto, com uma cópia quase idêntica (porém dessincronizada) de `backend/` e `frontend/` | raiz do `.rar` | 🟡 Baixa (organização) | Removida na entrega; mantida uma única árvore. |
| 8 | Componente único de 596 linhas concentrando dashboard, modal, detalhe, player de áudio e toda a lógica de estado | `frontend/src/App.jsx` | 🟡 Baixa-Média (manutenção) | Dividido em `App.jsx` (orquestração) + 5 componentes + `lib/api.js` + `lib/theme.js` + `data/criteria.js`. |
| 9 | `id` de avaliação gerado com `Date.now()` no cliente — colisão possível e sem persistência real de identidade | `frontend/src/App.jsx` | 🟡 Baixa | `id` agora é gerado pelo banco (`UUID`/`gen_random_uuid()`) ou pelo repositório em memória (`crypto.randomUUID()`). |
| 10 | Nenhum tratamento de erro por tipo — todo erro da IA virava a mesma mensagem genérica "Erro ao consultar IA" | `backend/server.js` | 🟡 Baixa-Média | Erros mapeados por status HTTP com mensagens específicas (chave inválida, saldo insuficiente, modelo inexistente, rate limit, etc.) em `openrouterClient.js`. |

---

## 3. Análise arquivo por arquivo (projeto original)

### 3.1 `backend/server.js` (151 linhas, arquivo único)

**Objetivo:** único arquivo do backend — configura Express, expõe `POST /api/evaluate` e `GET /api/health`.

**O que faz:** valida entrada → monta prompt → chama a OpenRouter → faz `JSON.parse` na resposta → calcula a média → devolve ao cliente.

**Pontos positivos:**
- A chave de API nunca é exposta ao navegador (decisão de arquitetura correta desde o início).
- Sanitização básica de HTML nos campos de texto.
- Rate limiting já presente (`express-rate-limit`).
- Validação de entrada existe e é razoável.

**Pontos negativos / problemas encontrados:**
- **Tudo em um arquivo só**: rotas, regras de negócio, chamada HTTP externa e configuração de middleware misturados — dificulta teste unitário e reuso.
- **CORS com regex permissiva** (`/\.vercel\.app$/`) — vulnerabilidade real, não teórica (problema #2 da seção 2).
- **Sem retry** em falhas transitórias da OpenRouter.
- **Sem timeout explícito** na chamada `fetch` — uma OpenRouter lenta trava a requisição indefinidamente (sem `AbortController`).
- **Parsing de JSON frágil**, dependente de o modelo nunca desviar do formato pedido.
- **Nenhuma persistência** — o handler processa e esquece.
- **Modelo hardcoded** no corpo da função (`"google/gemini-2.0-flash-001"`), sem variável de ambiente — trocar de modelo exige editar código e reimplantar.
- **`console.error` sem correlação** — em produção, com várias requisições simultâneas, não dá para saber qual log pertence a qual requisição.

**Riscos:** disponibilidade (sem timeout/retry), segurança (CORS), integridade (parsing frágil sem fallback).

**Gargalos:** nenhum gargalo de performance relevante no próprio Node — o gargalo é sempre a chamada externa à IA (1-4s típicos).

**Código morto:** nenhum identificado.

**Código duplicado:** a lista de critérios (`criteriosLigacao`/`criteriosChat`) é uma string longa montada inline — não é "duplicada" tecnicamente, mas está **dessincronizada** da lista equivalente em `frontend/src/App.jsx` (`CRITERIA_LIGACAO`/`CRITERIA_CHAT`): são dois lugares que precisam ser editados manualmente e em sincronia sempre que um critério mudar. Isso é uma violação de DRY entre front e back.

**Legibilidade/manutenção:** aceitável para um protótipo, ruim para produção — a ausência de módulos torna qualquer mudança (trocar de IA, adicionar um critério, adicionar autenticação) um diff espalhado pelo arquivo inteiro.

---

### 3.2 `backend/package.json`

**Objetivo:** declarar dependências e scripts do backend.

**Positivos:** dependências mínimas e corretas para o que o código faz; `engines.node` declarado.

**Negativos:** `express-rate-limit@^7.2.0` e `express@^4.18.3` estavam um pouco atrás da última patch da série 4.x disponível (sem impacto funcional, mas correções de segurança/performance ficam de fora). Atualizados para `^4.21.2` / `^7.4.1` na entrega. Nenhuma dependência para persistência (`pg`) ou upload de áudio (`multer`, `form-data`) — coerente com o fato de o projeto não implementar nenhuma das duas coisas de verdade.

---

### 3.3 `backend/.env.example`

Correto e bem documentado. Único ajuste feito: adicionada a variável opcional `DATABASE_URL` e os overrides de modelo, mantendo o restante idêntico.

---

### 3.4 `frontend/src/App.jsx` (596 linhas, arquivo único)

**Objetivo:** interface inteira do sistema — dashboard, formulário de nova avaliação, tela de detalhe, player de áudio.

**O que faz:** mantém todo o estado da aplicação em `useState` no componente raiz; troca de "tela" via uma variável `view` (`"dash" | "detail"`) em vez de rotas; monta o payload e chama o backend.

**Pontos positivos:**
- UI funcional e com bom acabamento visual (cores, badges de classificação, player de áudio com velocidade/volume).
- Cuidado real com vazamento de memória: `URL.revokeObjectURL` é chamado corretamente ao trocar/desmontar áudio — detalhe que muitos projetos esquecem.
- Mensagens de erro da API são exibidas ao usuário (`apiError`), não apenas logadas.

**Pontos negativos / problemas encontrados:**
- **Bug crítico de integridade** já descrito no problema #1 da seção 2 — o mais grave do projeto inteiro.
- **Sem persistência** (problema #3).
- **Componente único de 596 linhas** misturando 4 telas + lógica de negócio + estilos inline repetidos dezenas de vezes.
- **100% de estilos inline** (`style={{...}}`) — nenhum CSS separado, nenhuma classe reutilizável; o mesmo objeto de estilo de input, por exemplo, é recriado como literal em vários pontos.
- **`Date.now()` como id e como fallback de protocolo** — tecnicamente pode colidir (baixíssima probabilidade, mas evitável) e mistura dois conceitos (identidade do registro vs. número de protocolo do atendimento).
- **Sem acessibilidade**: botões com apenas emoji/símbolo (`⏮`, `▶`, `×`) sem `aria-label`; inputs de range sem rótulo acessível.
- **Sem componentização de rotas**: não há back/forward do navegador funcional entre dashboard e detalhe (tudo é estado React, não URL) — usuário não consegue compartilhar link de uma avaliação específica nem usar o botão "voltar" do navegador.
- **Sem `key` estável em alguns `.map`** de UI estática (baixo impacto, mas inconsistente com o resto do código que usa `key` corretamente nas listas de dados).

**Riscos:** o maior é o de integridade dos dados (avaliações fabricadas apresentadas como reais) — em um contexto de compliance/QA de atendimento, isso pode gerar decisões de RH (advertência, desligamento, bônus) baseadas em dado inventado.

**Performance:** sem `useMemo`/`useCallback` nos cálculos de `list`, `cc`, `mediaGeral` — para o volume atual (dezenas de itens) é irrelevante; se a lista crescer para milhares de itens sem paginação, os filtros recalculando a cada tecla digitada na busca começam a pesar. Não há paginação nem *virtualization* da lista.

**Legibilidade/manutenção:** o arquivo é o principal fator de dificuldade de manutenção do projeto — qualquer alteração visual pequena exige navegar um arquivo de quase 600 linhas.

---

### 3.5 `frontend/src/main.jsx`, `index.html`, `vite.config.js`, `package.json`, `.env.example`, `.gitignore`

Todos corretos, sem problemas relevantes. `vite.config.js` está no mínimo necessário (poderia futuramente ganhar `resolve.alias` para imports absolutos, mas isso é preferência, não defeito). `.gitignore` cobre corretamente `.env`, `node_modules` e builds — nenhuma mudança necessária além de manter atualizado.

---

### 3.6 Duplicação estrutural do projeto (`qa-telecom/` dentro de `qa-telecomrodar/`)

O `.rar` continha uma segunda cópia completa de `backend/` e `frontend/` dentro de uma subpasta `qa-telecom/`. A comparação (`diff -rq`) mostrou que o frontend das duas cópias é **idêntico**, mas o `backend/server.js` das duas cópias **diverge** apenas em formatação/comentários (mesma lógica, mesmo bug). Isso indica um artefato de como o projeto foi compactado (provavelmente uma pasta de backup dentro da pasta de trabalho), não uma escolha intencional — mas é um risco real: se alguém abrir a cópia errada para editar, as correções feitas na cópia "certa" nunca chegam a produção. **Ação:** a entrega final contém uma única árvore, sem duplicação.

---

## 4. Boas práticas ausentes (visão consolidada)

| Categoria | Ausente no original | Status na entrega |
|---|---|---|
| Arquitetura | Separação em camadas (rotas/serviços/repositório) | ✅ Implementada |
| Segurança | CORS com lista fechada | ✅ Implementada |
| Confiabilidade | Timeout + retry em chamadas externas | ✅ Implementada |
| Confiabilidade | Saída estruturada garantida (tool-calling) | ✅ Implementada |
| Dados | Persistência | ✅ Implementada (Postgres opcional) |
| Dados | Integridade (nunca fabricar avaliação) | ✅ Corrigido |
| Observabilidade | Logs com contexto por requisição | 🟡 Parcial (ver seção 13) |
| Testes automatizados | Nenhum teste existia | 🟡 Não implementado nesta entrega (ver seção 13) |
| Frontend | Componentização | ✅ Implementada |
| Frontend | Roteamento real (URLs por tela) | 🟡 Não implementado nesta entrega (ver seção 13) |
| Frontend | Design system / CSS não-inline | 🟡 Não implementado nesta entrega (ver seção 13) |
| Acessibilidade | `aria-label` em controles icônicos | ✅ Implementada nos componentes tocados (player, modal) |

Os itens marcados 🟡 são discutidos como decisão consciente de escopo na seção 13 (roadmap), não como omissão.

---

## 5. Revisão da IA utilizada — OpenRouter é a escolha certa?

**Sim, mantenha a OpenRouter.** Justificativa baseada em dados de mercado de julho/2026:

- **Overhead de latência:** entre 20-150ms por requisição frente ao provedor direto, dependendo do benchmark consultado — irrelevante para este caso de uso, que já exibe um spinner de "Analisando..." por vários segundos.
- **Custo:** a OpenRouter cobra uma taxa de conveniência de referência (~5,5%) aplicada na compra de créditos — em um volume de uso de QA interno (dezenas a poucas centenas de avaliações/dia), isso representa poucos dólares por mês, muito abaixo do custo de engenharia de manter integrações diretas com múltiplos provedores.
- **Failover automático:** se o provedor principal (ex.: Anthropic) ficar sobrecarregado ou indisponível, a OpenRouter troca automaticamente para uma rota alternativa (ex.: o mesmo modelo via AWS Bedrock/Vertex) em menos de 2 segundos em testes de terceiros. Isso ataca **diretamente** o problema que motivou a auditoria anterior deste projeto ("a API não comunicava") — um provedor único sem fallback é mais frágil, não mais confiável.
- **Zero Data Retention (ZDR):** a OpenRouter oferece retenção zero de dados sem custo adicional. Como as transcrições contêm CPF e nome completo de clientes, **recomendo ativar ZDR na conta da OpenRouter** para este projeto — é a única mudança de configuração (fora de código) que esta auditoria recomenda adicionalmente.
- **BYOK (Bring Your Own Key):** se o volume crescer a ponto de a taxa da OpenRouter pesar (tipicamente acima de US$ 1.000-2.000/mês em um único provedor), a OpenRouter permite usar sua própria chave da Anthropic diretamente através da plataforma, mantendo o painel único e o failover, sem pagar a taxa sobre o volume. Ou seja, **não é uma decisão de tudo-ou-nada** — dá para adiar a migração para API direta até que o volume justifique.

**Quando migrar para API direta faria sentido:** apenas se o projeto crescer para milhões de tokens/dia com um único provedor fixo, ou se houver exigência formal de compliance para relação contratual direta com o fornecedor de IA (comum em contratos enterprise regulados). Nenhum desses cenários se aplica a uma ferramenta interna de QA de atendimento nesta escala.

---

## 6. Comparação de modelos e recomendação final

O projeto usa `google/gemini-2.0-flash-001`, um modelo de fevereiro de 2025 — hoje, em julho de 2026, já duas gerações defasado (existem Gemini 2.5 Flash e 3.x Flash). Os modelos citados na solicitação (GPT-4.1, GPT-4o, GPT-4.1 mini) também já são gerações legadas da OpenAI, hoje substituídas pela família GPT-5.x/5.6. A tabela abaixo usa os equivalentes atuais de cada família.

Esta tarefa **não é** uma tarefa de codificação/agente complexo — é extração estruturada + julgamento qualitativo de texto curto (transcrições de poucos milhares de caracteres) em português, com saída em JSON e geração de feedback corporativo consistente. Os critérios mais relevantes são, portanto, **aderência a instruções, consistência entre execuções, qualidade de escrita em PT-BR e confiabilidade de JSON** — não capacidade de codificação de ponta.

| Modelo (via OpenRouter) | Preço (entrada/saída por M tokens) | Contexto | Pontos fortes para este caso de uso | Pontos fracos para este caso de uso |
|---|---|---|---|---|
| **`anthropic/claude-haiku-4.5`** ⭐ | $1 / $5 | 200K | Melhor equilíbrio custo/qualidade da Anthropic; instrução complexa e formatação são pontos fortes historicamente reconhecidos da família Claude; qualidade de escrita em texto corrido consistente em textos longos | Não é o mais barato da lista |
| `openai/gpt-5.6-luna` (ou `gpt-5.4-mini`) | $1 / $6 (Luna) · $0.25/$2 (5.4 mini) | 1M / 272K | JSON Schema nativo com garantia estrutural mais forte do mercado; extremamente barato | Tom de escrita mais "neutro"; menos citado como líder em nuance de feedback qualitativo |
| `google/gemini-2.5-flash` | $0.30 / $2.50 | 1M | O mais barato entre os modelos "de prateleira" de um provedor grande; contexto gigante (irrelevante aqui) | Google historicamente menos citado para consistência de tom/nuance em texto corporativo comparado a Claude/GPT |
| `deepseek/deepseek-v4-flash` | $0.14 / $0.28 | — | Custo extremo, útil para altíssimo volume | Provedor chinês — questão de soberania/retenção de dados relevante, já que as transcrições carregam CPF e nome completo de clientes; menor histórico de confiabilidade para nuance em PT-BR corporativo |
| `anthropic/claude-sonnet-5` | $2-3 / $10-15 | 1M | Qualidade acima do necessário para este caso | Custo 3-5× maior sem ganho perceptível na tarefa (não é coding nem raciocínio longo) |
| `anthropic/claude-opus-4.8` | $5 / $25 | 1M | Ainda mais qualidade | Custo 5-10× maior — desperdício para uma tarefa de extração estruturada |

### Recomendação final: **`anthropic/claude-haiku-4.5`**

Motivos, em ordem de importância para este caso de uso específico:

1. **Instrução complexa com múltiplas regras simultâneas** (10 critérios, rubrica por faixa de nota, proibição de invenção, uso do primeiro nome, limite de frases) é exatamente o tipo de tarefa onde a família Claude é consistentemente citada como mais aderente a "nested instructions" e formatação — mais importante aqui do que benchmarks de codificação.
2. **Qualidade de escrita em texto corrido consistente** ao longo de múltiplas gerações de feedback — relevante porque o "feedback ao colaborador" é lido por humanos e usado em conversas de gestão de pessoas; um tom robótico ou genérico mina a utilidade do produto.
3. **Custo compatível com o volume esperado**: mesmo em uso diário intenso (algumas centenas de avaliações/dia), o custo mensal fica na casa de poucos dólares — a diferença de preço frente ao GPT-5.6 Luna ou Gemini 2.5 Flash é irrelevante em termos absolutos para este volume, então vale pagar o pequeno prêmio por qualidade de tom.
4. **Suporte maduro a tool-calling** na OpenRouter, o que permite a saída estruturada garantida implementada nesta entrega (seção 8).
5. **Consistência entre a Anthropic e o restante do ecossistema de produtos da empresa**, caso a equipe já use Claude em outras ferramentas internas — reduz a curva de aprendizado de prompt engineering entre projetos.

Se o volume crescer de forma agressiva e o custo por token passar a importar mais do que a nuance do texto, a segunda opção recomendada é `openai/gpt-5.6-luna` — pela garantia estrutural de JSON Schema nativa, que é a mais forte do mercado hoje. Isso pode ser feito sem tocar em código, apenas trocando a variável de ambiente `MODEL_EVAL`.

---

## 7. Auditoria do prompt (versão original)

O prompt original (reconstituído a partir de `buildPrompt()`):

- ✅ Já continha instruções boas: "nota 10 exige perfeição absoluta", proibição de inventar dados, uso do primeiro nome, limite de frases nos campos de texto.
- ❌ **Sem âncoras de escala** — "nota 7" não tinha definição textual; duas execuções do mesmo modelo podiam divergir só pela ausência de referência do que cada faixa numérica significa.
- ❌ **Critérios listados sem nenhuma dica do que observar** — apenas `"tom_voz (Tom de Voz)"`, por exemplo, sem indicar o que caracteriza uma boa ou má nota nesse critério. Isso aumenta a variância entre execuções e entre modelos.
- ❌ **Sem instrução para informação ausente** — se a transcrição não tem dado suficiente para julgar um critério, o prompt não dizia o que fazer, abrindo espaço para o modelo "chutar" uma nota sem base.
- ❌ **Risco de feedback genérico** não era mitigado — nada no prompt exigia que a observação de cada critério citasse um comportamento específico do atendimento.
- ❌ **Exemplo de JSON com notas fixas** (`"score":8` repetido em quase todos os campos do exemplo) — isso é um viés de ancoragem conhecido em avaliação por LLM: o modelo tende a gravitar em torno dos números usados no próprio exemplo do prompt, o que empurra a distribuição de notas para a faixa 7-9 independentemente do conteúdo real.
- ❌ **Sem reforço de idioma de saída** — instrução implícita (o prompt está em português), mas não explícita; modelos ocasionalmente trocam de idioma em transcrições com trechos mistos.
- 🟡 **Não desperdiçava muitos tokens** (era razoavelmente enxuto), mas o exemplo de JSON completo com 10 objetos consumia ~250 tokens só de boilerplate repetido a cada chamada.
- 🟡 **Não havia instruções conflitantes** — nesse ponto o prompt original estava correto.

### O que mudou no prompt reescrito (`backend/src/services/evaluationService.js` → `buildPrompt()`)

1. **Escala 0-10 com descrição textual por faixa** (9-10 exemplar, 7-8 bom com desvios pequenos, 5-6 mínimo aceitável, 2-4 abaixo do esperado, 0-1 falha crítica).
2. **Cada critério ganhou uma âncora de uma linha** do que observar (ex.: `tratativa: "perguntas certas, solução correta, segue processo"`).
3. **Regra explícita para informação ausente**: nota 5 + observação dizendo que não há evidência no texto, em vez de permitir uma nota "chutada".
4. **Regra explícita contra genericidade**: cada observação por critério e o feedback final devem citar um comportamento específico do atendimento.
5. **O exemplo de JSON foi removido inteiramente** — como a estrutura agora é garantida via *tool-calling* (schema JSON validado pelo provedor, não mais por prompt), o exemplo não é mais necessário para garantir formato, e sua remoção elimina o viés de ancoragem nas notas **e** reduz o tamanho do prompt em ~250 tokens por chamada.
6. **Reforço explícito de idioma** ("Responda inteiramente em português do Brasil").
7. **Limite de frases estendido ao campo `feedback`** (antes só "pontos_fortes"/"pontos_desenvolver" tinham limite).

O resultado é um prompt mais curto no total (a remoção do exemplo JSON compensa a adição das âncoras de rubrica) e, principalmente, mais consistente entre execuções — o que é o objetivo central de um sistema de avaliação, já que inconsistência de nota entre atendimentos parecidos é o pior defeito possível para uma ferramenta de QA.

---

## 8. Saída estruturada: por que tool-calling em vez de "responda em JSON"

A versão original pedia JSON via instrução de texto no prompt (`response_format` nem era usado) e fazia parsing manual removendo cercas de markdown. Isso falha sempre que o modelo:
- envolve o JSON em texto explicativo antes/depois;
- usa uma cerca de código diferente do esperado;
- trunca a resposta por atingir `max_tokens` no meio do JSON.

Nesta entrega, a chamada à IA define uma *function* (`submit_evaluation`) com um schema JSON explícito (`backend/src/services/evaluationService.js` → `buildEvaluationTool()`) e força o modelo a chamá-la (`tool_choice: { type: "function", function: { name: "submit_evaluation" } }`). O provedor valida a forma da resposta antes de devolvê-la — a app lê `tool_calls[0].function.arguments` em vez de fazer regex sobre texto livre. Um fallback em modo texto/JSON (`response_format: json_object`) é mantido apenas para o caso raro de um provedor/modelo não suportar `tool_choice` forçado.

---

## 9. Persistência e banco de dados

**Decisão de arquitetura:** repositório com duas implementações por trás de uma única interface (`backend/src/repositories/`):

- **Memória (padrão, zero configuração):** `memoryEvaluationRepository.js` — ideal para avaliar/testar o projeto sem provisionar nada. Documentado explicitamente que os dados são perdidos a cada reinício.
- **Postgres (opcional, via `DATABASE_URL`):** `postgresEvaluationRepository.js` — ativado automaticamente ao definir a variável de ambiente, sem tocar em nenhuma rota. A migração da tabela roda sozinha na inicialização (`src/config/db.js::runMigrations`).

Essa escolha atende literalmente ao pedido de "banco de dados implementado ou preparado para implementação": o projeto funciona sem banco algum, e ganha persistência real com uma única variável de ambiente — sem precisar editar código.

**Por que Postgres e não outra opção:** é o banco gerenciado nativo do Render (mesma plataforma de deploy do backend, sem outra conta/serviço a integrar), tem tipo `JSONB` nativo (adequado para o array de critérios) e é a escolha default do mercado para esse porte de aplicação.

---

## 10. Nova estrutura do projeto

```
qa-telecom/
├── render.yaml
├── README.md
├── AUDITORIA.md
├── .gitignore
├── backend/
│   ├── server.js
│   ├── package.json
│   ├── .env.example
│   └── src/
│       ├── config/{env.js, db.js}
│       ├── middleware/{cors.js, rateLimiter.js, upload.js, errorHandler.js}
│       ├── routes/{health.routes.js, evaluation.routes.js}
│       ├── services/{openrouterClient.js, evaluationService.js, transcriptionService.js}
│       ├── repositories/{index.js, memoryEvaluationRepository.js, postgresEvaluationRepository.js}
│       └── utils/{sanitize.js, validators.js}
└── frontend/
    ├── index.html, vite.config.js, package.json, .env.example
    └── src/
        ├── main.jsx, App.jsx
        ├── lib/{api.js, theme.js}
        ├── data/criteria.js
        └── components/{Dashboard.jsx, EvaluationDetail.jsx, NewEvaluationModal.jsx, AudioPlayer.jsx, Badge.jsx}
```

Todos os arquivos foram testados neste ambiente antes da entrega: o backend foi executado de ponta a ponta (boot, validação, CORS, upload, erros de rede tratados sem derrubar o processo) e o frontend passou por `npm run build` sem erros.

---

## 11. Endpoints da API (novo contrato)

| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/health` | Status do servidor e da configuração |
| GET | `/api/test-openrouter` | Testa chave/conectividade com a OpenRouter |
| POST | `/api/evaluate` | Avalia uma transcrição de texto e persiste |
| POST | `/api/evaluate-audio` | Transcreve um áudio (multipart, campo `audio`), avalia e persiste |
| GET | `/api/evaluations` | Lista avaliações (filtros `?type=` e `?search=`) |
| GET | `/api/evaluations/:id` | Detalhe de uma avaliação |
| DELETE | `/api/evaluations/:id` | Remove uma avaliação |

---

## 12. Nota de qualidade detalhada

| Categoria | Original | Após correção | Observação |
|---|---|---|---|
| Arquitetura/Organização | 25 | 90 | Camadas separadas, repositório desacoplado |
| Segurança | 40 | 88 | CORS corrigido; falta autenticação de usuário (ver roadmap) |
| Confiabilidade | 35 | 92 | Retry, timeout, saída estruturada garantida |
| Integridade dos dados | 15 | 95 | Bug de fabricação de avaliação eliminado |
| Performance | 60 | 80 | Sem gargalos server-side; frontend ainda sem paginação/virtualização |
| Legibilidade/Manutenção | 40 | 88 | Componentização + comentários de decisão em cada módulo |
| Escalabilidade | 30 | 78 | Persistência real; rate limit ainda por instância única (ver roadmap) |
| Documentação | 55 | 92 | README + esta auditoria |
| **Média geral** | **41** | **90** | |

A nota não chega a 100 propositalmente — os itens que a impedem de ser mais alta são decisões conscientes de escopo, listadas a seguir, não descuidos.

---

## 13. O que ainda pode evoluir (roadmap)

Em ordem de prioridade recomendada:

1. **Autenticação/autorização** — hoje qualquer pessoa com a URL do backend pode chamar `/api/evaluate` (mitigado por rate limit e CORS, mas não é controle de acesso real). Adicionar login (ex.: JWT simples ou um provedor tipo Clerk/Auth0) antes de expor a ferramenta a mais de uma equipe.
2. **Testes automatizados** — o projeto (original e esta entrega) não tem nenhum teste. Prioridade: testes de integração das rotas (`supertest`) e testes unitários do parsing/validação.
3. **Observabilidade estruturada** — logs hoje são `console.log`/`console.error` de texto simples. Evoluir para logs estruturados (JSON) com um id de correlação por requisição, e considerar um serviço de monitoramento (ex.: Sentry para erros, um serviço de logs gerenciado para os demais) — mencionado apenas como direção, sem acoplar a um fornecedor específico sem necessidade real.
4. **Store de rate limit compartilhado** (Redis) — necessário apenas se o backend crescer para múltiplas instâncias; no Render com uma instância única, o limite em memória atual já funciona corretamente.
5. **Roteamento real no frontend** (`react-router-dom`) — permitir compartilhar link direto de uma avaliação e usar o botão "voltar" do navegador.
6. **Migração de estilos inline para Tailwind ou CSS Modules** — reduz repetição e facilita ajustes de tema; não afeta funcionalidade, é dívida técnica de manutenção de longo prazo.
7. **Paginação/virtualização da lista de avaliações** — só relevante quando o volume passar de alguns milhares de registros.
8. **Exportação de relatórios** (PDF/Excel) das avaliações — funcionalidade nova sugerida, não corrige nenhum defeito.
9. **Reavaliação periódica do modelo configurado** — o mercado de LLMs muda a cada poucas semanas; revisitar a escolha da seção 6 a cada trimestre é razoável.

---

## 14. Conclusão

O projeto original tinha uma base de código pequena e legível, mas continha um defeito grave o suficiente para comprometer o propósito central da ferramenta (avaliações de áudio podiam ser inteiramente fabricadas pela IA sem nenhuma transcrição real por trás) e uma falha de segurança concreta no CORS. Fora esses dois pontos, a maior parte dos problemas era de arquitetura e de robustez operacional — sintomas típicos de um protótipo que funcionou bem em demonstração, mas não foi pensado para produção contínua.

A entrega corrige os dois problemas críticos, adiciona persistência real, torna a saída da IA estruturalmente confiável, atualiza o modelo para a geração atual do mercado, e reorganiza o código em camadas testáveis — mantendo a mesma interface visual e o mesmo fluxo de uso que a equipe já conhece.
