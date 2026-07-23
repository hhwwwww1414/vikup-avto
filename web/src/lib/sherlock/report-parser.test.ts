import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildSherlockReportKey,
  parseSherlockReport,
  pickTopPhoneCandidates,
} from "./report-parser.ts";

test("parseSherlockReport extracts phones with confidence and best candidate", () => {
  const parsed = parseSherlockReport(
    `
      Госномер: О101НТ790
      VIN: XTA210990Y1234567
      79091501335 — 25%
      +7 921 870-95-99 — 12.5%
      8 (985) 761-27-04 confidence 12,5%
    `,
    { reportUrl: "https://example.test/report/1", searchedPlate: "О101НТ790" },
  );

  assert.equal(parsed.searchedPlate, "О101НТ790");
  assert.equal(parsed.vin, "XTA210990Y1234567");
  assert.equal(parsed.reportUrl, "https://example.test/report/1");
  assert.deepEqual(
    parsed.phoneCandidates.map((candidate) => ({
      phone: candidate.phone,
      providerConfidence: candidate.providerConfidence,
      rank: candidate.rank,
      source: candidate.source,
    })),
    [
      {
        phone: "79091501335",
        providerConfidence: 25,
        rank: 1,
        source: "SHERLOCK_REPORT",
      },
      {
        phone: "79218709599",
        providerConfidence: 12.5,
        rank: 2,
        source: "SHERLOCK_REPORT",
      },
      {
        phone: "79857612704",
        providerConfidence: 12.5,
        rank: 3,
        source: "SHERLOCK_REPORT",
      },
    ],
  );
  assert.equal(parsed.bestPhone, "79091501335");
  assert.equal(parsed.bestProviderConfidence, 25);
  assert.equal(parsed.hasMultipleTopCandidates, false);
});

test("pickTopPhoneCandidates keeps ties instead of choosing randomly", () => {
  const top = pickTopPhoneCandidates([
    { phone: "79000000001", providerConfidence: 42, rank: 1 },
    { phone: "79000000002", providerConfidence: 42, rank: 2 },
    { phone: "79000000003", providerConfidence: 20, rank: 3 },
  ]);

  assert.deepEqual(top.map((candidate) => candidate.phone), [
    "79000000001",
    "79000000002",
  ]);
});

test("parseSherlockReport extracts phones from Sherlock html report cards", () => {
  const parsed = parseSherlockReport(
    `
      <div class="report-card__label">&#1058;&#1077;&#1083;&#1077;&#1092;&#1086;&#1085;</div>
      <span class='copyable' data-clipboard-text="79258393949">
        <strong>79258393949</strong>
      </span>
      <small style="font-size: 0.6em; color: #999;">50%</small>
      <span class='copyable' data-clipboard-text="79263129809">
        <strong>79263129809</strong>
      </span>
      <small style="font-size: 0.6em; color: #999;">46.15%</small>
    `,
    { reportUrl: "https://example.test/report/1", searchedPlate: "А037ОР799" },
  );

  assert.deepEqual(
    parsed.phoneCandidates.map((candidate) => ({
      phone: candidate.phone,
      providerConfidence: candidate.providerConfidence,
      rank: candidate.rank,
    })),
    [
      { phone: "79258393949", providerConfidence: 50, rank: 1 },
      { phone: "79263129809", providerConfidence: 46.15, rank: 2 },
    ],
  );
  assert.equal(parsed.bestPhone, "79258393949");
});

test("buildSherlockReportKey stores artifacts under vehicle and lookup ids", () => {
  assert.equal(
    buildSherlockReportKey("vehicle-1", "lookup-1", "application/pdf"),
    "sherlock/vehicle-1/lookup-1/report.pdf",
  );
  assert.equal(
    buildSherlockReportKey("vehicle-1", "lookup-1", "text/html; charset=utf-8"),
    "sherlock/vehicle-1/lookup-1/report.html",
  );
});
