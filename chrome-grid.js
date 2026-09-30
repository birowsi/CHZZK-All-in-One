(() => {
  'use strict';
  const ruleId = 1000;
  const upgradePattern = '^(https://[^/]+/[^?]*?)480p([^?]*\\.m3u8(?:\\?.*)?)$';
  const escapeRegex = text => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  function createController(api, logic, now = () => Date.now()) {
    let enabled = false;
    let queue = Promise.resolve();
    const redirects = new Map();
    const filter = { urls: ['https://*.navercdn.com/*', 'https://*.pstatic.net/*', 'https://*.akamaized.net/*'], types: ['xmlhttprequest', 'media'] };
    const alarmName = 'hanbi-grid-fallback';
    function enqueue(action) {
      const next = queue.catch(() => {}).then(action);
      queue = next;
      return next;
    }
    async function rebuild() {
      const { chromeGridManual = {}, chromeGridFailures = [] } = await api.storage.session.get(['chromeGridManual', 'chromeGridFailures']);
      const failures = chromeGridFailures.filter(item => item.until > now()).slice(-200);
      const addRules = [];
      const tabIds = (await api.tabs.query({ url: ['https://chzzk.naver.com/*', 'https://*.chzzk.naver.com/*'] })).map(tab => tab.id);
      if (enabled && tabIds.length) {
        const excludedTabIds = Object.keys(chromeGridManual).map(Number);
        addRules.push({ id: ruleId, priority: 1,
          action: { type: 'redirect', redirect: { regexSubstitution: '\\11080p\\2' } },
          condition: { regexFilter: upgradePattern, isUrlFilterCaseSensitive: true,
            tabIds, requestDomains: ['navercdn.com', 'pstatic.net', 'akamaized.net'],
            resourceTypes: ['xmlhttprequest', 'media'], ...(excludedTabIds.length ? { excludedTabIds } : {}) } });
        failures.forEach((item, index) => addRules.push({ id: ruleId + index + 1, priority: 2, action: { type: 'allow' },
          condition: { regexFilter: '^' + escapeRegex(item.url) + '$', isUrlFilterCaseSensitive: true,
            tabIds, resourceTypes: ['xmlhttprequest', 'media'] } }));
      }
      const existing = await api.declarativeNetRequest.getSessionRules();
      await api.declarativeNetRequest.updateSessionRules({ removeRuleIds: existing.filter(rule => rule.id >= ruleId && rule.id <= ruleId + 200).map(rule => rule.id), addRules });
      if (failures.length !== chromeGridFailures.length) await api.storage.session.set({ chromeGridFailures: failures });
      if (failures.length) await api.alarms.create(alarmName, { when: Math.max(now() + 1000, Math.min(...failures.map(item => item.until))) });
      else await api.alarms.clear(alarmName);
    }
    function fail(details) {
      const original = redirects.get(details.requestId);
      if (!original || (!details.error && details.statusCode < 400)) return;
      redirects.delete(details.requestId);
      enqueue(async () => {
        const { chromeGridFailures = [] } = await api.storage.session.get('chromeGridFailures');
        const failures = chromeGridFailures.filter(item => item.until > now() && item.url !== original).slice(-199);
        failures.push({ url: original, until: now() + 60_000 });
        await api.storage.session.set({ chromeGridFailures: failures });
        await rebuild();
      }).catch(console.error);
    }
    api.webRequest.onBeforeRedirect.addListener(details => {
      if (enabled && logic.higherQualityUrl(details.url) === details.redirectUrl) redirects.set(details.requestId, details.url);
    }, filter);
    api.webRequest.onHeadersReceived.addListener(fail, filter);
    api.webRequest.onErrorOccurred.addListener(details => { fail(details); redirects.delete(details.requestId); }, filter);
    api.webRequest.onCompleted.addListener(details => redirects.delete(details.requestId), filter);
    api.alarms.onAlarm.addListener(alarm => { if (alarm.name === alarmName) enqueue(rebuild).catch(console.error); });
    const clearManual = tabId => enqueue(async () => {
      const { chromeGridManual = {} } = await api.storage.session.get('chromeGridManual');
      if (Object.hasOwn(chromeGridManual, tabId)) delete chromeGridManual[tabId];
      await api.storage.session.set({ chromeGridManual }); await rebuild();
    });
    api.tabs.onRemoved.addListener(tabId => { clearManual(tabId).catch(console.error); });
    api.tabs.onUpdated.addListener((tabId, change) => {
      if (change.status === 'loading') clearManual(tabId).catch(console.error);
      else if (change.url) enqueue(async () => {
        const { chromeGridManual = {} } = await api.storage.session.get('chromeGridManual');
        if (chromeGridManual[tabId] && chromeGridManual[tabId] !== new URL(change.url).pathname) delete chromeGridManual[tabId];
        await api.storage.session.set({ chromeGridManual }); await rebuild();
      }).catch(console.error);
    });
    return {
      sync(value) { return enqueue(async () => { enabled = value; await rebuild(); }); },
      setManual(tabId, path) { return enqueue(async () => {
        const { chromeGridManual = {} } = await api.storage.session.get('chromeGridManual');
        chromeGridManual[tabId] = path;
        await api.storage.session.set({ chromeGridManual }); await rebuild();
      }); },
      idle() { return queue; },
    };
  }
  if (typeof chrome !== 'undefined') globalThis.HanbiChromeGrid = createController(chrome, HanbiGridLogic);
  if (typeof module !== 'undefined') module.exports = { createController, upgradePattern };
})();
