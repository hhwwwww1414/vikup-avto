import { test } from "node:test";
import assert from "node:assert/strict";
import { shouldSendPaidSherlockRequest } from "./job-policy.ts";

test("shouldSendPaidSherlockRequest allows only the first job attempt to send", () => {
  assert.equal(shouldSendPaidSherlockRequest(1), true);
  assert.equal(shouldSendPaidSherlockRequest(2), false);
  assert.equal(shouldSendPaidSherlockRequest(3), false);
});
