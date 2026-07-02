# Greater Malaysia

**The nation, in real time.** A suite of free, live tools for everyday Malaysians — prayer times, petrol prices, the ringgit, the weather, the air, disaster warnings and the cost of living — all pulled straight from official open data, in the browser, with no login.

[![Live](https://img.shields.io/badge/live-greatermalaysia.com-b23a23?style=flat-square)](https://greatermalaysia.com)
[![Made with](https://img.shields.io/badge/built%20with-vanilla%20JS-16130d?style=flat-square)](#tech)
[![No backend](https://img.shields.io/badge/backend-none-2f6b4a?style=flat-square)](#how-it-works)
[![License: MIT](https://img.shields.io/badge/license-MIT-9a7b2e?style=flat-square)](LICENSE)

### → **[greatermalaysia.com](https://greatermalaysia.com)**

![Greater Malaysia — live tools on Malaysian open data](docs/hero.png)

---

## The idea

Most "API" sites show you the *ingredients* — endpoints, auth schemes, a catalogue of 500+ APIs only a developer could love. **Greater Malaysia shows you the dishes.** Every panel is a finished, useful thing an ordinary person actually opens their phone for, built on top of those same public feeds. The data is the means; the tool is the point.

It's designed for the Malaysian who lands here from a Google search or an AI chat — not for builders.

## The tools

| Tool | What it does | Source |
|------|--------------|--------|
| 🕌 **Waktu Solat** | Prayer times for any zone + live countdown to the next prayer | JAKIM e-Solat |
| ⛽ **Harga Minyak** | Weekly RON95 / RON97 / Diesel prices + a *fill-your-tank* calculator | DOSM · data.gov.my |
| 👥 **Rakyat** | Population (34.2M) with live ethnic composition | DOSM · data.gov.my |
| 💱 **Ringgit Watch** | Live exchange rates, 30-day trend, and a money converter | Frankfurter / ECB |
| ₿ **Kripto dalam Ringgit** | BTC / ETH / SOL / BNB priced in MYR, 24h change | CoinGecko |
| 🌦 **Cuaca & Udara** | Weather + 5-day forecast **and** air quality (US AQI), 8 cities | Open-Meteo |
| ⚠️ **Amaran Bencana** | Live MET weather warnings + rivers above flood-alert level | MET Malaysia · JPS |
| 📈 **Kos Sara Hidup** | Headline inflation (YoY) with a plain-language takeaway | DOSM · data.gov.my |

Plus a live **ticker** that stitches every feed into one scrolling line at the top.

## How it works

No backend, no API keys, no build step. The whole thing is three static files that fetch **live, public, CORS-friendly APIs directly from the browser** — so it deploys anywhere and costs nothing to run.

A few engineering details I cared about:

- **Staggered + retried fetches** — ~10 feeds load on boot, so they're spaced out by host with exponential-backoff retries to respect rate limits (CoinGecko especially) and survive transient failures.
- **Every tool degrades on its own** — one feed failing never takes down the page; each panel shows its own quiet error state.
- **Interactive combos** — the fuel tool drives a litres→ringgit calculator; the FX tool is a live converter; "Cuaca & Udara" merges two separate Open-Meteo APIs into one panel.
- **Honest data** — RON95 is shown at its subsidised ceiling (it doesn't float), and I deliberately *dropped* a public-holidays tool rather than hardcode lunar dates that might be wrong, because the whole pitch is accuracy.
- **Accessible & responsive** — single-column on mobile, `prefers-reduced-motion` respected, semantic markup.

## Tech

- **Vanilla HTML / CSS / JavaScript** — no framework, no bundler
- Hand-built SVG charts (sparklines, donut gauges, composition bars)
- Type: [Anton](https://fonts.google.com/specimen/Anton) · [Caveat Brush](https://fonts.google.com/specimen/Caveat+Brush) · [Space Grotesk](https://fonts.google.com/specimen/Space+Grotesk) · [JetBrains Mono](https://fonts.google.com/specimen/JetBrains+Mono)
- A brush-ink-on-paper design system (a small, themeable set of CSS custom properties)
- **Deployed on Vercel**, custom domain, GA4 analytics

## Data sources

All public and free:

- [data.gov.my](https://data.gov.my) (DOSM) — fuel, population, inflation, weather warnings, flood
- [JAKIM e-Solat](https://www.e-solat.gov.my) — prayer times
- [Open-Meteo](https://open-meteo.com) — weather & air quality
- [Frankfurter](https://frankfurter.dev) (ECB) — exchange rates
- [CoinGecko](https://www.coingecko.com) — crypto prices
- API landscape indexed by [Pasar API](https://pasarapi.krackeddevs.com) (KrackedDevs)

## Run locally

No dependencies — just serve the folder:

```bash
git clone https://github.com/asianpengu/greater-malaysia.git
cd greater-malaysia
python3 -m http.server 4178
# open http://localhost:4178
```

The tools fetch live data, so they update every time you load.

## Maintenance

**Data stories are pre-rendered.** The `stories/*.html` pages have their full
content and JSON-LD schema baked into the HTML (so AI/search crawlers that
don't run JS still see everything). After editing any `data/*.json` story file
— or the render markup in `stories/story.js` / `scripts/prerender-stories.mjs`
(they mirror each other) — re-run:

```bash
node scripts/prerender-stories.mjs
```

**Yearly rollover.** `/cuti-umum` is a stable redirect (see `vercel.json`)
currently pointing at `cuti-umum-2026.html`. When the 2027 holiday list is
gazetted, create `cuti-umum-2027.html` and repoint the redirect (there's a
TODO at the top of the 2026 page).

**Shared JS.** `common.js` holds the helpers ($, esc, fmt, jget with
timeout + sessionStorage cache, sparkline, wireNav, toast…) used by `app.js`,
`today.js`, `answer.js` and `stories/story.js` — load it first on any new page.
Follow-up idea: the HTML page chrome (nav / footer / gtag snippet) is still
copy-pasted per page and could be generated from a template at build time.

## Full walkthrough

<details>
<summary>See the whole page (all 8 tools)</summary>

![Full page](docs/preview-full.png)

</details>

## License

[MIT](LICENSE) — use it, fork it, build your own city's version.

---

Built by **[Aaron Teng](https://x.com/aaronteng)** 𝕏 — a one-stop, real-time window into Malaysia.
