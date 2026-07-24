import { test } from "node:test";
import assert from "node:assert/strict";
import {
  isSherlockReportMessageForPlate,
  normalizeSherlockPlateText,
} from "./provider-message.ts";

test("normalizeSherlockPlateText removes spacing and uppercases plates", () => {
  assert.equal(normalizeSherlockPlateText("а037ор 799"), "А037ОР799");
  assert.equal(normalizeSherlockPlateText(" A037OP 799 "), "А037ОР799");
  assert.equal(normalizeSherlockPlateText("O805HA199"), "О805НА199");
});

test("isSherlockReportMessageForPlate matches only the requested plate", () => {
  assert.equal(
    isSherlockReportMessageForPlate(
      {
        message:
          "\u{1F4C4} \u0417\u0430\u043f\u0440\u043e\u0441: \u0410\u0030\u0033\u0037\u041E\u0420\u0037\u0039\u0039 \u{1F50D} \u041E\u0431\u043D\u0430\u0440\u0443\u0436\u0435\u043D\u043E 31 \u0441\u043E\u0432\u043F\u0430\u0434\u0435\u043D\u0438\u0435.",
        buttons: [[{ text: "\u{1F4C4} \u041E\u0442\u043A\u0440\u044B\u0442\u044C \u043F\u043E\u043B\u043D\u044B\u0439 \u043E\u0442\u0447\u0435\u0442 (31 \u0448\u0442)" }]],
      },
      "\u0410\u0030\u0033\u0037\u041E\u0420\u0037\u0039\u0039",
    ),
    true,
  );
  assert.equal(
    isSherlockReportMessageForPlate(
      {
        message:
          "\u{1F4C4} \u0417\u0430\u043f\u0440\u043e\u0441: \u0412\u0036\u0039\u0038\u041E\u0423\u0037\u0039\u0037 \u{1F50D} \u041E\u0431\u043D\u0430\u0440\u0443\u0436\u0435\u043D\u043E 9 \u0441\u043E\u0432\u043F\u0430\u0434\u0435\u043D\u0438\u0439.",
        buttons: [[{ text: "\u{1F4C4} \u041E\u0442\u043A\u0440\u044B\u0442\u044C \u043F\u043E\u043B\u043D\u044B\u0439 \u043E\u0442\u0447\u0435\u0442 (9 \u0448\u0442)" }]],
      },
      "\u0410\u0030\u0033\u0037\u041E\u0420\u0037\u0039\u0039",
    ),
    false,
  );
});

test("isSherlockReportMessageForPlate matches latin look-alike plate in Sherlock response", () => {
  assert.equal(
    isSherlockReportMessageForPlate(
      {
        message: "📄 Запрос: O805HA199\n🔍 Обнаружено 59 совпадений.",
        buttons: [[{ text: "📄 Открыть полный отчет (59 шт)" }]],
      },
      "О805НА199",
    ),
    true,
  );
});

test("isSherlockReportMessageForPlate matches real Sherlock full report prompt", () => {
  assert.equal(
    isSherlockReportMessageForPlate(
      {
        message:
          "\u{1F4C4} \u0417\u0430\u043F\u0440\u043E\u0441: \u041E805\u041D\u0410199\n\u{1F50D} \u041E\u0431\u043D\u0430\u0440\u0443\u0436\u0435\u043D\u043E 59 \u0441\u043E\u0432\u043F\u0430\u0434\u0435\u043D\u0438\u0439.\n\n\u{1F4C2} \u041E\u0437\u043D\u0430\u043A\u043E\u043C\u0438\u0442\u044C\u0441\u044F \u0441 \u043F\u043E\u043B\u043D\u044B\u043C \u043E\u0442\u0447\u0435\u0442\u043E\u043C \u043C\u043E\u0436\u043D\u043E \u043F\u043E \u0441\u0441\u044B\u043B\u043A\u0435 \u043D\u0438\u0436\u0435.",
        buttons: [[{ text: "\u{1F4C4} \u041E\u0442\u043A\u0440\u044B\u0442\u044C \u043F\u043E\u043B\u043D\u044B\u0439 \u043E\u0442\u0447\u0435\u0442 (59 \u0448\u0442)" }]],
      },
      "\u041E805\u041D\u0410199",
    ),
    true,
  );
});
