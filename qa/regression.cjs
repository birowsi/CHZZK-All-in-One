// Offline audit: extracts actual source functions; no account, network, or extension writes.
// Run: npm run test:audit (exit 1 means a release expectation failed).
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const repo = path.join(__dirname, '..');
const acorn = require(require.resolve('acorn', { paths: [repo] }));
function extract(file, predicate) {
  const source = fs.readFileSync(path.join(repo, file), 'utf8');
  const ast = acorn.parse(source, { ecmaVersion: 'latest', sourceType: 'module' });
  let found;
  function walk(node) {
    if (!node || typeof node !== 'object' || found) return;
    if (predicate(node, source)) { found = node; return; }
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) value.forEach(walk);
      else if (value && typeof value === 'object') walk(value);
    }
  }
  walk(ast);
  assert.ok(found, `Source node not found: ${file}`);
  return source.slice(found.start, found.end);
}
const func = (file, name, globals) => vm.runInNewContext(`(${extract(file, n => n.type === 'FunctionDeclaration' && n.id?.name === name)})`, globals);
const quiet = { log() {}, warn() {}, error() {} };
let failed = 0, passed = 0;
async function check(name, run) {
  try { await run(); passed++; console.log(`PASS ${name}`); }
  catch (error) { failed++; console.log(`FAIL ${name}: ${error.message}`); }
}
function powerProbe(logs = [], enabled = true) {
  const observed = { clicks: 0, saved: [] };
  const button = { textContent: '통나무 받기', classList: [], click() { observed.clicks++; } };
  const globals = {
    badgeToggle: false, powerAcquisitionEnabled: enabled, powerClickBusy: false, pendingViewClaim: null, console: quiet,
    cachedPowerChannelId: 'channel-b', cachedPowerAmount: 1000, timers: [],
    setTimeout(fn, delay) { globals.timers.push(delay); },
    document: { querySelector: () => ({ querySelectorAll: () => [button] }) },
    getChannelIdFromUrl: () => 'channel-b',
    savePowerLog: async (...args) => { observed.saved.push(args); return true; }, fetchAndUpdatePowerAmount() { observed.fetches = (observed.fetches || 0) + 1; },
    chrome: { runtime: { sendMessage() {} }, storage: { local: { get: async () => ({ powerLogs: logs }) } } },
  };
  return { observed, button, globals, run: func('content.js', 'clickPowerButtonIfExists', globals) };
}
async function main() {
  await check('POWER-CLAIM-RESULT: skip/failure do not confirm a grant; a successful claim ID is not sent twice', async () => {
    let puts = 0, ok = false;
    const globals = { powerAcquisitionEnabled: true, pendingClaims: new Set(), completedClaims: new Set(), console: quiet,
      fetch: async () => { puts++; return { ok, status: 503, json: async () => ({ code: 200, content: { amount: 100 } }) }; },
      savePowerLog: async () => true };
    const claim = func('content.js', 'claimPower', globals);
    const reward = { claimId: 'reward', claimType: 'FOLLOW', amount: 100 };
    assert.equal(await claim('a', reward), false);
    assert.equal(globals.pendingClaims.size, 0);
    ok = true;
    assert.equal(await claim('a', reward), true);
    assert.equal(await claim('a', reward), false);
    assert.equal(puts, 2);
    globals.powerAcquisitionEnabled = false;
    assert.equal(await claim('a', { ...reward, claimId: 'off' }), false);
    globals.powerAcquisitionEnabled = true;
    assert.equal(await claim('a', { ...reward, claimId: 'view', claimType: 'WATCH_1_HOUR' }), false);
    assert.equal(puts, 2);
  });
  await check('POWER-POLL-RETRY: unclaimed items alone must not create a one-second query loop', async () => {
    for (const active of [true, false]) {
      const timers = [], badges = [];
      let awarded = false, channel = 'a';
      const ctx = vm.createContext({ console: quiet, isLivePage: () => true, getChannelIdFromUrl: () => channel,
        fetch: async () => ({ ok: true, json: async () => ({ content: { amount: 100, claims: [{ claimId: 'a' }], active } }) }),
        recordPowerBalance: async () => {}, claimPower: async () => awarded,
        updatePowerCountBadge: (...args) => badges.push(args), isChannelInactive: false,
        powerBadgeDomPoller: null, startPowerBadgeDomPoller() {},
        setTimeout: fn => timers.push(fn), setInterval() {}, clearInterval() {},
      });
      vm.runInContext(extract('content.js', n => n.type === 'FunctionDeclaration' && n.id?.name === 'fetchAndUpdatePowerAmount'), ctx);
      await ctx.fetchAndUpdatePowerAmount();
      assert.equal(timers.length, 0, 'skip or rejected grant should wait for the existing 30-second poll');
      awarded = true;
      await ctx.fetchAndUpdatePowerAmount();
      assert.equal(timers.length, 1, 'confirmed grant gets one immediate refresh');
      let reads = 0;
      ctx.fetchAndUpdatePowerAmount = () => { reads++; };
      channel = 'b'; timers[0]();
      assert.equal(reads, 0, 'old channel callback must not query a new channel');
    }
  });
  await check('POWER-OFF: disabled acquisition must not click claim', async () => {
    const probe = powerProbe([], false); await probe.run(); assert.equal(probe.observed.clicks, 0);
  });
  await check('POWER-BUTTON-OFF: disabled site claim must not create a log', async () => {
    const probe = powerProbe(); probe.button.disabled = true; await probe.run();
    assert.equal(probe.observed.clicks, 0); assert.equal(probe.observed.saved.length, 0);
  });
  await check('POWER-VIEW-PENDING: a click only marks a pending view claim; no guessed log is written', async () => {
    const probe = powerProbe(); await probe.run();
    assert.equal(probe.observed.clicks, 1);
    assert.equal(probe.observed.saved.length, 0);
    assert.equal(probe.globals.pendingViewClaim.channelId, 'channel-b');
    assert.deepEqual(Array.from(probe.globals.timers), [1500, 5000, 15000]);
  });
  await check('POWER-VIEW-BASELINE: unknown balance is read before clicking', async () => {
    const probe = powerProbe(); probe.globals.cachedPowerChannelId = 'channel-a'; await probe.run();
    assert.equal(probe.observed.fetches, 1); assert.equal(probe.observed.clicks, 1);
  });
  await check('POWER-REACTIVATE: inactive channel keeps its status poll and resumes DOM checks', async () => {
    const cleared = [], updates = [], channelId = 'a'.repeat(32);
    let restarts = 0, active = false;
    const ctx = vm.createContext({
      console: quiet, isLivePage: () => true, getChannelIdFromUrl: () => channelId,
      fetch: async () => ({ ok: true, json: async () => ({ content: { amount: 100, claims: [], active } }) }),
      updatePowerCountBadge: (...args) => updates.push(args),
      recordPowerBalance: async () => {},
      setInterval: () => 9, clearInterval: id => cleared.push(id),
      powerBadgeDomPoller: 1, powerCountInterval: 2, isChannelInactive: false,
      startPowerBadgeDomPoller: () => { restarts++; ctx.powerBadgeDomPoller = 3; },
    });
    vm.runInContext(extract('content.js', n => n.type === 'FunctionDeclaration' && n.id?.name === 'fetchAndUpdatePowerAmount'), ctx);
    await ctx.fetchAndUpdatePowerAmount();
    assert.equal(ctx.isChannelInactive, true);
    assert.equal(ctx.powerBadgeDomPoller, null);
    assert.deepEqual(cleared, [1]);
    ctx.fetch = async () => { throw new Error('temporary network failure'); };
    await ctx.fetchAndUpdatePowerAmount();
    assert.equal(ctx.isChannelInactive, true); assert.equal(restarts, 0);
    ctx.fetch = async () => ({ ok: true, json: async () => ({ content: { amount: 120, claims: [], active: true } }) });
    await ctx.fetchAndUpdatePowerAmount();
    assert.equal(ctx.isChannelInactive, false);
    assert.equal(restarts, 1);
    assert.equal(ctx.powerBadgeDomPoller, 3);
    assert.deepEqual(updates.at(-1), [120, false]);
  });
  await check('POWER-TIME: next view claim uses the latest view log only', () => {
    const now = new Date('2026-09-25T12:30:00Z');
    const calculate = func('content.js', 'calculateFromLastLogForClock', { Date });
    const logs = [
      { method: 'view', timestamp: '2026-09-25T12:00:00Z' },
      { method: 'FOLLOW', timestamp: '2026-09-25T12:20:00Z' },
      { method: 'view', timestamp: '2026-09-25T11:50:00Z' },
    ];
    assert.equal(calculate(logs, now).toISOString(), '2026-09-25T13:00:00.000Z');
    assert.equal(calculate([], now), null);
    assert.equal(calculate(logs, new Date('2026-09-25T13:01:00Z')), null);
  });
  await check('POWER-POPUP-TIME: no log or expired log is not a fabricated countdown', () => {
    const display = { textContent: '' };
    const update = func('popup.js', 'updateNextPowerTime', { Date, document: { getElementById: () => display } });
    update([]); assert.equal(display.textContent, '획득 기록 없음');
    update([{ method: 'view', timestamp: new Date(Date.now() - 7_200_000).toISOString() }]);
    assert.equal(display.textContent, '획득 가능 여부 확인 필요');
    update([{ method: 'view', timestamp: new Date(Date.now() - 600_000).toISOString() }]);
    assert.match(display.textContent, /분 후$/);
  });
  await check('POWER-LOG-LIVE: open log receives new entries without replacing unsaved edits', () => {
    let allLogs = [], loadedLogs = [], rendered = 0;
    const refresh = func('log.js', 'refreshPowerLogs', {
      JSON, get allLogs() { return allLogs; }, get loadedLogs() { return loadedLogs; },
      acceptLogs(result) { allLogs = result.powerLogs; loadedLogs = structuredClone(allLogs); },
      applyFilters() { rendered++; }, updateStats() {},
    });
    refresh({ powerLogs: { newValue: [{ id: 'a' }] } }, 'local');
    assert.equal(allLogs.length, 1); assert.equal(rendered, 1);
    allLogs = [{ id: 'a', amount: 5 }];
    refresh({ powerLogs: { newValue: [{ id: 'b' }] } }, 'local');
    assert.equal(allLogs[0].id, 'a'); assert.equal(rendered, 1);
  });
  await check('POWER-CONCURRENT: both simultaneous acquisitions must survive', async () => {
    let stored = [];
    const store = require(path.join(repo, 'log-store.js')).createStore({ storage: {
      local: { get: async () => ({ powerLogs: structuredClone(stored) }), set: async data => { stored = structuredClone(data.powerLogs); } },
      sync: { get: async () => ({}) },
    } }, () => require('node:crypto').randomUUID());
    const save = func('content.js', 'savePowerLog', {
      console: quiet, getChannelInfo: async channelId => ({ channelId, channelName: channelId }),
      HanbiLogs: { append: log => store({ op: 'append', log }) },
    });
    await Promise.all([save('a', 100, 'view'), save('b', 100, 'view')]);
    assert.equal(stored.length, 2);
  });
  await check('POWER-BALANCE-LOG: only an unexplained increase creates a fallback entry', async () => {
    const saved = [];
    let powerLogs = [];
    const ctx = vm.createContext({
      Date, Number, console: quiet, powerAcquisitionEnabled: true,
      cachedPowerAmount: null, cachedPowerChannelId: null, cachedPowerObservedAt: 0, pendingViewClaim: null,
      chrome: { storage: { local: { get: async () => ({ powerLogs }) } } },
      savePowerLog: async (...args) => { saved.push(args); return true; },
    });
    vm.runInContext(extract('content.js', n => n.type === 'FunctionDeclaration' && n.id?.name === 'recordPowerBalance'), ctx);
    await ctx.recordPowerBalance('a', 100);
    assert.equal(saved.length, 0);
    await ctx.recordPowerBalance('a', 200);
    assert.deepEqual(Array.from(saved[0].slice(0, 3)), ['a', 100, 'OTHERS']);
    powerLogs = [{ channelId: 'a', amount: 50, timestamp: new Date().toISOString() }];
    await ctx.recordPowerBalance('a', 300);
    assert.equal(saved[1][1], 50);
    await ctx.recordPowerBalance('b', 800);
    assert.equal(saved.length, 2);
    await ctx.recordPowerBalance('b', 700);
    assert.equal(saved.length, 2);
    await ctx.recordPowerBalance('b', 900, false);
    assert.equal(saved.length, 2);
    assert.equal(saved[0][4].balanceAfter, 200);
  });
  await check('POWER-VIEW-VERIFIED: only a confirmed increase after the click is logged as view', async () => {
    const saved = [];
    let ok = true;
    const ctx = vm.createContext({
      Date, Number, console: quiet, powerAcquisitionEnabled: true, pendingViewClaim: null,
      cachedPowerAmount: null, cachedPowerChannelId: null, cachedPowerObservedAt: 0,
      chrome: { storage: { local: { get: async () => ({ powerLogs: [] }) } } },
      savePowerLog: async (...args) => { saved.push(args); return ok; },
    });
    vm.runInContext(extract('content.js', n => n.type === 'FunctionDeclaration' && n.id?.name === 'recordPowerBalance'), ctx);
    await ctx.recordPowerBalance('a', 1000);
    ctx.pendingViewClaim = { channelId: 'a', clickedAt: Date.now() };
    await ctx.recordPowerBalance('a', 1000);
    assert.equal(saved.length, 0, 'no increase means no view log');
    ok = false;
    await ctx.recordPowerBalance('a', 1120);
    assert.deepEqual(Array.from(saved[0].slice(0, 3)), ['a', 120, 'view']);
    assert.equal(ctx.cachedPowerAmount, 1000, 'failed write restores the baseline');
    assert.equal(ctx.pendingViewClaim.channelId, 'a', 'failed write keeps the pending view claim');
    ok = true;
    await ctx.recordPowerBalance('a', 1120);
    assert.deepEqual(Array.from(saved[1].slice(0, 3)), ['a', 120, 'view']);
    assert.equal(ctx.pendingViewClaim, null);
    await ctx.recordPowerBalance('a', 1220);
    assert.equal(saved[2][2], 'OTHERS');
  });
  await check('POWER-LOG-DEDUPE: two tabs logging the same balance increase store one entry', async () => {
    const { createStore } = require(path.join(repo, 'log-store.js'));
    let data = { powerLogs: [] };
    const api = { storage: {
      local: { get: async () => data, set: async (value) => { data = { ...data, ...value }; } },
      sync: { get: async () => ({}) } } };
    let n = 0;
    const store = createStore(api, () => `id${++n}`);
    const log = { channelId: 'a', channelName: 'A', amount: 100, method: 'OTHERS', timestamp: new Date().toISOString(), balanceAfter: 500 };
    await Promise.all([store({ op: 'append', log }), store({ op: 'append', log: { ...log } })]);
    assert.equal(data.powerLogs.length, 1);
    await store({ op: 'append', log: { ...log, balanceAfter: 600 } });
    assert.equal(data.powerLogs.length, 2);
  });
  await check('CHAT-FONT: current and legacy chat message selectors are both styled', () => {
    const style = { textContent: '' };
    const apply = func('tools.js', 'applyChatFeatures', {
      document: { getElementById: () => style },
      features: { hideDonation: false, chatFontSizeEnabled: true }, trendOptions: { chatFontSize: 20 },
    });
    apply();
    assert.match(style.textContent, /aside#aside-chatting \[role='log'\] \[class\*='_chatting_message_'\] > \[class\*='_text_'\]/);
    assert.match(style.textContent, /live_chatting_message_text/);
    assert.match(style.textContent, /font-size: 20px !important/);
  });
  const event = () => ({ listeners: [], addListener(fn) { this.listeners.push(fn); } });
  const api = {
    runtime: { onMessage: event(), onInstalled: event(), onStartup: event(), getPlatformInfo: async () => ({ os: 'win' }), getURL: name => name },
    storage: { onChanged: event(), local: { get: async () => ({}), set: async () => {}, remove: async () => {} } },
    declarativeNetRequest: { updateEnabledRulesets: async () => {} },
    webRequest: Object.fromEntries(['onBeforeRequest', 'onHeadersReceived', 'onCompleted', 'onErrorOccurred'].map(key => [key, event()])),
    tabs: { create: async () => ({ id: 1 }), onRemoved: event(), onUpdated: event() },
  };
  const factory = require('./fake-indexeddb.cjs')();
  function boot() {
    api.runtime.onMessage.listeners = [];
    vm.runInNewContext(fs.readFileSync(path.join(repo, 'background.js'), 'utf8'), {
      browser: api, console: quiet, Blob, crypto: require('node:crypto').webcrypto,
      HanbiLogs: require(path.join(repo, 'log-store.js')),
      HanbiRecordingStore: { createStore: () => require(path.join(repo, 'recording-store.js')).createStore(factory) },
    });
  }
  boot();
  const send = message => api.runtime.onMessage.listeners[0](message, { tab: { id: 1, active: true } });
  await check('REC-MULTI: two completions must preserve both results', async () => {
    const [a,b] = await Promise.all(['A','B'].map(name => send({ type: 'recording-complete', recording: { blob: new Blob([name]), fileName: name } })));
    const actual = await Promise.all([a,b].map(({ id }) => send({ type: 'get-recording', id })));
    assert.deepEqual(actual.map(item => item.fileName), ['A', 'B']);
    assert.notEqual(a.id, b.id);
  });
  await check('REC-RELOAD: result must remain available after page and background reload', async () => {
    const { id } = await send({ type: 'recording-complete', recording: { blob: new Blob(['A']), fileName: 'A' } });
    await send({ type: 'get-recording', id });
    boot();
    assert.equal((await send({ type: 'get-recording', id })).fileName, 'A');
    assert.equal((await send({ type: 'get-recording', id })).fileName, 'A');
  });
  await check('MESSAGE: unrelated listener must return undefined, not a Promise', async () => {
    const call = extract('tools.js', (n, s) => n.type === 'CallExpression' && s.slice(n.callee.start, n.callee.end) === 'api.runtime.onMessage.addListener');
    let listener;
    vm.runInNewContext(call, { api: { runtime: { onMessage: { addListener(fn) { listener = fn; } } } } });
    assert.equal(listener({ action: 'fetchPredictionDetail' }), undefined);
  });
  await check('SETTING-ZERO: sharpness 0 must stay 0', async () => {
    const expression = extract('popup.js', (n, s) => n.type === 'CallExpression' && s.slice(n.start, n.end).startsWith('Math.max(Number(input.min)'));
    const result = vm.runInNewContext(expression, { input: { min: '0', max: '300', value: '0' }, key: 'sharpnessAmount', trendDefaults: { sharpnessAmount: 100 } });
    assert.equal(result, 0);
  });
  await check('CONVERT-ERROR: invalid trim must report a UI error without rejecting', async () => {
    let shown = false;
    const convert = func('record-result.js', 'convert', {
      conversionSpec: require(path.join(repo, 'record-result-logic.js')).conversionSpec,
      setStatus(message, error) { if (error) shown = true; }, setBusy() {}, progress: { removeAttribute() {} }, progressText: {}, console: quiet,
    });
    await convert('trim', { start: 5, end: 4 });
    assert.equal(shown, true);
  });
  await check('CONVERT-NATIVE-MP4: verified AVC/AAC downloads the original without loading FFmpeg', async () => {
    const calls = [], busy = [];
    const convert = func('record-result.js', 'convert', {
      ...require(path.join(repo, 'record-result-logic.js')),
      recording: { mimeType: 'video/mp4;codecs=avc1.420028,mp4a.40.2', fileName: 'native' }, recordingUrl: 'blob:original',
      download: async (...args) => calls.push(args), safeName: name => name,
      loadFFmpeg: () => { throw new Error('must not encode'); },
      setStatus() {}, setBusy: value => busy.push(value), progress: { removeAttribute() {} }, progressText: {}, console: quiet,
    });
    await convert('mp4');
    assert.deepEqual(calls, [['blob:original', 'native.mp4']]);
    assert.deepEqual(busy, [true, false]);
  });
  await check('TIMESHIFT-FALLBACK: failed seek must not consume native shortcut', async () => {
    let prevented = false;
    const handler = func('tools.js', 'handleArrowSeek', {
      features: { arrowSeek: true }, video: () => ({ currentTime: 100 }), isLive: () => true,
      timeShift() { throw new Error('HLS unavailable'); }, status() {},
    });
    handler({ key: 'ArrowLeft', target: {}, preventDefault() { prevented = true; }, stopImmediatePropagation() {} });
    assert.equal(prevented, false);
  });
  await check('LOG-IMPORT: malformed log entries must not enter storage', async () => {
    let writes = 0;
    const handler = func('log.js', 'handleImportFile', {
      allLogs: [], console: quiet, showToast() {}, updateStats() {}, renderLogs() {},
      HanbiLogs: { validate: require(path.join(repo, 'log-store.js')).validate, replace: async () => { writes++; } },
      FileReader: class { readAsText() { this.onload({ target: { result: '{"logs":[null]}' } }); } },
      chrome: { runtime: {}, storage: { local: { set(data, callback) { writes++; callback(); } } } },
    });
    handler({ target: { files: [{}] } });
    assert.equal(writes, 0);
  });
  console.log(`\nRelease expectations: ${passed} passed, ${failed} failed. Offline probes only; not Firefox E2E.`);
  process.exitCode = failed ? 1 : 0;
}
function audioProbe(fault = '') {
  const contexts = [], nodes = [];
  const node = name => {
    const result = { name, outputs: [], disconnect() { this.outputs = []; }, connect(target) {
      if (fault === 'compress-connect' && name === 'compressor') throw new Error('connect failed');
      this.outputs.push(target); return target;
    } };
    nodes.push(result); return result;
  };
  class Context {
    constructor() { this.state = 'suspended'; this.destination = node('destination'); this.sources = 0; this.resumes = 0; this.closes = 0; contexts.push(this); }
    createDynamicsCompressor() { return Object.assign(node('compressor'), Object.fromEntries(['threshold', 'knee', 'ratio', 'attack', 'release'].map(key => [key, { value: 0 }]))); }
    createGain() { return Object.assign(node('gain'), { gain: { value: 1 } }); }
    createMediaElementSource() { this.sources++; return node('element'); }
    createMediaStreamSource(stream) {
      if (fault === 'stream-source') throw new Error('stream unavailable');
      return Object.assign(node('stream'), { stream });
    }
    async resume() { this.resumes++; this.state = 'running'; }
    async close() { this.closes++; this.state = 'closed'; }
  }
  const helpers = require(path.join(repo, 'tools.js'));
  const ctx = vm.createContext({
    console: quiet, window: { AudioContext: Context }, AudioContext: Context,
    MediaStream: class { constructor(tracks) { this.tracks = tracks; } },
    navigator: { userAgent: 'Firefox/154.0' },
    compressorData: null, compressorContext: null, compressorGraphs: new WeakMap(), monitorGraph: null,
    compressorEnabled: false, compressorGain: 1, ...helpers,
  });
  for (const name of ['closeCompressor', 'getCompressor', 'applyCompressorState', 'syncMonitorCompressor', 'resumeCompressor', 'syncCompressorControl', 'monitorFirefoxAudio']) {
    vm.runInContext(extract('tools.js', n => n.type === 'FunctionDeclaration' && n.id?.name === name), ctx);
  }
  return { ctx, contexts, nodes };
}
function compressorControlProbe() {
  let root = null, nativePresent = true;
  const writes = new Map();
  function element() {
    return { dataset: {}, children: [], listeners: {}, className: '',
      classList: { toggle() {} }, setAttribute() {},
      addEventListener(type, listener) { this.listeners[type] = listener; },
      append(...children) { this.children.push(...children); },
      querySelector(selector) { return this.children[selector.includes('toggle') ? 0 : 1]; },
      remove() { if (root === this) root = null; },
    };
  }
  const volume = { insertAdjacentElement(position, el) { root = el; el.previousElementSibling = volume; } };
  const ctx = vm.createContext({
    compressorControls: new WeakSet(), compressorEnabled: true, compressorGain: 0.37,
    compressorData: { mode: 'compressed', ctx: { state: 'running' } },
    localStorage: { setItem(key, value) { writes.set(key, String(value)); } },
    video() { return {}; }, applyCompressorState() {},
    button(label, text, action) { const el = element(); el.action = action; return el; },
    document: {
      getElementById() { return root; }, createElement: element,
      querySelector(selector) { return nativePresent ? volume : selector.includes(':not(') ? null : root; },
    },
  });
  for (const name of ['ensureCompressorControl', 'syncCompressorControl']) {
    vm.runInContext(extract('tools.js', n => n.type === 'FunctionDeclaration' && n.id?.name === name), ctx);
  }
  return { ctx, writes, root: () => root,
    cloneRoot() { root = { ...root, children: root.children.map(child => ({ ...child, action: undefined, listeners: {} })), listeners: {} }; },
    removeNative() { nativePresent = false; },
  };
}
async function audioMain() {
  await check('COMP-OWN-CONTROL: native player selectors must not match compressor', () => {
    const p = compressorControlProbe(); p.ctx.ensureCompressorControl();
    assert.doesNotMatch(p.root().className, /pzp-pc.*volume-control|knife-comp/);
    assert.doesNotMatch(p.root().children[0].className, /pzp.*setting/);
  });
  await check('COMP-NATIVE-REMOVAL: do not use compressor as its own volume anchor', () => {
    const p = compressorControlProbe(); p.ctx.ensureCompressorControl(); p.removeNative(); p.ctx.ensureCompressorControl();
    assert.equal(p.root(), null);
  });
  await check('COMP-CLONE: rebuild unbound DOM without resetting enabled/gain', () => {
    const p = compressorControlProbe(); p.ctx.ensureCompressorControl(); p.cloneRoot(); p.ctx.ensureCompressorControl();
    const root = p.root(); root.children[0].action();
    assert.equal(p.ctx.compressorEnabled, false); assert.equal(p.writes.get('hanbi_comp_enabled'), 'false');
    assert.equal(root.children[1].value, 0.37);
    root.children[1].listeners.input({ target: { value: '0.61' } });
    assert.equal(p.ctx.compressorGain, 0.61); assert.equal(p.writes.get('knifeGain'), '0.61');
  });
  await check('COMP-EVENTS: isolate controls without cancelling native range defaults', () => {
    const p = compressorControlProbe(); p.ctx.ensureCompressorControl();
    for (const type of ['pointerdown', 'pointerup', 'click', 'input', 'change', 'keydown', 'keyup']) {
      let stopped = 0; p.root().listeners[type]({ stopPropagation() { stopped++; }, preventDefault() { throw new Error('default cancelled'); } });
      assert.equal(stopped, 1);
    }
  });
  await check('AUDIO-OFF: untouched video must not create an AudioContext', () => {
    const p = audioProbe(); p.ctx.applyCompressorState({}); assert.equal(p.contexts.length, 0);
  });
  await check('AUDIO-DEFAULTS: actual constructor applies all five upstream values', () => {
    const p = audioProbe(); p.ctx.compressorEnabled = true; p.ctx.applyCompressorState({});
    const graph = p.ctx.compressorData;
    for (const [key, value] of Object.entries(p.ctx.compressorDefaults)) assert.equal(graph.compressor[key].value, value);
    assert.equal(graph.mode, 'compressed');
    assert.equal(graph.source.outputs[0], graph.compressor);
    assert.equal(graph.compressor.outputs[0], graph.gain);
    assert.equal(graph.gain.outputs[0], graph.ctx.destination);
  });
  await check('AUDIO-REUSE: repeated apply must keep one source and one connection', () => {
    const p = audioProbe(), media = {}; p.ctx.compressorEnabled = true;
    for (let i = 0; i < 20; i++) p.ctx.applyCompressorState(media);
    assert.equal(p.contexts.length, 1); assert.equal(p.contexts[0].sources, 1);
    assert.equal(p.ctx.compressorData.source.outputs.length, 1);
  });
  await check('AUDIO-TOGGLE: OFF bypasses gain/compressor and ON reuses graph', () => {
    const p = audioProbe(), media = {}; p.ctx.compressorEnabled = true; p.ctx.applyCompressorState(media);
    const graph = p.ctx.compressorData;
    p.ctx.compressorEnabled = false; p.ctx.applyCompressorState(media);
    assert.equal(graph.source.outputs[0], graph.ctx.destination); assert.equal(graph.gain.outputs.length, 0);
    p.ctx.compressorEnabled = true; p.ctx.applyCompressorState(media);
    assert.equal(p.ctx.compressorData, graph); assert.equal(graph.mode, 'compressed');
  });
  await check('AUDIO-GAIN: zero and 200 percent reach the actual gain node', () => {
    const p = audioProbe(), media = {}; p.ctx.compressorEnabled = true;
    for (const gain of [0, 0.5, 1, 2]) { p.ctx.compressorGain = gain; p.ctx.applyCompressorState(media); assert.equal(p.ctx.compressorData.gain.gain.value, gain); }
  });
  await check('AUDIO-REPLACE: old video bypasses; returning video reuses source', () => {
    const p = audioProbe(), a = {}, b = {}; p.ctx.compressorEnabled = true;
    p.ctx.applyCompressorState(a); const graphA = p.ctx.compressorData;
    p.ctx.applyCompressorState(b); assert.equal(graphA.mode, 'bypass');
    p.ctx.applyCompressorState(a); assert.equal(p.ctx.compressorData, graphA); assert.equal(p.contexts[0].sources, 2);
  });
  await check('AUDIO-RESUME: suspended context is resumed on apply and gesture', () => {
    const p = audioProbe(); p.ctx.compressorEnabled = true; p.ctx.applyCompressorState({});
    const context = p.contexts[0]; assert.equal(context.resumes, 1);
    context.state = 'suspended'; p.ctx.resumeCompressor(); assert.equal(context.resumes, 2);
  });
  await check('AUDIO-MONITOR: connect, volume, mute, unmute, cleanup execute', () => {
    const p = audioProbe(), listeners = new Map();
    const source = { muted: false, volume: 0.6, addEventListener: (key, fn) => listeners.set(key, fn), removeEventListener: key => listeners.delete(key) };
    const cleanup = p.ctx.monitorFirefoxAudio(source, { getAudioTracks: () => [{}] });
    const input = p.nodes.find(n => n.name === 'stream'), gain = p.nodes.find(n => n.name === 'gain');
    assert.equal(input.outputs[0], gain); assert.equal(gain.outputs[0], p.contexts[0].destination);
    assert.equal(gain.gain.value, 0.6);
    source.volume = 0.25; listeners.get('volumechange')(); assert.equal(gain.gain.value, 0.25);
    source.muted = true; listeners.get('volumechange')(); assert.equal(gain.gain.value, 0);
    source.muted = false; listeners.get('volumechange')(); assert.equal(gain.gain.value, 0.25);
    cleanup(); assert.equal(listeners.size, 0); assert.equal(input.outputs.length, 0); assert.equal(gain.outputs.length, 0); assert.equal(p.contexts[0].closes, 1);
  });
  await check('AUDIO-MUTED-REC: player mute does not remove captured audio', () => {
    const audio = { enabled: true }, video = { enabled: true };
    const stream = { getAudioTracks: () => [audio], getVideoTracks: () => [video], getTracks: () => [audio, video] };
    const source = { muted: true, volume: 0, mozCaptureStream: () => stream };
    let monitored = false;
    const ctx = vm.createContext({
      sharedCapture: null,
      captureReusePlan: require(path.join(repo, 'tools.js')).captureReusePlan,
      monitorFirefoxAudio(media, captured) { monitored = media === source && captured === stream; return () => {}; },
    });
    vm.runInContext(extract('tools.js', n => n.type === 'FunctionDeclaration' && n.id?.name === 'acquireCapture'), ctx);
    const result = ctx.acquireCapture(source);
    assert.equal(result.stream, stream);
    assert.equal(stream.getAudioTracks()[0].enabled, true);
    assert.equal(source.muted, true);
    assert.equal(monitored, true);
  });
  await check('AUDIO-MONITOR-COMP: captured audio follows COMP toggle', () => {
    const p = audioProbe(), source = { muted: false, volume: 1, addEventListener() {}, removeEventListener() {} };
    p.ctx.compressorEnabled = true;
    const cleanup = p.ctx.monitorFirefoxAudio(source, { getAudioTracks: () => [{}] });
    const graph = p.ctx.monitorGraph;
    assert.equal(graph.source.outputs[0], graph.compressor);
    assert.equal(graph.compressor.outputs[0], graph.gain);
    p.ctx.compressorEnabled = false;
    p.ctx.syncMonitorCompressor();
    assert.equal(graph.source.outputs[0], graph.context.destination);
    cleanup();
  });
  await check('AUDIO-NO-TRACK: no audio track must not create a monitor', () => {
    const p = audioProbe(); assert.equal(p.ctx.monitorFirefoxAudio({}, { getAudioTracks: () => [] }), null); assert.equal(p.contexts.length, 0);
  });
  await check('AUDIO-FAIL-BYPASS: failed compressor connection restores original path', () => {
    const p = audioProbe('compress-connect'); p.ctx.compressorEnabled = true; p.ctx.applyCompressorState({});
    assert.equal(p.ctx.compressorData.mode, 'bypass'); assert.equal(p.ctx.compressorData.source.outputs[0], p.contexts[0].destination);
  });
  await check('AUDIO-FAIL-UI: failed compressor must not claim COMP ON', () => {
    const p = audioProbe('compress-connect'); p.ctx.compressorEnabled = true; p.ctx.applyCompressorState({});
    const button = { classList: { toggle() {} }, setAttribute() {} }, slider = { setAttribute() {} };
    p.ctx.syncCompressorControl({ querySelector: selector => selector.includes('toggle') ? button : slider });
    assert.notEqual(button.textContent, 'COMP ON');
  });
  await check('AUDIO-MONITOR-FAIL: partially initialized monitor must close context', () => {
    const p = audioProbe('stream-source');
    assert.equal(p.ctx.monitorFirefoxAudio({}, { getAudioTracks: () => [{}] }), null);
    assert.equal(p.contexts[0].closes, 1);
  });
  await check('AUDIO-REC-START-FAIL: failed recorder start cleans one-shot tracks but keeps shared audio alive', () => {
    let stopped = 0, options;
    const stream = { getVideoTracks: () => [{}], getTracks: () => [{ stop() { stopped++; } }] };
    const ctx = vm.createContext({
      location: { pathname: '/live/test' }, clearInterval() {}, recording: null, video: () => ({ videoWidth: 1920, videoHeight: 1080, captureStream: () => stream }), chooseRecorderMime: () => '',
      recordingVideoBitrate: require(path.join(repo, 'tools.js')).recordingVideoBitrate,
      startRecordingRecorder: require(path.join(repo, 'tools.js')).startRecordingRecorder,
      MediaRecorder: class { constructor(_stream, value) { options = value; } addEventListener() {} removeEventListener() {} start() { throw new Error('start unavailable'); } },
      acquireCapture: () => ({ stream, shared: false }),
    });
    vm.runInContext(extract('tools.js', n => n.type === 'FunctionDeclaration' && n.id?.name === 'toggleRecording'), ctx);
    vm.runInContext(extract('tools.js', n => n.type === 'FunctionDeclaration' && n.id?.name === 'resetRecording'), ctx);
    try { ctx.toggleRecording({ classList: { remove() {} } }); } catch (error) { assert.equal(error.message, 'start unavailable'); }
    assert.deepEqual({ stopped, retained: !!ctx.recording }, { stopped: 1, retained: false });
    assert.equal(options.videoBitsPerSecond, 12_000_000);
    assert.equal(options.audioBitsPerSecond, 192_000);
    ctx.acquireCapture = () => ({ stream, shared: true });
    try { ctx.toggleRecording({ classList: { remove() {} } }); } catch (error) { assert.equal(error.message, 'start unavailable'); }
    assert.deepEqual({ stopped, retained: !!ctx.recording }, { stopped: 1, retained: false });
  });
  console.log(`\nAudio expectations: ${passed} passed, ${failed} failed. Simulated Web Audio API; no DSP or Firefox sound validation.`);
  process.exitCode = failed ? 1 : 0;
}
function blindProbe(identity = 'message-a') {
  let reveal = null;
  const text = { innerText: 'A의 원래 메시지', masked: false,
    removeAttribute() { this.masked = false; }, setAttribute() { this.masked = true; },
    after(element) { reveal = element; element.isConnected = true; },
  };
  const item = { identity, getAttribute() { return this.identity; },
    querySelector(selector) { return selector === '.hanbi-restored-message' ? reveal : text; }, querySelectorAll: () => [],
  };
  const globals = {
    features: { blindRestore: true }, originalMessages: new WeakMap(),
    isBlindNotice: require(path.join(repo, 'tools.js')).isBlindNotice,
    document: {
      querySelectorAll: () => [{ querySelectorAll: () => [item] }],
      createElement: () => ({ isConnected: false, remove() { reveal = null; this.isConnected = false; } }),
    },
  };
  return { text, item, globals, reveal: () => reveal, run: func('tools.js', 'rememberAndRestoreBlindMessages', globals) };
}
async function uiMain() {
  await check('PROMO-ALERT: new cheat-key ad alert closes once; ordinary alerts and old modal paths survive', () => {
    const closed = [], hidden = [], opened = [];
    const body = { classList: { toggle() {} } };
    const make = (name, text, role) => ({
      textContent: text, role, parentElement: body, isConnected: false,
      querySelector: () => ({ click: () => closed.push(name) }),
      setAttribute: () => hidden.push(name),
    });
    const nodes = [
      make('new', '광고 방해없이 영상을 시청하고 싶으신가요?모든 채널의 광고를 제거해주는 치지직 치트키를 사용해보세요.치트키 자세히보기팝업 닫기', 'alert'),
      make('error', '방송에 오류가 발생했습니다', 'alert'),
      make('payment', '치지직 치트키 결제를 완료했습니다', 'alert'),
      make('following', '새 팔로잉 방송이 시작됐습니다', 'alert'),
      make('old-adblock', '광고 차단 프로그램을 사용 중입니다', 'dialog'),
      make('old-tm', '치트키를 구매하면 타임머신 기능을 이용할 수 있어요!', 'dialog'),
    ];
    const remove = func('tools.js', 'removeAdPopup', {
      features: { hideAdPopup: true }, dismissedPopups: new WeakSet(),
      isBlockedPromoNotice: require(path.join(repo, 'tools.js')).isBlockedPromoNotice,
      popupRemovalRoot: require(path.join(repo, 'tools.js')).popupRemovalRoot,
      cheatKeyTimeMachinePattern: /치트키를 구매하면 타임머신/, showTimeMachine: () => opened.push('tm'),
      document: { body, querySelector: () => null, querySelectorAll: selector =>
        selector === "[aria-modal='true']" ? [] : nodes.filter(n => n.role === 'dialog' || selector.includes("[role='alert']")) },
    });
    remove(); remove();
    assert.deepEqual(closed, ['new', 'old-adblock', 'old-tm']);
    assert.deepEqual(hidden, []);
    assert.deepEqual(opened, ['tm']);
  });
  await check('PROMO-FALLBACK-OFF: retained React popup hides without deleting DOM and restores when disabled', () => {
    const attributes = new Set(), body = { classList: { remove() {}, toggle() {} } };
    const root = { textContent: '모든 채널의 광고를 제거해주는 치지직 치트키를 사용해보세요.', parentElement: body,
      isConnected: true, querySelector: () => null, querySelectorAll: () => [],
      setAttribute: name => attributes.add(name), removeAttribute: name => attributes.delete(name), inert: false };
    const features = { hideAdPopup: true };
    const remove = func('tools.js', 'removeAdPopup', {
      features, dismissedPopups: new WeakSet(),
      isBlockedPromoNotice: require(path.join(repo, 'tools.js')).isBlockedPromoNotice,
      popupRemovalRoot: require(path.join(repo, 'tools.js')).popupRemovalRoot,
      cheatKeyTimeMachinePattern: /치트키를 구매하면 타임머신/, showTimeMachine() {},
      document: { body, querySelector: () => attributes.size ? root : null, querySelectorAll: selector =>
        selector === "[aria-modal='true']" ? [] : selector === '[data-hanbi-hidden-promo]' ? attributes.size ? [root] : [] : [root] },
    });
    remove(); assert.equal(root.inert, true); assert.equal(attributes.has('data-hanbi-hidden-promo'), true);
    features.hideAdPopup = false; remove();
    assert.equal(root.inert, false); assert.equal(attributes.size, 0); assert.equal(root.isConnected, true);
  });
  await check('QUALITY-MISMATCH: actual decoded height is shown without rewriting the site selection', () => {
    let height = 1080, labels = [];
    const classes = new Set();
    const button = { textContent: 'Q --', title: '', classList: { toggle: (name, on) => on ? classes.add(name) : classes.delete(name) } };
    const location = { pathname: '/live/a' }, playbackLimit = { path: '/live/b', height: 480 };
    const source = { videoWidth: 1920, closest: () => null };
    const selected = { querySelector(selector) {
      return selector === '.hanbi-quality-actual' ? labels[0] || null : { textContent: '480p' };
    }, appendChild(label) { label.parentElement = this; labels.push(label); } };
    const sync = func('tools.js', 'syncQualityDisplay', {
      Number, video: () => source, actualQualityHeight: () => height, selectedQualityRow: () => selected,
      Boolean, location, playbackLimit, refreshPlaybackLimit() {}, isRestrictedPlayback: value => value > 0 && value < 720,
      document: {
        getElementById: () => button, querySelectorAll: () => labels.slice(),
        createElement: () => ({ remove() { labels = labels.filter(item => item !== this); } }),
      },
    });
    sync(); sync();
    assert.equal(button.textContent, 'Q 1080p');
    assert.equal(labels.length, 1);
    assert.equal(labels[0].textContent, '실제 출력 1080p');
    height = 480; sync();
    assert.equal(button.textContent, 'Q 480p');
    assert.equal(labels.length, 0);
    assert.equal(classes.has('is-limited'), false);
    playbackLimit.path = '/live/a'; sync();
    assert.equal(button.textContent, 'Q 480p 제한'); assert.equal(classes.has('is-limited'), true); assert.match(button.title, /최고 480p/);
  });
  for (const asynchronous of [false, true]) {
    await check(`BUTTON-${asynchronous ? 'ASYNC' : 'SYNC'}: handler failure must reach the visible error status`, async () => {
      let listener, reported = 0;
      const create = func('tools.js', 'button', {
        console: quiet, status() { reported++; },
        document: { createElement: () => ({ addEventListener(type, fn) { listener = fn; } }) },
      });
      const fail = () => { throw new Error('operation failed'); };
      create('test', 'TEST', asynchronous ? async () => fail() : fail);
      let escaped = false;
      try { listener({}); } catch (_) { escaped = true; }
      await new Promise(setImmediate);
      assert.deepEqual({ escaped, reported }, { escaped: false, reported: 1 });
    });
  }
  for (const denied of [false, true]) {
    await check(`SHOT-${denied ? 'FALLBACK' : 'CANVAS'}: correct path supplies one preview`, async () => {
      let fallback = 0; const previews = [], media = { videoWidth: 1920, videoHeight: 1080 };
      const canvas = { getContext: () => ({ drawImage() { if (denied) throw new Error('tainted'); } }) };
      const take = func('tools.js', 'screenshot', {
        video: () => media, document: { createElement: () => canvas }, canvasBlob: async () => 'frame-blob',
        captureVisibleVideo: async () => { fallback++; return 'visible-blob'; }, showPreview: blob => previews.push(blob),
      });
      await take(); assert.equal(canvas.width, 1920); assert.equal(canvas.height, 1080);
      assert.equal(fallback, denied ? 1 : 0); assert.deepEqual(previews, [denied ? 'visible-blob' : 'frame-blob']);
    });
  }
  await check('SHOT-CROP: HiDPI and partly off-screen player crop use correct coordinates', async () => {
    let args;
    const toolbar = { style: { visibility: '' } }, canvas = { getContext: () => ({ drawImage(...values) { args = values; } }) };
    const capture = func('tools.js', 'captureVisibleVideo', {
      document: { getElementById: () => toolbar, createElement: () => canvas },
      requestAnimationFrame: fn => fn(), innerWidth: 1000, innerHeight: 800,
      api: { runtime: { sendMessage: async () => 'data:image/png,test' } },
      loadImage: async () => ({ naturalWidth: 2000, naturalHeight: 1600 }), canvasBlob: async () => 'crop',
    });
    assert.equal(await capture({ getBoundingClientRect: () => ({ left: -20, top: 50, right: 600, bottom: 900 }) }), 'crop');
    assert.deepEqual(args.slice(1), [0, 100, 1200, 1500, 0, 0, 1200, 1500]);
    assert.equal(toolbar.style.visibility, '');
  });
  await check('SHOT-FAIL: denied screen capture restores toolbar and reports failure', async () => {
    const toolbar = { style: { visibility: '' } };
    const capture = func('tools.js', 'captureVisibleVideo', {
      document: { getElementById: () => toolbar }, requestAnimationFrame: fn => fn(),
      api: { runtime: { sendMessage: async () => { throw new Error('permission denied'); } } },
    });
    await assert.rejects(capture({}), /permission denied/); assert.equal(toolbar.style.visibility, '');
  });
  await check('SHOT-PREVIEW: repeated captures reuse one overlay and revoke the previous URL', () => {
    let overlay = null, created = 0, urlId = 0; const revoked = [];
    const image = {}, save = {}, close = {}, handle = { addEventListener() {} };
    const ctx = vm.createContext({
      previewUrl: null, fileName: () => 'frame.png', download() {},
      overlayHost: () => ({ appendChild(value) { overlay = value; } }),
      URL: { createObjectURL: () => `blob:${++urlId}`, revokeObjectURL: value => revoked.push(value) },
      document: { getElementById: () => overlay, body: { appendChild(value) { overlay = value; } },
        createElement: () => { created++; return { dataset: {}, remove() { overlay = null; }, querySelector: selector => selector === 'img' ? image : selector === '[data-save]' ? save : selector === '[data-close]' ? close : handle }; },
      },
    });
    vm.runInContext(extract('tools.js', n => n.type === 'FunctionDeclaration' && n.id?.name === 'showPreview'), ctx);
    ctx.showPreview({}); ctx.showPreview({});
    assert.equal(created, 1); assert.equal(image.src, 'blob:2'); assert.deepEqual(revoked, ['blob:1']);
    close.onclick(); assert.equal(overlay, null);
  });
  await check('FOLLOWING-PREVIEW: hover plays muted HLS, retains thumbnail, and destroys player on leave', async () => {
    const channelId = 'a'.repeat(32), image = { removeAttribute() {} }, title = {};
    const hlsUrl = 'https://livecloud.pstatic.net/chzzk/live/hls_playlist.m3u8?token=kept';
    const media = { pauseCount: 0, loadCount: 0, canPlayType: () => '',
      play() { this.onplaying?.(); return Promise.resolve(); },
      pause() { this.pauseCount++; }, removeAttribute() { delete this.src; }, load() { this.loadCount++; },
    };
    const classes = new Set(), players = [];
    let preview = null, fetchCount = 0;
    class FakeHls {
      static Events = { MEDIA_ATTACHED: 'attached', MANIFEST_PARSED: 'parsed', ERROR: 'error' };
      static isSupported() { return true; }
      constructor() { this.handlers = {}; players.push(this); }
      on(event, handler) { this.handlers[event] = handler; }
      attachMedia(value) { this.media = value; this.handlers.attached(); }
      loadSource(value) { this.source = value; this.handlers.parsed(); }
      destroy() { this.destroyed = true; }
    }
    const ctx = vm.createContext({
      URL, AbortSignal, innerWidth: 1920, innerHeight: 1080,
      features: { hoverPreview: true }, sidebarPreviewPlayer: null, sidebarPreviewToken: 0,
      loadSidebarPreviewHls: async () => ({ default: FakeHls }),
      fetch: async () => { fetchCount++; return { ok: true, json: async () => ({ code: 200, content: {
        liveImageUrl: 'https://example.com/{type}.jpg', defaultThumbnailImageUrl: 'https://example.com/default.jpg', liveTitle: '실제 방송 제목',
        livePlaybackJson: JSON.stringify({ media: [{ mediaId: 'HLS', protocol: 'HLS', path: hlsUrl }] }),
      } }) }; },
      document: {
        getElementById: () => preview,
        createElement: () => ({ dataset: {}, style: {}, classList: {
          add(value) { classes.add(value); }, remove(value) { classes.delete(value); }, contains(value) { return classes.has(value); },
        }, setAttribute() { this.hidden = true; }, querySelector: selector => selector === 'img' ? image : selector === 'video' ? media : title }),
        body: { appendChild: element => { preview = element; } },
      },
    });
    for (const name of ['stopSidebarPreview', 'sidebarPreviewHlsPath', 'startSidebarPreviewVideo', 'handleSidebarPreviewOut']) {
      vm.runInContext(extract('tools.js', n => n.type === 'FunctionDeclaration' && n.id?.name === name), ctx);
    }
    const link = {
      href: `https://chzzk.naver.com/live/${channelId}`, textContent: '채널 이름',
      querySelector: () => null, closest: () => null, contains: () => false,
      getBoundingClientRect: () => ({ right: 200, top: 100 }),
    };
    await func('tools.js', 'showSidebarPreview', ctx)(link);
    assert.equal(fetchCount, 1);
    assert.equal(preview.hidden, false);
    assert.equal(image.src, 'https://example.com/480.jpg');
    assert.equal(media.muted, true);
    assert.equal(players.length, 1);
    assert.equal(players[0].source, hlsUrl);
    assert.equal(classes.has('is-playing'), true);
    image.onerror(); assert.equal(image.src, 'https://example.com/default.jpg');
    image.onerror(); assert.equal(image.hidden, true);
    assert.equal(title.textContent, '실제 방송 제목');
    ctx.sidebarLiveLink = () => link;
    ctx.handleSidebarPreviewOut({ target: link, relatedTarget: null });
    assert.equal(preview.hidden, true);
    assert.equal(players[0].destroyed, true);
    assert.equal(media.pauseCount, 1);
    assert.equal(media.loadCount, 1);
    assert.equal(fetchCount, 1);
    ctx.fetch = async () => ({ ok: true, json: async () => ({ code: 200, content: {
      liveTitle: '영상 없는 방송', liveImageUrl: 'https://example.com/fallback_{type}.jpg',
    } }) });
    await func('tools.js', 'showSidebarPreview', ctx)(link);
    assert.equal(image.src, 'https://example.com/fallback_480.jpg');
    assert.match(title.textContent, /영상 미리보기 불가/);
    assert.equal(classes.has('is-playing'), false);
  });
  await check('FOLLOWING-PREVIEW-SOURCE: rejects non-CHZZK HLS hosts', () => {
    const source = func('tools.js', 'sidebarPreviewHlsPath', { URL });
    assert.equal(source({ livePlaybackJson: JSON.stringify({ media: [{ mediaId: 'HLS', protocol: 'HLS', path: 'https://evil.example/live.m3u8' }] }) }), '');
    assert.equal(source({ livePlaybackJson: '{invalid' }), '');
  });
  await check('FOLLOWING-PREVIEW-ISOLATION: preview video cannot replace the main recording source', () => {
    const main = { videoWidth: 1920, readyState: 4, closest: () => null, getBoundingClientRect: () => ({ width: 800, height: 450 }) };
    const preview = { videoWidth: 1920, readyState: 4, closest: () => ({}), getBoundingClientRect: () => ({ width: 1200, height: 675 }) };
    const choose = func('tools.js', 'video', { document: { querySelectorAll: () => [preview, main] } });
    assert.equal(choose(), main);
  });
  await check('BLIND-SAME-ID: an observed message restores once, OFF removes it', () => {
    const p = blindProbe(); p.run(); p.text.innerText = '관리자에 의해 블라인드 처리된 메시지입니다.'; p.run();
    assert.equal(p.reveal().textContent, 'A의 원래 메시지'); const first = p.reveal(); p.run(); assert.equal(p.reveal(), first);
    p.globals.features.blindRestore = false; p.run(); assert.equal(p.reveal(), null); assert.equal(p.text.masked, false);
  });
  await check('BLIND-NEW-ID: recycled node with a different message ID must not restore old text', () => {
    const p = blindProbe(); p.run(); p.item.identity = 'message-b'; p.text.innerText = '관리자에 의해 블라인드 처리된 메시지입니다.'; p.run(); assert.equal(p.reveal(), null);
  });
  await check('BLIND-UNKNOWN: never-observed masked message must not invent original text', () => {
    const p = blindProbe(); p.text.innerText = '관리자에 의해 블라인드 처리된 메시지입니다.'; p.run(); assert.equal(p.reveal(), null);
  });
  await check('BLIND-NO-ID-RECYCLE: reused node without an ID must not show another message', () => {
    const p = blindProbe(''); p.run();
    // Site reuses both nodes for a different, already-masked message with no stable ID.
    p.text.innerText = '관리자에 의해 블라인드 처리된 메시지입니다.'; p.run(); assert.equal(p.reveal(), null);
  });
  await check('REC-UI-REBUILD: changing screenshot setting during recording must keep STOP state', () => {
    let root = null;
    const target = { prepend(element) { root = element; element.parentElement = target; } };
    const ctx = vm.createContext({
      recording: { recorder: { state: 'recording' } }, rawRecording: null, features: { recorder: true, screenshot: true }, video: () => ({}), isLive: () => true,
      button: (label, text, action) => ({ label, textContent: text, action, classList: { add() {} } }), screenshot() {}, showTimeMachine() {}, toggleRecording() {}, toggleRawRecording() {},
      pipSupported: () => true, togglePip() {}, syncPipButton() {},
      document: {
        querySelector: () => target, getElementById: () => root,
        createElement: () => ({ dataset: {}, children: [], appendChild(el) { this.children.push(el); }, remove() { if (root === this) root = null; } }),
      },
    });
    vm.runInContext(extract('tools.js', n => n.type === 'FunctionDeclaration' && n.id?.name === 'ensureTools'), ctx);
    ctx.ensureTools(); root.children[0].textContent = 'STOP';
    ctx.features.screenshot = false; ctx.ensureTools(); assert.equal(root.children[0].textContent, 'STOP');
    ctx.features.recorder = false; ctx.rawRecording = { source: {} }; ctx.ensureTools(); assert.equal(root.children[0].textContent, 'STOP');
    assert.ok(root.children.some((child) => child.id === 'hanbi-pip-button'), 'PIP button exists where the standard PiP API is available');
    ctx.pipSupported = () => false; ctx.ensureTools();
    assert.ok(!root.children.some((child) => child.id === 'hanbi-pip-button'), 'no PIP button without the standard API (Firefox)');
    ctx.rawRecording = null; ctx.ensureTools(); assert.equal(root.children.some(item => item.label === '방송 원본 조각 녹화 시작/저장'), false);
  });
  await check('TREND-FALLBACK: below-threshold lives still show the popular fallback', () => {
    const { selectTrendStreams } = require(path.join(repo, 'tools.js'));
    const result = selectTrendStreams([{ channelId: 'a', concurrentUserCount: 200 }], new Map(), 1000, 10);
    assert.equal(result.items.length, 1);
    assert.equal(result.items[0].pumping, false);
  });
  await check('RAW-STALL: buffering or a larger video must not stop RAW; leaving the channel does', () => {
    const source = { isConnected: true };
    const stops = [];
    const ctx = vm.createContext({
      recording: null, rawRecording: { source, channelPath: '/live/a' }, location: { pathname: '/live/a' },
      video: () => null, rawCommand: command => stops.push(command), console: quiet, document: { getElementById: () => null },
      preparedVideos: new WeakSet(), features: { autoUnmute: false }, isLive: () => true, applyCompressorState() {},
    });
    vm.runInContext(extract('tools.js', n => n.type === 'FunctionDeclaration' && n.id?.name === 'prepareVideo'), ctx);
    ctx.prepareVideo();
    ctx.video = () => ({ isConnected: true, addEventListener() {} }); ctx.prepareVideo();
    assert.deepEqual(stops, []); assert.equal(ctx.rawRecording.source, source);
    ctx.location.pathname = '/live/b'; ctx.prepareVideo();
    assert.deepEqual(stops, ['stop']); assert.equal(ctx.rawRecording, null);
  });
  await check('FULLSCREEN-OVERLAY: status/REC/TM overlays follow the fullscreen element', () => {
    const body = { children: [], appendChild(node) { node.parentElement = this; } };
    const player = { appendChild(node) { node.parentElement = this; } };
    const nodes = { 'hanbi-tool-status': { parentElement: body }, 'hanbi-recording-indicator': { parentElement: body } };
    const ctx = vm.createContext({ document: { fullscreenElement: null, body, getElementById: id => nodes[id] || null } });
    vm.runInContext(`${extract('tools.js', n => n.type === 'VariableDeclarator' && n.id?.name === 'overlayHost').replace(/^/, 'var ')};${extract('tools.js', n => n.type === 'VariableDeclarator' && n.id?.name === 'overlayIds').replace(/^/, 'var ')};${extract('tools.js', n => n.type === 'FunctionDeclaration' && n.id?.name === 'moveOverlays')}`, ctx);
    ctx.document.fullscreenElement = player; ctx.moveOverlays();
    assert.equal(nodes['hanbi-tool-status'].parentElement, player); assert.equal(nodes['hanbi-recording-indicator'].parentElement, player);
    ctx.document.fullscreenElement = null; ctx.moveOverlays();
    assert.equal(nodes['hanbi-tool-status'].parentElement, body);
  });
  console.log(`\nUI flow expectations: ${passed} passed, ${failed} failed. Hand-built DOM/API fixtures, not browser rendering/E2E.`);
  process.exitCode = failed ? 1 : 0;
}
(process.argv.includes('--audio') ? audioMain() : process.argv.includes('--ui') ? uiMain() : main()).catch(error => { console.error(error); process.exitCode = 2; });
