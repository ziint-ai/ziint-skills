#!/usr/bin/env node
// ziint-doctor — diagnostica a conexão com o MCP Server do Ziint.
// Faz o handshake JSON-RPC (initialize -> tools/list) usando a API key e imprime
// as tools disponíveis + os escopos inferidos a partir delas.
//
// Uso:
//   ZIINT_API_KEY=ziint_live_xxx node ziint-doctor.mjs
//   node ziint-doctor.mjs --key ziint_live_xxx --url http://localhost:3000/api/mcp
//
// Requisitos: Node >= 18 (usa fetch nativo). Sem dependências externas.

const DEFAULT_URL = 'https://api.ziint.com/api/mcp';

// Mapa tool -> escopo, para inferir os escopos da chave a partir do tools/list.
// Espelha o catálogo de plans/mcp/mcp-server.md (§4.2 / §6).
const TOOL_SCOPES = {
  list_forms: 'forms:read',
  get_form_overview: 'forms:read',
  get_form_fields: 'forms:read',
  query_responses: 'responses:read',
  create_response: 'responses:write',
  analyze_form: 'analytics:read',
  get_workflow_analytics: 'analytics:read',
  generate_chart: 'analytics:read',
  generate_csv: 'analytics:read',
  get_system_report: 'analytics:read',
  get_gamification: 'analytics:read',
  get_user_summary: 'analytics:read',
  list_bookings: 'scheduling:read',
  list_signature_documents: 'signatures:read',
  list_dashboards: 'dashboards:read',
  get_dashboard: 'dashboards:read',
  list_datasources: 'dashboards:read',
  get_datasource_data: 'dashboards:read',
  create_dashboard: 'dashboards:write',
  update_dashboard: 'dashboards:write',
  delete_dashboard: 'dashboards:write',
  list_database_connections: 'database:read',
  query_database: 'database:read',
};

function parseArgs(argv) {
  const out = { url: DEFAULT_URL, key: process.env.ZIINT_API_KEY };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--url') out.url = argv[++i];
    else if (a === '--key') out.key = argv[++i];
    else if (a === '--help' || a === '-h') out.help = true;
  }
  return out;
}

function help() {
  console.log(`ziint-doctor — diagnostica a conexão com o MCP do Ziint

Uso:
  ZIINT_API_KEY=ziint_live_xxx node ziint-doctor.mjs
  node ziint-doctor.mjs --key ziint_live_xxx --url http://localhost:3000/api/mcp

Opções:
  --key <chave>   API key (ou via env ZIINT_API_KEY)
  --url <url>     Endpoint MCP (padrão: ${DEFAULT_URL})
  --help          Esta ajuda`);
}

// O transporte Streamable HTTP pode responder como JSON puro ou como um
// stream SSE (text/event-stream). Esta função entende os dois.
async function rpc(url, key, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'X-API-Key': key,
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
    },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  if (!res.ok) {
    const err = new Error(`HTTP ${res.status}`);
    err.status = res.status;
    err.body = text;
    throw err;
  }

  const ct = res.headers.get('content-type') || '';
  if (ct.includes('text/event-stream')) {
    // Extrai o último payload `data:` do stream SSE.
    const dataLines = text
      .split('\n')
      .filter((l) => l.startsWith('data:'))
      .map((l) => l.slice(5).trim())
      .filter(Boolean);
    if (!dataLines.length) throw new Error('Resposta SSE sem payload data:');
    return JSON.parse(dataLines[dataLines.length - 1]);
  }
  return JSON.parse(text);
}

async function main() {
  const { url, key, help: wantHelp } = parseArgs(process.argv);
  if (wantHelp) return help();

  if (!key) {
    console.error('✗ Nenhuma API key. Defina ZIINT_API_KEY ou passe --key ziint_live_...');
    process.exit(2);
  }

  console.log(`→ Testando ${url}`);
  console.log(`→ Chave: ${key.slice(0, 12)}…${key.slice(-4)}\n`);

  // 1) initialize
  try {
    const init = await rpc(url, key, {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2025-06-18',
        capabilities: {},
        clientInfo: { name: 'ziint-doctor', version: '1.0.0' },
      },
    });
    const info = init?.result?.serverInfo;
    console.log(`✓ Handshake OK${info ? ` — servidor: ${info.name} ${info.version || ''}`.trimEnd() : ''}`);
  } catch (e) {
    console.error(`✗ Falha no handshake: ${e.message}`);
    if (e.status === 401) console.error('  → API key ausente ou inválida. Verifique a chave e o header X-API-Key.');
    if (e.status === 403) console.error('  → Chave ou empresa desativada. Fale com o admin do Ziint.');
    if (e.body) console.error(`  → Corpo: ${e.body.slice(0, 300)}`);
    process.exit(1);
  }

  // 2) tools/list
  let tools = [];
  try {
    const list = await rpc(url, key, { jsonrpc: '2.0', id: 2, method: 'tools/list' });
    tools = list?.result?.tools || [];
  } catch (e) {
    console.error(`✗ Falha ao listar tools: ${e.message}`);
    process.exit(1);
  }

  if (!tools.length) {
    console.warn('\n⚠ Conectou, mas nenhuma tool disponível — a chave provavelmente não tem escopos.');
    console.warn('  Edite a chave adicionando escopos (ex.: forms:read, responses:read, analytics:read).');
    process.exit(0);
  }

  const names = tools.map((t) => t.name).sort();
  console.log(`✓ ${names.length} tools disponíveis:\n`);
  for (const n of names) {
    const scope = TOOL_SCOPES[n] ? `  [${TOOL_SCOPES[n]}]` : '';
    console.log(`   • ${n}${scope}`);
  }

  const scopes = [...new Set(names.map((n) => TOOL_SCOPES[n]).filter(Boolean))].sort();
  console.log(`\n✓ Escopos inferidos da chave: ${scopes.join(', ') || '(nenhum reconhecido)'}`);
  console.log('\nTudo certo. O seu cliente MCP vai enxergar exatamente estas tools.');
}

main().catch((e) => {
  console.error(`✗ Erro inesperado: ${e.message}`);
  process.exit(1);
});
