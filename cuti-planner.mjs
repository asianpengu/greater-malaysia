/* Cuti Planner — DOM rendering and interactions. One shared implementation
   for the EN, BM and Chinese pages; all calculations live in cuti-engine.mjs.
   Relies on globals from common.js (jget, getPrefs, setPrefs, track, esc). */
import { buildOpportunities, optimizePlan } from "/cuti-engine.mjs";
import { resolvePlannerParams, buildPlannerQuery } from "/cuti-url.mjs";

const YEAR = 2026;
const LANG = (() => { const l = document.documentElement.lang; return l === "ms" ? "ms" : l === "zh-Hans" ? "zh" : "en"; })();

/* Friday–Saturday weekend states, per the official federal + state holiday
   schedule (kabinet.gov.my HKA-2026). Used only as a fallback when the API
   response and local dataset are unavailable for weekend metadata. */
const FRI_SAT_STATES = ["jhr", "kdh", "ktn", "trg"];

/* presentation copy — localized here so the three HTML pages stay copy-only */
const COPY = {
  en: {
    state: "State / federal territory",
    months: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
    fmt: (d, mon) => `${d} ${mon}`,
    head: (spent, off) => `Spend <b>${spent}</b> leave day${spent === 1 ? "" : "s"} &rarr; <b>${off}</b> days off in ${YEAR}`,
    sub: (budget) => `Plus the free long weekends below, taken automatically. Highlighted cards are the ones we picked for your ${budget}-day budget.`,
    free: "free", picked: "picked",
    range: (a, b) => `days off &middot; ${a} to ${b}`,
    takeFree: "No leave needed, it is already a long weekend.",
    take: (n, days) => `Take <b>${n}</b> day${n === 1 ? "" : "s"}: ${days}`,
    note: (state) => `This uses the gazetted national and ${state} holidays. Dates marked * follow the lunar calendar and may shift on official confirmation. Leave days shown are working days to book off.`,
    src: 'Holidays: official federal and state schedule, Prime Minister\'s Department (see <a href="/cuti-umum-2026">Cuti Umum 2026</a>).',
    loading: "Loading holidays…",
    usingLocal: "Using saved holiday data",
    failed: "Holiday data unavailable.",
    retry: "Try again",
  },
  ms: {
    state: "Negeri / wilayah persekutuan",
    months: ["Jan", "Feb", "Mac", "Apr", "Mei", "Jun", "Jul", "Ogo", "Sep", "Okt", "Nov", "Dis"],
    fmt: (d, mon) => `${d} ${mon}`,
    head: (spent, off) => `Guna <b>${spent}</b> hari cuti &rarr; <b>${off}</b> hari bercuti pada ${YEAR}`,
    sub: (budget) => `Termasuk juga hujung minggu panjang percuma di bawah, diambil secara automatik. Kad yang diserlahkan ialah pilihan kami untuk bajet ${budget} hari anda.`,
    free: "percuma", picked: "dipilih",
    range: (a, b) => `hari bercuti &middot; ${a} hingga ${b}`,
    takeFree: "Tak perlu ambil cuti, ini memang hujung minggu panjang.",
    take: (n, days) => `Ambil <b>${n}</b> hari cuti: ${days}`,
    note: (state) => `Ini menggunakan cuti kebangsaan dan cuti negeri ${state} yang diwartakan. Tarikh bertanda * mengikut kalendar lunar dan mungkin berubah selepas pengesahan rasmi. Hari cuti yang ditunjukkan ialah hari bekerja untuk anda mohon cuti.`,
    src: 'Cuti: jadual rasmi persekutuan dan negeri, Jabatan Perdana Menteri (lihat <a href="/ms/cuti-umum-2026">Cuti Umum 2026</a>).',
    loading: "Memuatkan cuti…",
    usingLocal: "Menggunakan data cuti tersimpan",
    failed: "Data cuti tidak tersedia.",
    retry: "Cuba lagi",
  },
  zh: {
    state: "州属 / 联邦直辖区",
    months: ["1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"],
    fmt: (d, mon) => `${mon}${d}日`,
    head: (spent, off) => `用 <b>${spent}</b> 天年假 &rarr; ${YEAR} 年共 <b>${off}</b> 天假期`,
    sub: (budget) => `还有下方免费的长周末，会自动帮你安排。高亮的卡片就是我们为你 ${budget} 天年假预算挑选的组合。`,
    free: "免费", picked: "已选",
    range: (a, b) => `天假期 &middot; ${a} 至 ${b}`,
    takeFree: "无需请假，这本来就是长周末。",
    take: (n, days) => `请 <b>${n}</b> 天年假：${days}`,
    note: (state) => `这里采用宪报颁布的全国假期与${state}州属假期。标 * 的日期依农历/回历而定，或会在官方确认后调整。显示的年假是你需要请的工作日。`,
    src: '假期：首相署官方联邦与州属假期表（见 <a href="/zh/cuti-umum-2026">Cuti Umum 2026</a>）。',
    loading: "正在载入假期…",
    usingLocal: "使用已保存的假期数据",
    failed: "假期数据暂不可用。",
    retry: "重试",
  },
}[LANG];

/* the sixteen jurisdictions, in the site's usual display order */
const STATES = [
  ["kul", { en: "Kuala Lumpur", ms: "W.P. Kuala Lumpur", zh: "吉隆坡" }],
  ["sgr", { en: "Selangor", ms: "Selangor", zh: "雪兰莪" }],
  ["png", { en: "Penang", ms: "Pulau Pinang", zh: "槟城" }],
  ["jhr", { en: "Johor", ms: "Johor", zh: "柔佛" }],
  ["prk", { en: "Perak", ms: "Perak", zh: "霹雳" }],
  ["kdh", { en: "Kedah", ms: "Kedah", zh: "吉打" }],
  ["ktn", { en: "Kelantan", ms: "Kelantan", zh: "吉兰丹" }],
  ["trg", { en: "Terengganu", ms: "Terengganu", zh: "登嘉楼" }],
  ["phg", { en: "Pahang", ms: "Pahang", zh: "彭亨" }],
  ["mlk", { en: "Melaka", ms: "Melaka", zh: "马六甲" }],
  ["nsn", { en: "Negeri Sembilan", ms: "Negeri Sembilan", zh: "森美兰" }],
  ["pls", { en: "Perlis", ms: "Perlis", zh: "玻璃市" }],
  ["sbh", { en: "Sabah", ms: "Sabah", zh: "沙巴" }],
  ["swk", { en: "Sarawak", ms: "Sarawak", zh: "砂拉越" }],
  ["lbn", { en: "Labuan", ms: "W.P. Labuan", zh: "纳闽" }],
  ["pjy", { en: "Putrajaya", ms: "W.P. Putrajaya", zh: "布城" }],
];
const STATE_CODES = STATES.map(([c]) => c);
const stateName = (code) => { const s = STATES.find(([c]) => c === code); return s ? s[1][LANG] : code; };

const el = (id) => document.getElementById(id);
const fmtDate = (isoDate) => {
  const d = new Date(isoDate + "T00:00:00Z");
  return COPY.fmt(d.getUTCDate(), COPY.months[d.getUTCMonth()]);
};

/* ?state= and ?leave= reproduce a shared plan for this visit only —
   they never overwrite the stored preference until the user changes it */
const initial = resolvePlannerParams(location.search, getPrefs().state);
let activeState = initial.state;
let holidayState = null; // { rows, weekendDays, from } for activeState

/* reflect explicit changes in the address bar without reload or history spam */
function syncUrl() {
  try {
    const budgetInput = el("cpLeave");
    const leave = Math.max(0, Math.min(30, Math.floor(Number(budgetInput && budgetInput.value) || 0)));
    history.replaceState(null, "", location.pathname + buildPlannerQuery(location.search, activeState, leave));
  } catch (e) { /* URL sync is cosmetic */ }
}

/* API first; the local verified dataset is the fallback */
async function fetchHolidays(state) {
  try {
    const d = await jget(`/api/holidays?year=${YEAR}&state=${state}`, 1, 3600e3);
    if (!d || !Array.isArray(d.holidays)) throw new Error("bad response");
    return { rows: d.holidays, weekendDays: d.weekend_days, from: "api" };
  } catch (e) {
    const ds = await jget(`/data/public-holidays-${YEAR}.json`, 1, 3600e3);
    const jur = ds && ds.jurisdictions && ds.jurisdictions[state];
    if (!jur) throw new Error("no local data");
    return {
      rows: jur.holidays.map((h) => ({ date: h.date, name: h.name.en, names: h.name, status: h.status })),
      weekendDays: jur.weekend_days,
      from: "local",
    };
  }
}

function rowLabel(row) {
  const base = (row.names && row.names[LANG]) || row.name;
  return row.status === "subject-to-confirmation" ? base + " *" : base;
}

function render() {
  if (!holidayState) return;
  const budgetInput = el("cpLeave");
  const budget = Math.max(0, Math.min(30, Math.floor(Number(budgetInput && budgetInput.value) || 0)));
  const holidays = holidayState.rows.map((r) => ({ date: r.date, name: rowLabel(r) }));
  const weekendDays = holidayState.weekendDays || (FRI_SAT_STATES.includes(activeState) ? [5, 6] : [0, 6]);
  const opps = buildOpportunities({ year: YEAR, holidays, weekendDays });
  const plan = optimizePlan({ opportunities: opps, leaveBudget: budget });
  const chosen = new Set(plan.chosenStarts);

  el("cpHead").innerHTML = `<div class="big">${COPY.head(plan.spent, plan.daysOff)}</div><div class="sub">${COPY.sub(budget)}</div>`;
  el("cpList").innerHTML = opps.map((o) => {
    const on = o.leave === 0 || chosen.has(o.start);
    const cls = o.leave === 0 ? "cp-card free" : on ? "cp-card on" : "cp-card";
    const badge = o.leave === 0
      ? `<span class="cp-badge free">${COPY.free}</span>`
      : on ? `<span class="cp-badge">${COPY.picked}</span>` : `<span class="cp-badge">${(o.off / o.leave).toFixed(1)}x</span>`;
    const take = o.leave === 0 ? COPY.takeFree : COPY.take(o.leave, o.leaveDays.map(fmtDate).join(", "));
    return `<div class="${cls}"><div class="cp-top"><span class="cp-days">${o.off}</span><span class="cp-range">${COPY.range(fmtDate(o.start), fmtDate(o.end))}</span>${badge}</div><div class="cp-take">${take}</div><div class="cp-hol">${o.hols.map(esc).join(" &middot; ")}</div></div>`;
  }).join("");
  el("cpNote").innerHTML = esc(COPY.note(stateName(activeState)));
  el("cpSrc").innerHTML = COPY.src + (holidayState.from === "local" ? ` <span class="cp-local">${esc(COPY.usingLocal)}</span>` : "");

  window.GM_CUTI_RESULT = { state: activeState, budget, plan, weekendDays }; // consumed by share + calendar ships
  document.dispatchEvent(new CustomEvent("gm:cuti-rendered"));
}

async function loadAndRender() {
  const budgetInput = el("cpLeave");
  if (budgetInput) budgetInput.disabled = true;
  el("cpHead").innerHTML = `<div class="sub">${esc(COPY.loading)}</div>`;
  el("cpList").innerHTML = "";
  try {
    holidayState = await fetchHolidays(activeState);
    if (budgetInput) budgetInput.disabled = false;
    render();
  } catch (e) {
    holidayState = null;
    el("cpHead").innerHTML = `<div class="sub">${esc(COPY.failed)} <button class="cp-retry" id="cpRetry" type="button">${esc(COPY.retry)}</button></div>`;
    const retry = el("cpRetry");
    if (retry) retry.addEventListener("click", () => { retry.disabled = true; loadAndRender(); });
  }
}

function boot() {
  const stateSel = el("cpState");
  if (stateSel) {
    stateSel.innerHTML = STATES.map(([code, names]) => `<option value="${code}"${code === activeState ? " selected" : ""}>${esc(names[LANG])}</option>`).join("");
    stateSel.addEventListener("change", (e) => {
      const code = String(e.target.value);
      if (!STATE_CODES.includes(code)) return;
      activeState = code;
      setPrefs({ state: code }); // explicit change — now it may persist
      track("preference_set", { preference: "state", value: code, source: "cuti_selector" });
      syncUrl();
      loadAndRender();
    });
  }
  const budgetInput = el("cpLeave");
  if (budgetInput) {
    if (initial.leaveFromQuery) budgetInput.value = String(initial.leave);
    budgetInput.addEventListener("input", () => { syncUrl(); render(); });
  }
  loadAndRender();
}

boot();
