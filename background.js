const extensionApi = globalThis.browser ?? globalThis.chrome;
// ponytail: one pending result is enough while recording is single-session; use a Map if concurrent tabs are added.
let pendingRecording = null;
let lastFollowingPoll = 0;
let followingSnapshotQueue = Promise.resolve();

async function syncGridBypass() {
  const { os } = await extensionApi.runtime.getPlatformInfo();
  const { features = {} } = await extensionApi.storage.local.get("features");
  const enabled = os === "win" && features.gridBypass !== false;

  await extensionApi.declarativeNetRequest.updateEnabledRulesets({
    enableRulesetIds: enabled ? ["grid_bypass"] : [],
    disableRulesetIds: enabled ? [] : ["grid_bypass"],
  });
}

extensionApi.runtime.onInstalled.addListener(syncGridBypass);
extensionApi.runtime.onStartup.addListener(syncGridBypass);
extensionApi.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.features) {
    syncGridBypass();
    if (changes.features.oldValue?.followingAlerts !== changes.features.newValue?.followingAlerts) {
      extensionApi.storage.local.remove("followingLiveState");
    }
  }
});

async function saveFollowingSnapshot(entries) {
  const { followingLiveState } = await extensionApi.storage.local.get("followingLiveState");
  const result = HanbiFollowingLogic.detectLiveStarts(followingLiveState, entries);
  await extensionApi.storage.local.set({ followingLiveState: result.state });
  return result.alerts;
}

extensionApi.runtime.onMessage.addListener((message, sender) => {
  if (message?.type === "claim-following-poll") {
    const now = Date.now();
    if (!sender.tab?.active || now - lastFollowingPoll < 14_000) return Promise.resolve({ granted: false });
    lastFollowingPoll = now;
    return Promise.resolve({ granted: true });
  }
  if (message?.type === "following-snapshot") {
    if (!Array.isArray(message.entries)) return Promise.resolve({ alerts: [] });
    followingSnapshotQueue = followingSnapshotQueue.catch(() => {}).then(() => saveFollowingSnapshot(message.entries));
    return followingSnapshotQueue.then((alerts) => ({ alerts }));
  }
  if (message?.type === "capture-visible-tab") {
    return extensionApi.tabs.captureVisibleTab(sender.tab?.windowId, { format: "png" });
  }
  if (message?.type === "recording-complete") {
    pendingRecording = message.recording;
    return extensionApi.tabs.create({ url: extensionApi.runtime.getURL("record-result.html") });
  }
  if (message?.type === "get-recording") {
    const result = pendingRecording;
    pendingRecording = null;
    return Promise.resolve(result);
  }
  return undefined;
});
