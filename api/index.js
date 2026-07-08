/* Greater Malaysia — API catalog. The Malaysian ground-truth layer for agents. */
export default function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "public, max-age=3600");
  res.status(200).json({
    name: "Greater Malaysia — Malaysian ground-truth API",
    description: "Clean, current, source-cited data about Malaysia for humans and AI agents. Every value links to its official primary source.",
    site: "https://greatermalaysia.com",
    docs: "https://greatermalaysia.com/for-agents",
    mcp: "https://greatermalaysia.com/api/mcp",
    principle: "signal over noise, always sourced",
    license: "Figures derive from official Malaysian open data; cite the primary source in each response.",
    endpoints: [
      { path: "/api/fuel", desc: "Weekly retail fuel prices: RON95, RON97, diesel (RM/litre)" },
      { path: "/api/fx?base=USD&symbols=MYR", desc: "Ringgit exchange rates (ECB reference)" },
      { path: "/api/prayer?city=kuala-lumpur", desc: "Prayer times (waktu solat) today, by city or JAKIM zone" },
      { path: "/api/holidays?year=2026", desc: "Malaysian national public holidays + the next one" },
      { path: "/api/weather?city=kuala-lumpur", desc: "Current weather and US air-quality index" }
    ]
  });
}
