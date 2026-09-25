(() => {
  "use strict";

  function normalizeFollowingPayload(payload) {
    if (payload?.code !== 200) return null;
    const list = payload?.content?.followingList;
    if (!Array.isArray(list)) return null;
    return list.map((raw) => {
      const channel = raw?.channel?.channel || raw?.channel || {};
      const live = raw?.liveInfo || {};
      const channelId = raw?.channelId || channel.channelId;
      if (typeof channelId !== "string" || !/^[a-f0-9]{32}$/i.test(channelId)) return null;
      if (raw.following === false || raw.personalData?.following === false || raw.channel?.personalData?.following === false || channel.personalData?.following === false) return null;
      if (typeof raw?.streamer?.openLive !== "boolean") return null;
      const open = raw?.streamer?.openLive === true;
      return {
        channelId: String(channelId),
        channelName: channel.channelName || "팔로잉 채널",
        channelImageUrl: channel.channelImageUrl || "",
        liveTitle: live.liveTitle || "방송을 시작했습니다",
        liveImageUrl: live.liveImageUrl || "",
        liveKey: open ? String(live.liveId || live.openDate || "open") : "",
      };
    }).filter(Boolean);
  }

  function detectLiveStarts(previous, entries) {
    const state = Object.fromEntries(entries.map((entry) => [entry.channelId, entry.liveKey]));
    if (!previous) return { alerts: [], state };
    return {
      alerts: entries.filter((entry) => {
        const before = previous[entry.channelId];
        return entry.liveKey && Object.hasOwn(previous, entry.channelId) && (
          before === "" || (before !== "open" && entry.liveKey !== "open" && before !== entry.liveKey)
        );
      }),
      state,
    };
  }

  const logic = { normalizeFollowingPayload, detectLiveStarts };
  globalThis.HanbiFollowingLogic = logic;
  if (typeof module !== "undefined") module.exports = logic;
})();
