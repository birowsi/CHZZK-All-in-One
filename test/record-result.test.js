const test = require("node:test");
const assert = require("node:assert/strict");
const { conversionSpec, isCompatibleMp4, canRemuxToMp4 } = require("../record-result-logic.js");

test("MP4 인코딩·자르기·분할은 WebM의 1000fps 프레임 복제를 막는다", () => {
  for (const spec of [conversionSpec("mp4"), conversionSpec("trim", { start: 0, end: 1 }), conversionSpec("split", { seconds: 1 })]) {
    const index = spec.args.indexOf("-fps_mode");
    assert.ok(index >= 0);
    assert.equal(spec.args[index + 1], "vfr");
    assert.ok(!spec.args.includes("-r"));
    assert.ok(!spec.args.includes("scale"));
  }
});

test("MP4 직접 저장은 AVC/AAC가 확인된 MIME만 허용한다", () => {
  for (const mime of ['video/mp4;codecs=avc1.420028,mp4a.40.2', 'video/mp4; codecs="avc1.42E01E, mp4a.40.2"', 'video/mp4;codecs=avc1.420028']) assert.equal(isCompatibleMp4(mime), true);
  for (const mime of [undefined, 'video/mp4', 'video/webm;codecs=vp8,opus', 'video/mp4;codecs=hvc1,mp4a.40.2', 'video/mp4;codecs=avc1.420028,opus', 'video/mp4;codecs=avc1.420028,mp4a.40.2,opus']) assert.equal(isCompatibleMp4(mime), false);
});

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

test("MP4 저장은 H.264/AAC MP4와 RAW TS를 재인코딩 없이 복사하고 타임스탬프를 0부터 정리한다", () => {
  const spec = conversionSpec("remux");
  assert.equal(spec.output, "output-fixed.mp4");
  assert.deepEqual(spec.args, ["-map", "0:v?", "-map", "0:a?", "-c", "copy", "-avoid_negative_ts", "make_zero", "-movflags", "+faststart"]);
  assert.ok(!spec.args.includes("libx264"));
  for (const mime of ['video/mp4; codecs="avc1.4D001F,mp4a.40.2"', "video/mp4;codecs=avc1.420028,mp4a.40.2", "video/mp2t"]) assert.equal(canRemuxToMp4(mime), true);
  for (const mime of ["video/webm;codecs=vp8,opus", "video/mp4", undefined]) assert.equal(canRemuxToMp4(mime), false);
});
