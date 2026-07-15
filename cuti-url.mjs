/* Pure URL-parameter helpers for the Cuti Planner. A shared link like
   /cuti-planner?state=sgr&leave=8 recreates the sender's plan for the
   current visit without overwriting the recipient's saved preference. */

export const CUTI_STATE_CODES = ["jhr", "kdh", "ktn", "mlk", "nsn", "phg", "prk", "pls", "png", "sbh", "swk", "sgr", "trg", "kul", "lbn", "pjy"];
export const LEAVE_MIN = 0;
export const LEAVE_MAX = 30; // must match the #cpLeave input's min/max
export const LEAVE_DEFAULT = 8;

/* base-10 integers only — reject decimals, signs, exponents and arrays */
export function parseLeaveParam(raw) {
  if (typeof raw !== "string" || !/^[0-9]{1,2}$/.test(raw)) return null;
  const n = parseInt(raw, 10);
  return n >= LEAVE_MIN && n <= LEAVE_MAX ? n : null;
}

/* Resolution order: valid query value → valid stored preference → defaults.
   For repeated parameters the first recognized value wins. */
export function resolvePlannerParams(search, storedState) {
  let q;
  try { q = new URLSearchParams(search || ""); } catch (e) { q = new URLSearchParams(); }
  const qState = q.getAll("state").find((s) => CUTI_STATE_CODES.includes(s)) || null;
  const leaveVals = q.getAll("leave").map(parseLeaveParam).filter((n) => n !== null);
  return {
    state: qState || (CUTI_STATE_CODES.includes(storedState) ? storedState : "kul"),
    leave: leaveVals.length ? leaveVals[0] : LEAVE_DEFAULT,
    stateFromQuery: !!qState,
    leaveFromQuery: leaveVals.length > 0,
  };
}

/* Normalized query string for history.replaceState: recognized UTM
   parameters survive, planner params are deduplicated, everything else
   (including arbitrary query text) is dropped. */
export function buildPlannerQuery(search, state, leave) {
  let q;
  try { q = new URLSearchParams(search || ""); } catch (e) { q = new URLSearchParams(); }
  const keep = new URLSearchParams();
  for (const [k, v] of q) {
    if (/^utm_[a-z_]+$/.test(k) && !keep.has(k)) keep.append(k, v);
  }
  keep.set("state", CUTI_STATE_CODES.includes(state) ? state : "kul");
  keep.set("leave", String(parseLeaveParam(String(leave)) ?? LEAVE_DEFAULT));
  return "?" + keep.toString();
}
