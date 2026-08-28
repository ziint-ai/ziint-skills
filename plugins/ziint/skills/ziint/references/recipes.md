# Receitas ponta-a-ponta

Sequências completas para os pedidos mais comuns. Substituir `<...>` pelos valores descobertos — nunca inventados.

## 1. Relatório semanal de um formulário (com gráfico)

Pedido típico: *"Como foi a semana do formulário de auditoria?"*

```
1. list_forms { search: "auditoria" }                       → formularioId
2. query_responses { formularioId, days: 7 }                → total da semana
3. query_responses { formularioId, groupBy: "status", days: 7 } → breakdown
4. query_responses { formularioId, groupBy: "day", days: 7 }    → série diária
5. generate_chart { type: "bar", title: "Respostas por dia — últimos 7 dias",
                    rows: <breakdown do passo 4> }          → link da imagem
```

Entregar: total, leitura do breakdown (comparar com `get_form_overview` se precisar de contexto histórico) e o gráfico. Lembrar: o gráfico vai para S3 público — sem PII no título/labels.

## 2. Agregação por campo ("soma de horas extras por setor")

```
1. list_forms { search: "horas" }            → formularioId
2. get_form_fields { formularioId }          → fieldId de "setor" e "horas extras"
3. query_responses { formularioId,
     groupBy: "<fieldId-setor>",
     aggregate: "sum", aggregateField: "<fieldId-horas>" }
4. (opcional) generate_chart { type: "pie", rows: <breakdown> }
```

Se `query_responses` devolver `{ error, validFields }`, usar um item de `validFields` e repetir. Para agrupar por atributo do respondente: `groupBy: "usuario.nome"` (ou `email|matricula|codigo|phone|uo`).

## 3. Exportar respostas para CSV

```
1. list_forms → formularioId ; get_form_fields → fieldIds desejados
2. query_responses { formularioId, select: [<fieldIds>], limit: 500, offset: 0 }
   → { mode: "rows", total, rows }
3. Se total > 500: repetir com offset += 500 e concatenar (máx 5000 linhas no CSV)
4. generate_csv { rows: <linhas>, filename: "respostas-auditoria.csv" }
```

⚠️ Linhas cruas contêm PII → confirmar com o usuário antes do passo 4 (o CSV fica em S3 público).

## 4. Criar uma resposta em nome do usuário

```
1. list_forms → formularioId
2. get_form_fields { formularioId }   → fieldIds, tipos, options
3. Montar respostas: { "<fieldId>": valor } — em campos com options usar o VALUE;
   isMulti aceita array
4. create_response { formularioId, respostas, dryRun: true }
   → revisar validation (missingRequired / invalidOptions / unknownFields)
5. Mostrar o preview ao usuário e aguardar confirmação explícita
6. create_response { formularioId, respostas, idempotencyKey: "<tarefa-única>" }
   → { ok, responseId }
```

A resposta é criada como o dono da API key e dispara workflow/notificações normalmente — avisar o usuário disso no preview.

## 5. Dashboard de um formulário

Fluxo completo em `dashboards.md`. Resumo: descobrir campos → validar agregação com `query_responses` → `create_dashboard` `dryRun: true` → confirmar → real.

## 6. Consultar banco de dados externo ("banco de vendas")

```
1. list_database_connections { search: "vendas" } → connectionId
2. get_database_connection → LER a documentação do banco (contexto, tabelas, regras)
   da conexão — montar o SQL só depois disso
3. query_database { connectionId, sql: "SELECT ... FROM ... WHERE ...", maxRows: 500 }
4. Se truncated: refinar com WHERE/agregação, ou paginar a análise
5. (opcional) generate_chart / generate_csv com o resultado
```

Só `SELECT`/`WITH ... SELECT` — o servidor bloqueia mutações e stacked queries. Respeitar as regras descritas na documentação do banco (dialeto, nomes de tabela, joins recomendados).

## 7. "Meu dia" / pendências pessoais

```
get_user_summary { upcomingDays: 7 }
```

Uma chamada só: workflow pendente, assinaturas, agendamentos, treinamentos, notificações, gamificação e timeline — tudo do dono da API key. Usar `sections` para respostas mais curtas (ex.: `["workflow","signatures"]`).

## 8. Diagnóstico de workflow ("onde o processo trava?")

```
1. list_forms → formularioId (form com workflowHabilitado: true)
2. get_workflow_analytics { formularioId, topN: 10 }
   → stepCounts (etapa que concentra ações), actorCounts (quem age),
     avgHoursFromSubmission (lentidão), topComments (motivos)
3. Cruzar com query_responses { formularioId, groupBy: "status" } para o estoque atual
```

## 9. Relatório executivo da empresa

```
1. get_system_report { report: "summary" }
2. get_system_report { report: "trends", months: 6 }
3. get_system_report { report: "responses_by_form", limit: 10 }
4. generate_chart com as séries relevantes
```

Combinar com `get_gamification { view: "leaderboard" }` quando o usuário quiser engajamento.
