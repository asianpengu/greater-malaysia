/* Largest Malaysian companies by market cap.
   Live price from Twelve Data (Bursa Malaysia / MYX, mic XKLS); market cap =
   price x shares outstanding (shares_m from the roster). Prices are last-close
   on the free tier. Falls back to the labelled indicative snapshot when the key
   or feed is unavailable, so the page never presents an unverified number as live. */
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "public, max-age=21600, s-maxage=21600, stale-while-revalidate=86400");
  if (req.method === "OPTIONS") return res.status(204).end();

  const base = `https://${req.headers.host}`;
  const KEY = process.env.TWELVEDATA_API_KEY;

  let roster = [];
  try {
    const r = await fetch(base + "/data/companies.json");
    roster = (await r.json()).companies || [];
  } catch (e) {
    return res.status(502).json({ error: "roster unavailable" });
  }

  const snapshot = (note) => ({
    live: false, basis: "snapshot", asof: "2026-06-30",
    note: note || "Indicative snapshot pending a live data feed.",
    source: { name: "Bursa Malaysia (indicative)", url: "https://www.bursamalaysia.com" },
    provider: "Greater Malaysia (greatermalaysia.com)",
    companies: roster.slice().sort((a, b) => b.mcap_bn - a.mcap_bn)
      .map((c, i) => ({ rank: i + 1, name: c.name, ticker: c.ticker, sector: c.sector, mcap_bn: c.mcap_bn, price: null, change_pct: null }))
  });

  if (!KEY) return res.status(200).json(snapshot("Indicative snapshot. Add TWELVEDATA_API_KEY to serve live figures."));

  try {
    const allSyms = roster.map((c) => c.ticker).filter(Boolean);
    const syms = (req.query && req.query.diag ? allSyms.slice(0, 7) : allSyms).join(",");
    const r = await fetch(`https://api.twelvedata.com/quote?symbol=${syms}&mic_code=XKLS&apikey=${KEY}`);
    const raw = await r.text();
    let data; try { data = JSON.parse(raw); } catch (e) { data = null; }

    if (req.query && req.query.diag) {
      const m1 = data && data["1155"];
      return res.status(200).json({ http_status: r.status, keys: data ? Object.keys(data).slice(0, 8) : null, maybank: m1 ? { name: m1.name, close: m1.close, currency: m1.currency, percent_change: m1.percent_change, exchange: m1.exchange } : null, body_preview: raw.slice(0, 200) });
    }

    // Batch returns an object keyed by symbol; single returns a flat quote.
    const byT = data && data.symbol ? { [data.symbol]: data } : (data || {});
    let anyLive = false;
    const rows = roster.map((c) => {
      const q = byT[c.ticker];
      const price = q && q.close != null && q.status !== "error" ? parseFloat(q.close) : null;
      const cap = price != null && c.shares_m ? (price * c.shares_m / 1000) : c.mcap_bn;
      if (price != null) anyLive = true;
      return {
        name: c.name, ticker: c.ticker, sector: c.sector,
        mcap_bn: Number(cap.toFixed(2)),
        price: price != null ? Number(price.toFixed(3)) : null,
        change_pct: q && q.percent_change != null && q.status !== "error" ? Number(parseFloat(q.percent_change).toFixed(2)) : null
      };
    }).sort((a, b) => b.mcap_bn - a.mcap_bn).map((r2, i) => ({ rank: i + 1, ...r2 }));

    if (!anyLive) return res.status(200).json(snapshot("Live feed returned no prices; showing indicative snapshot."));

    res.status(200).json({
      live: true, basis: "last close", asof: new Date().toISOString().slice(0, 10),
      matched: rows.filter((r2) => r2.price != null).length, total: rows.length,
      note: "Market cap = last-close price (Twelve Data) x issued shares. Shares are being verified against Bursa filings.",
      source: { name: "Twelve Data (Bursa Malaysia / MYX) + issued-share counts", url: "https://twelvedata.com", retrieved: new Date().toISOString() },
      provider: "Greater Malaysia (greatermalaysia.com)",
      companies: rows
    });
  } catch (e) {
    res.status(200).json(snapshot("Live feed unavailable; showing indicative snapshot."));
  }
}
