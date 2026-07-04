---
description: Conecta e diagnostica o MCP Server do Ziint (verifica a API key, lista as tools e escopos disponíveis).
argument-hint: "[url opcional, ex.: http://localhost:3000/api/mcp]"
---

Ajude o usuário a conectar o Ziint via MCP e confirme que está funcionando.

Contexto: a skill `ziint` (instalada com este plugin) e sua referência `references/setup.md` explicam a conexão por plataforma. O MCP server deste plugin já está declarado em `.mcp.json` apontando para `https://api.ziint.com/api/mcp`, lendo a chave de `${ZIINT_API_KEY}`.

Passos:

1. Verifique se a variável de ambiente `ZIINT_API_KEY` está definida. Se não estiver, explique que o usuário precisa gerar uma API key no Ziint (um admin, via `POST /api/api-keys`) e exportá-la — sem colar a chave em arquivos versionados. Aponte os escopos recomendados conforme o uso pretendido (ver `references/setup.md`).

2. Rode o diagnóstico da skill:
   ```bash
   ZIINT_API_KEY="$ZIINT_API_KEY" node "${CLAUDE_PLUGIN_ROOT}/skills/ziint/scripts/ziint-doctor.mjs" ${1:+--url $1}
   ```

3. Interprete a saída:
   - Sucesso → liste as tools e escopos disponíveis e diga que o assistente já pode responder perguntas sobre o Ziint.
   - `401`/`403` → problema de chave/empresa; oriente conforme a tabela de troubleshooting de `references/setup.md`.
   - Conectou mas poucas/nenhuma tool → a chave está sem escopos; oriente o admin a editá-la.

4. Se o MCP `ziint` ainda não aparecer no cliente, confirme que o plugin está habilitado e que `ZIINT_API_KEY` foi exportada **antes** de abrir o Claude Code (o `.mcp.json` resolve a variável no start).
