const test = require("node:test");
const assert = require("node:assert/strict");
const { createTimeShift, findHls, bufferedPosition, mediaCandidates, install } = require("../timeshift.js");
test("광고 video가 남아 있어도 재생 가능한 본편 video를 고른다", () => {
  const ad = { videoWidth: 1920, videoHeight: 1080, readyState: 4, closest: () => ({}) };
  const live = { videoWidth: 1920, videoHeight: 1080, readyState: 4, closest: () => null };
  assert.equal(mediaCandidates({ querySelectorAll: () => [ad, live] }), live);
});
function fixture() {
  let syncCount = 0;
  const media = { currentTime: 95, buffered: { length: 1, start: () => 10, end: () => 100 } };
  const hls = { media, config: { backBufferLength: 20, maxBufferLength: 30, maxMaxBufferLength: 600, maxBufferSize: 60_000_000 }, streamController: { synchronizeToLiveEdge() { syncCount++; } } };
  return { hls, media, count: () => syncCount };
}
test("원본 방식으로 buffered 내 탐색하고 실시간 강제 복귀를 막는다", () => {
  const { hls, media, count } = fixture();
  const control = createTimeShift();
  assert.equal(control.run("seek", hls, media, 60).active, true);
  assert.equal(media.currentTime, 60);
  assert.equal(hls.config.backBufferLength, 300);
  hls.streamController.synchronizeToLiveEdge({});
  assert.equal(count(), 0);
  media.currentTime = 0; // Evicted buffer must still recover.
  hls.streamController.synchronizeToLiveEdge({});
  assert.equal(count(), 1);
});
test("LIVE/닫기/플레이어 교체 시 원래 설정과 함수를 복원한다", () => {
  const { hls, media } = fixture();
  const original = { ...hls.config }, sync = hls.streamController.synchronizeToLiveEdge;
  const control = createTimeShift();
  control.run("enable", hls, media);
  control.run("enable", hls, media); // Must not save patched values as originals.
  assert.equal(control.run("live", hls, media).active, false);
  assert.equal(media.currentTime, 99);
  assert.deepEqual(hls.config, original);
  assert.equal(hls.streamController.synchronizeToLiveEdge, sync);
  control.run("enable", hls, media);
  control.run("status", null, null);
  assert.deepEqual(hls.config, original);
  control.run("enable", hls, media);
  control.restore();
  assert.equal(hls.streamController.synchronizeToLiveEdge, sync);
});
test("연결 실패는 정상 재생을 건드리지 않으며 성공으로 보고하지 않는다", () => {
  const { hls, media } = fixture();
  const control = createTimeShift();
  assert.throws(() => control.run("seek", null, media, 50), /HLS/);
  assert.equal(media.currentTime, 95);
  const config = { ...hls.config };
  Object.defineProperty(hls.streamController, "synchronizeToLiveEdge", { writable: false });
  assert.throws(() => control.run("enable", hls, media));
  assert.deepEqual(hls.config, config);
  assert.equal(control.run("status", hls, media).active, false);
});
test("React state 및 직접 연결된 core player를 찾고 없는 객체도 안전하게 처리한다", () => {
  const { hls } = fixture();
  const player = { _corePlayer: { player: { _mediaController: { _hls: hls } } } };
  assert.equal(findHls(player), hls);
  assert.equal(findHls({ __reactFiber$test: { memoizedState: { memoizedState: null, next: { memoizedState: player } } } }), hls);
  assert.equal(findHls(null), null);
  assert.equal(findHls({ __reactFiber$test: { memoizedState: null } }), null);
});
test("탐색은 빈 버퍼/간격/가장자리에서 원본의 안전 여백을 지킨다", () => {
  assert.equal(bufferedPosition({ length: 0 }, 5), null);
  const ranges = { length: 2, start: (i) => [10, 50][i], end: (i) => [20, 100][i] };
  assert.equal(bufferedPosition(ranges, 0), 11);
  assert.equal(bufferedPosition(ranges, 45), 51);
  assert.equal(bufferedPosition(ranges, 150), 99);
});

test("첫 최고 화질만 자동 선택하고 사용자 수동 선택과 채널 이동을 존중한다", () => {
  const listeners = new Map();
  const media = { readyState: 2, buffered: { length: 0 }, closest: () => null };
  const player = () => ({ media, levels: [{ height: 720, bitrate: 1000 }, { height: 1080, bitrate: 2000 }], currentLevel: -1,
    config: {}, streamController: {} });
  let hls = player(), tick;
  const root = { _corePlayer: { player: { _mediaController: { get _hls() { return hls; } } } },
    querySelector: () => media };
  const document = {
    addEventListener(type, fn) { listeners.set(type, fn); },
    getElementById: () => root,
    querySelector: () => media,
  };
  const target = { document, location: { pathname: '/live/a' }, setInterval(fn) { tick = fn; }, addEventListener() {} };
  install(target);
  tick();
  assert.equal(hls.currentLevel, 1);
  listeners.get('hanbi-quality-manual')();
  hls = player();
  tick();
  assert.equal(hls.currentLevel, -1);
  target.location.pathname = '/live/b';
  tick();
  assert.equal(hls.currentLevel, 1);
});
