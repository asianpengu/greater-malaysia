import { test } from "node:test";
import assert from "node:assert/strict";
import { GLOSSARY } from "./glossary.mjs";

test("every glossary entry has en, ms, and zh values", () => {
  for (const [key, entry] of Object.entries(GLOSSARY)) {
    assert.ok(entry.en, `${key} missing en`);
    assert.ok(entry.ms, `${key} missing ms`);
    assert.ok(entry.zh, `${key} missing zh`);
  }
});

test("has the required nav keys", () => {
  for (const key of ["navTools", "navAnswers", "navElection", "navExplainers", "navStories", "navFollow"]) {
    assert.ok(GLOSSARY[key], `missing ${key}`);
  }
});

test("has the required footer keys", () => {
  for (const key of [
    "footTag", "footColTools", "footColAnswersElection", "footColRead", "footColTrust",
    "footWaktuSolat", "footHargaMinyak", "footRinggit", "footIncomeByState", "footTakeHomePay",
    "footRoadTax", "footStampDuty", "footCutiPlanner", "footMalaysiaToday",
    "footQuickAnswers", "footGe16Hub", "footWhenIsGe16", "footCheckVoterReg",
    "footDataStories", "footExplainersLink", "footDigitalNomads", "footStartBusiness",
    "footForAgents", "footSourcePolicy", "footDataFeed", "footSitemap",
    "footDisclaimer", "footBuiltBy",
  ]) {
    assert.ok(GLOSSARY[key], `missing ${key}`);
  }
});
