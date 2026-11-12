# Deploy no Vercel - HACKER_AI NEXUS

## 1. Conectar o repositório

1. Acesse [vercel.com](https://vercel.com) e faça login.
2. Clique em **"Add New Project"**.
3. Importe o repositório do GitHub (ou faça upload do ZIP da pasta `099`).
4. Selecione o framework **Next.js** (detectado automaticamente).
5. Clique em **Deploy**.

## 2. Banco de dados (PostgreSQL / Neon)

O projeto usa a integracao **Neon** do Vercel Marketplace. O banco e criado e
conectado ao projeto pela CLI:

```bash
vercel integration accept-terms neon --yes
vercel install neon --name hackerai-db
```

Isso cria as variaveis `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `PGHOST`,
`PGUSER`, `PGPASSWORD` e `PGDATABASE` em Production, Preview e Development.

| Variavel | Origem | Observacao |
|----------|--------|------------|
| `DATABASE_URL` | integracao Neon | obrigatoria em producao |
| `DATABASE_PATH` | opcional | caminho do SQLite local (fallback) |

Sem `DATABASE_URL` o app roda com SQLite local em `./data/hackerai.db`.
Com `DATABASE_URL` o app roda com Postgres: usuarios, planos, conversas,
uso e configuracoes **persistem entre deploys e cold starts**.

### Migrar um banco SQLite existente para o Postgres

```bash
node --env-file=.env.local scripts/migrate-sqlite-to-postgres.mjs
```

O script cria o schema, copia `users`, `plans`, `chats`, `messages`,
`usage_logs`, `audit_logs`, `plan_history`, `sessions` e `settings`, e nao
apaga nada do destino.

## 3. Configurar Variáveis de Ambiente

No painel do Vercel, va em **Settings > Environment Variables** e adicione:

| Variavel | Valor | Obrigatorio |
|----------|-------|-------------|
| `APP_SECRET` | `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` | Sim |
| `DATABASE_URL` | gerado pela integracao Neon | Sim |
| `NVIDIA_API_KEY` | `<SUA_CHAVE_NVIDIA>` | Sim |
| `OPENROUTER_API_KEY` | `<SUA_CHAVE_OPENROUTER>` | Sim |
| `GROQ_API_KEY` | `<SUA_CHAVE_GROQ>` | Para o plano PRO |
| `SAMBANOVA_API_KEY` | `<SUA_CHAVE_SAMBANOVA>` | Para o plano OMEGA |
| `OPENCODE_API_KEY` | `<SUA_CHAVE_OPENCODE>` | Para o plano FREE |
| `VERCEL_AI_GATEWAY_API_KEY` | `<CHAVE_VCK_DO_AI_GATEWAY>` | Para o plano OMEGA |
| `ADMIN_EMAILS` | `admin@exemplo.com,seu-email@gmail.com` | Nao |
| `NODE_OPTIONS` | `--max-old-space-size=4096` | Nao |

A `ADMIN_EMAILS` **promove** os e-mails listados a administrador. Ninguem e
rebaixado: quem ja e admin no banco continua admin.

## 4. Planos e modelos

Cada plano libera um conjunto proprio de provedores (exclusivo). A lista fica
gravada no banco (coluna `plans.providers`) e e editavel em
**Admin > Planos**:

| Plano | Provedor | Modelos |
|-------|----------|---------|
| FREE | OpenCode Console (+ OpenRouter como reserva) | Big Pickle, GLM 5.3 Flash, DeepSeek V4.1 Flash, MiniMax M3.1 Flash, Nemotron 3.5, Inkling, Beam, LongCat, Iceman, Flint + NEXUS Core local |
| PRO | Groq | GPT OSS, Llama 3.3/3.1/4, Kimi K2, Qwen3, DeepSeek R1, Gemma 2 |
| ULTRA | NVIDIA NIM | todos os modelos Nemotron, Llama, Mistral, Qwen, Kimi... |
| NEXUS OMEGA | todos | Groq, NVIDIA NIM, SambaNova, Vercel AI Gateway (Claude, GPT, Gemini, Grok, Kimi), OpenCode, OpenRouter + modelos sem censura (Heretic) |

Regras de operacao:

- o **NEXUS Core local** e liberado em todos os planos e nao depende de chave;
- provedor **sem chave** nao entrega modelo: o plano continua funcionando com os
  demais provedores e o terminal avisa no topo da conversa;
- plano **sem nenhum provedor externo com chave** entra em *modo reserva* e
  usa somente o NEXUS Core local;
- o administrador sempre enxerga todos os provedores. O servidor bloqueia
  modelos fora do plano com HTTP 403, mesmo em chamada direta a `/api/chat`;
- o dashboard mostra a saude de cada plano (modelos liberados e provedores sem
  chave) e `Admin > Testar modelos` faz um ping real em cada provedor.

O Vercel AI Gateway exige cartao de credito na conta Vercel: sem ele o
`/v1/models` responde 200, mas o chat devolve HTTP 403
(`customer_verification_required`).

## 5. Manutencao

`Admin > Manutencao` liga/desliga o modo de manutencao. Quando ativo:

- administradores continuam accessing tudo;
- usuarios comuns recebem **HTTP 503** em `/api/chat`, `/api/chats`,
  `/api/files`, `/api/generate-image` e `/api/generate-audio`;
- a rota `/chat` redireciona para `/maintenance` (pagina publica).

## 6. Limitacoes no Vercel (Serverless)

| Recurso | Status no Vercel | Solucao |
|---------|-----------------|---------|
| **SQLite** | nao persiste | resolvido: Neon Postgres via `DATABASE_URL` |
| **Uploads de arquivos** | nao persistem | gravados em `/tmp` (efemeros) |
| **Omega/Heretic** | `uv` e Python nao estao disponiveis | modo OMEGA fica para execucao local |
| **Ollama local** | nao roda no serverless | use apenas provedores de API |

## 7. O que funciona no Vercel

- ✅ Chat com modelos de texto (NVIDIA NIM, OpenRouter, Groq)
- ✅ Persistencia de usuarios, planos, historico e uso (Postgres/Neon)
- ✅ Autenticacao por OTP com SMTP
- ✅ Geracao de imagem via NVIDIA (`/api/generate-image`)
- ✅ Geracao de audio via NVIDIA (`/api/generate-audio`)
- ✅ Painel Admin: usuarios, planos, provedores, auditoria, manutencao

## 8. Comandos locais

```bash
npm install
npm run dev
npm run build
npm start
npm run db:migrate   # SQLite -> Postgres
```

## 9. Troubleshooting

- **Build falha**: rode `npm run typecheck` e `npm run lint`.
- **Erro 404 nas rotas de API**: confirme `runtime = "nodejs"` e `vercel.json`.
- **Usuarios sumiram**: o banco precisa estar em Postgres (`DATABASE_URL`).
  Com SQLite em `/tmp` os dados somem a cada cold start.
- **Chave NVIDIA nao funciona**: confirme `NVIDIA_API_KEY` no ambiente certo.
