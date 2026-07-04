---
description: Gera um relatório executivo dos dados do Ziint (visão geral da empresa, tendências, formulários e, opcionalmente, gráficos).
argument-hint: "[foco opcional, ex.: 'último mês', 'formulário de auditoria', 'engajamento']"
---

Monte um relatório executivo usando as tools MCP do Ziint. Foco do usuário: **$ARGUMENTS** (se vazio, faça um panorama geral da empresa).

Use a skill `ziint` para os detalhes de cada tool. Fluxo recomendado (adapte ao foco):

1. **Panorama da empresa:** `get_system_report { report: "summary" }`.
2. **Tendência:** `get_system_report { report: "trends", months: 6 }` (ou a janela que o foco pedir).
3. **Por formulário:** `get_system_report { report: "responses_by_form", limit: 10 }`. Se o foco citar um formulário específico, use `list_forms` → `get_form_overview` → `query_responses` (com `groupBy: "status"` e/ou `"day"`).
4. **Engajamento (se relevante):** `get_gamification { view: "leaderboard" }`.
5. **Visualização (opcional):** ofereça gerar `generate_chart` com as séries mais relevantes. Antes de gerar, lembre que a imagem vai para um bucket público — confirme se não há dados sensíveis nos rótulos.

Entregue um resumo em linguagem natural com os números exatos retornados pelas tools (nunca estime), destaque tendências e finalize com 2–3 observações acionáveis. Se alguma tool retornar erro de escopo, informe qual escopo falta e siga com o que for possível.
