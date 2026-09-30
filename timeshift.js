(() => {
  "use strict";
  // Adapted from cheese-knife's buffered seek / setSeeking / patchHls (MIT; see NOTICE).
  const hlsOwners = new WeakMap();
  function findHls(root) {
    const from = (value) => {
      for (const player of [value?._corePlayer, value?.current?._corePlayer, value?.current, value]) {
        const owner = player?.player?._mediaController;
        const hls = owner?._hls;
        if (hls?.config && hls.streamController) { hlsOwners.set(hls, owner); return hls; }
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
    const pausedForwardSeconds = 3600;
    const forwardKeys = ["maxBufferLength", "maxMaxBufferLength"];
    function restore() {
      if (!active) return;
      const state = active;
      active = null;
      state.resumeCleanup?.();
      if (state.owner && state.owner._updateHlsConfig === state.profileWrapper) {
        if (state.profileDescriptor) Object.defineProperty(state.owner, "_updateHlsConfig", state.profileDescriptor);
        else delete state.owner._updateHlsConfig;
      }
      for (const [key, value] of Object.entries(state.original)) {
        if (state.hls.config?.[key] === (state.pausedValues[key] ?? state.applied[key])) state.hls.config[key] = value;
      }
      if (state.controller.synchronizeToLiveEdge === state.wrapper) state.controller.synchronizeToLiveEdge = state.sync;
    }
    function keepPausedBuffering(state) {
      if (active !== state) return;
      const { hls, media } = state;
      if (media.paused) {
        for (const key of forwardKeys) {
          if (key in state.pausedValues || hls.config[key] !== state.applied[key]) continue;
          const value = Math.max(hls.config[key], pausedForwardSeconds);
          if (value !== hls.config[key]) {
            hls.config[key] = value;
            state.pausedValues[key] = value;
          }
        }
        try {
          if (hls.bufferingEnabled === false) hls.resumeBuffering?.();
          if (hls.loadingEnabled === false) hls.startLoad?.(media.currentTime, true);
        } catch (error) { console.warn("[CHZZK All-in-One TM] 일시정지 버퍼 재개 실패", error); }
      } else {
        for (const [key, value] of Object.entries(state.pausedValues)) {
          if (hls.config[key] === value) hls.config[key] = state.applied[key];
          delete state.pausedValues[key];
        }
      }
    }
    function enable(hls, media) {
      if (active?.hls === hls && active.media === media) { keepPausedBuffering(active); return; }
      restore();
      const controller = hls?.streamController;
      if (!hls?.config || typeof controller?.synchronizeToLiveEdge !== "function" || !media) {
        throw new Error("플레이어의 HLS 버퍼 제어 연결을 찾지 못했습니다. 원본 재생을 유지합니다.");
      }
      if (hls.media && hls.media !== media) throw new Error("표시 중인 영상과 HLS 플레이어가 일치하지 않습니다.");
      const keys = ["backBufferLength", "maxBufferSize", "maxBufferLength", "maxMaxBufferLength"];
      const original = Object.fromEntries(keys.map((key) => [key, hls.config[key]]));
      if (keys.some((key) => typeof original[key] !== "number" || Number.isNaN(original[key]))) throw new Error("지원하지 않는 HLS 버퍼 설정입니다.");
      // hls.js leaves old media in the browser's buffer; Firefox may still evict it under memory pressure.
      const applied = { backBufferLength: Infinity, maxBufferSize: Math.max(original.maxBufferSize, 100_000_000), maxBufferLength: Math.max(original.maxBufferLength, 330), maxMaxBufferLength: Math.max(original.maxMaxBufferLength, 330) };
      const sync = controller.synchronizeToLiveEdge;
      const state = { hls, media, controller, original, applied, sync, wrapper: null, pausedValues: {} };
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
        // CHZZK reapplies its streaming profile on playback events (15s cap).
        // Preserve that profile for LIVE/close, but keep the active TM limits.
        // HLS's own memory-pressure reductions do not pass through this method.
        const owner = hlsOwners.get(hls);
        if (owner?._hls === hls && typeof owner._updateHlsConfig === "function") {
          state.owner = owner;
          state.profileDescriptor = Object.getOwnPropertyDescriptor(owner, "_updateHlsConfig");
          const update = owner._updateHlsConfig;
          state.profileWrapper = function(config, ...args) {
            if (active !== state || this._hls !== hls) return update.call(this, config, ...args);
            const held = Object.fromEntries(keys.map(key => [key, hls.config[key]]));
            try { return update.call(this, config, ...args); }
            finally {
              for (const key of keys) {
                if (Object.hasOwn(config || {}, key) && typeof config[key] === "number" && !Number.isNaN(config[key])) {
                  state.original[key] = config[key];
                  hls.config[key] = held[key];
                }
              }
            }
          };
          owner._updateHlsConfig = state.profileWrapper;
          if (owner._updateHlsConfig !== state.profileWrapper) throw new Error("플레이어 버퍼 설정 연결을 적용하지 못했습니다.");
        }
        Object.assign(hls.config, applied);
        controller.synchronizeToLiveEdge = state.wrapper;
        if (controller.synchronizeToLiveEdge !== state.wrapper) throw new Error("HLS 동기화 제어를 적용하지 못했습니다.");
        keepPausedBuffering(state);
      } catch (error) { restore(); throw error; }
    }
    function resume(hls, media) {
      const state = active;
      if (!state || state.hls !== hls || state.media !== media || !Object.keys(state.pausedValues).length) return;
      state.resumeCleanup?.();
      const position = media.currentTime;
      const buffered = () => {
        for (let i = 0; i < media.buffered.length; i++) {
          if (position >= media.buffered.start(i) && position < media.buffered.end(i)) return true;
        }
        return false;
      };
      if (!buffered()) return;
      const own = Object.getOwnPropertyDescriptor(media, "currentTime");
      let descriptor = own, prototype = media;
      while (!descriptor && (prototype = Object.getPrototypeOf(prototype))) descriptor = Object.getOwnPropertyDescriptor(prototype, "currentTime");
      if (!descriptor?.get || !descriptor?.set || own?.configurable === false) return;
      // The site's play listener seeks to seekable.end after every pause. Guard
      // only that one event dispatch; manual seeks and evicted-buffer recovery remain native.
      let blocked = false;
      const setter = function(value) {
        const ranges = state.owner?.seekable || media.seekable;
        if (!blocked && active === state && this === media && ranges?.length && buffered() &&
            value > position + 1 && Math.abs(value - ranges.end(ranges.length - 1)) < 0.25) {
          blocked = true;
          return;
        }
        descriptor.set.call(this, value);
      };
      let timer;
      const cleanup = () => {
        clearTimeout(timer);
        if (Object.getOwnPropertyDescriptor(media, "currentTime")?.set === setter) {
          if (own) Object.defineProperty(media, "currentTime", own);
          else delete media.currentTime;
        }
        state.resumeCleanup = null;
      };
      try {
        Object.defineProperty(media, "currentTime", { configurable: true, enumerable: descriptor.enumerable, get: descriptor.get, set: setter });
        state.resumeCleanup = cleanup;
        timer = setTimeout(cleanup, 0);
      } catch (error) { cleanup(); console.warn("[CHZZK All-in-One TM] 재개 위치 보호 연결 실패", error); }
    }
    function run(command, hls, media, time) {
      if (active && (active.hls !== hls || active.media !== media)) restore();
      if (command === "status" && active) keepPausedBuffering(active);
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
    return { run, restore, resume };
  }
  function createRawRecorder(onError = () => {}) {
    let session = null, lastError = "";
    const bytesOf = value => value instanceof ArrayBuffer ? new Uint8Array(value) : value instanceof Uint8Array ? value : null;
    const formatOf = bytes => {
      if (bytes[0] === 0x47 && bytes[188] === 0x47) return "ts";
      const box = String.fromCharCode(...bytes.subarray(4, 8));
      return ["moof", "styp"].includes(box) ? "mp4" : null;
    };
    function detach() {
      if (!session) return null;
      const old = session;
      session = null;
      old.hls.off("hlsFragLoaded", old.onFragment);
      return old;
    }
    function result(old) {
      if (!old?.format) return null;
      return { blob: new Blob(old.chunks, { type: old.format === "ts" ? "video/mp2t" : "video/mp4" }), ext: old.format };
    }
    function fail(message) {
      lastError = message;
      const partial = result(detach());
      try { onError(message, partial); } catch (error) { console.error("[CHZZK All-in-One RAW]", error); }
    }
    function start(hls, media) {
      if (session) throw new Error("RAW 녹화가 이미 진행 중입니다.");
      if (!hls?.on || !hls?.off || !media || (hls.media && hls.media !== media)) throw new Error("본방송 HLS 플레이어를 찾지 못했습니다. 기존 REC를 이용해 주세요.");
      lastError = "";
      const current = { hls, media, chunks: [], format: "", level: null, lastSn: null, onFragment: null };
      current.onFragment = (_, data) => {
        const frag = data?.frag;
        if (frag?.type === "audio") return fail("오디오가 별도 트랙인 방송은 RAW로 합칠 수 없습니다. 기존 REC를 이용해 주세요.");
        if (frag?.type !== "main" || !Number.isInteger(frag.sn)) return;
        if (data.part) return fail("저지연 HLS 부분 조각은 RAW 저장을 지원하지 않습니다. 기존 REC를 이용해 주세요.");
        if (frag.encrypted) return fail("암호화된 방송 조각은 RAW 저장을 지원하지 않습니다. 기존 REC를 이용해 주세요.");
        const bytes = bytesOf(data.payload);
        if (!bytes?.length) return;
        const format = formatOf(bytes);
        if (!format) return fail("방송 조각 형식을 확인할 수 없습니다. 기존 REC를 이용해 주세요.");
        if (current.format && current.format !== format) return fail("방송 조각 형식이 바뀌었습니다. 기존 REC를 이용해 주세요.");
        if (current.level !== null && current.level !== frag.level) return fail("녹화 중 화질이 바뀌어 RAW 파일 연결을 중단했습니다. 기존 REC를 이용해 주세요.");
        if (current.lastSn !== null && frag.sn !== current.lastSn + 1) return fail("방송 조각이 누락되거나 재생 위치가 바뀌었습니다. 기존 REC를 이용해 주세요.");
        if (!current.format && format === "mp4") {
          const init = bytesOf(frag.initSegment?.data);
          if (!init?.length || String.fromCharCode(...init.subarray(4, 8)) !== "ftyp") return fail("MP4 시작 조각을 찾지 못했습니다. 기존 REC를 이용해 주세요.");
          current.chunks.push(init.slice());
        }
        current.format = format;
        current.level = frag.level;
        current.lastSn = frag.sn;
        current.chunks.push(bytes.slice());
      };
      session = current;
      hls.on("hlsFragLoaded", current.onFragment);
    }
    function stop() {
      const old = detach();
      if (!old) throw new Error(lastError || "RAW 녹화가 진행 중이지 않습니다.");
      if (!old.format) throw new Error("받은 방송 조각이 없습니다. 잠시 재생한 뒤 다시 시도해 주세요.");
      return result(old);
    }
    return { start, stop, fail, active: () => Boolean(session), matches: (hls, media) => !session || session.hls === hls && session.media === media };
  }
  function install(target) {
    const document = target.document;
    const control = createTimeShift();
    let rawName = "chzzk_raw";
    const saveRaw = ({ blob, ext }) => {
      const url = target.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${rawName}.${ext}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      target.setTimeout(() => target.URL.revokeObjectURL(url), 60_000);
    };
    const raw = createRawRecorder((message, partial) => {
      let detail = message;
      if (partial) {
        try { saveRaw(partial); detail += " 받은 구간의 부분 파일 다운로드를 요청했습니다."; }
        catch (error) { console.error("[CHZZK All-in-One RAW]", error); detail += " 부분 파일 저장에도 실패했습니다."; }
      }
      document.dispatchEvent(new target.CustomEvent("hanbi-raw-error", { detail }));
    });
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
    const playedMedia = new WeakSet();
    document.addEventListener("play", (event) => {
      const { media, hls, nativeTimeMachine } = locate();
      if (/^\/live\//.test(target.location.pathname) && event.target === media && !nativeTimeMachine) control.resume(hls, media);
    }, true);
    document.addEventListener("playing", (event) => {
      if (event.target === locate().media) playedMedia.add(event.target);
    }, true);
    document.addEventListener("pause", (event) => {
      if (!/^\/live\//.test(target.location.pathname) || !playedMedia.has(event.target)) return;
      const { media, hls, nativeTimeMachine } = locate();
      if (media !== event.target || !hls || nativeTimeMachine) return;
      try { control.run("enable", hls, media); }
      catch (error) { console.warn("[CHZZK All-in-One TM] 일시정지 버퍼 연결 실패", error); }
    }, true);
    document.addEventListener("hanbi-raw-command", (event) => {
      let request;
      try {
        request = JSON.parse(event.detail);
        if (request.command === "start") {
          const { hls, media } = locate();
          raw.start(hls, media);
          rawName = String(request.name || "chzzk_raw").replace(/[\\/:*?"<>|]/g, "_");
          document.dispatchEvent(new target.CustomEvent("hanbi-raw-result", { detail: JSON.stringify({ id: request.id, ok: true, active: true }) }));
        } else if (request.command === "stop") {
          const { blob, ext } = raw.stop();
          saveRaw({ blob, ext });
          document.dispatchEvent(new target.CustomEvent("hanbi-raw-result", { detail: JSON.stringify({ id: request.id, ok: true, active: false, ext, bytes: blob.size }) }));
        }
      } catch (error) {
        document.dispatchEvent(new target.CustomEvent("hanbi-raw-result", { detail: JSON.stringify({ id: request?.id, ok: false, active: raw.active(), error: error.message }) }));
      }
    });
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
      if (target.location.pathname !== activePath) { control.restore(); if (raw.active()) raw.fail("방송을 이동해 RAW 녹화를 중단했습니다."); activePath = target.location.pathname; initialQualityPlayer = null; manualQuality = false; }
      if (!/^\/live\//.test(activePath)) return;
      const { hls, media, nativeTimeMachine } = locate();
      if (raw.active() && hls && media && !raw.matches(hls, media)) raw.fail("본방송 플레이어가 교체되어 RAW 녹화를 중단했습니다.");
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
  if (typeof module !== "undefined") module.exports = { findHls, bufferedPosition, createTimeShift, createRawRecorder, mediaCandidates, install };
})();
