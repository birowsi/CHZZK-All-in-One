const test = require("node:test");
const assert = require("node:assert/strict");
const { detectLiveStarts } = require("../following-logic.js");

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
});
