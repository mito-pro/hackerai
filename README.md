# HACKER_AI :: NEXUS

Terminal de IA auto-hospedado: login por OTP, chat em streaming, controle de
tokens por plano e painel administrativo completo. Roda 100% offline com o motor
local embutido e usa APIs gratuitas (Groq, Google AI Studio, OpenRouter) ou
Ollama quando voce quiser respostas de LLM de verdade.

O plano **NEXUS OMEGA** acrescenta o modo sem censura: o admin decensorsa um
modelo do Hugging Face com o Heretic (`0xSojalSec/Uncensored-AI`), importa no
Ollama e o modelo passa a ser oferecido no terminal.

Baseado no template open-source [`vercel/ai-chatbot`](https://github.com/vercel/ai-chatbot)
(Apache-2.0), com motor local proprio, tema cyberpunk e painel administrativo.

---

## Stack

| Camada | Tecnologia |
| --- | --- |
| App | Next.js 15 (App Router) + React 19 + TypeScript |
| UI | Tailwind CSS v4 + `react-markdown` (GFM) |
| IA | AI SDK v5 (`@ai-sdk/groq`, `@ai-sdk/google`, `@ai-sdk/openai-compatible`) |
| IA local | Heretic (`0xSojalSec/Uncensored-AI`) + Ollama (modo NEXUS OMEGA) |
| Banco | SQLite via `node:sqlite` (modulo nativo do Node, sem build) |
| Auth | OTP por e-mail (nodemailer) + sessao opaca em cookie httpOnly |
| Criptografia | `node:crypto` (SHA-256, HMAC, AES-256-GCM, scrypt) |

---

## Requisitos

- **Node.js >= 22.5** (obrigatorio: o banco usa `node:sqlite`, modulo nativo)
- npm (ou outro gerenciador compativel)

## Instalacao

```bash
npm install
cp .env.example .env.local   # Linux/macOS: cp .env.example .env
npm run dev
```

Acesse `http://localhost:3000`.

O banco (`data/hackerai.db`) e criado automaticamente no primeiro start, com
WAL habilitado e os planos padrao (FREE, PRO, ULTRA) semeados.

### Scripts

| Comando | O que faz |
| --- | --- |
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` | Build de producao |
| `npm run start` | Sobe o build de producao |
| `npm run lint` | ESLint (next/core-web-vitals + next/typescript) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run omega:setup` | Clona o repo do Heretic em `tools/Uncensored-AI` e checa o `uv` |
| `npm run omega:decensor -- <modelo>` | Decensorsa um modelo do Hugging Face e salva em `data/omega/models` |
| `npm run omega:ollama -- <slug>` | Importa o modelo decensored no Ollama como `nexus-omega-<slug>` |

---

## Variaveis de ambiente

Todas opcionais, exceto `APP_SECRET` em producao.

| Variavel | Padrao | Descricao |
| --- | --- | --- |
| `APP_SECRET` | (dev) | Segredo do HMAC dos OTPs e da chave AES-256-GCM do cofre de segredos. **Obrigatorio em producao.** |
| `DATABASE_PATH` | `./data/hackerai.db` | Caminho do arquivo SQLite. |
| `ADMIN_EMAILS` | vazio | E-mails (separados por virgula) que sempre recebem papel de admin. |
| `GROQ_API_KEY` | vazio | Fallback de ambiente para a chave da Groq. |
| `GOOGLE_API_KEY` | vazio | Fallback de ambiente para o Google AI Studio. |
| `OPENROUTER_API_KEY` | vazio | Fallback de ambiente para o OpenRouter. |
| `OPENCODE_API_KEY` | vazio | Fallback de ambiente para o OpenCode Console (modelos gratuitos). |
| `VERCEL_AI_GATEWAY_API_KEY` | vazio | Fallback de ambiente para o Vercel AI Gateway (modelos premium). |
| `OLLAMA_BASE_URL` | `http://127.0.0.1:11434/v1` | Base URL da API do Ollama. Definir a variavel **habilita** o provedor. |
| `OLLAMA_MODEL` | `llama3.2` | Modelo padrao do Ollama. |
| `HERETIC_REPO_PATH` | `./tools/Uncensored-AI` | Caminho do repo do Heretic usado no console OMEGA. |
| `SMTP_HOST` / `SMTP_PORT` | vazio / `587` | Servidor SMTP para o envio do OTP. |
| `SMTP_SECURE` | `false` | `true` usa TLS direto (porta 465). |
| `SMTP_USER` / `SMTP_PASS` | vazio | Credenciais do SMTP (a senha e criptografada no banco). |
| `MAIL_FROM` | `HACKER AI <no-reply@hackerai.local>` | Remetente do OTP. |

As chaves cadastradas no painel **Admin > Provedores** tem prioridade sobre as
variaveis de ambiente e sao gravadas criptografadas (AES-256-GCM) no SQLite.

---

## Primeiro acesso

1. Abra `/login` e informe um e-mail.
2. Sem SMTP configurado o codigo de 6 digitos aparece na tela (dev) e no console
   do servidor. Com SMTP ele chega por e-mail.
3. O codigo vale 10 minutos, aceita ate 5 tentativas, tem cooldown de 45s para
   reenvio e limite de 5 codigos/hora por e-mail e 30/hora por IP.
4. **O primeiro usuario registrado vira administrador.** Os e-mails listados em
   `ADMIN_EMAILS` tambem entram como admin.

## Conectando provedores

| Provedor | Onde pegou a chave | Modelos | Planos |
| --- | --- | --- | --- |
| OpenCode Console | `opencode.ai/console` | Big Pickle, GLM 5.3 Flash, DeepSeek V4.1 Flash, MiMo V2.6 Flash, MiniMax M3.1 Flash, Nemotron 3.5, Inkling, Beam, LongCat, Iceman, Flint | FREE, OMEGA |
| Groq | `console.groq.com/keys` | Llama 3.3 70B, Llama 3.1 8B, Llama 4, Kimi K2, Qwen3, DeepSeek R1, Gemma 2, GPT OSS | PRO, OMEGA |
| NVIDIA NIM | `build.nvidia.com` | Nemotron 3 Ultra/Super, Nemotron 3.5, Llama Nemotron, VILA, NEVA | ULTRA, OMEGA |
| OpenRouter | `openrouter.ai/keys` | DeepSeek e Llama 3.3 (`:free`) + roteadores | FREE, OMEGA |
| SambaNova | `sambanova.ai` | GLM 5.3, Llama 3.3 70B, MiniMax M3.1 Flash, Gemma 4 | OMEGA |
| Vercel AI Gateway | painel da Vercel (chave `vck_`) | Claude 5.5, GPT 5.5, Gemini 3.8, Grok 4.7, Kimi K3.1, GLM 5.3, DeepSeek V4 | OMEGA |
| Google AI Studio | `aistudio.google.com` | Gemini 2.0 Flash | admin |
| Ollama | `ollama serve` (local) | o que estiver instalado na sua maquina | admin, OMEGA |

O Vercel AI Gateway exige cartao de credito cadastrado na conta Vercel: sem ele
a listagem de modelos funciona, mas o chat responde HTTP 403
(`customer_verification_required`).

No painel: **Admin > Provedores** -> cole a chave -> *testar conexao* ->
*salvar configuracoes*. O botão de teste do Ollama lista os modelos instalados
e avisa se o modelo configurado nao existe no servidor.

Sem nenhuma chave, o terminal continua funcionando com o **NEXUS Core**, motor
offline embutido (comandos `/help`, `/status`, `/plan`, `/tokens`, `/modelos`,
`/omega`, `/limites`, `/exportar`, `/api`, roteamento de intents e skeletons de
codigo).

---

## NEXUS OMEGA :: modo sem censura (local)

Fluxo completo, sem depender de nenhum servico externo de IA:

1. `npm run omega:setup` clona o repo do Heretic (`0xSojalSec/Uncensored-AI`)
   em `tools/Uncensored-AI` e verifica o `uv` no PATH.
2. **Admin > Omega** mostra o estado do repo, monta o comando de decensoracao e
   pode iniciar o processo em background (log em `data/omega/heretic.log`).
   Equivalente pela linha de comando:
   `npm run omega:decensor -- Qwen/Qwen3-4B-Instruct-2507`.
3. `npm run omega:ollama -- <slug-do-modelo>` importa os pesos decensored no
   Ollama com a tag `nexus-omega-<slug>`.
4. O terminal detecta as tags do Ollama que casam com `heretic`, `uncensored`,
   `abliterated` ou `omega` e as oferece no seletor de modelos.

O acesso ao modo fica no plano **NEXUS OMEGA** (capacidade `uncensored`): o
admin libera a capacidade em **Admin > Planos** e troca o plano do operador em
**Admin > Usuarios**. Quem nao tem a capability recebe HTTP 403 se tentar usar
um modelo OMEGA pela API.

O provider continua sendo o Ollama, mas quando o modelo OMEGA e escolhido o
prompt de sistema muda para o perfil direto do terminal (sem avisos de "como
IA", sem recusas por politica do produto) e a resposta vai direto ao ponto, em
portugues do Brasil, com markdown e codigo executavel.

Requisitos: `uv` instalado, Python 3.11+ e memoria/VRAM para o modelo escolhido.
A decensoracao roda na sua maquina; nenhum peso ou log e enviado para fora.

---

## Planos: o que cada um realmente faz

Cota e contexto sao aplicados **no servidor**, nao apenas exibidos.

| Recurso | FREE | PRO | ULTRA | NEXUS OMEGA |
| --- | --- | --- | --- | --- |
| Tokens/mes | 50.000 | 500.000 | 2.000.000 | 10.000.000 |
| Mensagens/dia | 25 | 200 | 1.000 | 2.000 |
| Contexto por requisicao | 8k | 32k | 128k | 128k |
| Retencao do historico | 7 dias | ilimitado | ilimitado | ilimitado |
| Sessoes simultaneas | 1 | multiplas | multiplas | multiplas |
| Exportar conversa (.md/.json) | nao | sim | sim | sim |
| Fila prioritaria (20 req/min) | nao (5 req/min) | sim | sim | sim |
| Modelos sem censura (Heretic) | nao | nao | nao | sim |

As capacidades sao editaveis em **Admin > Planos**: retencao (dias, `0` =
ilimitado) e as caixas *multiplas sessoes*, *exportar conversas*, *fila
prioritaria* e *modelos sem censura*. O admin ainda pode dar uma cota extra por
usuario em **Admin > Usuarios** (o campo vazio volta ao valor do plano).

O preco exibido e informativo: **nao existe cobranca automatica**. A troca de
plano e manual, pelo admin.

---

## Painel administrativo

| Secao | O que faz |
| --- | --- |
| Dashboard | KPIs, grafico de 30 dias, consumo por provedor, top operadores, novos usuarios. |
| Usuarios | Papel, plano, cota extra, zerar consumo, banir/reativar (revoga as sessoes). |
| Planos | CRUD completo: cota, limite diario, contexto, retencao, capacidades, prioridade. |
| Tokens | Log de consumo por requisicao + exportacao CSV. |
| Provedores | Chaves de API, Ollama (base URL + modelo) e SMTP, com teste de conexao. |
| Omega | Console de decensoracao (repo do Heretic, job em background, log) e modelos OMEGA no Ollama. |
| Conversas | Todas as conversas de todos os operadores, com exportacao e remocao. |
| Sessoes | Sessoes ativas (cookie httpOnly), com revogacao imediata. |

---

## API

| Metodo | Rota | Descricao |
| --- | --- | --- |
| `POST` | `/api/auth/request-otp` | Solicita codigo OTP. |
| `POST` | `/api/auth/verify-otp` | Valida o codigo e cria a sessao. |
| `POST` | `/api/auth/logout` | Encerra a sessao. |
| `GET` | `/api/auth/me` | Usuario, consumo e modelos disponiveis. |
| `POST` | `/api/chat` | Chat em streaming (AI SDK UI message stream). |
| `GET` | `/api/chats` | Conversas do usuario (aplica retencao do plano). |
| `GET`/`DELETE` | `/api/chats/:id` | Detalhe / remocao de uma conversa. |
| `GET` | `/api/chats/:id/export` | Exporta a conversa (`format=md` ou `format=json`). |
| `GET` | `/api/admin/stats` | Agregados do dashboard. |
| `GET`/`PATCH` | `/api/admin/users` | Lista e acoes por usuario. |
| `GET`/`PUT`/`DELETE` | `/api/admin/plans` | CRUD de planos. |
| `GET`/`PUT`/`POST` | `/api/admin/settings` | Provedores, SMTP e teste de conexao. |
| `GET`/`POST` | `/api/admin/omega` | Estado do Heretic/Ollama, comando e inicio da decensoracao. |
| `GET` | `/api/admin/usage` | Log de consumo. |
| `GET` | `/api/admin/chats` | Conversas de todos os operadores. |
| `GET`/`DELETE` | `/api/admin/sessions` | Sessoes ativas e revogacao. |

Erros usam `{ error, message }` com status HTTP proprio (`401` sem sessao,
`403` sem permissao, `402` cota de tokens, `429` limite diario ou rate limit).

---

## Seguranca

- **Sessao**: token opaco de 32 bytes em cookie `httpOnly`, `SameSite=Lax`,
  `Secure` em producao. No banco fica apenas o **SHA-256** do token.
- **OTP**: codigo armazenado como HMAC-SHA256, comparacao em tempo constante,
  expiracao de 10 min, 5 tentativas, cooldown e limites por e-mail/IP.
- **Segredos**: chaves de API e senha do SMTP em AES-256-GCM (chave derivada do
  `APP_SECRET` via scrypt). O `APP_SECRET` ausente em producao gera erro no log.
- **Banco**: `node:sqlite` com WAL, chaves estrangeiras e `busy_timeout`.
- **HTTP**: `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy` e
  `Permissions-Policy` em todas as respostas.

O que **nao** existe nesta versao: CSRF token (o `SameSite=Lax` do cookie e a
barreira atual), 2FA, recuperacao de senha e auditoria de acoes do admin.

---

## Estrutura

```
src/
  app/
    admin/            painel (dashboard, usuarios, planos, tokens, provedores,
                      omega, conversas, sessoes)
    api/              rotas REST/streaming
    chat/             terminal
    login/            acesso por OTP
  components/         otp-login, chat (shell + markdown)
  lib/                db, auth, otp, crypto, chats, usage, plans, providers,
                      model-registry, nexus (motor offline), omega (Heretic),
                      capabilities, rate-limit
scripts/              omega:setup, omega:decensor, omega:ollama
data/                 banco SQLite e saidas do OMEGA (ignorados pelo git)
tools/Uncensored-AI/ repo do Heretic clonado (ignorado pelo git)
```

## Backup

O banco e um arquivo unico. Com o servidor parado:

```bash
cp data/hackerai.db data/backup-$(date +%F).db
```

Com o servidor rodando, use `sqlite3 data/hackerai.db ".backup 'backup.db'"`
(ou copie os tres arquivos `.db`, `.db-wal` e `.db-shm`).

## Limitações conhecidas

- Sem cobranca/pagamento: os precos dos planos sao informativos.
- O rate limit por minuto vive em memoria (por processo) e zera ao reiniciar.
- `node:sqlite` e experimental no Node: o modulo ainda pode mudar de API.
- O NEXUS Core e um motor local por comandos e intents: ele nao gera respostas
  de LLM. Para isso, conecte um provedor.
- O modo OMEGA depende do Heretic e do Ollama: o job de decensoracao e
  monitorado por polling no painel e o `uv` precisa estar no PATH do servidor.

## Licenca

Codigo original deste projeto. Template base: `vercel/ai-chatbot` (Apache-2.0).
