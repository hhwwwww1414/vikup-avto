import { test } from "node:test";
import assert from "node:assert/strict";
import { isUsefulSourceHit, rankSourceHits } from "./source-quality.ts";
import type { SourceHit } from "./types.ts";

function hit(overrides: Partial<SourceHit>): SourceHit {
  return {
    source: "test",
    fetchedAt: new Date("2026-07-23T00:00:00.000Z"),
    ...overrides,
  };
}

test("isUsefulSourceHit rejects low-confidence generic search noise", () => {
  assert.equal(
    isUsefulSourceHit(
      hit({
        url: "https://example.com/phone-check",
        title: "797 phone lookup",
        snippet: "Generic digit match",
        confidence: 0.2,
      }),
    ),
    false,
  );
});

test("isUsefulSourceHit accepts plate matches and public contacts", () => {
  assert.equal(isUsefulSourceHit(hit({ plate: "В698ОУ797", confidence: 0.7 })), true);
  assert.equal(isUsefulSourceHit(hit({ publicPhone: "+79991234567", confidence: 0.55 })), true);
});

test("rankSourceHits puts contact and exact vehicle evidence first", () => {
  const ranked = rankSourceHits([
    hit({ title: "noise", confidence: 0.2 }),
    hit({ title: "contact", publicPhone: "+79991234567", confidence: 0.6 }),
    hit({ title: "exact", plate: "В698ОУ797", confidence: 0.9 }),
  ]);

  assert.equal(ranked[0].title, "exact");
  assert.equal(ranked[1].title, "contact");
  assert.equal(ranked[2].title, "noise");
});
