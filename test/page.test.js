const test = require("node:test");
const assert = require("node:assert/strict");
const rules = require("../rules.json");
const { chooseVariant, filterMasterPlaylist, patchPayload, isAdMediaSource } = require("../page.js");

test("prefers 1080p and removes every P2P field", () => {
  assert.equal(chooseVariant([{ height: 720, fps: 60, bandwidth: 1 }, { height: 1080, fps: 30, bandwidth: 1 }]).height, 1080);

  const payload = { content: { p2pQuality: ["1080p"], livePlaybackJson: JSON.stringify({ meta: { p2p: true }, media: [{ encodingTrack: [{ p2pPath: "x", p2pPathUrlEncoding: "y" }] }] }) } };
  assert.equal(patchPayload(payload), true);
  assert.deepEqual(payload.content.p2pQuality, []);
  assert.deepEqual(JSON.parse(payload.content.livePlaybackJson), { meta: { p2p: false }, media: [{ encodingTrack: [{}] }] });
});

test("재생 JSON에 meta가 없어도 P2P·타임머신 패치를 유지한다", () => {
  const payload = { timeMachine: false, livePlaybackJson: JSON.stringify({ live: { timeMachine: false } }) };
  assert.equal(patchPayload(payload), true);
  assert.equal(payload.timeMachine, true);
  assert.deepEqual(JSON.parse(payload.livePlaybackJson), { meta: { p2p: false }, live: { timeMachine: true } });
});

test("광고 미디어만 차단 대상으로 고른다", () => {
  assert.equal(isAdMediaSource("https://example.com/ad.mp4?token=x"), true);
  assert.equal(isAdMediaSource("https://example.com/service/ad/segment"), true);
  assert.equal(isAdMediaSource("https://example.com/live/1080p.m3u8"), false);
});

test("keeps only the best 1080p HLS variant", () => {
  const playlist = "#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=1000,RESOLUTION=1280x720,FRAME-RATE=60\n720.m3u8\n#EXT-X-STREAM-INF:BANDWIDTH=2000,RESOLUTION=1920x1080,FRAME-RATE=60\n1080.m3u8";
  const result = filterMasterPlaylist(playlist);
  assert.equal(result.includes("720.m3u8"), false);
  assert.equal(result.includes("1080.m3u8"), true);
});

test("치트키 제한 중계는 1080p가 없어도 최고 가용 480p를 유지한다", () => {
  const playlist = "#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=992000,RESOLUTION=852x480,FRAME-RATE=30\n480.m3u8\n#EXT-X-STREAM-INF:BANDWIDTH=696000,RESOLUTION=640x360,FRAME-RATE=30\n360.m3u8";
  const result = filterMasterPlaylist(playlist);
  assert.equal(result.includes("480.m3u8"), true);
  assert.equal(result.includes("360.m3u8"), false);
});

test("GRID 우회 규칙은 480p 요청을 1080p로 바꾼다", () => {
  assert.equal(rules[0].condition.regexFilter.includes("480p"), true);
  assert.equal(rules[0].action.redirect.regexSubstitution.includes("1080p"), true);
});
