# Catálogo de tools do MCP Ziint

29 tools, todas confinadas à empresa da API key (multi-tenant enforced no servidor). Convenções:
- Erros vêm como `{ "error": "..." }` dentro do conteúdo da tool — ler e se recuperar.
- `✅` = obrigatório. Tools de escrita estão marcadas com ✍️ e aceitam `dryRun`.
- IDs (`formularioId`, `dashboardId`, ...) sempre vêm de uma tool de listagem — nunca inventar.

## Formulários e respostas

### `list_forms` — `forms:read`
Lista formulários da empresa. Ponto de partida para descobrir `formularioId`.
Args: `search?` (ILIKE no título), `limit?` (padrão 50, teto 200).
Retorno: array de `{ id, titulo, descricao, workflowHabilitado }`.

### `get_form_overview` — `forms:read`
Métricas rápidas de um formulário.
Args: `formularioId` ✅.
Retorno: `{ titulo, totalResponses, uniqueRespondents, firstSubmissionAt, lastSubmissionAt, activeWorkflowResponses, totalWorkflowSteps, statusCounts: [{label,value}] }`.

### `get_form_fields` — `forms:read`
Campos de um formulário — discovery obrigatório antes de `create_response` e do modo campo de `query_responses`.
Args: `formularioId` ✅.
Retorno: `{ fields: [{ id, name, type, isMulti, options: [{label,value}] }] }`.
Regras: usar `id` do campo como chave em `respostas`; em campos com `options`, enviar o `value` (não o `label`); `isMulti: true` aceita array.

### `query_responses` — `responses:read`
Consulta agregada e segura das respostas. Dois modos:

**Modo metadados:** `formularioId` ✅, `groupBy?: "status"|"day"`, `days?` (teto 365), `period?: {preset:"7d"|"30d"|"90d"|"12m"} | {from,to}`.
Retorno: `{ total, breakdown: [{label,value}] }`.

**Modo campo (agregação por campo do form ou atributo do respondente):**
- `groupBy`: um `fieldId` OU `"usuario.<nome|email|matricula|codigo|phone|uo>"`
- `aggregate?`: `"count"` (padrão) | `"sum"` | `"avg"` | `"min"` | `"max"` — se ≠ count, exige `aggregateField` (fieldId)
- `distinct?: boolean`
- `filters?`: `[{ campo: fieldId|"usuario.*", operador: "="|"!="|">"|"<"|"contains", valor }]` (máx 10; **não aceita** `"status"`/`"day"` como campo)
- `select?`: `fieldId[]` (máx 30, sem `groupBy`) → modo linhas cruas `{ mode:"rows", total, rows }`
- `limit?` (máx 500) / `offset?`

Retorno agregado: `{ groupBy, aggregate, breakdown: [{label,value}] }` — o `breakdown` alimenta `generate_chart` diretamente.
Pegadinhas: nomes de campo inválidos retornam `{ error, validFields }` — autocorrigir. Não existe agregação sem `groupBy` (para "soma total", agrupar por campo de baixa cardinalidade, ex.: `status` no modo metadados não serve — usar um fieldId).

### `create_response` — `responses:write` ✍️
Cria uma resposta (dispara workflow, notificações, integrações e gamificação como uma submissão normal). Autor = dono da API key.
Args: `formularioId` ✅, `respostas` ✅ (`{ "<fieldId>": valor }`), `status?` (padrão `sent`), `receiverId?`, `idempotencyKey?`, `dryRun?`.
Retornos: `{ dryRun:true, wouldCreate, validation:{unknownFields,missingRequired,invalidOptions} }` · `{ ok:true, responseId, status }` · `{ ok:true, idempotent:true, responseId }` · `{ error, validation }`.
Fluxo obrigatório: `get_form_fields` → `dryRun:true` → confirmação do usuário → real com `idempotencyKey` (idempotência garantida no banco).

## Analytics

### `analyze_form` — `analytics:read` (+ `responses:read` para `samples`/`respondents`)
Análise exploratória 3-em-1.
Args: `formularioId` ✅, `analysis` ✅ (`"field_profiles"` | `"samples"` | `"respondents"`), `fieldIds?`, `limit?` (máx 50, samples), `topN?` (máx 20, profiles), `search?` (respondents).
`field_profiles` exige só `analytics:read`; `samples`/`respondents` exigem também `responses:read` (PII).

### `get_workflow_analytics` — `analytics:read`
Analytics das ações de workflow de um formulário.
Args: `formularioId` ✅, `workflowStepId?`, `stepName?` (ILIKE), `dateFrom?`/`dateTo?`, `topN?` (padrão 10, máx 50), `includeStepFields?`.
Retorno: `{ overview:{totalActions,responsesTouched,avgHoursFromSubmission,...}, actionCounts, stepCounts, actorCounts, topComments, stepFields? }`.

### `generate_chart` — `analytics:read`
Gera gráfico (pizza/barra) de dados já obtidos e retorna o link da imagem.
Args: `type` ✅ (`"pie"`|`"bar"`), `title?`, `labels?`+`values?` OU `rows?` (`[{label,value}]`), `datasetLabel?`.
Retorno: markdown `![Gráfico gerado](url)`.
⚠️ Imagem publicada em S3 **público** — confirmar com o usuário antes de incluir dados sensíveis em título/labels.

### `generate_csv` — `analytics:read`
Gera CSV de dados já obtidos e retorna link de download.
Args: `rows` ✅ (array de objetos, máx 5000), `filename?`.
⚠️ Mesmo aviso de S3 público.

### `get_system_report` — `analytics:read`
8 relatórios em nível de **empresa** (não por formulário).
Args: `report` ✅ — `summary` | `responses_by_date` | `responses_by_user` | `responses_by_form` | `user_activity` | `form_activity` | `trends` | `field_usage`; extras conforme o relatório: `startDate`, `endDate`, `formId`, `limit`, `days`, `interval`, `months`.
Ex.: crescimento de 6 meses → `{ report: "trends", months: 6 }`.

### `get_gamification` — `analytics:read`
Leaderboard, posição do dono da chave, ou metadados do esquema ativo.
Args: `view` ✅ (`leaderboard`|`my_position`|`scheme`), `periodId?` (padrão `"auto"`), `limit?` (padrão 10, máx 50, só leaderboard).
`my_position` pode retornar `{ restricted: true }` (esquema restrito a grupos).

### `get_user_summary` — `analytics:read`
Painel pessoal do **dono da API key**: workflow pendente, assinaturas, agendamentos, treinamentos, notificações, gamificação e timeline — numa chamada.
Args: `sections?` (recorta o JSON), `upcomingDays?` (padrão 7, máx 30), `timelineLimit?` (padrão 10, máx 50).
Uso: "o que está pendente pra mim hoje?".

## Dashboards

> Spec completa de criação/edição (widgets, grid, fontes): `dashboards.md`.

### `list_dashboards` — `dashboards:read`
Args: `grupo?`, `tag?`, `ativo?` (padrão true), `search?`, `limit?` (teto 100), `offset?`.
Retorno: `{ id, nome, descricao, grupo, icone, tags, publico, dataCriacao }[]`.
Visibilidade: só dashboards públicos, criados pelo dono da chave, autorizados a ele, ou todos se a chave é de admin/gerente — pode "ver menos" que a UI, por design.

### `get_dashboard` — `dashboards:read`
Árvore completa: painéis → widgets → fontes.
Args: `dashboardId` ✅, `include?: "summary"` (padrão) | `"full"`.
Retorno: `{ nome, paineis: [{ nome, objetos: [{ nome, tipo, posicao, fonteDadosId, fonteDados:{id,nome,tipo} }] }] }`. `"full"` inclui `configuracoes` (strings >4KB truncadas; payload >100KB degrada para summary com `_truncated`).

### `list_datasources` — `dashboards:read`
Args: `tipo?` (`manual|formulario|consulta_sql|api|file|users|company|workflow`), `categoria?`, `tag?`, `search?`, `limit?`/`offset?`.
Retorno: `{ id, nome, tipo, categoria, tags, variaveis, ativo }[]` — `variaveis` informa o que passar em `get_datasource_data`.

### `get_datasource_data` — `dashboards:read`
Executa uma fonte de dados salva (mesma engine dos dashboards nativos).
Args: `fonteDadosId` ✅, `limit?` (padrão 200, teto 1000), `offset?`, `variables?` (só chaves **declaradas** na fonte; valores coagidos pelo tipo).
Retorno: `{ tipo, totalRecords, returned, truncated, data }`. `truncated: true` → paginar com `offset`.
Restrições: tipo `file` é negado via MCP; `consulta_sql` executa apenas SQL já autorado por admin (o LLM nunca cria/edita esse SQL).

### `create_dashboard` — `dashboards:write` ✍️
Cria dashboard completo (painéis + widgets + fontes) numa transação atômica. Ver `dashboards.md`.
Args principais: `nome` ✅, `paineis` ✅ (1–8, cada um com `objetos[]` ≤20), `descricao?`, `grupo?`, `icone?`, `tags?` (≤20), `publico?` (padrão false), `configuracoes?`, `idempotencyKey?` (best-effort), `dryRun?`.
Fontes inline: só `formulario` (exige `configuracao.formularioId`) e `users`; `consulta_sql` **nunca**. Widget pode referenciar fonte existente de qualquer tipo via `fonteDadosId` (XOR com `fonteDados`).
`warnings` não bloqueiam (ex.: widgets sobrepostos); `errors` bloqueiam.

### `update_dashboard` — `dashboards:write` ✍️
Patch por operações (não substitui a árvore).
Args: `dashboardId` ✅, `operations[]` ✅ (1–20), `dryRun?`.
Ops: `update_meta` (merge raso de `configuracoes`), `add_painel`, `update_painel`, `remove_painel`, `add_objeto`, `update_objeto`, `remove_objeto` (soft delete).
Permissão: criador do dashboard ou admin/gerente.

### `delete_dashboard` — `dashboards:write` ✍️
Soft delete (desativa). Não existe hard delete via MCP.
Args: `dashboardId` ✅. Retorna `{ ok, idempotent? }`.

## Outros domínios

### `list_bookings` — `scheduling:read`
Agendamentos de recursos da empresa.
Args: `dateFrom?`, `dateTo?`, `resourceId?`, `status?` (`pendente|confirmado|cancelado|concluido`), `limit?` (teto 100), `offset?`.
Retorno: `{ id, inicio, fim, status, observacoes, resource:{id,nome,tipo}, user:{id,nome,email} }[]`.

### `list_signature_documents` — `signatures:read`
Documentos de assinatura eletrônica.
Args: `status?` (`PENDING|IN_PROGRESS|FULLY_SIGNED|CANCELLED`), `dateFrom?`/`dateTo?`, `search?`, `limit?` (teto 100), `offset?`.
Retorno: `{ id, documentName, status, totalSigners, completedSigners, currentSignerIndex, createdAt, createdBy }[]`.

### `query_signature_pendencies` — `signatures:read`
"Quais assinaturas estão pendentes?" e "quem ainda não assinou?". Uma linha por **pendência** (signatário que não assinou num documento aberto), não por documento.
Args: `signerQuery?` (pessoa: nome/e-mail/telefone/CPF), `search?` (nome do documento), `minDaysWaiting?`, `slotStatus?` (`WAITING|IN_PROGRESS`), `dateFrom?`/`dateTo?`, `sort?` (`daysWaiting|documentName|signerName`), `order?`, `page?`, `limit?` (teto 200).
Retorno: `{ items: [{ documentId, documentName, documentStatus, slotId, order, signerName, signerEmail, isCurrent, slotStatus, waitingSince, daysWaiting, aging, lastRemindedAt, totalSigners, completedSigners, documentCreatedAt }], pagination, summary }`.
**Pegadinha — não existe prazo.** Assinatura neste sistema **não tem data de vencimento**. O que existe é há quanto tempo a pessoa está parada, em faixas: `fresh` 0–2 dias, `attention` 3–6, `late` 7–14, `critical` 15+. "O que está atrasado" = `minDaysWaiting: 7`; "crítico" = `minDaysWaiting: 15`. **Nunca prometer data-limite ao usuário nem falar em "vencimento".**
O `summary` cobre o recorte inteiro, não a página — pode ser narrado mesmo com `items` paginado.

### `get_signature_summary` — `signatures:read`
Panorama agregado: contagens por status e por faixa de atraso. Use quando o usuário quer um número, não uma lista.
Args: `status?`, `search?`, `signerQuery?`, `dateFrom?`/`dateTo?`.

### `get_signature_document` — `signatures:read`
Um documento e a situação de cada signatário.
Args: `documentId` ✅.
Retorno: `{ ..., signers: [{ slotId, order, name, email, status, isCurrent, signedAt, waitingSince, daysWaiting, aging, lastRemindedAt }] }`.
**Regra:** `isCurrent` marca o signatário da vez. A fila é **sequencial** — só ele pode assinar agora; os outros `WAITING` estão atrás dele, não atrasados por culpa própria.

### `create_signature_upload` — `signatures:write` ✍️
URL temporária (PUT, 15 min) para enviar um PDF que será assinado. Use quando o arquivo está com o usuário e não tem URL.
Args: `fileName?` (informativo).
Retorno: `{ uploadUrl, uploadToken, expiresInSeconds, contentType }`.
**Regra:** enviar com `curl -X PUT -H "Content-Type: application/pdf" --data-binary @arquivo.pdf "<uploadUrl>"` e depois passar o `uploadToken` para `create_signature_request`. **Nunca colar o conteúdo do PDF numa chamada de tool** — base64 de 1 MB custa centenas de milhares de tokens e corrompe o arquivo na primeira reprodução imperfeita, o que quebra o hash da assinatura.

### `create_signature_request` — `signatures:write` ✍️
Monta a solicitação e **NÃO avisa ninguém**. Primeiro de dois passos.
Args: `signers` ✅ (array, a ordem é a fila), `documentName?`, `dryRun?`, `idempotencyKey?`, e **exatamente uma** origem de PDF: `responseId?` | `pdfUrl?` | `uploadToken?`.
- signatário interno: `{ "userId": "<uuid>" }` — precisa ser usuário da mesma empresa.
- signatário externo: `{ "name": "...", "email": "..." }`.
Retorno: `{ ok, documentId, status, invitesSent: false, signers }`.
**Pegadinhas:**
- `responseId` gera o PDF a partir de uma resposta de formulário — é o caminho para documento que nasce dentro do Ziint. Uma "folha de ponto" aqui é um formulário preenchido; **não existe entidade de folha de ponto** no sistema.
- `pdfUrl` só aceita `https` e recusa endereço de rede interna.
- `idempotencyKey` é **best-effort, sem índice único**: duas chamadas simultâneas com a mesma chave **podem** criar dois documentos. Como esta tool não envia nada, a duplicata é um rascunho descartável — cancele o extra. **Não prometa unicidade ao usuário.**

### `send_signature_request` — `signatures:write` ✍️
**DISPARA** o e-mail com o link para o signatário da vez. Segundo passo, irreversível.
Args: `documentId` ✅, `dryRun?`.
Retorno: `{ ok, documentId, sentTo: { name, email, order }, totalSigners, sentAt }`.
**Regras:**
- Só o signatário **da vez** é avisado. O próximo é convidado sozinho pelo sistema quando o atual assinar — **não chame em loop para "avisar todo mundo"**.
- Documento `FULLY_SIGNED` ou `CANCELLED` recusa.
- Chamar de novo reenvia para a mesma pessoa.

## Bancos de dados externos

### `list_database_connections` — `database:read`
Conexões de banco **externas** cadastradas pela empresa (não é o banco do Ziint).
Args: `search?`, `limit?` (teto 100), `offset?`.
Retorno: `{ id, nome, tipo, database, isActive, promptRespostaAgente, promptGeracaoSql, ... }[]` — **nunca** retorna host/porta/usuário/senha.
Uso: **ler `promptRespostaAgente` (contexto do banco) e `promptGeracaoSql` (schema/tabelas/regras) antes de montar qualquer SQL.**

### `query_database` — `database:read`
Executa SELECT read-only na conexão externa escolhida.
Args: `connectionId` ✅, `sql` ✅ (deve começar com `SELECT` ou `WITH ... SELECT`), `maxRows?` (padrão 500, teto 5000).
Retorno: `{ tipo, rowCount, truncated, rows }`.
Regras: mutações (`INSERT/UPDATE/DELETE/DROP/...`) e stacked queries (`;` + conteúdo) são bloqueadas no servidor; `truncated: true` → refinar com `WHERE`/`LIMIT`.

## Resources e prompt MCP (clientes que suportam)

- Resource `ziint://docs/dashboard-spec` (sempre visível) — spec de widgets/grid/fontes.
- Resource `ziint://forms/{formularioId}/schema` (`forms:read`) — schema de um formulário por URI.
- Prompt `build-dashboard` (`dashboards:write`) — fluxo guiado de criação de dashboard. Args: `objetivo` ✅, `formularioId?`.
Nenhuma tool depende deles; muitos clientes MCP os ignoram.
