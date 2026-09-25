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
  arrowSeek: true,
  videoFilters: false,
  hideDonation: false,
  chatFontSizeEnabled: false,
  sidebarRefresh: true,
  hoverPreview: true,
};
const trendDefaults = { minViewers: 1000, displayCount: 10, refreshMinutes: 1, sharpnessAmount: 100, brightnessAmount: 100, contrastAmount: 100, chatFontSize: 14 };
const powerSettings = {
  toggle: ["powerAcquisition", "updatePowerAcquisition", "powerAcquisitionEnabled", true],
  badgeToggle: ["badge", "updateBadgeToggle", "badgeToggle", true],
  clockToggle: ["clockToggle", "updateClockToggle", "clockToggle", false],
  powerSummaryToggle: ["powerSummary", "updatePowerSummaryToggle", "powerSummaryToggle", false],
  movingGifProfileToggle: ["movingGifProfile", "updateMovingGifProfileToggle", "movingGifProfileToggle", false],
};

async function notifyTab(message) {
  const [tab] = await api.tabs.query({ active: true, currentWindow: true });
  if (tab?.id && tab.url?.includes("chzzk.naver.com")) api.tabs.sendMessage(tab.id, message).catch(() => {});
}

function updateNextPowerTime(logs) {
  const now = new Date();
  const latest = logs.filter(log => log?.method === 'view').reduce((max, log) => Math.max(max, Date.parse(log.timestamp) || 0), 0);
  const next = latest ? new Date(latest + 3_600_000) : null;
  const display = document.getElementById("timeDisplay");
  if (!next || next <= now) { display.textContent = latest ? "획득 가능 여부 확인 필요" : "획득 기록 없음"; return; }
  const minutes = Math.max(0, Math.ceil((next - now) / 60_000));
  display.textContent = `${Math.floor(minutes / 60)}시간 ${minutes % 60}분 후`.replace(/^0시간 /, "");
}

async function init() {
  const { features: savedFeatures = {} } = await api.storage.local.get("features");
  const features = { ...featureDefaults, ...savedFeatures };
  for (const input of document.querySelectorAll("[data-feature]")) {
    input.checked = features[input.dataset.feature];
    input.addEventListener("change", async () => {
      features[input.dataset.feature] = input.checked;
      const { features: current = {} } = await api.storage.local.get('features');
      await api.storage.local.set({ features: { ...current, [input.dataset.feature]: input.checked } });
      if (input.dataset.feature === 'gridBypass') document.getElementById('popupStatus').textContent = 'GRID 설정 변경: 기존 응답을 되돌리려면 방송 탭을 새로고침하세요.';
    });
  }

  const { trendOptions: savedTrendOptions = {} } = await api.storage.local.get("trendOptions");
  const trendOptions = { ...trendDefaults, ...savedTrendOptions };
  for (const input of document.querySelectorAll("[data-trend-option]")) {
    const key = input.dataset.trendOption;
    input.value = trendOptions[key];
    input.addEventListener("change", async () => {
      const value = Math.max(Number(input.min) || 0, Math.min(Number(input.max) || Infinity, Math.floor(input.value.trim() !== '' && Number.isFinite(Number(input.value)) ? Number(input.value) : trendDefaults[key])));
      input.value = value;
      trendOptions[key] = value;
      await api.storage.local.set({ trendOptions });
    });
  }

  const storedPower = await api.storage.sync.get(Object.values(powerSettings).map(([key]) => key));
  if (storedPower.powerAcquisition === undefined) {
    storedPower.powerAcquisition = storedPower.badge ?? true;
    await api.storage.sync.set({ powerAcquisition: storedPower.powerAcquisition });
  }
  for (const [id, [key, action, messageKey, defaultValue]] of Object.entries(powerSettings)) {
    const input = document.getElementById(id);
    input.checked = storedPower[key] ?? defaultValue;
    input.addEventListener("change", async () => {
      await api.storage.sync.set({ [key]: input.checked });
      notifyTab({ action, [messageKey]: input.checked });
    });
  }

  let { powerLogs = [] } = await api.storage.local.get("powerLogs");
  updateNextPowerTime(powerLogs);
  api.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.powerLogs) {
      powerLogs = changes.powerLogs.newValue || [];
      updateNextPowerTime(powerLogs);
    }
  });
  setInterval(() => updateNextPowerTime(powerLogs), 60_000);
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
  else if (result.apiOk) status.textContent = `팝업 표시 · 팔로잉 API 확인 (${result.count}개 채널)`;
  else status.textContent = `팝업 표시 · ${result.error || "팔로잉 API 확인 실패"}`;
  });
}

init().catch(console.error);
