/* Malaysia's next general election (GE16), computed from the Federal Constitution. */
export default function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "public, max-age=3600, s-maxage=3600");
  if (req.method === "OPTIONS") return res.status(204).end();
  const deadline = Date.parse("2028-02-17T00:00:00+08:00");
  const dissolve = Date.parse("2027-12-19T00:00:00+08:00");
  const days = Math.max(0, Math.floor((deadline - Date.now()) / 864e5));
  res.status(200).json({
    event: "Malaysia 16th General Election (GE16)",
    must_be_held_by: "2028-02-17",
    parliament_auto_dissolves: "2027-12-19",
    days_until_deadline: days,
    can_be_called_earlier: true,
    note: "The 15th Parliament first met on 19 Dec 2022 and dissolves automatically five years later; an election must follow within 60 days. The Prime Minister may call it earlier.",
    parliament: { total_seats: 222, simple_majority: 112, two_thirds: 148 },
    ge15: { date: "2022-11-19", outcome: "Hung parliament; Anwar Ibrahim became PM via a unity government", turnout_pct: 74 },
    source: { name: "Federal Constitution (Art. 55); Election Commission of Malaysia (SPR)", url: "https://www.spr.gov.my", retrieved: new Date().toISOString() },
    provider: "Greater Malaysia (greatermalaysia.com)"
  });
}
