const test = require("node:test");
const assert = require("node:assert/strict");
const { chooseRecorderMime, isBlindNotice, isAdBlockNotice, isBlockedPromoNotice, needsFirefoxAudioMonitor, calculateTrendOffset, clampSeekTime, channelIdFromHref, isFollowingSectionLabel, compressorDefaults, connectAudioGraph, selectTrendStreams, trendThumbnail } = require("../tools.js");

test("MediaRecorder는 Firefox가 지원하는 첫 WebM 형식을 고른다", () => {
  const supported = new Set(["video/webm;codecs=vp8,opus", "video/webm"]);
  assert.equal(
    chooseRecorderMime({ isTypeSupported: (type) => supported.has(type) }),
    "video/webm;codecs=vp8,opus",
  );
  assert.equal(chooseRecorderMime({}), "");
});

test("광고 차단 경고만 감지한다", () => {
  assert.equal(isAdBlockNotice("광고 차단 프로그램을 사용 중입니다"), true);
  assert.equal(isAdBlockNotice("광고 차단 프로그램을 사용 중이신가요?"), true);
  assert.equal(isAdBlockNotice("로그인이 필요한 방송입니다"), false);
});

test("타임머신 치트키 구매 안내를 감지한다", () => {
  assert.equal(isBlockedPromoNotice("치트키를 구매하면 타임머신 기능을 이용할 수 있어요! 치트키 구매 혜택"), true);
  assert.equal(isBlockedPromoNotice("타임머신 기능을 이용 중입니다"), false);
});

test("실제 블라인드 안내만 감지한다", () => {
  assert.equal(isBlindNotice("관리자에 의해 블라인드 처리된 메시지입니다."), true);
  assert.equal(isBlindNotice("블라인드 테스트 방송입니다"), false);
});

test("Firefox 녹화 오디오는 재생 모니터를 연결한다", () => {
  assert.equal(needsFirefoxAudioMonitor("Mozilla/5.0 Firefox/154.0", 1), true);
  assert.equal(needsFirefoxAudioMonitor("Mozilla/5.0 Chrome/140.0", 1), false);
  assert.equal(needsFirefoxAudioMonitor("Mozilla/5.0 Firefox/154.0", 0), false);
});

test("트렌드는 급상승을 감지하고 720 썸네일을 고른다", () => {
  const live = { concurrentUserCount: 1600, liveImageUrl: "https://example.com/{type}.jpg", channel: { channelId: "a" } };
  const result = selectTrendStreams([live], new Map([["a", 1000]]), 1000, 10);
  assert.equal(result.items[0].pumping, true);
  assert.equal(trendThumbnail(live), "https://example.com/720.jpg");
});

test("트렌드 바는 열린 왼쪽 메뉴만큼 시작점을 보정한다", () => {
  assert.equal(calculateTrendOffset(0, 0, 240), 240);
  assert.equal(calculateTrendOffset(240, 0, 240), 0);
  assert.equal(calculateTrendOffset(240, 240, 80), 80);
});

test("방향키 탐색은 현재 seek 범위를 넘지 않는다", () => {
  assert.equal(clampSeekTime(12, -5, 10, 20), 10);
  assert.equal(clampSeekTime(18, 5, 10, 20), 20);
  assert.equal(channelIdFromHref("/live/channel-id?x=1"), "channel-id");
  assert.equal(channelIdFromHref("/video/123"), "");
});

test("팔로잉 섹션만 인정하고 사이드바 전체 문구는 거부한다", () => {
  assert.equal(isFollowingSectionLabel("팔로잉 채널"), true);
  assert.equal(isFollowingSectionLabel("Following Channels"), true);
  assert.equal(isFollowingSectionLabel("팔로잉 인기 카테고리 파트너 스트리머"), false);
});

test("컴프레서는 cheese-knife와 같은 Source → Compressor → Gain 그래프를 쓴다", () => {
  assert.deepEqual(compressorDefaults, { threshold: -50, knee: 40, ratio: 12, attack: 0, release: 0.25 });
  const links = [];
  const node = (name) => ({ name, connect: (target) => links.push(`${name}->${target.name}`), disconnect() {} });
  const graph = {
    source: node("source"), compressor: node("compressor"), gain: node("gain"),
    context: { destination: { name: "destination" } },
  };
  assert.equal(connectAudioGraph(graph, true), true);
  assert.deepEqual(links, ["source->compressor", "compressor->gain", "gain->destination"]);
  links.length = 0;
  assert.equal(connectAudioGraph(graph, false), true);
  assert.deepEqual(links, ["source->destination"]);
});
