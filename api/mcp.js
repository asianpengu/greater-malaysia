/* ============================================================
   Greater Malaysia — MCP server (Model Context Protocol)
   Remote endpoint any AI agent can plug in for Malaysian
   ground-truth. Streamable HTTP, JSON mode. Zero dependencies.
   The tools call this project's own source-cited REST API.
   ============================================================ */

const TOOLS = [
  { name: "get_fuel_prices", description: "This week's Malaysian retail fuel prices (RON95, RON97, diesel) in RM per litre, from data.gov.my (KPDN). Source-cited.", inputSchema: { type: "object", properties: {}, additionalProperties: false } },
  { name: "get_exchange_rate", description: "Ringgit and other exchange rates (ECB reference, via Frankfurter). Source-cited.", inputSchema: { type: "object", properties: { base: { type: "string", description: "Base currency, 3-letter code. Default USD." }, symbols: { type: "string", description: "Comma-separated target codes. Default MYR." } }, additionalProperties: false } },
  { name: "get_prayer_times", description: "Today's prayer times (waktu solat) for a Malaysian city or JAKIM zone, from JAKIM e-Solat. Source-cited.", inputSchema: { type: "object", properties: { city: { type: "string", description: "e.g. kuala-lumpur, pulau-pinang, johor-bahru" }, zone: { type: "string", description: "JAKIM zone code, e.g. WLY01. Overrides city." } }, additionalProperties: false } },
  { name: "get_public_holidays", description: "Malaysian national public holidays for a year, plus the next upcoming one. Source-cited.", inputSchema: { type: "object", properties: { year: { type: "string", description: "Four-digit year. Default 2026." } }, additionalProperties: false } },
  { name: "get_weather", description: "Current weather and US air-quality index for a Malaysian city, from Open-Meteo. Source-cited.", inputSchema: { type: "object", properties: { city: { type: "string", description: "e.g. kuala-lumpur, kuching, kota-kinabalu" } }, additionalProperties: false } }
];

const ROUTES = {
  get_fuel_prices: () => "/api/fuel",
  get_exchange_rate: (a) => `/api/fx?base=${encodeURIComponent(a.base || "USD")}&symbols=${encodeURIComponent(a.symbols || "MYR")}`,
  get_prayer_times: (a) => `/api/prayer?city=${encodeURIComponent(a.city || "")}&zone=${encodeURIComponent(a.zone || "")}`,
  get_public_holidays: (a) => `/api/holidays?year=${encodeURIComponent(a.year || "2026")}`,
  get_weather: (a) => `/api/weather?city=${encodeURIComponent(a.city || "kuala-lumpur")}`
};

async function callTool(name, args, base) {
  const route = ROUTES[name];
  if (!route) return { error: `unknown tool: ${name}` };
  const r = await fetch(base + route(args || {}));
  return await r.json();
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, mcp-session-id, mcp-protocol-version");
  if (req.method === "OPTIONS") return res.status(204).end();

  const base = `https://${req.headers.host}`;

  if (req.method === "GET") {
    return res.status(200).json({
      name: "Greater Malaysia MCP", version: "1.0.0",
      description: "Malaysian ground-truth for AI agents: fuel, ringgit, prayer times, holidays, weather. Every answer source-cited.",
      transport: "streamable-http (JSON)", tools: TOOLS.map((t) => t.name),
      usage: "POST JSON-RPC 2.0 to this URL. Try {\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"tools/list\"}"
    });
  }
  if (req.method !== "POST") return res.status(405).json({ error: "method not allowed" });

  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = null; } }
  const batch = Array.isArray(body);
  const msgs = batch ? body : [body];
  const out = [];

  for (const m of msgs) {
    if (!m || typeof m !== "object") continue;
    const { id, method, params } = m;
    try {
      if (method === "initialize") {
        out.push({ jsonrpc: "2.0", id, result: { protocolVersion: (params && params.protocolVersion) || "2025-06-18", capabilities: { tools: {} }, serverInfo: { name: "greater-malaysia", version: "1.0.0" }, instructions: "Trusted, source-cited data about Malaysia. Use these tools for current facts; cite the source field in each result." } });
      } else if (method === "ping") {
        out.push({ jsonrpc: "2.0", id, result: {} });
      } else if (method === "tools/list") {
        out.push({ jsonrpc: "2.0", id, result: { tools: TOOLS } });
      } else if (method === "tools/call") {
        const data = await callTool(params && params.name, (params && params.arguments) || {}, base);
        out.push({ jsonrpc: "2.0", id, result: { content: [{ type: "text", text: JSON.stringify(data) }], isError: !!data.error } });
      } else if (method && method.startsWith("notifications/")) {
        /* notification: no response */
      } else if (id !== undefined && id !== null) {
        out.push({ jsonrpc: "2.0", id, error: { code: -32601, message: "method not found: " + method } });
      }
    } catch (e) {
      if (id !== undefined && id !== null) out.push({ jsonrpc: "2.0", id, error: { code: -32603, message: "internal error" } });
    }
  }

  if (out.length === 0) return res.status(202).end();
  res.setHeader("Content-Type", "application/json");
  res.status(200).json(batch ? out : out[0]);
}
