(() => {
  "use strict";

  function detectLiveStarts(previous, entries) {
    const state = Object.fromEntries(entries.map((entry) => [entry.channelId, entry.liveKey]));
    if (!previous) return { alerts: [], state };
    return {
      alerts: entries.filter((entry) => entry.liveKey && previous[entry.channelId] !== entry.liveKey),
      state,
    };
  }

  const logic = { detectLiveStarts };
  globalThis.HanbiFollowingLogic = logic;
  if (typeof module !== "undefined") module.exports = logic;
})();
