const test = require("node:test");
const assert = require("node:assert/strict");
const { createTimeShift, createRawRecorder, findHls, bufferedPosition, mediaCandidates, install } = require("../timeshift.js");
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
  assert.equal(hls.config.backBufferLength, Infinity);
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
test("일시정지 중 HLS 조각 로딩과 앞쪽 버퍼를 유지하고 재개 시 제한을 복원한다", () => {
  const { hls, media } = fixture();
  const original = { ...hls.config };
  const starts = [];
  let resumes = 0;
  media.paused = true;
  hls.loadingEnabled = false;
  hls.bufferingEnabled = false;
  hls.startLoad = (...args) => { starts.push(args); hls.loadingEnabled = true; };
  hls.resumeBuffering = () => { resumes++; hls.bufferingEnabled = true; };
  const control = createTimeShift();
  control.run("enable", hls, media);
  assert.equal(media.currentTime, 95);
  assert.deepEqual(starts, [[95, true]]);
  assert.equal(resumes, 1);
  assert.equal(hls.config.maxBufferLength, 3600);
  assert.equal(hls.config.maxMaxBufferLength, 3600);
  control.run("status", hls, media);
  assert.equal(starts.length, 1);
  media.paused = false;
  control.run("status", hls, media);
  assert.equal(hls.config.maxBufferLength, 330);
  assert.equal(hls.config.maxMaxBufferLength, 600);
  control.restore();
  assert.deepEqual(hls.config, original);
});
test("HLS가 메모리 압박으로 낮춘 버퍼 한도를 다시 올리지 않는다", () => {
  const { hls, media } = fixture();
  media.paused = true;
  const control = createTimeShift();
  control.run("enable", hls, media);
  hls.config.maxMaxBufferLength = 120;
  control.run("status", hls, media);
  assert.equal(hls.config.maxMaxBufferLength, 120);
  media.paused = false;
  control.run("status", hls, media);
  assert.equal(hls.config.maxMaxBufferLength, 120);
});
test("사이트 streaming profile은 TM을 덮지 않고 LIVE에서 최신 사이트 설정으로 복원된다", () => {
  const { hls, media } = fixture();
  hls.userConfig = {};
  const owner = Object.create({ _updateHlsConfig(config) {
    Object.assign(this._hls.config, config);
    Object.assign(this._hls.userConfig, config);
    return 'updated';
  } });
  owner._hls = hls;
  findHls({ _corePlayer: { player: { _mediaController: owner } } });
  const update = owner._updateHlsConfig, sync = hls.streamController.synchronizeToLiveEdge;
  const control = createTimeShift();
  control.run('enable', hls, media);
  assert.equal(owner._updateHlsConfig({ maxMaxBufferLength: 15, lowLatencyMode: true }), 'updated');
  assert.equal(hls.config.maxMaxBufferLength, 600);
  assert.equal(hls.config.lowLatencyMode, true);
  assert.equal(hls.userConfig.maxMaxBufferLength, 15);
  media.paused = true;
  control.run('enable', hls, media);
  owner._updateHlsConfig({ maxMaxBufferLength: 15 });
  assert.equal(hls.config.maxMaxBufferLength, 3600);
  hls.config.maxMaxBufferLength = 120; // HLS quota recovery bypasses the site's profile method.
  owner._updateHlsConfig({ maxMaxBufferLength: 15 });
  control.run('status', hls, media);
  assert.equal(hls.config.maxMaxBufferLength, 120);
  control.run('live', hls, media);
  assert.equal(hls.config.maxMaxBufferLength, 120); // Keep the native recovery reduction.
  assert.equal(owner._updateHlsConfig, update);
  assert.equal(Object.hasOwn(owner, '_updateHlsConfig'), false);
  assert.equal(hls.streamController.synchronizeToLiveEdge, sync);
  owner._updateHlsConfig({ maxMaxBufferLength: 15 });
  control.run('enable', hls, media);
  owner._updateHlsConfig({ maxMaxBufferLength: 20 });
  control.restore();
  assert.equal(hls.config.maxMaxBufferLength, 20);
});
function accessorMediaFixture() {
  const value = fixture();
  const media = Object.assign(Object.create({
    get currentTime() { return this.time; },
    set currentTime(time) { this.time = time; },
  }), { time: 50, paused: true, buffered: value.media.buffered, seekable: { length: 1, end: () => 100 } });
  value.hls.media = media;
  return { ...value, media };
}
test("재개 이벤트의 사이트 자동 LIVE 이동만 한 번 제한하고 접근자를 즉시 복원한다", async () => {
  const { hls, media } = accessorMediaFixture();
  const owner = { _hls: hls, seekable: { length: 1, end: () => 97 }, _updateHlsConfig() {} };
  findHls({ _corePlayer: { player: { _mediaController: owner } } });
  const control = createTimeShift();
  control.run('enable', hls, media);
  media.paused = false;
  control.resume(hls, media);
  media.currentTime = 97; // Site seekable excludes target latency; native media.seekable ends at 100.
  assert.equal(media.currentTime, 50);
  media.currentTime = 70; // Other manual seeks remain available even during play dispatch.
  assert.equal(media.currentTime, 70);
  await new Promise(resolve => setTimeout(resolve, 5));
  assert.equal(Object.hasOwn(media, 'currentTime'), false);
  media.currentTime = 100;
  assert.equal(media.currentTime, 100);
  control.restore();
});
test("버퍼 소실·플레이어 교체·명시적 LIVE는 재개 위치 보호를 해제한다", () => {
  const { hls, media } = accessorMediaFixture();
  const control = createTimeShift();
  control.run('enable', hls, media);
  control.resume(hls, media);
  media.buffered = { length: 0 };
  media.currentTime = 100;
  assert.equal(media.currentTime, 100);
  control.run('status', null, null);
  assert.equal(Object.hasOwn(media, 'currentTime'), false);
  media.buffered = { length: 1, start: () => 10, end: () => 100 };
  media.currentTime = 50;
  control.run('enable', hls, media);
  control.resume(hls, media);
  control.run('live', hls, media);
  assert.equal(media.currentTime, 99);
  assert.equal(Object.hasOwn(media, 'currentTime'), false);
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

test("본방송을 실제로 일시정지하면 TM 패널 없이도 버퍼 유지 모드로 들어간다", () => {
  const listeners = new Map();
  const { hls, media } = fixture();
  media.paused = false;
  media.readyState = 4;
  media.videoWidth = 1920;
  media.videoHeight = 1080;
  media.closest = () => null;
  const layout = { querySelectorAll: () => [media], _corePlayer: { player: { _mediaController: { _hls: hls } } } };
  const document = {
    addEventListener(name, listener) { listeners.set(name, listener); },
    getElementById: () => layout,
  };
  let tick;
  const target = { document, location: { pathname: "/live/a" }, setInterval(fn) { tick = fn; }, addEventListener() {} };
  install(target);
  media.paused = true;
  listeners.get("pause")({ target: media });
  assert.equal(hls.config.maxBufferLength, 30);
  media.paused = false;
  listeners.get("playing")({ target: media });
  media.paused = true;
  listeners.get("pause")({ target: media });
  assert.equal(hls.config.maxBufferLength, 3600);
  media.paused = false;
  tick();
  assert.equal(hls.config.maxBufferLength, 330);
});

test("RAW는 HLS 조각을 다시 인코딩하지 않고 TS/MP4 원본 바이트로 연결한다", async () => {
  const listeners = new Map(), media = {};
  const hls = { media, on(name, fn) { listeners.set(name, fn); }, off(name, fn) { if (listeners.get(name) === fn) listeners.delete(name); } };
  const emit = (sn, payload, extra = {}) => listeners.get("hlsFragLoaded")?.("hlsFragLoaded", {
    frag: { type: "main", sn, level: 2, ...extra }, payload,
  });
  const recorder = createRawRecorder();
  const ts = () => { const packet = new Uint8Array(376); packet[0] = packet[188] = 0x47; return packet; };
  recorder.start(hls, media);
  emit(100, ts().buffer);
  emit(101, ts().buffer);
  const transport = recorder.stop();
  assert.equal(transport.ext, "ts");
  assert.equal(transport.blob.size, 752);
  assert.equal(listeners.size, 0);

  const box = (name) => { const data = new Uint8Array(16); data.set([...name].map(c => c.charCodeAt(0)), 4); return data; };
  const init = box("ftyp"), fragment = box("moof");
  recorder.start(hls, media);
  emit(200, fragment.buffer, { initSegment: { data: init } });
  const mp4 = recorder.stop();
  assert.equal(mp4.ext, "mp4");
  assert.deepEqual(new Uint8Array(await mp4.blob.arrayBuffer()), new Uint8Array([...init, ...fragment]));

  let failure = "", partial;
  const guarded = createRawRecorder((message, result) => { failure = message; partial = result; });
  guarded.start(hls, media);
  emit(300, ts().buffer);
  emit(302, ts().buffer);
  assert.match(failure, /누락/);
  assert.equal(partial.ext, "ts");
  assert.equal(partial.blob.size, 376);
  assert.equal(guarded.active(), false);
  assert.throws(() => guarded.stop(), /누락/);
});

test("RAW 버튼 명령은 본방송 HLS에만 연결하고 저장 링크를 만든다", () => {
  const listeners = new Map(), hlsListeners = new Map(), links = [];
  const media = { readyState: 2, videoWidth: 1920, videoHeight: 1080, closest: () => null, buffered: { length: 0 } };
  const hls = { media, levels: [], config: {}, streamController: {},
    on(name, fn) { hlsListeners.set(name, fn); }, off(name) { hlsListeners.delete(name); } };
  const root = { _corePlayer: { player: { _mediaController: { _hls: hls } } }, querySelector: () => media };
  const document = {
    addEventListener(name, fn) { listeners.set(name, fn); },
    dispatchEvent(event) { listeners.get(event.type)?.(event); },
    getElementById: () => root, querySelector: () => media,
    createElement: () => ({ click() { links.push({ name: this.download, url: this.href }); }, remove() {} }),
    body: { appendChild() {} },
  };
  const target = { document, location: { pathname: "/live/a" }, CustomEvent: class { constructor(type, options) { this.type = type; this.detail = options.detail; } },
    URL: { createObjectURL: () => "blob:test", revokeObjectURL() {} }, setInterval() {}, setTimeout() {}, addEventListener() {} };
  install(target);
  let response;
  listeners.set("hanbi-raw-result", event => { response = JSON.parse(event.detail); });
  document.dispatchEvent(new target.CustomEvent("hanbi-raw-command", { detail: JSON.stringify({ id: 1, command: "start", name: "test" }) }));
  assert.equal(response.ok, true);
  const packet = new Uint8Array(376); packet[0] = packet[188] = 0x47;
  hlsListeners.get("hlsFragLoaded")("hlsFragLoaded", { frag: { type: "main", sn: 1, level: 0 }, payload: packet.buffer });
  document.dispatchEvent(new target.CustomEvent("hanbi-raw-command", { detail: JSON.stringify({ id: 2, command: "stop" }) }));
  assert.equal(response.ok, true);
  assert.equal(response.ext, "ts");
  assert.deepEqual(links, [{ name: "test.ts", url: "blob:test" }]);
  assert.equal(hlsListeners.size, 0);
});

test("RAW는 저지연 HLS 부분 조각을 순서대로 이어 붙이고 재전송은 건너뛴다", async () => {
  const listeners = new Map(), media = {};
  const hls = { media, on(name, fn) { listeners.set(name, fn); }, off(name, fn) { if (listeners.get(name) === fn) listeners.delete(name); } };
  const box = (name, fill) => { const data = new Uint8Array(16).fill(fill); data.set([...name].map(c => c.charCodeAt(0)), 4); data.fill(0, 0, 4); return data; };
  const init = box("ftyp", 1);
  const emit = (sn, index, fill, independent = index === 0) => listeners.get("hlsFragLoaded")?.("hlsFragLoaded", {
    frag: { type: "main", sn, level: 0, initSegment: { data: init } },
    part: index === null ? null : { index, independent }, payload: box("moof", fill).buffer,
  });
  const recorder = createRawRecorder();
  recorder.start(hls, media);
  emit(10, 1, 9, false);        // 키프레임이 아닌 중간 부분 조각에서는 시작하지 않는다
  emit(10, 2, 2, true);         // 독립 부분 조각부터 시작
  emit(10, 3, 3);
  emit(10, 3, 3);               // 재전송
  emit(10, null, 8);            // 같은 조각 전체는 중복
  emit(11, 0, 4);
  emit(11, 1, 5);
  emit(12, null, 6);            // 다음 조각 전체
  const mp4 = recorder.stop();
  assert.equal(mp4.ext, "mp4");
  const bytes = new Uint8Array(await mp4.blob.arrayBuffer());
  assert.equal(bytes.length, 16 * 6);
  assert.deepEqual([...bytes].filter((_, index) => index % 16 === 15), [1, 2, 3, 4, 5, 6]);

  let failure = "", partial;
  const guarded = createRawRecorder((message, result) => { failure = message; partial = result; });
  guarded.start(hls, media);
  emit(20, 0, 1);
  emit(20, 2, 3);               // 1번 부분 조각 누락
  assert.match(failure, /누락/);
  assert.equal(partial.blob.size, 32);
  assert.equal(guarded.active(), false);
});
