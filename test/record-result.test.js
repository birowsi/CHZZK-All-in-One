const test = require("node:test");
const assert = require("node:assert/strict");
const { conversionSpec } = require("../record-result-logic.js");

test("MP4는 호환 인코딩 경로 하나를 사용하고 기존 형식을 유지한다", () => {
  assert.ok(conversionSpec("mp4").args.includes("libx264"));
  assert.throws(() => conversionSpec("mp4-compatible"), /지원하지 않는/);
  assert.equal(conversionSpec("gif").ext, "gif");
  assert.equal(conversionSpec("webp").ext, "webp");
  assert.equal(conversionSpec("split", { seconds: 600 }).split, true);
  for (const format of ["webm", "gif", "webp"]) {
    assert.equal(conversionSpec("split", { seconds: 1, format }).split, "chunks");
  }
  assert.throws(() => conversionSpec("split", { seconds: 1, format: "avi" }), /형식/);
  assert.throws(() => conversionSpec("trim", { start: 5, end: 4 }), /종료 시간/);
});

test("자르기는 MP4, WebM, GIF, WebP 출력을 선택한다", () => {
  const trim = conversionSpec("trim", { start: 12, end: 30 });
  assert.deepEqual(trim.preInput, ["-ss", "12"]);
  assert.deepEqual(trim.args.slice(0, 2), ["-t", "18"]);
  for (const format of ["mp4", "webm", "gif", "webp"]) {
    const spec = conversionSpec("trim", { start: 1, end: 2, format });
    assert.equal(spec.ext, format);
    assert.equal(spec.output, `output-trim.${format}`);
  }
  assert.throws(() => conversionSpec("trim", { start: 1, end: 2, format: "avi" }), /형식/);
});
