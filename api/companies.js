/* Largest Malaysian companies by market cap.
   Serves a source-cited ranking. Live price comes from a configured provider
   (set via env); market cap = price x shares outstanding. Until a Bursa-capable
   provider is wired, it serves the committed indicative snapshot, clearly
   labelled, so the page never shows an unverified number as if it were live. */
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "public, max-age=21600, s-maxage=21600, stale-while-revalidate=86400");
  if (req.method === "OPTIONS") return res.status(204).end();

  const base = `https://${req.headers.host}`;
  let roster = [];
  try {
    const r = await fetch(base + "/data/companies.json");
    roster = (await r.json()).companies || [];
  } catch (e) {
    return res.status(502).json({ error: "roster unavailable" });
  }

  // Snapshot fallback — indicative, not live. Sorted by cap.
  res.status(200).json({
    live: false,
    basis: "snapshot",
    asof: "2026-06-30",
    note: "Indicative snapshot pending a live Bursa-capable data feed.",
    source: { name: "Bursa Malaysia (indicative)", url: "https://www.bursamalaysia.com" },
    provider: "Greater Malaysia (greatermalaysia.com)",
    companies: roster.slice().sort((a, b) => b.mcap_bn - a.mcap_bn)
      .map((c, i) => ({ rank: i + 1, name: c.name, ticker: c.ticker, sector: c.sector, mcap_bn: c.mcap_bn, price: null, change_pct: null }))
  });
}
