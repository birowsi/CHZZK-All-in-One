const api = globalThis.browser ?? globalThis.chrome;
const featureDefaults = {
  screenshot: true,
  recorder: true,
  autoUnmute: true,
  hideAdPopup: true,
  blindRestore: true,
  followingAlerts: true,
  trends: true,
  gridBypass: true,
  sharpness: false,
};
const trendDefaults = { minViewers: 1000, displayCount: 10, refreshMinutes: 1, sharpnessAmount: 100 };
const powerSettings = {
  toggle: ["badge", "updateBadgeToggle", "badgeToggle", true],
  clockToggle: ["clockToggle", "updateClockToggle", "clockToggle", false],
  powerSummaryToggle: ["powerSummary", "updatePowerSummaryToggle", "powerSummaryToggle", false],
  movingGifProfileToggle: ["movingGifProfile", "updateMovingGifProfileToggle", "movingGifProfileToggle", false],
};

async function notifyTab(message) {
  const [tab] = await api.tabs.query({ active: true, currentWindow: true });
  if (tab?.id && tab.url?.includes("chzzk.naver.com")) api.tabs.sendMessage(tab.id, message).catch(() => {});
}

function updateNextPowerTime(logs, lastAcquisitionTime) {
  const now = new Date();
  let next = lastAcquisitionTime ? new Date(new Date(lastAcquisitionTime).getTime() + 3_600_000) : null;
  if (!next || next <= now) {
    const last = logs[0]?.timestamp ? new Date(logs[0].timestamp) : now;
    next = new Date(now);
    next.setMinutes(last.getMinutes(), 0, 0);
    if (next <= now) next.setHours(next.getHours() + 1);
  }
  const minutes = Math.max(0, Math.ceil((next - now) / 60_000));
  document.getElementById("timeDisplay").textContent = minutes ? `${Math.floor(minutes / 60)}시간 ${minutes % 60}분 후`.replace(/^0시간 /, "") : "곧 획득 가능";
}

async function init() {
  const { features: savedFeatures = {} } = await api.storage.local.get("features");
  const features = { ...featureDefaults, ...savedFeatures };
  for (const input of document.querySelectorAll("[data-feature]")) {
    input.checked = features[input.dataset.feature];
    input.addEventListener("change", async () => {
      features[input.dataset.feature] = input.checked;
      await api.storage.local.set({ features });
    });
  }

  const { trendOptions: savedTrendOptions = {} } = await api.storage.local.get("trendOptions");
  const trendOptions = { ...trendDefaults, ...savedTrendOptions };
  for (const input of document.querySelectorAll("[data-trend-option]")) {
    const key = input.dataset.trendOption;
    input.value = trendOptions[key];
    input.addEventListener("change", async () => {
      const value = Math.max(Number(input.min) || 0, Math.min(Number(input.max) || Infinity, Math.floor(Number(input.value) || trendDefaults[key])));
      input.value = value;
      trendOptions[key] = value;
      await api.storage.local.set({ trendOptions });
    });
  }

  const storedPower = await api.storage.sync.get(Object.values(powerSettings).map(([key]) => key));
  for (const [id, [key, action, messageKey, defaultValue]] of Object.entries(powerSettings)) {
    const input = document.getElementById(id);
    input.checked = storedPower[key] ?? defaultValue;
    input.addEventListener("change", async () => {
      await api.storage.sync.set({ [key]: input.checked });
      notifyTab({ action, [messageKey]: input.checked });
    });
  }

  const { powerLogs = [], lastPowerAcquisitionTime } = await api.storage.local.get(["powerLogs", "lastPowerAcquisitionTime"]);
  updateNextPowerTime(powerLogs, lastPowerAcquisitionTime);
  setInterval(() => updateNextPowerTime(powerLogs, lastPowerAcquisitionTime), 1000);
  document.getElementById("viewLogs").addEventListener("click", () => api.tabs.create({ url: api.runtime.getURL("log.html") }));
  document.getElementById("testFollowingAlert").addEventListener("click", async () => {
    const status = document.getElementById("popupStatus");
    const [tab] = await api.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id || !tab.url?.includes("chzzk.naver.com")) {
      status.textContent = "치지직 탭에서 테스트해 주세요.";
      return;
    }
    const result = await api.tabs.sendMessage(tab.id, { type: "test-following-alert" }).catch(() => null);
    if (!result?.shown) status.textContent = "알림 기능을 켜고 페이지를 새로고침해 주세요.";
    else if (result.apiOk) status.textContent = `팝업 표시 · API 정상 (${result.count}개 채널)`;
    else status.textContent = `팝업 표시 · API 실패 (${result.error || "로그인 상태 확인"})`;
  });
}

init().catch(console.error);
