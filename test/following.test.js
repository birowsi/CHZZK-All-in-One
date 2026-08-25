const test = require("node:test");
const assert = require("node:assert/strict");
const { normalizeFollowingPayload, detectLiveStarts } = require("../following-logic.js");

test("팔로잉 API 응답을 정규화하고 최초 조회는 알리지 않는다", () => {
  const entries = normalizeFollowingPayload({ content: { followingList: [{
    channelId: "abc", channel: { channelName: "채널", channelImageUrl: "profile" },
    streamer: { openLive: true }, liveInfo: { liveId: 7, liveTitle: "제목", liveImageUrl: "thumb" },
  }] } });
  assert.deepEqual(entries[0], {
    channelId: "abc", channelName: "채널", channelImageUrl: "profile", liveTitle: "제목",
    liveImageUrl: "thumb", liveKey: "7",
  });
  assert.deepEqual(detectLiveStarts(undefined, entries).alerts, []);
});

test("방송 시작과 재시작만 한 번씩 알린다", () => {
  const offline = [{ channelId: "abc", liveKey: "" }];
  const live = [{ channelId: "abc", liveKey: "7" }];
  let result = detectLiveStarts({ abc: "" }, live);
  assert.equal(result.alerts.length, 1);
  result = detectLiveStarts(result.state, live);
  assert.equal(result.alerts.length, 0);
  result = detectLiveStarts(result.state, [{ channelId: "abc", liveKey: "8" }]);
  assert.equal(result.alerts.length, 1);
  assert.deepEqual(detectLiveStarts(result.state, offline).state, { abc: "" });
});

test("알 수 없는 API 응답은 상태로 사용하지 않는다", () => {
  assert.equal(normalizeFollowingPayload({ error: true }), null);
});
