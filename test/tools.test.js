const test = require("node:test");
const assert = require("node:assert/strict");
const { chooseRecorderMime, recordingVideoBitrate, isBlindNotice, isAdBlockNotice, isBlockedPromoNotice, popupRemovalRoot, needsFirefoxAudioMonitor, captureReusePlan, calculateTrendOffset, clampSeekTime, isFollowingSectionLabel, compressorDefaults, connectAudioGraph, selectTrendStreams, trendThumbnail, actualQualityHeight } = require("../tools.js");

test("화질 표시는 선택 메뉴가 아닌 실제 디코딩된 영상 높이를 쓴다", () => {
  assert.equal(actualQualityHeight({ readyState: 4, videoHeight: 1080, error: null }), 1080);
  assert.equal(actualQualityHeight({ readyState: 0, videoHeight: 1080, error: null }), null);
  assert.equal(actualQualityHeight({ readyState: 4, videoHeight: 1080, error: { code: 3 } }), null);
});

test("MediaRecorder는 Firefox가 지원하는 첫 WebM 형식을 고른다", () => {
  const supported = new Set(["video/webm;codecs=vp8,opus", "video/webm"]);
  assert.equal(
    chooseRecorderMime({ isTypeSupported: (type) => supported.has(type) }),
    "video/webm;codecs=vp8,opus",
  );
  assert.equal(chooseRecorderMime({}), "");
});

test("녹화 비트레이트는 영상 해상도에 맞추고 범위를 제한한다", () => {
  assert.equal(recordingVideoBitrate({ videoWidth: 1920, videoHeight: 1080 }), 12_000_000);
  assert.equal(recordingVideoBitrate({ videoWidth: 1280, videoHeight: 720 }), 5_333_333);
  assert.equal(recordingVideoBitrate({ videoWidth: 854, videoHeight: 480 }), 3_000_000);
  assert.equal(recordingVideoBitrate({ videoWidth: 3840, videoHeight: 2160 }), 16_000_000);
  assert.equal(recordingVideoBitrate({ videoWidth: 0, videoHeight: 0 }), 12_000_000);
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

test("구매 안내 제거 시 딤드 배경까지 포함한 래퍼를 고른다", () => {
  const body = {};
  const backdrop = { matches: () => true };
  const popup = { matches: () => false };
  const wrapper = { parentElement: body, children: [backdrop, popup] };
  popup.parentElement = wrapper;
  assert.equal(popupRemovalRoot(popup, body), wrapper);
});

test("실제 사이트처럼 딤드가 조상이면 해당 모달 배경까지만 선택한다", () => {
  const body = {};
  const backdrop = { matches: () => true, parentElement: body, children: [] };
  const popup = { parentElement: backdrop };
  assert.equal(popupRemovalRoot(popup, body), backdrop);
});

test("타임머신은 빈 탐색 범위와 범위 사이의 간격으로 이동하지 않는다", () => {
  const { seekableTarget } = require("../tools.js");
  assert.equal(seekableTarget({ length: 0 }, 10), null);
  const ranges = { length: 2, start: (i) => [10, 40][i], end: (i) => [20, 60][i] };
  assert.equal(seekableTarget(ranges, 5), 10);
  assert.equal(seekableTarget(ranges, 35), 40);
  assert.equal(seekableTarget(ranges, 90), 59.9);
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

test("Firefox 공유 캡처는 같은 영상을 재사용하고 교체를 구분한다", () => {
  const a = {}, b = {};
  assert.equal(captureReusePlan(null, a), "create");
  assert.equal(captureReusePlan(a, a), "reuse");
  assert.equal(captureReusePlan(a, b), "replace");
});

test("트렌드는 급상승을 감지하고 720 썸네일을 고른다", () => {
  const live = { concurrentUserCount: 1600, liveImageUrl: "https://example.com/{type}.jpg", channel: { channelId: "a" } };
  const result = selectTrendStreams([live], new Map([["a", 1000]]), 1000, 10);
  assert.equal(result.items[0].pumping, true);
  assert.equal(trendThumbnail(live), "https://example.com/720.jpg");
});

test("트렌드 기준에 맞는 방송이 없으면 기존 인기 방송 fallback을 유지한다", () => {
  const lives = [
    { channelId: "a", concurrentUserCount: 800 },
    { channelId: "b", concurrentUserCount: 700 },
  ];
  for (const previous of [new Map(), new Map([["a", 750]])]) {
    const result = selectTrendStreams(lives, previous, 1000, 10);
    assert.deepEqual(result.items.map(({ channelId, pumping }) => [channelId, pumping]), [["a", false], ["b", false]]);
  }
  assert.deepEqual(selectTrendStreams(lives, new Map(), 1000, 1).items.map(({ channelId }) => channelId), ["a"]);
});

test("트렌드 바는 열린 왼쪽 메뉴만큼 시작점을 보정한다", () => {
  assert.equal(calculateTrendOffset(0, 0, 240), 240);
  assert.equal(calculateTrendOffset(240, 0, 240), 0);
  assert.equal(calculateTrendOffset(240, 240, 80), 80);
});

test("방향키 탐색은 현재 seek 범위를 넘지 않는다", () => {
  assert.equal(clampSeekTime(12, -5, 10, 20), 10);
  assert.equal(clampSeekTime(18, 5, 10, 20), 20);
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
  assert.equal(connectAudioGraph(graph, true), true);
  assert.deepEqual(links, []);
  assert.equal(connectAudioGraph(graph, false), true);
  assert.deepEqual(links, ["source->destination"]);
});

test("컴프레서 연결 실패 시 원음을 연결한다", () => {
  const destination = {}, links = [];
  const graph = { context: { destination }, source: { disconnect() {}, connect(target) { links.push(target); } }, compressor: { disconnect() {}, connect() { throw new Error("failed"); } }, gain: { disconnect() {} } };
  assert.equal(connectAudioGraph(graph, true), false);
  assert.equal(links.at(-1), destination);
  assert.equal(graph.mode, "bypass");
});
