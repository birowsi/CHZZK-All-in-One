const test = require("node:test");
const assert = require("node:assert/strict");
const { higherQualityUrl } = require("../grid-bypass.js");
const url = "https://live.navercdn.com/stream/480p/main.m3u8?token=test";

test("1080p 후보는 알려진 CDN의 화질 경로만 바꾼다", () => {
  assert.equal(higherQualityUrl(url), url.replace("480p", "1080p"));
  assert.equal(higherQualityUrl("https://example.com/480p.m3u8"), null);
  assert.equal(higherQualityUrl("https://live.navercdn.com/main.m3u8?token=480p"), null);
});
test("1080p 우회는 서명/쿼리를 유지하며 추가 네트워크 검사를 요구하지 않는다", () => {
  const original = "https://live.navercdn.com/480p/main.m3u8?token=480p%2Babc&auth=yes";
  assert.equal(higherQualityUrl(original), "https://live.navercdn.com/1080p/main.m3u8?token=480p%2Babc&auth=yes");
});
