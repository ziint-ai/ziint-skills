---
description: Cria um dashboard no Ziint a partir de uma descrição em linguagem natural (fluxo guiado com preview antes de gravar).
argument-hint: "<o que o dashboard deve mostrar, ex.: 'distribuição por status do formulário de auditoria'>"
---

Crie um dashboard no Ziint para o objetivo: **$ARGUMENTS**.

Siga o fluxo seguro descrito na skill `ziint`, referência `references/dashboards.md` (ou o resource MCP `ziint://docs/dashboard-spec`, se o cliente suportar). Requer a chave com escopo `dashboards:write`.

Passos obrigatórios:

1. **Descobrir os dados:** `list_forms` (e `get_form_fields` se precisar de campos específicos) e/ou `list_datasources` para fontes existentes. Nunca invente `formularioId`/`fieldId`.
2. **Validar a agregação:** rode `query_responses` (ou `get_datasource_data`) com o mesmo `groupBy`/`aggregate` que o widget usará, para confirmar que o dado existe e tem a forma esperada.
3. **Montar a spec** de `create_dashboard` (painéis, widgets, posições no grid 24×24, fontes). Fontes inline permitidas: apenas `formulario` e `users` — nunca `consulta_sql`.
4. **Preview:** chame `create_dashboard` com `dryRun: true`. Mostre ao usuário o que será criado e trate `validation.errors` (bloqueiam) e `warnings` (ajuste se fizer sentido).
5. **Confirmação explícita:** só depois do "ok" do usuário, chame `create_dashboard` de verdade, com uma `idempotencyKey` única.
6. Responda com o `dashboardId` criado e um resumo dos painéis/widgets montados.

Se o objetivo estiver vago, faça 1–2 perguntas objetivas (qual formulário, quais métricas) antes do passo 1.
