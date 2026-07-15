// D5.1 — RFC 5545 calendar export
import test from "node:test";
import assert from "node:assert/strict";
import { buildLeaveCalendar, escapeIcsText } from "../cuti-calendar.mjs";

const GEN = "2026-07-16T04:00:00Z";

test("an empty plan produces a valid empty calendar with no events", () => {
  const ics = buildLeaveCalendar({ locale: "en", state: "kul", leaveDates: [], generatedAt: GEN });
  assert.ok(ics.startsWith("BEGIN:VCALENDAR\r\n"));
  assert.ok(ics.endsWith("END:VCALENDAR\r\n"));
  assert.ok(!ics.includes("BEGIN:VEVENT"));
});

test("one all-day event per unique leave date, with exclusive next-day DTEND", () => {
  const ics = buildLeaveCalendar({ locale: "en", state: "png", leaveDates: ["2026-03-19", "2026-03-19", "2026-03-24"], generatedAt: GEN });
  const events = ics.split("BEGIN:VEVENT").length - 1;
  assert.equal(events, 2, "duplicates collapse");
  assert.ok(ics.includes("DTSTART;VALUE=DATE:20260319"));
  assert.ok(ics.includes("DTEND;VALUE=DATE:20260320"));
  assert.ok(ics.includes("DTSTART;VALUE=DATE:20260324"));
  assert.ok(ics.includes("DTEND;VALUE=DATE:20260325"));
});

test("year-end dates roll into the next year without time zone drift", () => {
  const ics = buildLeaveCalendar({ locale: "en", state: "sgr", leaveDates: ["2026-12-31"], generatedAt: GEN });
  assert.ok(ics.includes("DTSTART;VALUE=DATE:20261231"));
  assert.ok(ics.includes("DTEND;VALUE=DATE:20270101"));
});

test("UIDs are deterministic per state and date", () => {
  const a = buildLeaveCalendar({ locale: "en", state: "jhr", leaveDates: ["2026-03-19"], generatedAt: GEN });
  const b = buildLeaveCalendar({ locale: "ms", state: "jhr", leaveDates: ["2026-03-19"], generatedAt: "2026-08-01T00:00:00Z" });
  const uid = /UID:([^\r\n]+)/;
  assert.equal(a.match(uid)[1], b.match(uid)[1]);
  assert.equal(a.match(uid)[1], "cuti-2026-jhr-20260319@greatermalaysia.com");
});

test("every line ends with CRLF", () => {
  const ics = buildLeaveCalendar({ locale: "zh", state: "kul", leaveDates: ["2026-03-19"], generatedAt: GEN });
  assert.ok(!/[^\r]\n/.test(ics), "no bare LF");
  assert.ok(!ics.includes("\r\r"), "no double CR");
});

test("text fields escape commas, semicolons, backslashes and newlines", () => {
  assert.equal(escapeIcsText("a,b;c\\d\ne"), "a\\,b\\;c\\\\d\\ne");
  const ics = buildLeaveCalendar({ locale: "en", state: "kul", leaveDates: ["2026-03-19"], generatedAt: GEN });
  const desc = ics.match(/DESCRIPTION:([^\r\n]+)/)[1];
  assert.ok(!/[^\\][,;]/.test(desc), desc);
});

test("the summary is localized and the state stays traceable in the description", () => {
  const ms = buildLeaveCalendar({ locale: "ms", state: "trg", leaveDates: ["2026-03-19"], generatedAt: GEN });
  assert.ok(ms.includes("SUMMARY:Cuti tahunan"));
  assert.ok(ms.includes("State: trg"));
  const zh = buildLeaveCalendar({ locale: "zh", state: "trg", leaveDates: ["2026-03-19"], generatedAt: GEN });
  assert.ok(zh.includes("年假"));
});
