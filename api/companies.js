/* Largest Malaysian companies by market cap.
   Market cap = live price x shares outstanding, from Financial Modeling Prep
   (one batched /quote call). EOD/last-close on the free tier. Falls back to
   the committed snapshot when no key is set or the upstream is unavailable. */
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "public, max-age=21600, s-maxage=21600, stale-while-revalidate=86400");
  if (req.method === "OPTIONS") return res.status(204).end();

  const base = `https://${req.headers.host}`;
  const KEY = process.env.FMP_API_KEY;

  // roster (names, sectors, symbols, fallback caps) is the site's own static file
  let roster = [];
  try {
    const r = await fetch(base + "/data/companies.json");
    roster = (await r.json()).companies || [];
  } catch (e) {
    return res.status(502).json({ error: "roster unavailable" });
  }

  const snapshot = () => ({
    live: false,
    basis: "snapshot",
    asof: "2026-06-30",
    note: "Indicative snapshot. Add FMP_API_KEY to serve live last-close figures.",
    source: { name: "Bursa Malaysia (indicative)", url: "https://www.bursamalaysia.com" },
    companies: roster.slice().sort((a, b) => b.mcap_bn - a.mcap_bn)
      .map((c, i) => ({ rank: i + 1, name: c.name, ticker: c.ticker, sector: c.sector, mcap_bn: c.mcap_bn, price: null, change_pct: null }))
  });

  if (!KEY) return res.status(200).json(snapshot());

  try {
    const syms = roster.map((c) => c.sym).filter(Boolean).join(",");
    const r = await fetch(`https://financialmodelingprep.com/api/v3/quote/${syms}?apikey=${KEY}`);
    if (!r.ok) throw new Error(r.status);
    const quotes = await r.json();
    if (!Array.isArray(quotes) || !quotes.length) throw new Error("empty");
    const byS = {};
    for (const q of quotes) byS[q.symbol] = q;

    if (req.query && req.query.debug) {
      return res.status(200).json({
        fmp_returned: quotes.length,
        sample: quotes[0] ? { symbol: quotes[0].symbol, name: quotes[0].name, price: quotes[0].price, marketCap: quotes[0].marketCap } : null,
        matched_symbols: roster.map((c) => c.sym).filter((s) => byS[s]).length,
        missing_symbols: roster.map((c) => c.sym).filter((s) => !byS[s])
      });
    }

    const rows = roster.map((c) => {
      const q = byS[c.sym];
      const cap = q && q.marketCap ? q.marketCap / 1e9 : c.mcap_bn;
      return {
        name: c.name, ticker: c.ticker, sector: c.sector,
        mcap_bn: Number(cap.toFixed(2)),
        price: q && q.price != null ? Number(q.price) : null,
        change_pct: q && q.changesPercentage != null ? Number(Number(q.changesPercentage).toFixed(2)) : null,
        live: !!(q && q.marketCap)
      };
    }).sort((a, b) => b.mcap_bn - a.mcap_bn).map((r2, i) => ({ rank: i + 1, ...r2 }));

    const matched = rows.filter((r2) => r2.live).length;
    res.status(200).json({
      live: matched > 0,
      basis: "last close",
      asof: new Date().toISOString().slice(0, 10),
      matched, total: rows.length,
      note: "Market cap = last-close price x shares outstanding. Figures are end-of-day, not intraday.",
      source: { name: "Financial Modeling Prep (Bursa Malaysia listings)", url: "https://financialmodelingprep.com", retrieved: new Date().toISOString() },
      provider: "Greater Malaysia (greatermalaysia.com)",
      companies: rows
    });
  } catch (e) {
    const snap = snapshot();
    snap.note = "Live feed unavailable; showing indicative snapshot.";
    res.status(200).json(snap);
  }
}
