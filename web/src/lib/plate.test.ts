import { test } from "node:test";
import assert from "node:assert/strict";
import {
  normalizePlateInput,
  parseRussianPlate,
  formatPlateDisplay,
  isValidRussianPlate,
} from "./plate.ts";

test("normalizePlateInput strips spaces and uppercases", () => {
  assert.equal(normalizePlateInput("о101нт 790"), "О101НТ790");
  assert.equal(normalizePlateInput("к 575 нк 777"), "К575НК777");
});

test("normalizePlateInput maps latin look-alikes to cyrillic", () => {
  // O101HT790 all latin -> cyrillic
  assert.equal(normalizePlateInput("O101HT790"), "О101НТ790");
  assert.equal(normalizePlateInput("c160th799"), "С160ТН799");
});

test("parseRussianPlate accepts standard plates (2 and 3 digit region)", () => {
  assert.deepEqual(parseRussianPlate("О101НТ790"), {
    normalized: "О101НТ790",
    display: "О101НТ 790",
  });
  assert.deepEqual(parseRussianPlate("О805НА199"), {
    normalized: "О805НА199",
    display: "О805НА 199",
  });
});

test("parseRussianPlate corrects OCR digit/letter confusion by position", () => {
  // OCR returned latin O and H and digit-shaped letters
  assert.equal(parseRussianPlate("0101HT790")?.normalized, "О101НТ790");
});

test("parseRussianPlate rejects impossible plates", () => {
  assert.equal(parseRussianPlate("ЖЖЖ123"), null);
  assert.equal(parseRussianPlate("123456"), null);
  assert.equal(parseRussianPlate(""), null);
  // wrong length
  assert.equal(parseRussianPlate("О101НТ7900"), null);
});

test("formatPlateDisplay inserts region space", () => {
  assert.equal(formatPlateDisplay("С160ТН799"), "С160ТН 799");
});

test("isValidRussianPlate", () => {
  assert.equal(isValidRussianPlate("Е348СК199"), true);
  assert.equal(isValidRussianPlate("E348CK199"), false); // latin, not canonical
});
