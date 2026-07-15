/* Calendar export for the Cuti Planner. buildLeaveCalendar is pure and
   returns an RFC 5545 text string (one all-day VEVENT per proposed leave
   date — never public holidays or weekends); downloadCalendar performs the
   browser download. Everything happens client-side. */

const SUMMARY = {
  en: "Annual leave (Greater Malaysia Cuti Planner)",
  ms: "Cuti tahunan (Perancang Cuti Greater Malaysia)",
  zh: "年假（Greater Malaysia 假期规划）",
};

/* escape commas, semicolons, backslashes and newlines per RFC 5545 */
export function escapeIcsText(value) {
  return String(value)
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

const compact = (iso) => iso.replace(/-/g, "");
function nextDay(iso) {
  const d = new Date(iso + "T00:00:00Z"); // all math in UTC — dates never shift with device time zones
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

export function buildLeaveCalendar({ locale = "en", state, leaveDates, generatedAt }) {
  const dates = [...new Set(leaveDates || [])].filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort();
  const stamp = new Date(generatedAt || Date.now()).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const summary = escapeIcsText(SUMMARY[locale] || SUMMARY.en);
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Greater Malaysia//Cuti Planner 2026//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
  ];
  for (const date of dates) {
    lines.push(
      "BEGIN:VEVENT",
      // deterministic UID: same state + date always yields the same event
      `UID:cuti-2026-${state}-${compact(date)}@greatermalaysia.com`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${compact(date)}`,
      `DTEND;VALUE=DATE:${compact(nextDay(date))}`,
      `SUMMARY:${summary}`,
      `DESCRIPTION:${escapeIcsText(`Proposed annual leave day. State: ${state}. https://greatermalaysia.com/cuti-planner`)}`,
      "TRANSP:TRANSPARENT",
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  return lines.join("\r\n") + "\r\n";
}

export function downloadCalendar({ filename, contents }) {
  const blob = new Blob([contents], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
