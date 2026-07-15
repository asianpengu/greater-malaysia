// Release gate: run the structural i18n verifier across every manifest page
// (EN + BM + ZH) without relying on shell globs, so `npm run check` behaves
// the same on every platform.
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { PAGES, LANGS } from "./i18n/manifest.mjs";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

const files = [];
for (const page of PAGES) {
  for (const lang of Object.values(LANGS)) {
    files.push(lang.prefix ? path.join(lang.prefix.slice(1), page.file) : page.file);
  }
}

const result = spawnSync(process.execPath, [path.join(ROOT, "scripts/verify-i18n.mjs"), ...files], {
  cwd: ROOT,
  stdio: ["ignore", "pipe", "inherit"],
  encoding: "utf8",
});
const passes = (result.stdout.match(/^PASS /gm) || []).length;
const fails = (result.stdout.match(/^FAIL /gm) || []).length;
if (result.status !== 0 || fails > 0) {
  process.stdout.write(result.stdout);
  console.error(`i18n page verification FAILED (${fails} failing, ${passes} passing).`);
  process.exit(1);
}
console.log(`i18n page verification passed for ${passes} localized pages.`);
