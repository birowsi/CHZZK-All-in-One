const extensionApi = globalThis.browser ?? globalThis.chrome;
// ponytail: one pending result is enough while recording is single-session; use a Map if concurrent tabs are added.
let pendingRecording = null;
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
      extensionApi.storage.local.remove(["followingLiveState", "followingLiveSource"]);
    }
  }
});

async function saveFollowingSnapshot(entries) {
  const { followingLiveState, followingLiveSource } = await extensionApi.storage.local.get(["followingLiveState", "followingLiveSource"]);
  const result = HanbiFollowingLogic.detectLiveStarts(followingLiveSource === "dom-v2" ? followingLiveState : undefined, entries);
  await extensionApi.storage.local.set({ followingLiveState: result.state, followingLiveSource: "dom-v2" });
  return result.alerts;
}

extensionApi.runtime.onMessage.addListener((message, sender) => {
  if (message?.type === "following-snapshot") {
    if (!sender.tab?.active || !Array.isArray(message.entries)) return Promise.resolve({ alerts: [] });
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
