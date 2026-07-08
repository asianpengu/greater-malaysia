/* Ringgit exchange rates, from the European Central Bank via Frankfurter. */
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "public, max-age=1800, s-maxage=1800");
  if (req.method === "OPTIONS") return res.status(204).end();
  const base = (req.query.base || "USD").toUpperCase().replace(/[^A-Z]/g, "").slice(0, 3) || "USD";
  const symbols = (req.query.symbols || "MYR").toUpperCase().replace(/[^A-Z,]/g, "") || "MYR";
  try {
    const r = await fetch(`https://api.frankfurter.dev/v1/latest?base=${base}&symbols=${symbols}`);
    if (!r.ok) throw new Error(r.status);
    const d = await r.json();
    res.status(200).json({
      dataset: "Exchange rates (ECB reference)",
      base: d.base, date: d.date, rates: d.rates,
      source: { name: "European Central Bank via Frankfurter", url: "https://frankfurter.dev", retrieved: new Date().toISOString() },
      provider: "Greater Malaysia (greatermalaysia.com)"
    });
  } catch (e) {
    res.status(502).json({ error: "upstream unavailable", source: "frankfurter.dev" });
  }
}
