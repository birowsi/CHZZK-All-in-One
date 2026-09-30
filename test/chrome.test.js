const test = require('node:test');
const assert = require('node:assert/strict');
const transport = require('../recording-transport.js');
const { createController, upgradePattern } = require('../chrome-grid.js');
const grid = require('../grid-bypass.js');

test('Chrome JSON 메시지로 큰 녹화 두 건을 전달하고 재시작 뒤 원본 바이트를 복원한다', async () => {
  const entries = new Map(), opened = [], messages = [];
  const store = { put: async data => { entries.set(data.id, data); }, get: async id => entries.get(id) };
  let serial = 0;
  let receiver = transport.createReceiver(store, async id => { opened.push(id); }, () => 'id-' + ++serial);
  const sender = { tab: { id: 1 }, documentId: 'document-a' };
  const api = { runtime: { getManifest: () => ({ background: { service_worker: 'chrome-worker.js' } }),
    sendMessage: async message => {
      const serialized = JSON.stringify(message); messages.push(serialized);
      return JSON.parse(JSON.stringify(await receiver(JSON.parse(serialized), sender)));
    } } };
  const bytes = Uint8Array.from({ length: transport.chunkSize + 17 }, (_, i) => i % 256);
  const [a, b] = await Promise.all([bytes, new Uint8Array([0, 128, 255])].map((data, index) =>
    transport.save(api, { blob: new Blob([data], { type: 'video/webm' }), mimeType: 'video/webm', fileName: 'clip-' + index })));
  assert.equal(opened.length, 2);
  assert.notEqual(a.id, b.id);
  receiver = transport.createReceiver(store, async () => { throw new Error('reading must not reopen a tab'); });
  const restored = await transport.read(api, a.id);
  assert.deepEqual(new Uint8Array(await restored.blob.arrayBuffer()), bytes);
  assert.equal(restored.fileName, 'clip-0');
  assert.equal(restored.blob.type, 'video/webm');
  assert.ok(Math.max(...messages.map(message => message.length)) < 400000);
});

test('녹화 전송은 순서·소유 탭·전체 크기를 검사하고 저장 실패를 숨기지 않는다', async () => {
  const sender = { tab: { id: 1 } }, other = { tab: { id: 2 } };
  const receiver = transport.createReceiver({ put: async () => { throw new Error('quota'); } }, async () => {}, () => 'test');
  const { id } = await receiver({ type: 'recording-upload-start', metadata: {}, size: 1 }, sender);
  await assert.rejects(receiver({ type: 'recording-upload-chunk', id, sequence: 0, data: 'AA==' }, other), /중단/);
  await assert.rejects(receiver({ type: 'recording-upload-chunk', id, sequence: 1, data: 'AA==' }, sender), /순서/);
  await assert.rejects(receiver({ type: 'recording-upload-finish', id }, sender), /불완전/);
  await receiver({ type: 'recording-upload-chunk', id, sequence: 0, data: 'AA==' }, sender);
  await assert.rejects(receiver({ type: 'recording-upload-finish', id }, sender), /quota/);
});

test('Firefox 녹화는 기존 Blob 메시지 경로를 유지한다', async () => {
  const blob = new Blob(['original']);
  const api = { runtime: { getManifest: () => ({ background: { scripts: ['background.js'] } }),
    sendMessage: async message => { assert.equal(message.type, 'recording-complete'); assert.equal(message.recording.blob, blob); return { id: 'original' }; } } };
  assert.deepEqual(await transport.save(api, { blob }), { id: 'original' });
});

function chromeGridProbe() {
  const event = () => ({ listeners: [], addListener(fn, filter, options) {
    assert.ok(!options?.includes('blocking')); this.listeners.push(fn);
  } });
  const storage = {}, rules = new Map(), clock = { now: 1000 };
  const api = {
    storage: { session: { get: async keys => Object.fromEntries((Array.isArray(keys) ? keys : [keys]).map(key => [key, storage[key]])),
      set: async value => Object.assign(storage, value) } },
    tabs: { onRemoved: event(), onUpdated: event(), query: async () => [{ id: 1 }, { id: 2 }] },
    alarms: { onAlarm: event(), create: async () => {}, clear: async () => {} },
    webRequest: Object.fromEntries(['onBeforeRedirect', 'onHeadersReceived', 'onErrorOccurred', 'onCompleted'].map(name => [name, event()])),
    declarativeNetRequest: { getSessionRules: async () => [...rules.values()], updateSessionRules: async ({ removeRuleIds, addRules }) => {
      removeRuleIds.forEach(id => rules.delete(id)); addRules.forEach(rule => rules.set(rule.id, rule));
    } },
  };
  return { api, storage, rules, clock, controller: createController(api, grid, () => clock.now) };
}

test('Chrome GRID 규칙은 CHZZK/CDN에 한정하며 토큰·전체 화질을 보존하고 수동 선택을 제외한다', async () => {
  const probe = chromeGridProbe();
  await probe.controller.sync(true);
  const rule = probe.rules.get(1000);
  assert.deepEqual(rule.condition.tabIds, [1, 2]);
  const url = 'https://live.navercdn.com/path/480p/main.m3u8?token=abc';
  const groups = new RegExp(upgradePattern).exec(url);
  assert.equal(groups[1] + '1080p' + groups[2], grid.higherQualityUrl(url));
  assert.equal(new RegExp(upgradePattern).test('https://live.navercdn.com/main.m3u8?token=480p'), false);
  await probe.controller.setManual(1, '/live/channel');
  assert.deepEqual(probe.rules.get(1000).condition.excludedTabIds, [1]);
  const restarted = createController(probe.api, grid, () => probe.clock.now);
  await restarted.sync(true);
  assert.deepEqual(probe.rules.get(1000).condition.excludedTabIds, [1]);
  await restarted.sync(false);
  assert.equal(probe.rules.size, 0);
});

test('Chrome 고화질 403/네트워크 실패는 원본 재시도를 허용하고 만료·재시작을 처리한다', async () => {
  const probe = chromeGridProbe();
  await probe.controller.sync(true);
  const url = 'https://live.navercdn.com/path/480p/main.m3u8?token=abc';
  probe.api.webRequest.onBeforeRedirect.listeners[0]({ requestId: '1', url, redirectUrl: grid.higherQualityUrl(url) });
  probe.api.webRequest.onHeadersReceived.listeners[0]({ requestId: '1', statusCode: 403 });
  await probe.controller.idle();
  assert.equal(probe.rules.get(1001).action.type, 'allow');
  assert.ok(new RegExp(probe.rules.get(1001).condition.regexFilter).test(url));
  const restarted = createController(probe.api, grid, () => probe.clock.now);
  await restarted.sync(true);
  assert.ok(probe.rules.has(1001));
  probe.clock.now += 60001;
  probe.api.alarms.onAlarm.listeners.at(-1)({ name: 'hanbi-grid-fallback' });
  await restarted.idle();
  assert.equal(probe.rules.has(1001), false);
  probe.api.webRequest.onBeforeRedirect.listeners.at(-1)({ requestId: '2', url, redirectUrl: grid.higherQualityUrl(url) });
  probe.api.webRequest.onErrorOccurred.listeners.at(-1)({ requestId: '2', error: 'net::ERR_FAILED' });
  await restarted.idle();
  assert.equal(probe.rules.get(1001).action.type, 'allow');
});
