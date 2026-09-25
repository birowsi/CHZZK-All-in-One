(() => {
  "use strict";
  // Adapted from cheese-knife's buffered seek / setSeeking / patchHls (MIT; see NOTICE).
  function findHls(root) {
    const from = (value) => {
      for (const player of [value?._corePlayer, value?.current?._corePlayer, value?.current, value]) {
        const hls = player?.player?._mediaController?._hls;
        if (hls?.config && hls.streamController) return hls;
      }
      return null;
    };
    const direct = from(root);
    if (direct) return direct;
    let fiber = Object.entries(root || {}).find(([key]) => key.startsWith("__reactFiber$"))?.[1];
    for (let depth = 0; fiber && depth < 100; depth++, fiber = fiber.return) {
      for (let hook = fiber.memoizedState, count = 0; hook && count < 100; hook = hook.next, count++) {
        const found = from(hook.memoizedState);
        if (found) return found;
      }
    }
    return null;
  }
  function mediaCandidates(container) {
    const videos = container?.querySelectorAll ? [...container.querySelectorAll("video")] : [container?.querySelector?.("video")].filter(Boolean);
    const ready = item => item.videoWidth && item.readyState >= 2 ? item.videoWidth * item.videoHeight : 0;
    return videos.filter(item => !item.closest?.("#preAdPlayerWrapper, #midAdPlayerWrapper"))
      .sort((a, b) => ready(b) - ready(a))[0] || null;
  }
  function bufferedPosition(ranges, requested) {
    if (!ranges?.length || !Number.isFinite(requested)) return null;
    let closest = null;
    for (let index = 0; index < ranges.length; index++) {
      const start = ranges.start(index), end = ranges.end(index);
      const margin = Math.min(1, (end - start) / 2);
      const position = Math.max(start + margin, Math.min(end - margin, requested));
      if (closest === null || Math.abs(position - requested) < Math.abs(closest - requested)) closest = position;
    }
    return closest;
  }
  function createTimeShift() {
    let active = null;
    function restore() {
      if (!active) return;
      const state = active;
      active = null;
      for (const [key, value] of Object.entries(state.original)) {
        if (state.hls.config?.[key] === state.applied[key]) state.hls.config[key] = value;
      }
      if (state.controller.synchronizeToLiveEdge === state.wrapper) state.controller.synchronizeToLiveEdge = state.sync;
    }
    function enable(hls, media) {
      if (active?.hls === hls && active.media === media) return;
      restore();
      const controller = hls?.streamController;
      if (!hls?.config || typeof controller?.synchronizeToLiveEdge !== "function" || !media) {
        throw new Error("플레이어의 HLS 버퍼 제어 연결을 찾지 못했습니다. 원본 재생을 유지합니다.");
      }
      if (hls.media && hls.media !== media) throw new Error("표시 중인 영상과 HLS 플레이어가 일치하지 않습니다.");
      const keys = ["backBufferLength", "maxBufferSize", "maxBufferLength", "maxMaxBufferLength"];
      const original = Object.fromEntries(keys.map((key) => [key, hls.config[key]]));
      if (keys.some((key) => typeof original[key] !== "number" || Number.isNaN(original[key]))) throw new Error("지원하지 않는 HLS 버퍼 설정입니다.");
      // ponytail: retain 5 minutes / 100 MB rather than upstream's unbounded back buffer and 1000x limits.
      const applied = { backBufferLength: 300, maxBufferSize: Math.max(original.maxBufferSize, 100_000_000), maxBufferLength: Math.max(original.maxBufferLength, 330), maxMaxBufferLength: Math.max(original.maxMaxBufferLength, 330) };
      const sync = controller.synchronizeToLiveEdge;
      const state = { hls, media, controller, original, applied, sync, wrapper: null };
      state.wrapper = function(...args) {
        if (active === state) {
          const buffered = media.buffered;
          for (let i = 0; i < buffered.length; i++) {
            if (media.currentTime >= buffered.start(i) && media.currentTime < buffered.end(i)) return;
          }
        }
        // Evicted data must still recover via the player's native live synchronization.
        return sync.apply(this, args);
      };
      active = state;
      try {
        Object.assign(hls.config, applied);
        controller.synchronizeToLiveEdge = state.wrapper;
        if (controller.synchronizeToLiveEdge !== state.wrapper) throw new Error("HLS 동기화 제어를 적용하지 못했습니다.");
      } catch (error) { restore(); throw error; }
    }
    function run(command, hls, media, time) {
      if (active && (active.hls !== hls || active.media !== media)) restore();
      if (command === "restore") restore();
      else if (command === "enable") enable(hls, media);
      else if (command === "seek" || command === "live") {
        const ranges = media?.buffered;
        if (!ranges?.length) throw new Error("아직 저장된 영상 버퍼가 없습니다.");
        const edge = ranges.end(ranges.length - 1);
        const position = bufferedPosition(ranges, command === "live" ? edge : time);
        if (position === null) throw new Error("탐색 위치가 올바르지 않습니다.");
        const live = command === "live" || position >= edge - 1;
        if (!live) enable(hls, media);
        try { media.currentTime = position; } catch (error) { restore(); throw error; }
        if (live) restore();
      }
      const ranges = media?.buffered;
      return { ok: true, active: Boolean(active), hlsFound: Boolean(hls),
        start: ranges?.length ? ranges.start(0) : null,
        end: ranges?.length ? ranges.end(ranges.length - 1) : null,
        currentTime: media?.currentTime ?? null };
    }
    return { run, restore };
  }
  function install(target) {
    const document = target.document;
    const control = createTimeShift();
    let activePath = target.location.pathname;
    let initialQualityPlayer = null, manualQuality = false;
    document.addEventListener('hanbi-quality-manual', () => { manualQuality = true; });
    const locate = () => {
      const layout = document.getElementById("live_player_layout");
      const media = mediaCandidates(layout) || document.querySelector(".webplayer-internal-video");
      const roots = [layout, media?.closest("pzp-player"), media?.parentElement];
      const hls = roots.map(findHls).find(Boolean) || null;
      const nativeTimeMachine = Boolean(roots.some(root => root?.__vue__?.timeMachine));
      return { media, hls, nativeTimeMachine };
    };
    document.addEventListener("hanbi-timeshift-command", (event) => {
      let request;
      try {
        request = JSON.parse(event.detail);
        if (!["enable", "seek", "live", "restore", "status"].includes(request.command)) return;
        if (target.location.pathname !== activePath) { control.restore(); activePath = target.location.pathname; initialQualityPlayer = null; manualQuality = false; }
        if (!/^\/live\//.test(activePath)) throw new Error("라이브 페이지에서만 사용할 수 있습니다.");
        const { hls, media, nativeTimeMachine } = locate();
        if (nativeTimeMachine && ["enable", "seek"].includes(request.command)) throw new Error("공식 타임머신을 이용 중입니다.");
        const result = control.run(request.command, hls, media, request.time);
        document.dispatchEvent(new target.CustomEvent("hanbi-timeshift-result", { detail: JSON.stringify({ ...result, nativeTimeMachine, id: request.id }) }));
      } catch (error) {
        document.dispatchEvent(new target.CustomEvent("hanbi-timeshift-result", { detail: JSON.stringify({ id: request?.id, ok: false, error: error.message }) }));
      }
    });
    // Restore even when navigation removes the panel before it can send a command.
    target.setInterval(() => {
      if (target.location.pathname !== activePath) { control.restore(); activePath = target.location.pathname; initialQualityPlayer = null; manualQuality = false; }
      if (!/^\/live\//.test(activePath)) return;
      const { hls, media, nativeTimeMachine } = locate();
      control.run("status", hls, media);
      if (!nativeTimeMachine && !manualQuality && hls && hls !== initialQualityPlayer && hls.levels?.length && media?.readyState >= 2) {
        const levels = hls.levels.map((level, index) => ({ height: Number(level.height) || 0, bitrate: Number(level.bitrate) || 0, index }));
        levels.sort((a,b) => Number(b.height === 1080) - Number(a.height === 1080) || b.height - a.height || b.bitrate - a.bitrate);
        try { hls.currentLevel = levels[0].index; initialQualityPlayer = hls; } catch (_) {}
      }
    }, 1000);
    target.addEventListener("pagehide", control.restore);
  }
  if (typeof window !== "undefined") install(window);
  if (typeof module !== "undefined") module.exports = { findHls, bufferedPosition, createTimeShift, mediaCandidates, install };
})();
