/* Greater Malaysia — OpenAPI 3.1 spec for the ground-truth API.
   Lets agent frameworks (GPT Actions, LangChain, tool routers) and API
   tooling auto-discover and call the endpoints. Zero dependencies. */
export default function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "public, max-age=3600");
  const base = `https://${req.headers.host}`;

  const cited = { type: "object", description: "JSON with a `source` block ({name,url,retrieved}) on every response.", additionalProperties: true };
  const err = { description: "Upstream unavailable", content: { "application/json": { schema: { type: "object", properties: { error: { type: "string" } } } } } };
  const ok = (desc) => ({ description: desc, content: { "application/json": { schema: cited } } });
  const p = (name, desc, def) => ({ name, in: "query", required: false, description: desc + (def ? ` Default ${def}.` : ""), schema: { type: "string" } });

  res.status(200).json({
    openapi: "3.1.0",
    info: {
      title: "Greater Malaysia — Malaysian ground-truth API",
      version: "1.0.0",
      description: "Clean, current, source-cited data about Malaysia for humans and AI agents. Every value links to its official primary source. No API key. CORS-open. Also available as an MCP server at /api/mcp.",
      contact: { name: "Greater Malaysia", url: "https://greatermalaysia.com/for-agents", email: "hello@greatermalaysia.com" },
      license: { name: "Official Malaysian open data; cite the source in each response.", url: "https://greatermalaysia.com/for-agents" }
    },
    servers: [{ url: base, description: "Production" }],
    paths: {
      "/api/fuel": { get: { operationId: "getFuelPrices", summary: "This week's Malaysian retail fuel prices (RON95, RON97, diesel) in RM/litre. Source: data.gov.my (KPDN).", responses: { "200": ok("Fuel prices"), "502": err } } },
      "/api/fx": { get: { operationId: "getExchangeRate", summary: "Ringgit and other exchange rates (ECB reference, via Frankfurter).", parameters: [p("base", "Base currency, 3-letter code.", "USD"), p("symbols", "Comma-separated target codes.", "MYR")], responses: { "200": ok("Exchange rates"), "502": err } } },
      "/api/prayer": { get: { operationId: "getPrayerTimes", summary: "Today's prayer times (waktu solat) for a Malaysian city or JAKIM zone. Source: JAKIM e-Solat.", parameters: [p("city", "e.g. kuala-lumpur, pulau-pinang, johor-bahru."), p("zone", "JAKIM zone code, e.g. WLY01. Overrides city.")], responses: { "200": ok("Prayer times"), "502": err } } },
      "/api/holidays": { get: { operationId: "getPublicHolidays", summary: "Malaysian national public holidays for a year, plus the next upcoming one.", parameters: [p("year", "Four-digit year.", "2026")], responses: { "200": ok("Public holidays"), "502": err } } },
      "/api/weather": { get: { operationId: "getWeather", summary: "Current weather and US air-quality index for a Malaysian city. Source: Open-Meteo.", parameters: [p("city", "e.g. kuala-lumpur, kuching, kota-kinabalu.", "kuala-lumpur")], responses: { "200": ok("Weather + air quality"), "502": err } } },
      "/api/inflation": { get: { operationId: "getInflation", summary: "Malaysian headline inflation (CPI) and year-on-year rate. Source: DOSM.", responses: { "200": ok("Inflation"), "502": err } } },
      "/api/population": { get: { operationId: "getPopulation", summary: "Malaysia's total population, latest official figure. Source: DOSM.", responses: { "200": ok("Population"), "502": err } } },
      "/api/election": { get: { operationId: "getElection", summary: "Malaysia's next general election (GE16): must-be-held-by date, countdown, and how the system works.", responses: { "200": ok("Next election") } } },
      "/api/companies": { get: { operationId: "getCompanies", summary: "Largest Malaysian companies (Bursa Malaysia) ranked by market capitalisation.", responses: { "200": ok("Companies by market cap") } } }
    }
  });
}
