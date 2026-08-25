(() => {
  "use strict";

  function normalizeFollowingPayload(payload) {
    const list = Array.isArray(payload)
      ? payload
      : payload?.content?.followingList ?? payload?.content?.data ?? payload?.followingList;
    if (!Array.isArray(list)) return null;

    return list.map((raw) => {
      const channel = raw?.channel?.channel || raw?.channel || raw || {};
      const live = raw?.liveInfo || raw?.live || {};
      const channelId = raw?.channelId || channel.channelId;
      if (!channelId) return null;
      const openValue = raw?.streamer?.openLive ?? raw?.openLive ?? live.openLive ?? live.status;
      const open = openValue === true || /^(?:OPEN|LIVE)$/i.test(String(openValue || "")) ||
        (openValue == null && Boolean(live.liveId));
      return {
        channelId: String(channelId),
        channelName: channel.channelName || raw.channelName || "팔로잉 채널",
        channelImageUrl: channel.channelImageUrl || raw.channelImageUrl || "",
        liveTitle: live.liveTitle || raw.liveTitle || "방송을 시작했습니다",
        liveImageUrl: live.liveImageUrl || raw.liveImageUrl || "",
        liveKey: open ? String(live.liveId || raw.liveId || live.openDate || raw.openDate || "open") : "",
      };
    }).filter(Boolean);
  }

  function detectLiveStarts(previous, entries) {
    const state = Object.fromEntries(entries.map((entry) => [entry.channelId, entry.liveKey]));
    if (!previous) return { alerts: [], state };
    return {
      alerts: entries.filter((entry) => entry.liveKey && previous[entry.channelId] !== entry.liveKey),
      state,
    };
  }

  const logic = { normalizeFollowingPayload, detectLiveStarts };
  globalThis.HanbiFollowingLogic = logic;
  if (typeof module !== "undefined") module.exports = logic;
})();
