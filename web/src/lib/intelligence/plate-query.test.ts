import { test } from "node:test";
import assert from "node:assert/strict";
import { generatePlateQueries, PLATE_QUERY_GENERATOR_VERSION } from "./plate-query.ts";

test("generatePlateQueries emits measurable plate variants", () => {
  const queries = generatePlateQueries("O101HT790");
  const values = queries.map((query) => query.query);

  assert.ok(values.includes("О101НТ790"));
  assert.ok(values.includes("О101НТ 790"));
  assert.ok(values.includes("О 101 НТ 790"));
  assert.ok(values.includes("O101HT790"));
  assert.ok(values.includes("\"О101НТ790\""));
  assert.ok(values.includes("\"O101HT790\" VIN"));
  assert.equal(new Set(values).size, values.length);
  assert.ok(queries.every((query) => query.generatedBy === PLATE_QUERY_GENERATOR_VERSION));
});

test("generatePlateQueries returns no queries for empty input", () => {
  assert.deepEqual(generatePlateQueries(""), []);
});
