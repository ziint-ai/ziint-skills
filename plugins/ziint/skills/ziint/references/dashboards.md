# Criar e editar dashboards do Ziint via MCP

Spec operacional de `create_dashboard` / `update_dashboard` / `delete_dashboard` (escopo `dashboards:write`). Se o cliente MCP suportar resources, o resource `ziint://docs/dashboard-spec` traz a versão canônica desta spec direto do servidor — preferi-lo quando disponível.

## Fluxo obrigatório de criação

1. **Descobrir os dados**: `list_forms` → `get_form_fields` (fieldIds e tipos) e/ou `list_datasources` (fontes já existentes).
2. **Validar a agregação**: rodar `query_responses` (ou `get_datasource_data`) com o mesmo `groupBy`/`aggregate` que o widget usará — confirma que o dado existe e tem a forma esperada.
3. **Montar a spec** (abaixo) e chamar `create_dashboard` com `dryRun: true`.
4. **Mostrar o preview ao usuário** (nome, painéis, widgets, fontes) e tratar `validation.errors`/`warnings`.
5. Após confirmação explícita: `create_dashboard` real com `idempotencyKey`.

A criação é **atômica**: dashboard + painéis + widgets + fontes numa transação — ou grava tudo, ou nada.

## Spec de `create_dashboard`

```jsonc
{
  "nome": "Vendas — Visão Geral",            // ✅
  "descricao": "…", "grupo": "vendas", "icone": "chart-line",
  "tags": ["vendas"],                          // ≤ 20
  "publico": false,                            // padrão false
  "paineis": [                                 // ✅ 1–8 painéis
    {
      "nome": "Resumo",                        // ✅
      "icone": "gauge",
      "objetos": [                             // ≤ 20 widgets por painel
        {
          "nome": "Respostas por status",      // ✅
          "tipo": "grafico",                   // ✅ ver tipos abaixo
          "posicao": { "x": 0, "y": 0, "width": 12, "height": 6 },  // ✅
          "fonteDadosId": "<uuid existente>",  // XOR com fonteDados
          // OU criar fonte nova inline:
          "fonteDados": {
            "nome": "Respostas do form X",
            "tipo": "formulario",              // só "formulario" ou "users"
            "configuracao": { "formularioId": "<uuid>" }
          },
          "configuracoes": { "grafico": { "tipoGrafico": "pizza" } }
        }
      ]
    }
  ],
  "idempotencyKey": "dash-vendas-2026-07",     // best-effort
  "dryRun": true
}
```

### Tipos de widget (`objetos[].tipo`)

`tabela` · `cartao` · `grafico` · `mapa` · `calendario` · `info` · `leaderboard` · `workflow`

### Grid de posição

`posicao: { x, y, width, height }` — grid de **10 colunas**, altura útil de **12 linhas**; `x + width` não pode passar de 10. Cada tipo tem largura mínima/máxima própria (`cartao` no máximo 6, `tabela`/`grafico`/`mapa` até 10) — fora dela o front recorta **em silêncio**, e `create_dashboard` trata isso como erro. Widgets sobrepostos também são **erro** (use `permitirSobreposicao: true` no painel se for intencional). Layout típico: cards de KPI com `width: 5, height: 3`; gráficos com `width: 5, height: 4`; tabelas full-width com `width: 10, height: 5`. A lista completa de limites vem de `get_dashboard_capabilities`.

### `configuracoes` por tipo (shapes principais)

```jsonc
// tipo: "grafico"
{ "grafico": {
    "tipoGrafico": "linha" | "barras" | "pizza" | "area" | "scatter" | "gauge",
    "campoX": "…", "campoY": "…",
    "agrupamento": "…", "agregacao": "count|sum|avg|min|max",
    "cores": ["#007bff"], "mostrarLegenda": true, "mostrarValores": false } }

// tipo: "tabela"
{ "tabela": {
    "colunas": [{ "campo": "…", "titulo": "…", "tipo": "texto|numero|data|imagem|link|badge",
                  "largura?": "…", "formatacao?": "…", "ordenavel?": true, "filtravel?": true }],
    "paginacao": true, "tamanhoPagina": 10, "filtrosLocais": true, "exportavel": true } }

// tipo: "cartao"
{ "cartao": {
    "template": "{{total}} respostas",        // Mustache sobre os dados da fonte
    "estilos": { "corFundo?": "…", "corTexto?": "…", "tamanhoFonte?": "…", "alinhamento?": "left|center|right" },
    "alertas": [{ "condicao": "total > 100", "corAlerta?": "#f00", "somAlerta?": false }] } }
```

`grafico` sem `configuracoes.grafico.tipoGrafico` gera `warning`.

### Regras de fontes de dados

- **Criável inline via MCP**: apenas `tipo: "formulario"` (exige `configuracao.formularioId` da empresa) e `tipo: "users"`.
- **NUNCA criável via MCP**: `consulta_sql` (SQL só pode ser autorado por admin na UI), `api`, `file`, `workflow`, `company`.
- Um widget **pode referenciar** qualquer fonte já existente (inclusive `consulta_sql` criada por admin) via `fonteDadosId`.
- `fonteDadosId` e `fonteDados` juntos no mesmo widget = erro.

### Validação do retorno

- `validation.errors` → **bloqueia** (ex.: `fonteDadosId` de outra empresa, XOR violado, `formularioId` inválido). Corrigir e repetir o `dryRun`.
- `validation.warnings` → não bloqueia (ex.: posições sobrepostas). Relatar ao usuário e ajustar se fizer sentido.

## `update_dashboard` — patch por operações

Nunca reenviar a árvore inteira; aplicar só as mudanças (1–20 operações por chamada, transacional):

| `op` | Args | Efeito |
|---|---|---|
| `update_meta` | `nome?, descricao?, tags?, publico?, configuracoes?, ativo?` | `configuracoes` faz **merge raso** |
| `add_painel` | `painel` (mesma spec do create) | Adiciona ao final |
| `update_painel` | `painelId, nome?, icone?, configuracoes?, ativo?` | Patch parcial |
| `remove_painel` | `painelId` | Desvincula deste dashboard |
| `add_objeto` | `painelId, objeto` (mesma spec do create) | Adiciona widget |
| `update_objeto` | `objetoId, nome?, posicao?, configuracoes?, fonteDadosId?, ativo?` | Patch parcial |
| `remove_objeto` | `objetoId` | Soft delete |

Usar `dryRun: true` também aqui quando a mudança for grande. `painelId`/`objetoId` vêm de `get_dashboard` — nunca de memória.

**Permissões**: editar/desativar exige ser o criador do dashboard ou admin/gerente da empresa. `delete_dashboard` é sempre soft delete (reversível pela UI).

## Exemplo mínimo completo

Pedido: *"Crie um dashboard com a distribuição por status do formulário de auditoria."*

1. `list_forms { search: "auditoria" }` → `formularioId`.
2. `query_responses { formularioId, groupBy: "status" }` → confirma que há dados.
3. `create_dashboard` com `dryRun: true`:
   - painel "Visão Geral" com 1 widget `grafico` (pizza), `fonteDados: { tipo: "formulario", configuracao: { formularioId } }`, `posicao: {x:0,y:0,width:12,height:6}`.
4. Mostrar preview → usuário confirma → chamada real com `idempotencyKey`.
5. Responder com o `dashboardId` criado e o que foi montado.
