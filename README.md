# Ziint Agent Skills

![Ziint Agent Skills](./cover.jpg)

Conecte o **Ziint** ao seu assistente de IA e converse com os dados da sua empresa em linguagem natural — *"quantas respostas o formulário de auditoria teve essa semana?"*, *"crie um dashboard de vendas"*, *"o que está pendente pra mim hoje?"*.

Este pacote traz uma **Agent Skill** no padrão aberto `SKILL.md` (com instruções de instalação para Claude Code, Codex, OpenCode e — via ponte `mcp-remote` — Cursor, Windsurf e Claude Desktop) + um **plugin Claude Code** completo. Tudo conversa com o **MCP Server oficial do Ziint** (`https://api.ziint.com/api/mcp`), isolado por empresa.

> Os números vêm do banco do Ziint — exatos, nunca estimados. As tools calculam; a IA narra.

## O que a IA passa a fazer

- **Formulários e respostas**: listar, ver métricas, agregar por campo/status/dia, criar respostas.
- **Analytics**: perfis de campo, workflow, relatórios da empresa, tendências, gamificação.
- **Dashboards**: ler, executar fontes de dados e **criar/editar** dashboards nativos.
- **Artefatos**: gerar gráficos e CSVs.
- **Pessoal**: agendamentos, assinaturas e um painel "meu dia".
- **Bancos externos**: consultar (SELECT read-only) os bancos que a empresa cadastrou.

23 tools no total, filtradas pelos escopos da sua credencial. Uma credencial só-leitura padrão costuma enxergar 21: `list_bookings` e `list_signature_documents` exigem `scheduling:read` / `signatures:read`, que não fazem parte do vocabulário do OAuth. Detalhes em [`skills/ziint/references/tools.md`](./skills/ziint/references/tools.md).

---

## Autenticação

O MCP fica em `POST /api/mcp` (transporte **Streamable HTTP**) e aceita **dois esquemas**. Os dois desembocam no mesmo contexto interno — a tool não sabe, nem precisa saber, qual deles autenticou. Em ambos, **a empresa vem da credencial, nunca do payload da requisição**: o LLM não consegue pedir dados de outro tenant.

| | **API key** | **OAuth 2.1** |
|---|---|---|
| Para quê | Máquina-a-máquina: CI, scripts, servidores, agentes headless | Pessoas: o "Login with Ziint" que o cliente MCP abre no browser |
| Como vai no request | `X-API-Key: ziint_live_…` | `Authorization: Bearer <access token>` |
| Quem define a empresa | A chave (fixada na criação) | O consentimento do usuário no login |
| Quem define os escopos | Os escopos gravados na chave | Os escopos aprovados na tela de consentimento |
| Validade | Até revogar/expirar | Access token 1 h, refresh 30 dias |
| Configuração manual | Sim — você cola a chave | Nenhuma: o cliente descobre e conduz sozinho |

### Esquema 1 — API key

Três formatos de header são aceitos, todos equivalentes:

```http
X-API-Key: ziint_live_<segredo>
Authorization: ApiKey ziint_live_<segredo>
Authorization: Bearer ziint_live_<segredo>
```

> O prefixo `ziint_live_` é o que desambigua os dois esquemas: um `Bearer` que começa com ele é tratado como chave, não como token OAuth.

Um admin gera a chave em **API Keys** na UI, ou pela API:

```bash
curl -X POST https://api.ziint.com/api/api-keys \
  -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" \
  -d '{ "nome": "Assistente IA — Analytics",
        "scopes": ["forms:read", "responses:read", "analytics:read"] }'
```

O segredo aparece **uma única vez**. Guarde em variável de ambiente, nunca em arquivo versionado:

```bash
export ZIINT_API_KEY="ziint_live_xxx"
```

### Esquema 2 — OAuth 2.1 (login pelo browser)

Se o cliente MCP mandar a requisição **sem credencial nenhuma**, o servidor responde `401` com `WWW-Authenticate` apontando para o documento de *Protected Resource Metadata*. É isso que ensina o cliente a descobrir o Authorization Server e iniciar o login sozinho — você não configura nada além da URL do servidor.

**Documentos de descoberta:**

| Documento | Caminho |
|---|---|
| Protected Resource Metadata (RFC 9728) | `/.well-known/oauth-protected-resource/api/mcp` |
| Authorization Server Metadata (RFC 8414) | `/.well-known/oauth-authorization-server` |

**Endpoints do Authorization Server:**

| Endpoint | Caminho |
|---|---|
| Authorization | `/api/oauth/authorize` |
| Token | `/api/oauth/token` |
| Revocation | `/api/oauth/revoke` |
| Consentimento | `/api/oauth/consent` |
| Dynamic Client Registration | `/api/oauth/register` |

**Parâmetros do fluxo:**

- **PKCE obrigatório**, apenas `S256` (`plain` é recusado).
- Grants: `authorization_code` e `refresh_token`.
- Autenticação do cliente: `client_secret_post` e `none`.
- **Resource indicators (RFC 8707)**: o access token vale só para a URL canônica `https://api.ziint.com/api/mcp`. Um token emitido para outro serviço não é aceito aqui.
- **DCR ligado por padrão** — clientes como o Claude Code se registram sozinhos, e o segredo emitido não expira.

**Escopos oferecidos no fluxo OAuth (7):**

`forms:read` · `responses:read` · `responses:write` · `analytics:read` · `dashboards:read` · `dashboards:write` · `database:read`

Se o cliente não pedir escopo nenhum, são concedidos os quatro de leitura: `forms:read`, `responses:read`, `analytics:read`, `dashboards:read`.

> A API key admite ainda `signatures:read`, `signatures:write`, `scheduling:read` e `scheduling:write`, que não fazem parte do vocabulário do fluxo OAuth.

### Escopos recomendados por caso de uso

| Caso de uso | Escopos |
|---|---|
| Perguntas e relatórios (read-only) | `forms:read`, `responses:read`, `analytics:read` |
| + Ler dashboards | adicionar `dashboards:read` |
| + Criar respostas | adicionar `responses:write` |
| + Criar/editar dashboards | adicionar `dashboards:write` |
| + Agendamentos / assinaturas (só API key) | adicionar `scheduling:read` / `signatures:read` |
| + Bancos externos | adicionar `database:read` |

Princípio do menor privilégio: dar `:write` só a credenciais que realmente precisam. Uma credencial read-only **nem enxerga** as tools de escrita no `tools/list`.

⚠️ Chaves criadas **antes** de um escopo existir não o têm: regenerar ou editar (`PUT /api/api-keys/:id`).

### Variáveis de ambiente do servidor (self-host)

Quem sobe o próprio backend precisa configurar:

| Variável | Obrigatória | Padrão | Para quê |
|---|---|---|---|
| `MCP_PUBLIC_URL` | **em produção** | `http://localhost:$PORT` | Base pública anunciada como `issuer` e recurso canônico. Sem ela o OAuth anuncia URLs de localhost e nenhum cliente conclui o login. |
| `MCP_OAUTH_JWT_SECRET` | **em produção** | — (erro no boot) | Segredo dos tokens do MCP. Deliberadamente separado do `JWT_SECRET` das sessões, para que um JWT de sessão não vire access token do MCP nem vice-versa. |
| `MCP_OAUTH_ACCESS_TTL` | não | `3600` | Validade do access token, em segundos. |
| `MCP_OAUTH_REFRESH_TTL_DAYS` | não | `30` | Validade do refresh token, em dias. |
| `MCP_OAUTH_DCR_ENABLED` | não | `true` | `false` desliga o registro dinâmico de clientes. |

---

## Instalação rápida

### 1. Escolha a credencial

- **Você, no seu terminal?** Não precisa de nada — o OAuth resolve no primeiro uso.
- **Servidor, CI ou agente headless?** Gere uma API key (acima) e exporte `ZIINT_API_KEY`.

### 2. Instale a skill/plugin

**Claude Code (plugin — recomendado):**
```
/plugin marketplace add ziint-ai/ziint-skills
/plugin install ziint@ziint
```

**Qualquer agente (skill universal):**
```bash
npx skills add ziint-ai/ziint-skills -a claude-code -a codex -a opencode
```

**Manual:** copie `skills/ziint/` para `.claude/skills/`, `.agents/skills/` ou `.opencode/skills/` do seu projeto.

### 3. Conecte o MCP

**Com OAuth (sem segredo no arquivo):**
```bash
claude mcp add --transport http ziint https://api.ziint.com/api/mcp
```
No primeiro uso o Claude Code abre o browser, você aprova os escopos, e pronto.

**Com API key:**
```bash
claude mcp add --transport http ziint https://api.ziint.com/api/mcp \
  --header "X-API-Key: ${ZIINT_API_KEY}"
```

O plugin já aponta o MCP e lê `ZIINT_API_KEY` do ambiente. Para configuração manual por plataforma (Codex `config.toml`, OpenCode `opencode.json`, ponte `mcp-remote` para clientes só-stdio), veja [`skills/ziint/references/setup.md`](./skills/ziint/references/setup.md).

### 4. Verifique

```bash
npm run doctor            # ou: node skills/ziint/scripts/ziint-doctor.mjs
```

⚠️ O diagnóstico exige `ZIINT_API_KEY`. **No caminho OAuth ele não se aplica** — sai com código 2 sem uma chave. Ali, verifique pedindo `liste meus formulários` ao seu agente.

Lista as tools e escopos que sua credencial enxerga. Se aparecerem, está pronto.

## Estrutura

```
skills/ziint/          # skill universal (SKILL.md + references + scripts)
  SKILL.md
  references/          # tools, recipes, dashboards, setup
  scripts/             # ziint-doctor.mjs (diagnóstico, sem deps, Node ≥18)
  agents/openai.yaml   # metadados extras do Codex
plugins/ziint/         # plugin Claude Code (plugin.json, .mcp.json, commands/, skills/)
.claude-plugin/        # marketplace.json
scripts/sync-skill.mjs # mantém a cópia da skill do plugin em sincronia
```

A skill canônica é `skills/ziint/`. Após editá-la, rode `npm run sync` para atualizar a cópia dentro do plugin.

## Comandos do plugin (Claude Code)

- `/ziint:conectar` — conecta e diagnostica o MCP (caminho da chave de API; o diagnóstico exige `ZIINT_API_KEY`).
- `/ziint:relatorio [foco]` — relatório executivo dos dados.
- `/ziint:dashboard <descrição>` — cria um dashboard com preview antes de gravar.

## Troubleshooting

| Sintoma | Causa provável | Correção |
|---|---|---|
| `401` sem detalhe, cliente abre o browser | Normal — é o caminho do OAuth começando | Aprovar o consentimento |
| `401 API_KEY_MISSING` | Header não chegou | Conferir o nome exato `X-API-Key` e o valor sem espaços |
| `401 API_KEY_INVALID` / `API_KEY_EXPIRED` | Chave errada ou expirada | Gerar nova chave |
| `403 API_KEY_INACTIVE` / `..._COMPANY_INACTIVE` | Chave ou empresa desativada | Falar com o admin do Ziint |
| Login abre em `localhost` num servidor remoto | `MCP_PUBLIC_URL` não definido | Definir a URL pública e reiniciar |
| Conecta mas `tools/list` vem curto | Credencial sem escopos suficientes | Adicionar escopos (tabela acima) |
| `405` em GET/DELETE | Normal — o servidor é stateless | Ignorar; o cliente MCP usa só POST |
| Codex/Cursor não aceita header custom | Build sem suporte | Usar a ponte `mcp-remote` |

## Segurança

- A empresa é **fixada na credencial** — a IA só acessa os dados daquela empresa, em ambos os esquemas.
- Escopos = menor privilégio; credenciais read-only nem enxergam tools de escrita.
- O segredo do OAuth do MCP é separado do segredo das sessões: o vazamento de um não vira o outro.
- Escrita (respostas/dashboards) é **atômica**, **auditada** — inclusive os `dryRun` — e só faz **soft delete**. `create_response` é idempotente de verdade (índice único no banco); `create_dashboard` aceita `idempotencyKey` best-effort; `update_dashboard` e `delete_dashboard` **não têm** chave de idempotência (`update_dashboard` declara `idempotentHint: false`).
- `dryRun` é um parâmetro **opcional enviado pelo cliente**, não um estado imposto pelo servidor, e `delete_dashboard` não o aceita. A confirmação antes de gravar é uma regra de comportamento da skill, não uma trava do servidor.
- A **auditoria** (`logMcpOperation`) cobre as 4 tools de escrita e `query_database`. As outras 18 leituras não geram registro, e não há visualizador de auditoria neste pacote.
- **Rate limit**: escritas 30 por 60 s; leituras limitadas apenas em `query_database`, `query_responses` e `get_datasource_data`. O limite volta como erro no resultado da tool, **não** como HTTP 429.
- Gráficos e CSVs são gravados em S3 e a URL construída é de **estilo** público; a visibilidade efetiva depende da policy do bucket no seu deploy. Além disso, `generate_chart` envia a configuração do gráfico (título, rótulos e valores) para `https://quickchart.io/chart`, um serviço de terceiros, antes de armazenar o PNG. Não gere artefato com dado sensível.

## Licença

MIT — ver [LICENSE](./LICENSE).
