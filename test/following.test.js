const test = require("node:test");
const assert = require("node:assert/strict");
const { normalizeFollowingPayload, detectLiveStarts } = require("../following-logic.js");

test("전용 팔로잉 응답만 알림 목록으로 인정한다", () => {
  const entries = normalizeFollowingPayload({ code: 200, content: { followingList: [{
    channelId: "b33c957eac9335d38e4043c3dca97675", channel: { channel: { channelName: "채널", channelImageUrl: "profile" } },
    streamer: { openLive: true }, liveInfo: { liveId: 7, liveTitle: "제목", liveImageUrl: "thumb" },
  }] } });
  assert.deepEqual(entries, [{ channelId: "b33c957eac9335d38e4043c3dca97675", channelName: "채널", channelImageUrl: "profile", liveTitle: "제목", liveImageUrl: "thumb", liveKey: "7" }]);
  assert.equal(normalizeFollowingPayload({ content: { data: [{ channelId: "not-following" }] } }), null);
});

test("명시적인 비팔로잉, 오류 응답, 신규 목록 진입은 알림에서 제외한다", () => {
  const raw = { channelId: "b33c957eac9335d38e4043c3dca97675", streamer: { openLive: true }, personalData: { following: false } };
  assert.deepEqual(normalizeFollowingPayload({ code: 200, content: { followingList: [raw] } }), []);
  assert.equal(normalizeFollowingPayload({ code: 401, content: { followingList: [] } }), null);
  assert.deepEqual(detectLiveStarts({ old: "7" }, [{ channelId: "new", liveKey: "8" }]).alerts, []);
});

test("팔로잉 DOM 최초 조회는 이미 방송 중인 채널을 알리지 않는다", () => {
  const entries = [{ channelId: "abc", channelName: "채널", liveKey: "open" }];
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
  assert.equal(detectLiveStarts({ abc: "open" }, live).alerts.length, 0);
  assert.equal(detectLiveStarts({ abc: "7" }, [{ channelId: "abc", liveKey: "open" }]).alerts.length, 0);
});
