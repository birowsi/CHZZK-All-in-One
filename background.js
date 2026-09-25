const extensionApi = globalThis.browser ?? globalThis.chrome;
const recordingStore = HanbiRecordingStore.createStore();
const powerLogStore = HanbiLogs.createStore(extensionApi);
let followingSnapshotQueue = Promise.resolve();
let followingPoll = null;
let nextPollId = 0;
let lastFollowingPollAt = 0;
let gridEnabled = false;
const failedUpgrades = new Map();
const redirectedStreams = new Map();
const manualQualityPaths = new Map();
extensionApi.tabs.onRemoved.addListener(tabId => manualQualityPaths.delete(tabId));
extensionApi.tabs.onUpdated.addListener((tabId, change) => {
  if (change.status === 'loading' || change.url) manualQualityPaths.delete(tabId);
});
const streamFilter = { urls: ["https://*.navercdn.com/*", "https://*.pstatic.net/*", "https://*.akamaized.net/*"], types: ["xmlhttprequest", "media"] };

extensionApi.webRequest.onBeforeRequest.addListener(async (details) => {
  const manualPath = manualQualityPaths.get(details.tabId);
  if (manualPath && [details.documentUrl, details.originUrl].some(url => {
    try { return new URL(url).pathname === manualPath; } catch (_) { return false; }
  })) return {};
  if (!gridEnabled || ![details.originUrl, details.documentUrl].some((url) => /^(?:blob:)?https:\/\/(?:[\w-]+\.)?chzzk\.naver\.com\//.test(url || ""))) return {};
  const redirectUrl = HanbiGridLogic.higherQualityUrl(details.url);
  if (!redirectUrl) return {};
  // A failed upgraded request must not loop back into an upgrade.
  if (redirectedStreams.has(details.requestId)) return {};
  if ((failedUpgrades.get(details.url) || 0) > Date.now()) return {};
  // Redirect the actual player request with its original authentication context.
  // A separate extension fetch can fail even when the player's request is valid.
  redirectedStreams.set(details.requestId, details.url);
  return { redirectUrl };
}, streamFilter, ["blocking"]);
extensionApi.webRequest.onHeadersReceived.addListener((details) => {
  const original = redirectedStreams.get(details.requestId);
  if (original && details.url !== original && details.statusCode >= 400) {
    if (failedUpgrades.size >= 200) failedUpgrades.delete(failedUpgrades.keys().next().value);
    failedUpgrades.set(original, Date.now() + 60_000);
    return { redirectUrl: original };
  }
  return {};
}, streamFilter, ["blocking"]);
for (const event of [extensionApi.webRequest.onCompleted, extensionApi.webRequest.onErrorOccurred]) {
  event.addListener((details) => {
    const original = redirectedStreams.get(details.requestId);
    if (original && details.error) {
      if (failedUpgrades.size >= 200) failedUpgrades.delete(failedUpgrades.keys().next().value);
      failedUpgrades.set(original, Date.now() + 60_000);
    }
    redirectedStreams.delete(details.requestId);
  }, streamFilter);
}

async function syncGridBypass() {
  const { os } = await extensionApi.runtime.getPlatformInfo();
  const { features = {} } = await extensionApi.storage.local.get("features");
  gridEnabled = os === "win" && features.gridBypass !== false;

  await extensionApi.declarativeNetRequest.updateEnabledRulesets({
    enableRulesetIds: [],
    disableRulesetIds: ["grid_bypass"],
  });
}

extensionApi.runtime.onInstalled.addListener(syncGridBypass);
extensionApi.runtime.onStartup.addListener(syncGridBypass);
syncGridBypass().catch(console.error);
extensionApi.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.features) {
    syncGridBypass().catch(console.error);
    if (changes.features.oldValue?.followingAlerts !== changes.features.newValue?.followingAlerts) {
      followingPoll = null;
      extensionApi.storage.local.remove(["followingLiveState", "followingLiveSource", "followingAccount", "followingUpdatedAt"]);
    }
  }
});

async function saveFollowingSnapshot(message, sender) {
  if (followingPoll?.id !== message.pollId || followingPoll.tabId !== sender.tab.id || followingPoll.until <= Date.now()) return [];
  const { followingLiveState, followingLiveSource, followingAccount, followingUpdatedAt, features = {} } = await extensionApi.storage.local.get(["followingLiveState", "followingLiveSource", "followingAccount", "followingUpdatedAt", "features"]);
  if (features.followingAlerts === false || followingPoll?.id !== message.pollId || followingPoll.until <= Date.now()) return [];
  const known = followingLiveSource === "api-full-v2" && followingAccount === message.account && Date.now() - followingUpdatedAt < 60_000;
  const result = HanbiFollowingLogic.detectLiveStarts(known ? followingLiveState : undefined, message.entries);
  await extensionApi.storage.local.set({ followingLiveState: result.state, followingLiveSource: "api-full-v2", followingAccount: message.account, followingUpdatedAt: Date.now() });
  return result.alerts;
}

extensionApi.runtime.onMessage.addListener((message, sender) => {
  if (message?.type === 'quality-manual' && sender.tab && typeof message.path === 'string') {
    manualQualityPaths.set(sender.tab.id, message.path);
    return Promise.resolve({ ok: true });
  }
  if (message?.type === 'power-logs') {
    return powerLogStore(message).then(result => ({ ok: true, ...result }), error => ({ ok: false, error: error.message }));
  }
  if (message?.type === "following-poll") {
    if (!sender.tab?.active || Date.now() - lastFollowingPollAt < 5_000 || (followingPoll && followingPoll.until > Date.now())) return Promise.resolve({});
    lastFollowingPollAt = Date.now();
    followingPoll = { id: ++nextPollId, tabId: sender.tab.id, until: Date.now() + 10_000 };
    return Promise.resolve({ pollId: followingPoll.id });
  }
  if (message?.type === "following-poll-end") {
    if (followingPoll?.id === message.pollId && followingPoll.tabId === sender.tab?.id) followingPoll = null;
    return Promise.resolve({});
  }
  if (message?.type === "following-snapshot") {
    if (!sender.tab?.active || typeof message.account !== "string" || !message.account || !Array.isArray(message.entries)
      || message.entries.some((entry) => !/^[a-f0-9]{32}$/i.test(entry?.channelId) || typeof entry.liveKey !== "string")) return Promise.resolve({ alerts: [] });
    followingSnapshotQueue = followingSnapshotQueue.catch(() => {}).then(() => saveFollowingSnapshot(message, sender));
    return followingSnapshotQueue.then((alerts) => ({ alerts }));
  }
  if (message?.type === "capture-visible-tab") {
    return extensionApi.tabs.captureVisibleTab(sender.tab?.windowId, { format: "png" });
  }
  if (message?.type === "recording-complete") {
    return (async () => {
      if (!(message.recording?.blob instanceof Blob) || !message.recording.blob.size) throw new Error('녹화 데이터가 없습니다.');
      const id = crypto.randomUUID();
      await recordingStore.put({ ...message.recording, id });
      await extensionApi.tabs.create({ url: extensionApi.runtime.getURL(`record-result.html?id=${id}`) });
      return { id };
    })();
  }
  if (message?.type === "get-recording") {
    return typeof message.id === 'string' ? recordingStore.get(message.id) : Promise.resolve(null);
  }
  if (message?.type === 'delete-recording') {
    if (typeof message.id !== 'string' || !message.id) return Promise.reject(new Error('녹화 ID가 없습니다.'));
    return recordingStore.delete(message.id).then(() => ({ ok: true }));
  }
  return undefined;
});
