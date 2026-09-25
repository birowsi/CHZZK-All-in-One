const test = require("node:test");
const assert = require("node:assert/strict");
const { chooseVariant, filterMasterPlaylist, patchPayload, isAdMediaSource, neutralizeAds, neutralizeAdBuffer, transformText, isAdFeed, install } = require("../page.js");

test("prefers 1080p and removes every P2P field", () => {
  assert.equal(chooseVariant([{ height: 720, fps: 60, bandwidth: 1 }, { height: 1080, fps: 30, bandwidth: 1 }]).height, 1080);

  const payload = { content: { p2pQuality: ["1080p"], livePlaybackJson: JSON.stringify({ meta: { p2p: true }, media: [{ encodingTrack: [{ p2pPath: "x", p2pPathUrlEncoding: "y" }] }] }) } };
  assert.equal(patchPayload(payload), true);
  assert.deepEqual(payload.content.p2pQuality, []);
  assert.deepEqual(JSON.parse(payload.content.livePlaybackJson), { meta: { p2p: false }, media: [{ encodingTrack: [{}] }] });
});

test("일반 방송의 타임머신 플래그와 재생 JSON은 조작하지 않는다", () => {
  const payload = { timeMachine: false, livePlaybackJson: JSON.stringify({ live: { timeMachine: false } }) };
  assert.equal(patchPayload(payload), false);
  assert.equal(payload.timeMachine, false);
  assert.deepEqual(JSON.parse(payload.livePlaybackJson), { live: { timeMachine: false } });
});

test("타임머신 자격/원본 스트림을 임의로 바꾸지 않는다", () => {
  const original = JSON.stringify({ meta: { p2p: false }, media: [{ path: "https://example.com/live.m3u8" }] });
  const payload = { content: { livePlaybackJson: original, timeMachineActive: false, timeMachinePlayback: false } };
  assert.equal(patchPayload(payload), false);
  assert.equal(payload.content.livePlaybackJson, original);
  assert.equal(payload.content.timeMachineActive, false);
  assert.equal(payload.content.timeMachinePlayback, false);
});

test("광고 미디어만 차단 대상으로 고른다", () => {
  assert.equal(isAdMediaSource("https://media.navercdn.com/ad/clip.mp4?token=x"), true);
  assert.equal(isAdMediaSource("https://glad-vod.pstatic.net/a/read/v2/VOD_ALPHA/date/hls/ad.m3u8"), true);
  assert.equal(isAdMediaSource("https://media.navercdn.com/normal.mp4"), false);
  assert.equal(isAdMediaSource("https://media.navercdn.com/service/live/main.m3u8"), false);
  assert.equal(isAdMediaSource("https://example.com/service/ad/segment"), false);
  assert.equal(isAdMediaSource("https://example.com/live/1080p.m3u8"), false);
});

test("광고 스케줄과 표시 응답만 무력화하고 본편 정보는 보존한다", () => {
  const schedule = { head: { description: "GFP Video Ad Schedule" }, adBreaks: [{ adSources: ["ad"], adUnitId: "unit" }] };
  assert.equal(neutralizeAds(schedule), true);
  assert.deepEqual(schedule.adBreaks[0].adSources, []);
  assert.equal(neutralizeAds(schedule), false);
  const playback = { content: { playerAdDisplayResponse: { preRoll: true, midRoll: true, postRoll: true }, p2pQuality: ["1080p"] } };
  assert.equal(neutralizeAds(playback), true);
  assert.deepEqual(playback.content.playerAdDisplayResponse, { preRoll: false, midRoll: false, postRoll: true });
  assert.deepEqual(playback.content.p2pQuality, ["1080p"]);
  const bytes = new TextEncoder().encode(JSON.stringify({ head: { description: "GFP Video Ad Schedule" }, adBreaks: [{ adSources: ["ad"] }] }));
  assert.deepEqual(JSON.parse(new TextDecoder().decode(neutralizeAdBuffer(bytes))).adBreaks[0].adSources, []);
  assert.equal(isAdFeed("https://nam.veta.naver.com/gfp/v1/schedule"), true);
  assert.equal(isAdFeed("https://livecloud.pstatic.net/chzzk/live.m3u8"), false);
  assert.equal(JSON.parse(transformText(JSON.stringify(playback), false, false, false)).content.p2pQuality[0], "1080p");
});

test("광고 피드 fetch 응답만 교체하고 방송 조각은 그대로 둔다", async () => {
  const adUrl = "https://nam.veta.naver.com/gfp/v1/schedule";
  const liveUrl = "https://livecloud.pstatic.net/chzzk/live/1080p/segment.m4v";
  const original = [];
  const target = { Headers, Response, fetch: async url => {
    const response = new Response(url === adUrl
      ? JSON.stringify({ head: { description: "GFP Video Ad Schedule" }, adBreaks: [{ adSources: ["ad"] }] })
      : "video", { headers: { "content-type": url === adUrl ? "application/json" : "video/mp4" } });
    Object.defineProperty(response, "url", { value: url });
    original.push(response);
    return response;
  } };
  install(target);
  const ad = await target.fetch(adUrl);
  assert.notEqual(ad, original[0]);
  assert.deepEqual((await ad.json()).adBreaks[0].adSources, []);
  assert.equal(await target.fetch(liveUrl), original[1]);
});

test("수동 화질 선택을 위해 1080p와 하위 화질 목록을 모두 보존한다", () => {
  const playlist = "#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=1000,RESOLUTION=1280x720,FRAME-RATE=60\n720.m3u8\n#EXT-X-STREAM-INF:BANDWIDTH=2000,RESOLUTION=1920x1080,FRAME-RATE=60\n1080.m3u8";
  const result = filterMasterPlaylist(playlist);
  assert.equal(result.includes("720.m3u8"), true);
  assert.equal(result.includes("1080.m3u8"), true);
  assert.equal(result, playlist);
});

test("치트키 제한 중계는 1080p가 없어도 최고 가용 480p를 유지한다", () => {
  const playlist = "#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=992000,RESOLUTION=852x480,FRAME-RATE=30\n480.m3u8\n#EXT-X-STREAM-INF:BANDWIDTH=696000,RESOLUTION=640x360,FRAME-RATE=30\n360.m3u8";
  const result = filterMasterPlaylist(playlist);
  assert.equal(result.includes("480.m3u8"), true);
  assert.equal(result.includes("360.m3u8"), true);
  assert.equal(result.includes("1080"), false);
});

test("중첩/객체형/축약형 P2P 재생 정보를 제거하고 타임머신 값은 보존한다", () => {
  const payload = { content: { data: { p2pQuality: ["1080p"], playbackJson: {
    live: { p: ["1080p"], timeMachine: false }, media: [{ e: [{ h: "grid-only", encodingTrackId: "1080p" }] }],
  } } } };
  assert.equal(patchPayload(payload), true);
  assert.deepEqual(payload.content.data.p2pQuality, []);
  assert.deepEqual(payload.content.data.playbackJson.live.p, []);
  assert.equal(payload.content.data.playbackJson.live.timeMachine, false);
  assert.equal(payload.content.data.playbackJson.meta.p2p, false);
  assert.deepEqual(payload.content.data.playbackJson.media[0].e, [{ encodingTrackId: "1080p" }]);
  assert.equal(patchPayload(payload), false);
});

test("검증 없는 정적 GRID 리다이렉트는 비활성화한다", () => {
  assert.equal(require("../manifest.json").declarative_net_request.rule_resources[0].enabled, false);
});

test("fetch는 응답 URL/clone/body 일관성을 유지하고 추가 API를 호출하지 않는다", async () => {
  const url = "https://api.chzzk.naver.com/service/v3.3/channels/b33c957eac9335d38e4043c3dca97675/live-detail-meta";
  let calls = 0;
  const target = { Headers, Response, fetch: async () => {
    calls++;
    const response = new Response(JSON.stringify({ code: 200, content: { dab: true, timeMachineActive: false } }));
    Object.defineProperty(response, "url", { value: url });
    return response;
  } };
  install(target);
  const response = await target.fetch(url);
  const clone = response.clone().clone();
  assert.equal(clone.url, url);
  assert.deepEqual(await clone.json(), { code: 200, content: { dab: false, timeMachineActive: false } });
  assert.equal(new TextDecoder().decode(await response.arrayBuffer()).includes('"dab":false'), true);
  assert.equal(calls, 1);
});

test("XHR의 send/abort/동기 요청 계약은 변경하지 않는다", () => {
  class XHR { open(method, url, async) { this.args = [method, url, async]; } send() { return "native"; } abort() {} }
  const send = XHR.prototype.send, abort = XHR.prototype.abort;
  install({ XMLHttpRequest: XHR });
  const xhr = new XHR();
  xhr.open("GET", "https://api.chzzk.naver.com/service/v3/channels/b33c957eac9335d38e4043c3dca97675/live-detail", false);
  assert.equal(xhr.args[2], false);
  assert.equal(xhr.send(), "native");
  assert.equal(XHR.prototype.send, send);
  assert.equal(XHR.prototype.abort, abort);
});

test("일반 MP4 재생은 src/currentTime을 변경하지 않는다", async () => {
  class Media { play() { return Promise.resolve("played"); } }
  install({ HTMLMediaElement: Media, location: { pathname: "/live/test" } });
  const source = new Media();
  Object.assign(source, { src: "https://media.navercdn.com/service/live/movie.mp4", currentTime: 12, duration: 60 });
  assert.equal(await source.play(), "played");
  assert.equal(source.currentTime, 12);
  assert.ok(source.src.endsWith("movie.mp4"));
});

test("GRID OFF는 P2P 응답을 유지하면서 광고 표시 신호만 독립 처리한다", async () => {
  const listeners = new Map();
  const document = {
    addEventListener(type, fn) { listeners.set(type, fn); },
    dispatchEvent(event) { listeners.get(event.type)?.(event); },
  };
  const url = "https://api.chzzk.naver.com/service/v3.3/channels/b33c957eac9335d38e4043c3dca97675/live-detail-meta";
  const target = {
    document, CustomEvent: class { constructor(type, options) { this.type = type; this.detail = options?.detail; } },
    Headers, Response,
    fetch: async () => {
      const response = new Response(JSON.stringify({ content: { dab: true, p2pQuality: ["1080p"] } }));
      Object.defineProperty(response, "url", { value: url });
      return response;
    },
  };
  install(target);
  document.dispatchEvent(new target.CustomEvent('hanbi-playback-settings', { detail: '{"gridBypass":false}' }));
  assert.deepEqual(await (await target.fetch(url)).json(), { content: { dab: false, p2pQuality: ["1080p"] } });
  document.dispatchEvent(new target.CustomEvent('hanbi-playback-settings', { detail: '{"gridBypass":true}' }));
  assert.deepEqual(await (await target.fetch(url)).json(), { content: { dab: false, p2pQuality: [] } });
});

test("광고 전용 주소만 메타데이터 로딩 뒤 건너뛰고 정상 재생을 보존한다", () => {
  const listeners = new Map();
  class Media { play() { return 'native'; } }
  const target = {
    document: {
      addEventListener(type, fn) { listeners.set(type, fn); },
      removeEventListener(type) { listeners.delete(type); },
      dispatchEvent() {},
    },
    CustomEvent: class {},
    HTMLMediaElement: Media,
    location: { pathname: '/live/test' },
  };
  install(target);
  const ad = Object.assign(new Media(), { src: 'https://media.navercdn.com/ad/clip.mp4', currentTime: 0, duration: NaN });
  ad.play();
  assert.equal(ad.currentTime, 0);
  ad.duration = 15;
  listeners.get('loadedmetadata')({ target: ad });
  assert.equal(ad.currentTime, 15);
  const live = Object.assign(new Media(), { src: 'https://media.navercdn.com/live/clip.mp4', currentTime: 0, duration: 15 });
  listeners.get('playing')({ target: live });
  assert.equal(live.currentTime, 0);
});
