# Conectar o MCP do Ziint (por plataforma)

O servidor MCP do Ziint é remoto: `https://api.ziint.com/api/mcp`, transporte **Streamable HTTP**, autenticado pelo header `X-API-Key: ziint_live_<segredo>`. Cada plataforma configura o mesmo servidor de um jeito. Para ambiente local de testes, trocar a URL por `http://localhost:3000/api/mcp`.

## 1. Gerar a API key no Ziint

A empresa é **fixada na chave** — a IA só enxerga os dados daquela empresa. Um admin gera a chave (via UI ou API):

```bash
curl -X POST https://api.ziint.com/api/api-keys \
  -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" \
  -d '{ "nome": "Assistente IA — Analytics",
        "scopes": ["forms:read", "responses:read", "analytics:read"] }'
```

A chave (`ziint_live_...`) aparece **uma única vez** — copiar na hora. Guardar em variável de ambiente `ZIINT_API_KEY`, nunca em arquivo versionado.

⚠️ Chaves criadas **antes** de um domínio MCP existir não têm os escopos novos: regenerar ou editar (`PUT /api/api-keys/:id`).

### Escopos recomendados por caso de uso

| Caso de uso | Escopos |
|---|---|
| Perguntas e relatórios (read-only) | `forms:read`, `responses:read`, `analytics:read` |
| + Ler dashboards | adicionar `dashboards:read` |
| + Criar respostas | adicionar `responses:write` |
| + Criar/editar dashboards | adicionar `dashboards:write` |
| + Agendamentos / assinaturas | adicionar `scheduling:read` / `signatures:read` |
| + Bancos externos | adicionar `database:read` |

Princípio do menor privilégio: dar `:write` só a chaves que realmente precisam. Uma chave read-only nem enxerga as tools de escrita no `tools/list`.

## 2. Configuração por plataforma

### Claude Code (recomendado: CLI)

```bash
claude mcp add --transport http ziint https://api.ziint.com/api/mcp \
  --header "X-API-Key: ${ZIINT_API_KEY}"
```

Ou instalar o **plugin oficial** (traz a skill + o MCP já apontado + comandos `/ziint:*`):

```bash
/plugin marketplace add ziint-ai/ziint-skills
/plugin install ziint@ziint
```

O plugin lê a chave de `${ZIINT_API_KEY}` no ambiente — exportar antes de abrir o Claude Code.

### Codex

`~/.codex/config.toml`:

```toml
[mcp_servers.ziint]
transport = "streamable_http"
url = "https://api.ziint.com/api/mcp"
# Header custom: se a build do Codex suportar `headers`, usar:
# headers = { "X-API-Key" = "ziint_live_<segredo>" }
```

Se a build do Codex **não** aceitar header custom no config, usar a ponte `mcp-remote` (ver §3).

### OpenCode

`opencode.json` (projeto) ou `~/.config/opencode/opencode.json` (global):

```json
{
  "mcp": {
    "ziint": {
      "type": "remote",
      "url": "https://api.ziint.com/api/mcp",
      "enabled": true,
      "headers": { "X-API-Key": "ziint_live_<segredo>" }
    }
  }
}
```

### Cursor / Windsurf / Claude Desktop (via ponte stdio)

Clientes que só falam MCP local (`stdio`) usam `mcp-remote` como ponte (ver §3).

## 3. Ponte universal `mcp-remote` (fallback para qualquer cliente stdio)

Traduz `stdio` ↔ Streamable HTTP e injeta o header:

```json
{
  "mcpServers": {
    "ziint": {
      "command": "npx",
      "args": [
        "-y", "mcp-remote",
        "https://api.ziint.com/api/mcp",
        "--header", "X-API-Key:ziint_live_<segredo>"
      ]
    }
  }
}
```

Esse bloco funciona em Claude Desktop, Cursor, Windsurf e qualquer cliente que aceite `mcpServers` com `command`.

## 4. Verificar a conexão

Rodar o diagnóstico incluído na skill (Node ≥ 18, sem dependências):

```bash
ZIINT_API_KEY=ziint_live_<segredo> node scripts/ziint-doctor.mjs
# local: adicionar  --url http://localhost:3000/api/mcp
```

Saída esperada: `OK` + lista de tools disponíveis + escopos inferidos da chave. Se listar as tools, a conexão está boa e o cliente MCP vai enxergar as mesmas tools.

## 5. Troubleshooting

| Sintoma | Causa provável | Correção |
|---|---|---|
| `401 API_KEY_MISSING` | Header não chegou | Conferir nome exato `X-API-Key` e o valor sem espaços |
| `401 API_KEY_INVALID` / `API_KEY_EXPIRED` | Chave errada/expirada | Gerar nova chave |
| `403 API_KEY_INACTIVE` / `..._COMPANY_INACTIVE` | Chave/empresa desativada | Falar com o admin do Ziint |
| Conecta mas `tools/list` vem curto | Chave sem escopos suficientes | Editar a chave adicionando escopos (tabela acima) |
| `405` em GET/DELETE | Normal — servidor é stateless | Ignorar; o cliente MCP usa só POST |
| Cliente não envia `Accept` correto | cURL manual | Incluir `Accept: application/json, text/event-stream` |
| Codex/Cursor não aceita header | Build sem suporte a header custom | Usar a ponte `mcp-remote` (§3) |
