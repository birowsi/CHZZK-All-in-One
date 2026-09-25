const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const following = require("../following-logic.js");
const { higherQualityUrl } = require("../grid-bypass.js");

async function background() {
  const event = () => ({ listeners: [], addListener(fn) { this.listeners.push(fn); } });
  const storage = {}, clock = { now: 100_000 };
  const api = {
    tabs: { onRemoved: event(), onUpdated: event() },
    runtime: { onMessage: event(), onInstalled: event(), onStartup: event(), getPlatformInfo: async () => ({ os: "win" }) },
    storage: { onChanged: event(), local: {
      get: async (keys) => Object.fromEntries((Array.isArray(keys) ? keys : [keys]).map((key) => [key, storage[key]])),
      set: async (data) => Object.assign(storage, data),
      remove: async (keys) => keys.forEach((key) => delete storage[key]),
    } },
    declarativeNetRequest: { updateEnabledRulesets: async () => {} },
    webRequest: Object.fromEntries(["onBeforeRequest", "onHeadersReceived", "onCompleted", "onErrorOccurred"].map((key) => [key, event()])),
  };
  vm.runInNewContext(fs.readFileSync(require.resolve("../background.js"), "utf8"), {
    browser: api, console, Date: class extends Date { static now() { return clock.now; } },
    HanbiFollowingLogic: following,
    HanbiGridLogic: { higherQualityUrl },
    URL,
    HanbiLogs: require("../log-store.js"),
    HanbiRecordingStore: { createStore: () => ({}) },
  });
  await new Promise(setImmediate);
  return { api, storage, clock, send: (message, tabId = 1) => api.runtime.onMessage.listeners[0](message, { tab: { id: tabId, active: true } }) };
}
const channel = "b33c957eac9335d38e4043c3dca97675";

test("팔로잉 계정 전환/새 채널/여러 탭에서 시작 알림을 만들지 않는다", async () => {
  const bg = await background();
  async function poll(account, entries) {
    const { pollId } = await bg.send({ type: "following-poll" });
    assert.ok(pollId);
    assert.equal((await bg.send({ type: "following-poll" }, 2)).pollId, undefined);
    const result = await bg.send({ type: "following-snapshot", account, entries, pollId });
    await bg.send({ type: "following-poll-end", pollId });
    assert.equal((await bg.send({ type: "following-poll" }, 2)).pollId, undefined);
    bg.clock.now += 5_001;
    return result.alerts;
  }
  assert.equal((await poll("account-a", [{ channelId: channel, liveKey: "" }])).length, 0);
  assert.equal((await poll("account-a", [{ channelId: channel, liveKey: "7" }])).length, 1);
  assert.equal((await poll("account-a", [{ channelId: channel, liveKey: "7" }, { channelId: "a".repeat(32), liveKey: "8" }])).length, 0);
  assert.equal((await poll("account-b", [{ channelId: channel, liveKey: "9" }])).length, 0);
  assert.equal((await poll("account-b", [{ channelId: channel, liveKey: "9" }])).length, 0);
  bg.clock.now += 60_001;
  assert.equal((await poll("account-b", [{ channelId: channel, liveKey: "10" }])).length, 0);
});

test("만료된 팔로잉 조회 결과와 기능 OFF 이후 결과는 무시한다", async () => {
  const bg = await background();
  const first = await bg.send({ type: "following-poll" });
  bg.clock.now += 11_000;
  const second = await bg.send({ type: "following-poll" }, 2);
  const entries = [{ channelId: channel, liveKey: "7" }];
  await bg.send({ type: "following-snapshot", pollId: first.pollId, account: "a", entries });
  assert.equal(bg.storage.followingLiveState, undefined);
  bg.storage.features = { followingAlerts: false };
  await bg.send({ type: "following-snapshot", pollId: second.pollId, account: "a", entries }, 2);
  assert.equal(bg.storage.followingLiveState, undefined);
});

test("업그레이드가 403이면 원본 화질로 돌아가며 리다이렉트 루프가 없다", async () => {
  const bg = await background();
  const before = bg.api.webRequest.onBeforeRequest.listeners[0];
  const headers = bg.api.webRequest.onHeadersReceived.listeners[0];
  const request = { url: "https://live.navercdn.com/480p/main.m3u8", originUrl: "https://chzzk.naver.com/live/test", requestId: "1" };
  const upgrade = await before(request);
  assert.equal(upgrade.redirectUrl, request.url.replace("480p", "1080p"));
  const fallback = headers({ ...request, url: upgrade.redirectUrl, statusCode: 403 });
  assert.equal(fallback.redirectUrl, request.url);
  assert.equal((await before(request)).redirectUrl, undefined);
  bg.api.webRequest.onCompleted.listeners[0](request);
  assert.equal((await before({ ...request, requestId: "2" })).redirectUrl, undefined);
  assert.equal((await before({ ...request, originUrl: "moz-extension://test/", requestId: "3" })).redirectUrl, undefined);
});

test("플레이어 blob/worker 요청도 문서 출처를 확인해 1080p로 우회한다", async () => {
  const bg = await background();
  const before = bg.api.webRequest.onBeforeRequest.listeners[0];
  const url = "https://live.navercdn.com/480p/main.m3u8";
  assert.equal((await before({ url, requestId: "blob", originUrl: "blob:https://chzzk.naver.com/worker" })).redirectUrl, url.replace("480p", "1080p"));
  assert.equal((await before({ url, requestId: "worker", originUrl: "https://ssl.pstatic.net/player.js", documentUrl: "https://chzzk.naver.com/live/test" })).redirectUrl, url.replace("480p", "1080p"));
});
