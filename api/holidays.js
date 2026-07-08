/* Malaysian national public holidays (curated from official gazette). */
const HOLIDAYS = {
  "2026": [
    { date: "2026-01-01", name: "New Year's Day" }, { date: "2026-02-17", name: "Chinese New Year" },
    { date: "2026-02-18", name: "Chinese New Year (2nd Day)" }, { date: "2026-03-20", name: "Hari Raya Aidilfitri (additional)" },
    { date: "2026-03-21", name: "Hari Raya Aidilfitri" }, { date: "2026-03-23", name: "Hari Raya Aidilfitri (replacement)" },
    { date: "2026-05-01", name: "Labour Day" }, { date: "2026-05-27", name: "Hari Raya Haji (Aidiladha)" },
    { date: "2026-05-31", name: "Wesak Day" }, { date: "2026-06-01", name: "Birthday of the Yang di-Pertuan Agong" },
    { date: "2026-06-17", name: "Awal Muharram (Maal Hijrah)" }, { date: "2026-08-25", name: "Maulidur Rasul" },
    { date: "2026-08-31", name: "Merdeka Day" }, { date: "2026-09-16", name: "Malaysia Day" },
    { date: "2026-11-08", name: "Deepavali" }, { date: "2026-11-09", name: "Deepavali (replacement)" },
    { date: "2026-12-25", name: "Christmas Day" }
  ]
};
export default function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "public, max-age=86400, s-maxage=86400");
  if (req.method === "OPTIONS") return res.status(204).end();
  const year = String(req.query.year || "2026").replace(/[^0-9]/g, "").slice(0, 4);
  const list = HOLIDAYS[year];
  if (!list) return res.status(404).json({ error: "year not available", available: Object.keys(HOLIDAYS) });
  const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kuala_Lumpur" }));
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const next = list.find((h) => { const p = h.date.split("-"); return new Date(+p[0], +p[1] - 1, +p[2]) >= today; }) || null;
  res.status(200).json({
    dataset: "Malaysian national public holidays",
    year, count: list.length, holidays: list, next,
    note: "National gazetted holidays. Some Islamic dates may shift by a day on official confirmation; several holidays are not gazetted in every state.",
    source: { name: "Official public holiday gazette (via MyGov)", url: "https://www.malaysia.gov.my", retrieved: new Date().toISOString() },
    provider: "Greater Malaysia (greatermalaysia.com)"
  });
}
