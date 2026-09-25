const test = require('node:test');
const assert = require('node:assert/strict');
const logs = require('../log-store.js');
const { createStore } = require('../recording-store.js');
const fakeIndexedDB = require('../qa/fake-indexeddb.cjs');

const entry = (channelId, amount = 0, timestamp = '2026-09-23T00:00:00Z') => ({
  channelId, channelName: channelId, amount, method: 'view', timestamp,
});
function logStore(initial = []) {
  let powerLogs = structuredClone(initial), writes = 0, number = 0;
  const api = { storage: {
    local: { get: async () => ({ powerLogs: structuredClone(powerLogs) }), set: async data => { writes++; powerLogs = structuredClone(data.powerLogs); } },
    sync: { get: async () => ({ maxLogs: 10000 }) },
  } };
  return { execute: logs.createStore(api, () => 'id-' + ++number), state: () => structuredClone(powerLogs), writes: () => writes };
}

test('동시 획득은 보존하고 같은 채널의 1분 중복 view만 합친다', async () => {
  const db = logStore();
  await Promise.all([
    db.execute({ op: 'append', log: entry('a') }),
    db.execute({ op: 'append', log: entry('b') }),
    db.execute({ op: 'append', log: entry('a', 0, '2026-09-23T00:00:30Z') }),
  ]);
  assert.deepEqual(db.state().map(item => item.channelId), ['b', 'a']);
  assert.equal(db.state()[1].amount, 0);
});

test('기존 ID 없는 로그를 이관하고 다른 창의 추가 기록을 편집으로 지우지 않는다', async () => {
  const db = logStore([entry('a', 1)]);
  const before = (await db.execute({ op: 'read' })).powerLogs;
  assert.ok(before[0].id);
  await db.execute({ op: 'append', log: entry('b', 2) });
  const edited = [{ ...before[0], amount: 3 }];
  await db.execute(logs.changes(before, edited));
  assert.deepEqual(db.state().map(item => item.amount), [2, 3]);
});

test('다른 창의 수정 뒤 삭제는 충돌로 거부하고 원본을 남긴다', async () => {
  const db = logStore([entry('a', 1)]);
  const before = (await db.execute({ op: 'read' })).powerLogs;
  await db.execute(logs.changes(before, [{ ...before[0], amount: 2 }]));
  await assert.rejects(db.execute(logs.changes(before, [])), /수정된 로그/);
  assert.equal(db.state()[0].amount, 2);
});

test('잘못된 가져오기 파일과 저장 실패는 기존 로그를 바꾸지 않는다', async () => {
  const db = logStore([entry('a', 1)]);
  await assert.rejects(db.execute({ op: 'replace', logs: [null] }), /로그/);
  assert.equal(db.state()[0].amount, 1);
  assert.equal(db.writes(), 0);
});

test('녹화 두 건은 재시작 후에도 ID로 따로 조회하고 명시 삭제한다', async () => {
  const factory = fakeIndexedDB();
  const first = createStore(factory);
  await first.put({ id: 'a', blob: new Blob(['a']) });
  await first.put({ id: 'b', blob: new Blob(['b']) });
  const restarted = createStore(factory);
  assert.equal(await (await restarted.get('a')).blob.text(), 'a');
  assert.equal(await (await restarted.get('b')).blob.text(), 'b');
  await restarted.delete('a');
  assert.equal(await first.get('a'), undefined);
  assert.ok(await first.get('b'));
});

test('녹화 저장 공간 오류가 나도 기존 결과를 덮어쓰지 않는다', async () => {
  const factory = fakeIndexedDB(), db = createStore(factory);
  await db.put({ id: 'a', blob: new Blob(['original']) });
  factory.failNext = 'QuotaExceededError';
  await assert.rejects(db.put({ id: 'b', blob: new Blob(['new']) }), /QuotaExceededError/);
  assert.equal(await (await db.get('a')).blob.text(), 'original');
  assert.equal(await db.get('b'), undefined);
});
