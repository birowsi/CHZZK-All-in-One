const test = require("node:test");
const assert = require("node:assert/strict");
const { conversionSpec } = require("../record-result-logic.js");

test("record result restores the original conversion choices", () => {
  assert.deepEqual(conversionSpec("mp4").args.slice(0, 2), ["-c", "copy"]);
  assert.ok(conversionSpec("mp4-compatible").args.includes("libx264"));
  assert.equal(conversionSpec("split", { seconds: 600 }).split, true);
  assert.throws(() => conversionSpec("trim", { start: 5, end: 4 }), /종료 시간/);
});
