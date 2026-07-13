/* ============================================================
   Greater Malaysia — AI-adoption story auto-refresh

   Pulls the latest Microsoft AI for Good Lab "AI Diffusion" open CSV
   (MIT-licensed, github.com/microsoft/ai-diffusion-report), finds
   Malaysia's newest adoption figure + rank + the SEA peers, and
   updates the STRUCTURED fields of data/ai-adoption-malaysia.json
   (headline, trend series, SEA table, retrieved/updated dates).

   It NEVER rewrites the prose (subtitle, answer, takeaways, faq),
   because a trust brand dies by one wrong number. If the CSV has
   moved past what's published, it updates the machine-readable data
   and prints an exact checklist of the prose lines a human must edit
   before the story ships. Re-run the prerender after this.

   Usage:  node scripts/refresh-ai-adoption.mjs
           npm run refresh:ai   (refresh + prerender)

   Exit 0 = up to date OR updated-with-review-needed (see output).
   Exit 1 = could not fetch/parse the source (story left untouched).
   ============================================================ */

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const JSON_PATH = join(ROOT, "data", "ai-adoption-malaysia.json");
const REPO = "microsoft/ai-diffusion-report";
const PEERS = ["Singapore", "Vietnam", "Malaysia", "Philippines", "Indonesia", "Thailand"];

const near = (a, b) => Math.abs(a - b) < 0.05;           // floats within 0.05 pp are "equal"
const fail = (msg) => { console.error("✗ " + msg); process.exit(1); };

/* ---- find the newest AI_Diffusion_*.csv in the repo's data/ folder ---- */
function periodKey(name) {
  let m = name.match(/Q([1-4])(\d{4})/i);
  if (m) return (+m[2]) * 100 + (+m[1]) * 3;              // Q1..Q4 -> 3,6,9,12
  m = name.match(/H([12])(\d{4})/i);
  if (m) return (+m[2]) * 100 + (+m[1] === 1 ? 3 : 9);
  return 0;
}
async function findLatestCsv() {
  const api = `https://api.github.com/repos/${REPO}/contents/data`;
  const res = await fetch(api, { headers: { "User-Agent": "greatermalaysia-refresh" } });
  if (!res.ok) fail(`GitHub API ${res.status} listing ${api}`);
  const items = await res.json();
  const csvs = items.filter((i) => i.type === "file" && /^AI_Diffusion_.*\.csv$/i.test(i.name));
  if (!csvs.length) fail("no AI_Diffusion_*.csv found in repo data/ folder");
  csvs.sort((a, b) => periodKey(b.name) - periodKey(a.name));
  return csvs[0];
}

/* ---- parse the CSV into { periods:[...], byEconomy:{name:[v,...]} } ---- */
function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/);
  const header = lines[0].split(",").map((s) => s.trim());
  const periods = header.slice(1);
  const byEconomy = {};
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",");
    const name = (cols[0] || "").trim();
    if (!name) continue;
    byEconomy[name] = cols.slice(1).map((v) => parseFloat(String(v).replace("%", "").trim()));
  }
  return { periods, byEconomy };
}

/* ---- read a headline value out of the JSON by label match ---- */
function headlineVal(json, includes) {
  const h = json.headline.find((x) => x.label.toLowerCase().includes(includes));
  return h ? parseFloat(h.value) : NaN;
}

(async function main() {
  const csvFile = await findLatestCsv();
  const raw = await fetch(csvFile.download_url, { headers: { "User-Agent": "greatermalaysia-refresh" } });
  if (!raw.ok) fail(`could not download ${csvFile.name} (${raw.status})`);
  const { periods, byEconomy } = parseCsv(await raw.text());
  const latestIdx = periods.length - 1;
  const latestLabel = periods[latestIdx].replace(/\s*AI Diffusion\s*$/i, "").trim();   // e.g. "Q1 2026"

  if (!byEconomy["Malaysia"]) fail("Malaysia row not found in CSV");
  const values = Object.entries(byEconomy)
    .map(([name, vals]) => ({ name, v: vals[latestIdx] }))
    .filter((x) => !Number.isNaN(x.v))
    .sort((a, b) => b.v - a.v);
  const total = values.length;
  const rankOf = (name) => values.findIndex((x) => x.name === name) + 1;

  const my = byEconomy["Malaysia"][latestIdx];
  const myRank = rankOf("Malaysia");
  const trajectory = periods.map((p, i) => ({ period: p.replace(/\s*AI Diffusion\s*$/i, "").trim(), share: byEconomy["Malaysia"][i] }));

  console.log(`Source: ${csvFile.name}  ·  latest period: ${latestLabel}  ·  ${total} economies`);
  console.log(`Malaysia: ${my}%  ·  rank #${myRank}/${total}`);
  console.log("SEA:", PEERS.map((p) => `${p} ${byEconomy[p]?.[latestIdx]}% (#${rankOf(p)})`).join(", "));

  const json = JSON.parse(readFileSync(JSON_PATH, "utf8"));
  const curMy = headlineVal(json, "using ai");
  const curRank = headlineVal(json, "rank");

  if (near(curMy, my) && curRank === myRank) {
    console.log(`\n✓ AI-adoption story is up to date (Malaysia ${my}%, #${myRank}/${total}). No change.`);
    process.exit(0);
  }

  console.log(`\n△ Source moved: published ${curMy}% / #${curRank}  →  latest ${my}% / #${myRank}`);

  // --- update the unambiguous structured fields only ---
  const setHeadline = (inc, v) => { const h = json.headline.find((x) => x.label.toLowerCase().includes(inc)); if (h) h.value = String(v); };
  setHeadline("using ai", my);
  setHeadline("rank", myRank);
  if (json.series?.trend) json.series.trend.rows = trajectory;
  if (json.series?.sea) {
    json.series.sea.rows = PEERS.map((p) => ({
      label: p === "Malaysia" ? `Malaysia (#${myRank})` : `${p} (#${rankOf(p)})`,
      share: byEconomy[p]?.[latestIdx]
    }));
  }
  const today = new Date().toISOString().slice(0, 10);
  json.updated = today;
  if (json.source) { json.source.retrieved = today; json.source.document = json.source.document.replace(/AI Diffusion [^ ]+ \d{4} Update/i, `AI Diffusion ${latestLabel} Update`); }
  writeFileSync(JSON_PATH, JSON.stringify(json, null, 2) + "\n");
  console.log("✎ Updated structured data (headline, trend, SEA table, dates).");

  // --- flag prose that still holds the OLD numbers ---
  const oldNums = [String(curMy), `#${curRank}`, `${curRank} of`, `${curRank}st`, `${curRank}nd`, `${curRank}rd`, `${curRank}th`];
  const proseFields = ["subtitle", "answer", ...(json.takeaways || []).map((_, i) => `takeaways[${i}]`), ...(json.faq || []).map((_, i) => `faq[${i}].a`)];
  console.log("\n⚠ REVIEW NEEDED before publishing — prose still references the old figure.");
  console.log(`  Replace ${curMy}% → ${my}% and rank #${curRank} → #${myRank} in these fields of data/ai-adoption-malaysia.json:`);
  console.log("  " + proseFields.join(", "));
  console.log("  Then: node scripts/prerender-stories.mjs, review the diff, and ship.");
  process.exit(0);
})().catch((e) => fail(e.message));
