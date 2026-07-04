# Ziint Agent Skills

Conecte o **Ziint** ao seu assistente de IA e converse com os dados da sua empresa em linguagem natural — *"quantas respostas o formulário de auditoria teve essa semana?"*, *"crie um dashboard de vendas"*, *"o que está pendente pra mim hoje?"*.

Este pacote traz uma **Agent Skill** no padrão aberto `SKILL.md` (funciona em Claude Code, Codex, OpenCode, Cursor, Copilot, Gemini CLI e ~70 agentes) + um **plugin Claude Code** completo. Tudo conversa com o **MCP Server oficial do Ziint** (`https://api.ziint.com/api/mcp`), autenticado por API key e isolado por empresa.

> Os números vêm do banco do Ziint — exatos, nunca estimados. As tools calculam; a IA narra.

## O que a IA passa a fazer

- **Formulários e respostas**: listar, ver métricas, agregar por campo/status/dia, criar respostas.
- **Analytics**: perfis de campo, workflow, relatórios da empresa, tendências, gamificação.
- **Dashboards**: ler, executar fontes de dados e **criar/editar** dashboards nativos.
- **Artefatos**: gerar gráficos e CSVs.
- **Pessoal**: agendamentos, assinaturas e um painel "meu dia".
- **Bancos externos**: consultar (SELECT read-only) os bancos que a empresa cadastrou.

23 tools no total, filtradas pelos escopos da sua API key. Detalhes em [`skills/ziint/references/tools.md`](./skills/ziint/references/tools.md).

## Instalação rápida

### 1. Gere uma API key no Ziint

Um admin gera em **API Keys** (ou `POST /api/api-keys`) com os escopos que fizerem sentido (ex.: `forms:read`, `responses:read`, `analytics:read`). Exporte no ambiente:

```bash
export ZIINT_API_KEY="ziint_live_xxx"
```

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

O plugin já aponta o MCP para você (lê `ZIINT_API_KEY` do ambiente). Para configuração manual por plataforma (Claude Code CLI, Codex `config.toml`, OpenCode `opencode.json`, ponte `mcp-remote`), veja [`skills/ziint/references/setup.md`](./skills/ziint/references/setup.md).

### 4. Verifique

```bash
npm run doctor            # ou: node skills/ziint/scripts/ziint-doctor.mjs
```

Lista as tools e escopos que sua chave enxerga. Se aparecerem, está pronto.

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

- `/ziint:conectar` — conecta e diagnostica o MCP.
- `/ziint:relatorio [foco]` — relatório executivo dos dados.
- `/ziint:dashboard <descrição>` — cria um dashboard com preview antes de gravar.

## Segurança

- A empresa é **fixada na API key** — a IA só acessa os dados daquela empresa.
- Escopos = menor privilégio; chaves read-only nem enxergam tools de escrita.
- Escrita (respostas/dashboards) sempre passa por `dryRun` + confirmação, é idempotente e auditada.
- Gráficos/CSVs vão para um bucket público — a skill avisa antes de incluir dados sensíveis.

## Licença

MIT — ver [LICENSE](./LICENSE).
