/* Pure holiday and leave calculation engine for the Cuti Planner.
   No DOM, no fetch, no mutation of arguments; results are serializable and
   identical regardless of the display language. Shared by the three
   localized planner pages and the Node test suite. */

const DAY = 86400000;

/* Build consecutive time-off opportunities for a year.
   holidays: [{ date: "YYYY-MM-DD", name: string }]
   weekendDays: e.g. [0, 6] (Sat–Sun states) or [5, 6] (Fri–Sat states)
   Each holiday cluster is greedily bridged toward nearby free days with at
   most two leave days per bridge, mirroring the original planner behavior.
   Opportunities never overlap, so no leave date is ever counted twice. */
export function buildOpportunities({ year, holidays, weekendDays }) {
  const weekend = new Set(weekendDays && weekendDays.length ? weekendDays : [0, 6]);
  const byDate = {};
  for (const h of holidays || []) {
    if (h && typeof h.date === "string" && h.date.slice(0, 4) === String(year)) {
      (byDate[h.date] = byDate[h.date] || []).push(String(h.name));
    }
  }
  const iso = (d) => d.toISOString().slice(0, 10);
  const isHol = (d) => !!byDate[iso(d)];
  const isFree = (d) => weekend.has(d.getUTCDay()) || isHol(d);

  const seen = {};
  const opps = [];
  let d = new Date(Date.UTC(Number(year), 0, 1));
  while (d.getUTCFullYear() === Number(year)) {
    if (isHol(d) && !seen[iso(d)]) {
      let s = new Date(d), e = new Date(d);
      for (;;) { const p = new Date(s); p.setUTCDate(p.getUTCDate() - 1); if (isFree(p)) s = p; else break; }
      for (;;) { const n = new Date(e); n.setUTCDate(n.getUTCDate() + 1); if (isFree(n)) e = n; else break; }
      let leave = 0; const leaveDays = [];
      const gap = (dir) => {
        const g = []; const c = new Date(dir < 0 ? s : e);
        for (;;) {
          c.setUTCDate(c.getUTCDate() + dir);
          if (isFree(c)) return { g, hit: new Date(c) };
          g.push(new Date(c));
          if (g.length > 6) return { g, hit: null };
        }
      };
      for (let i = 0; i < 4; i++) {
        const L = gap(-1), R = gap(1);
        const lc = L.hit ? L.g.length : 99, rc = R.hit ? R.g.length : 99;
        if (Math.min(lc, rc) > 2) break;
        if (lc <= rc) {
          leave += lc; L.g.forEach((x) => leaveDays.push(iso(x))); s = L.hit;
          for (;;) { const p = new Date(s); p.setUTCDate(p.getUTCDate() - 1); if (isFree(p)) s = p; else break; }
        } else {
          leave += rc; R.g.forEach((x) => leaveDays.push(iso(x))); e = R.hit;
          for (;;) { const n = new Date(e); n.setUTCDate(n.getUTCDate() + 1); if (isFree(n)) e = n; else break; }
        }
      }
      const off = Math.round((e - s) / DAY) + 1;
      const hols = [];
      const t = new Date(s);
      while (t <= e) {
        if (isHol(t)) { hols.push(...byDate[iso(t)]); seen[iso(t)] = 1; }
        t.setUTCDate(t.getUTCDate() + 1);
      }
      leaveDays.sort();
      opps.push({ start: iso(s), end: iso(e), off, leave, leaveDays, hols });
    }
    d.setUTCDate(d.getUTCDate() + 1);
  }
  opps.sort((a, b) => (a.start < b.start ? -1 : 1));
  return opps;
}

/* Pick the set of paid opportunities that maximises days off within the
   leave budget (exhaustive subset search — the yearly opportunity count is
   small). Free long weekends are always included. Ties prefer fewer leave
   days, then the earlier subset, so results are deterministic. */
export function optimizePlan({ opportunities, leaveBudget }) {
  const budget = Math.max(0, Math.floor(Number(leaveBudget) || 0));
  const freebies = (opportunities || []).filter((o) => o.leave === 0);
  const paid = (opportunities || []).filter((o) => o.leave > 0);
  let best = { off: 0, leave: 0, mask: 0 };
  for (let m = 0; m < (1 << paid.length); m++) {
    let l = 0, o = 0;
    for (let b = 0; b < paid.length; b++) {
      if (m & (1 << b)) { l += paid[b].leave; o += paid[b].off; }
    }
    if (l <= budget && (o > best.off || (o === best.off && l < best.leave))) best = { off: o, leave: l, mask: m };
  }
  const chosen = paid.filter((_, b) => best.mask & (1 << b));
  return {
    budget,
    spent: best.leave,
    daysOff: freebies.reduce((sum, o) => sum + o.off, 0) + best.off,
    chosenStarts: chosen.map((o) => o.start),
    leaveDates: chosen.flatMap((o) => o.leaveDays).sort(),
  };
}
