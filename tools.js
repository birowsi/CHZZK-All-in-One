(() => {
  "use strict";

  function chooseRecorderMime(Recorder) {
    if (typeof Recorder?.isTypeSupported !== "function") return "";
    return [
      "video/webm;codecs=vp9,opus",
      "video/webm;codecs=vp8,opus",
      "video/webm",
    ].find((type) => Recorder.isTypeSupported(type)) || "";
  }

  function recordingVideoBitrate(source) {
    const pixels = source.videoWidth * source.videoHeight;
    const target = Number.isFinite(pixels) && pixels > 0 ? 12_000_000 * pixels / (1920 * 1080) : 12_000_000;
    return Math.round(Math.max(3_000_000, Math.min(16_000_000, target)));
  }

  const blindNoticePattern = /(?:클린봇이\s*부적절한\s*표현을\s*감지|(?:관리자|운영자).*?(?:블라인드|숨김|삭제|차단|가림)|(?:블라인드|숨김|삭제|차단|가림).*?(?:메시지|채팅))/i;
  const adBlockNoticePattern = /광고\s*차단\s*프로그램.*사용\s*중/i;
  const cheatKeyTimeMachinePattern = /치트키를\s*구매하면\s*타임머신\s*기능을\s*이용할\s*수\s*있어요/i;
  const isBlindNotice = (text) => blindNoticePattern.test(text || "");
  const isAdBlockNotice = (text) => adBlockNoticePattern.test(text || "");
  const isBlockedPromoNotice = (text) => isAdBlockNotice(text) || cheatKeyTimeMachinePattern.test(text || "");
  const modalBackdropSelector = "[class*='dimmed'], [class*='backdrop'], [class*='overlay']";
  const needsFirefoxAudioMonitor = (userAgent, audioTrackCount) => userAgent.includes("Firefox") && audioTrackCount > 0;
  const captureReusePlan = (sharedSource, source) => (!sharedSource || !source ? "create" : sharedSource === source ? "reuse" : "replace");
  const calculateTrendOffset = (barLeft, currentOffset, sidebarRight) => Math.max(0, Math.ceil(sidebarRight - (barLeft - currentOffset)));
  const clampSeekTime = (current, delta, start, end) => Math.max(start, Math.min(end, current + delta));
  function seekableTarget(ranges, time) {
    if (!ranges?.length || !Number.isFinite(time)) return null;
    let closest = null;
    for (let index = 0; index < ranges.length; index += 1) {
      const start = ranges.start(index);
      const end = Math.max(start, ranges.end(index) - 0.1);
      const candidate = Math.max(start, Math.min(end, time));
      if (closest === null || Math.abs(candidate - time) < Math.abs(closest - time)) closest = candidate;
    }
    return closest;
  }
  const isFollowingSectionLabel = (text) => /^(?:팔로잉|팔로우)(?:\s*(?:채널|방송))?$|^following(?:\s+(?:channels?|live))?$/i.test(String(text || "").replace(/\s+/g, " ").trim());
  const compressorDefaults = { threshold: -50, knee: 40, ratio: 12, attack: 0, release: 0.25 };

  function popupRemovalRoot(popup, body) {
    let node = popup;
    while (node?.parentElement && node.parentElement !== body) {
      const parent = node.parentElement;
      if (parent.matches?.("[class*='_dimmed_'], [data-modal-backdrop]")) return parent;
      if ([...parent.children].some((child) => child !== node && child.matches?.(modalBackdropSelector))) return parent;
      node = parent;
    }
    return popup;
  }

  function connectAudioGraph(graph, compressed) {
    if (!graph || graph.failed) return false;
    const mode = compressed ? "compressed" : "bypass";
    if (graph.mode === mode) return true;
    for (const node of [graph.source, graph.compressor, graph.gain]) {
      try { node?.disconnect?.(); } catch (_) {}
    }
    try {
      if (compressed) {
        graph.source.connect(graph.compressor);
        graph.compressor.connect(graph.gain);
        graph.gain.connect(graph.context.destination);
      } else {
        graph.source.connect(graph.context.destination);
      }
      graph.mode = mode;
      return true;
    } catch (_) {
      graph.mode = "";
      try {
        graph.source.disconnect();
        graph.source.connect(graph.context.destination);
        graph.mode = "bypass";
      } catch (_) {}
      return false;
    }
  }

  function selectTrendStreams(liveList, previous, threshold = 1000, count = 10) {
    const firstRun = previous.size === 0;
    const next = new Map();
    const candidates = [];
    for (const live of liveList) {
      const channelId = live.channel?.channelId || live.channelId;
      if (!channelId) continue;
      const viewers = Number(live.concurrentUserCount) || 0;
      next.set(channelId, viewers);
      if (viewers < threshold) continue;
      const oldViewers = previous.get(channelId) || 0;
      candidates.push({
        live, channelId, viewers,
        pumping: !firstRun && oldViewers > 0 && (viewers - oldViewers >= 500 || (viewers - oldViewers) / oldViewers >= 0.2),
      });
    }
    const fallback = liveList.slice(0, count).map((live) => ({
      live,
      channelId: live.channel?.channelId || live.channelId,
      viewers: Number(live.concurrentUserCount) || 0,
      pumping: false,
    })).filter((item) => item.channelId);
    return { items: (candidates.length ? candidates : fallback).slice(0, count), next };
  }

  const trendThumbnail = (live) => (live.liveImageUrl || live.thumbnailImageUrl || live.defaultThumbnailImageUrl || "").replaceAll("{type}", "720");
  const actualQualityHeight = (media) => media?.readyState >= 2 && !media.error && Number.isFinite(media.videoHeight) && media.videoHeight > 0 ? media.videoHeight : null;

  if (typeof module !== "undefined") module.exports = { chooseRecorderMime, recordingVideoBitrate, isBlindNotice, isAdBlockNotice, isBlockedPromoNotice, popupRemovalRoot, needsFirefoxAudioMonitor, captureReusePlan, calculateTrendOffset, clampSeekTime, seekableTarget, isFollowingSectionLabel, compressorDefaults, connectAudioGraph, selectTrendStreams, trendThumbnail, actualQualityHeight };
  if (typeof document === "undefined") return;
  if (globalThis.__HANBI_CHZZK_TOOLS__) return;
  globalThis.__HANBI_CHZZK_TOOLS__ = true;

  const api = globalThis.browser ?? globalThis.chrome;
  const defaults = {
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
  let features = { ...defaults };
  let trendOptions = { ...trendDefaults };
  let recording = null;
  let sharedCapture = null;
  let monitorGraph = null;
  let scheduled = false;
  let trendTimer = null;
  let followingTimer = null;
  let followingUpdateTimer = null;
  let sidebarRefreshTimer = null;
  let sidebarPreviewPlayer = null;
  let sidebarPreviewLink = null;
  let sidebarPreviewToken = 0;
  let sidebarPreviewHlsModule = null;
  let followingUpdating = false;
  let followingMutationPending = false;
  let trendUpdating = false;
  let trendLayoutScheduled = false;
  let trendSidebar = null;
  const trendSidebarObserver = typeof ResizeObserver === "function" ? new ResizeObserver(() => scheduleTrendLayout()) : null;
  let previousViewerMap = new Map();
  let previewUrl = null;
  const preparedVideos = new WeakSet();
  const originalMessages = new WeakMap();
  let dismissedPopups = new WeakSet();
  let timeMachineTimer = null;
  let timeShiftError = "";
  let timeShiftRequestId = 0;
  function timeShift(command, time) {
    const id = ++timeShiftRequestId;
    let response;
    const receive = (event) => {
      try { const value = JSON.parse(event.detail); if (value.id === id) response = value; } catch (_) {}
    };
    document.addEventListener("hanbi-timeshift-result", receive);
    try {
      document.dispatchEvent(new CustomEvent("hanbi-timeshift-command", { detail: JSON.stringify({ id, command, time }) }));
    } finally { document.removeEventListener("hanbi-timeshift-result", receive); }
    if (!response?.ok) {
      timeShiftError = response?.error || "타임머신 페이지 연결이 없습니다. 확장과 방송 탭을 새로고침해 주세요.";
      throw new Error(timeShiftError);
    }
    if (command !== "status") timeShiftError = "";
    return response;
  }
  let compressorData = null;
  let compressorContext = null;
  const compressorGraphs = new WeakMap();
  let compressorEnabled = localStorage.getItem("hanbi_comp_enabled") === "true";
  const savedGain = Number(localStorage.getItem("knifeGain") ?? 1);
  let compressorGain = Number.isFinite(savedGain) ? Math.max(0, Math.min(2, savedGain)) : 1;

  const isLive = () => /^\/live\/[^/]+/.test(location.pathname);

  function video() {
    return [...document.querySelectorAll("video")]
      .filter((item) => !item.closest("#hanbi-sidebar-hover-preview") && item.videoWidth && item.readyState >= 2 && item.getBoundingClientRect().width)
      .sort((a, b) => {
        const aRect = a.getBoundingClientRect();
        const bRect = b.getBoundingClientRect();
        return (bRect.width * bRect.height) - (aRect.width * aRect.height);
      })[0] || null;
  }

  function status(message, error = false) {
    let toast = document.getElementById("hanbi-tool-status");
    if (!toast) {
      toast = document.createElement("div");
      toast.id = "hanbi-tool-status";
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.toggle("is-error", error);
    clearTimeout(status.timer);
    status.timer = setTimeout(() => toast.remove(), 3500);
  }

  function button(label, text, onClick) {
    const element = document.createElement("button");
    element.type = "button";
    element.className = "pzp-button pzp-setting-button pzp-pc-setting-button pzp-pc__setting-button hanbi-tool-button";
    element.ariaLabel = label;
    element.title = label;
    element.textContent = text;
    element.addEventListener("click", (event) => {
      Promise.resolve().then(() => onClick(event)).catch((error) => {
        console.error("[CHZZK All-in-One]", error);
        status(error?.message || "기능 실행에 실패했습니다.", true);
      });
    });
    return element;
  }

  function fileName(extension) {
    const channel = document.querySelector("[class*='channel_name'], [class*='name_text']")?.textContent?.trim() || "chzzk";
    const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "");
    return `${channel}_${stamp}.${extension}`.replace(/[\\/:*?"<>|]/g, "_");
  }

  function download(url, name) {
    const link = document.createElement("a");
    link.href = url;
    link.download = name;
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  function canvasBlob(canvas) {
    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("이미지를 만들 수 없습니다.")), "image/png");
    });
  }

  function showPreview(blob) {
    let overlay = document.getElementById("hanbi-screenshot-preview");
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.id = "hanbi-screenshot-preview";
      overlay.innerHTML = '<div class="hanbi-preview-title"><strong>스크린샷 미리보기</strong><span>드래그해서 이동</span><div><button type="button" data-save>저장</button><button type="button" data-close aria-label="닫기">×</button></div></div><img alt="스크린샷 미리보기">';
      (document.fullscreenElement || document.body).appendChild(overlay);
      const handle = overlay.querySelector(".hanbi-preview-title");
      handle.addEventListener("pointerdown", (event) => {
        if (event.target.closest("button")) return;
        const rect = overlay.getBoundingClientRect();
        const offsetX = event.clientX - rect.left;
        const offsetY = event.clientY - rect.top;
        overlay.style.left = `${rect.left}px`;
        overlay.style.top = `${rect.top}px`;
        overlay.style.transform = "none";
        handle.setPointerCapture(event.pointerId);
        const move = (moveEvent) => {
          overlay.style.left = `${Math.max(8, Math.min(innerWidth - rect.width - 8, moveEvent.clientX - offsetX))}px`;
          overlay.style.top = `${Math.max(8, Math.min(innerHeight - 56, moveEvent.clientY - offsetY))}px`;
        };
        const end = () => {
          handle.removeEventListener("pointermove", move);
          handle.removeEventListener("pointerup", end);
          handle.removeEventListener("pointercancel", end);
        };
        handle.addEventListener("pointermove", move);
        handle.addEventListener("pointerup", end);
        handle.addEventListener("pointercancel", end);
      });
    }

    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = URL.createObjectURL(blob);
    const image = overlay.querySelector("img");
    image.src = previewUrl;
    overlay.dataset.fileName = fileName("png");
    overlay.querySelector("[data-save]").onclick = () => {
      download(previewUrl, overlay.dataset.fileName);
      overlay.remove();
    };
    overlay.querySelector("[data-close]").onclick = () => overlay.remove();
  }

  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("화면 캡처를 불러오지 못했습니다."));
      image.src = src;
    });
  }

  async function captureVisibleVideo(source) {
    const tools = document.getElementById("hanbi-player-tools");
    if (tools) tools.style.visibility = "hidden";
    await new Promise(requestAnimationFrame);
    await new Promise(requestAnimationFrame);
    let dataUrl;
    try {
      dataUrl = await api.runtime.sendMessage({ type: "capture-visible-tab" });
    } finally {
      if (tools) tools.style.visibility = "";
    }
    if (!dataUrl) throw new Error("Firefox 화면 캡처 권한이 없습니다.");

    const image = await loadImage(dataUrl);
    const rect = source.getBoundingClientRect();
    const left = Math.max(0, rect.left);
    const top = Math.max(0, rect.top);
    const right = Math.min(innerWidth, rect.right);
    const bottom = Math.min(innerHeight, rect.bottom);
    if (right <= left || bottom <= top) throw new Error("영상이 화면에 보이지 않습니다.");

    const scaleX = image.naturalWidth / innerWidth;
    const scaleY = image.naturalHeight / innerHeight;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round((right - left) * scaleX);
    canvas.height = Math.round((bottom - top) * scaleY);
    canvas.getContext("2d").drawImage(
      image,
      left * scaleX, top * scaleY, canvas.width, canvas.height,
      0, 0, canvas.width, canvas.height,
    );
    return canvasBlob(canvas);
  }

  async function screenshot() {
    const source = video();
    if (!source) throw new Error("재생 중인 영상을 찾지 못했습니다.");
    const canvas = document.createElement("canvas");
    canvas.width = source.videoWidth;
    canvas.height = source.videoHeight;
    try {
      canvas.getContext("2d").drawImage(source, 0, 0);
      showPreview(await canvasBlob(canvas));
    } catch (_) {
      showPreview(await captureVisibleVideo(source));
    }
  }

  // Firefox 기본 PiP 사용: 확장 버튼은 사용자 요청으로 비활성화.
  // async function togglePip() {
  //   const source = video();
  //   if (!source?.requestPictureInPicture) throw new Error("PIP를 지원하지 않는 영상입니다.");
  //   if (document.pictureInPictureElement) await document.exitPictureInPicture();
  //   else await source.requestPictureInPicture();
  // }

  function resetRecording(session) {
    session.removeSourceListeners?.();
    const audioCleanup = session.audioCleanup;
    session.audioCleanup = null;
    audioCleanup?.();
    if (!session.sharedCapture) session.stream.getTracks().forEach((track) => track.stop());
    clearInterval(session.timer);
    session.indicator?.remove();
    session.button.textContent = "REC";
    session.button.classList.remove("is-recording");
    if (recording === session) recording = null;
  }

  function monitorFirefoxAudio(source, stream) {
    const tracks = stream.getAudioTracks();
    if (!needsFirefoxAudioMonitor(navigator.userAgent, tracks.length)) return null;
    let context;
    try {
      context = new AudioContext();
      const input = context.createMediaStreamSource(new MediaStream(tracks));
      const volume = context.createGain();
      const compressor = context.createDynamicsCompressor();
      const gain = context.createGain();
      for (const [name, value] of Object.entries(compressorDefaults)) compressor[name].value = value;
      gain.gain.value = compressorGain;
      input.connect(volume);
      const syncVolume = () => { volume.gain.value = source.muted ? 0 : source.volume; };
      syncVolume();
      source.addEventListener("volumechange", syncVolume);
      monitorGraph = { source: volume, compressor, gain, context, mode: "" };
      syncMonitorCompressor();
      context.resume().catch(console.error);
      return () => {
        source.removeEventListener("volumechange", syncVolume);
        if (monitorGraph?.context === context) monitorGraph = null;
        for (const node of [input, volume, compressor, gain]) { try { node.disconnect(); } catch (_) {} }
        context.close().catch(console.error);
      };
    } catch (error) {
      if (monitorGraph?.context === context) monitorGraph = null;
      context?.close().catch(() => {});
      console.warn("[CHZZK All-in-One recorder] Firefox audio monitor unavailable", error);
      return null;
    }
  }

  function retireSharedCapture() {
    if (!sharedCapture) return;
    const stale = sharedCapture;
    sharedCapture = null;
    stale.audioCleanup?.();
    stale.stream.getTracks().forEach(track => track.stop());
  }

  function acquireCapture(source) {
    const capture = source.mozCaptureStream || source.captureStream;
    if (typeof capture !== "function") throw new Error("이 영상은 녹화를 지원하지 않습니다.");
    const plan = captureReusePlan(sharedCapture?.source, source);
    if (plan === "replace") retireSharedCapture();
    if (plan === "reuse") return { stream: sharedCapture.stream, shared: true };
    const stream = capture.call(source);
    if (!stream.getVideoTracks().length) {
      stream.getTracks().forEach(track => track.stop());
      throw new Error("영상 트랙을 가져오지 못했습니다.");
    }
    const audioCleanup = monitorFirefoxAudio(source, stream);
    if (audioCleanup) sharedCapture = { source, stream, audioCleanup };
    return { stream, shared: Boolean(audioCleanup) };
  }

  async function finishRecording(session) {
    if (session.failed) { resetRecording(session); return; }
    if (!session.chunks.length) {
      resetRecording(session);
      status("녹화 데이터가 없습니다.", true);
      return;
    }
    const type = session.recorder.mimeType || "video/webm";
    const blob = new Blob(session.chunks, { type });
    resetRecording(session);
    status("녹화 결과 창을 여는 중…");
    const name = fileName("webm").replace(/\.webm$/, "");
    try {
      await api.runtime.sendMessage({
        type: "recording-complete",
        recording: { blob, fileName: name, mimeType: type, startedAt: session.startedAt, stoppedAt: Date.now() },
      });
      status("녹화 결과 창을 열었습니다.");
    } catch (error) {
      const url = URL.createObjectURL(blob);
      download(url, `${name}.webm`);
      setTimeout(() => URL.revokeObjectURL(url), 30_000);
      status("결과 창을 열지 못해 원본을 대신 저장했습니다.", true);
      console.error("[CHZZK All-in-One recorder]", error);
    }
  }

  function showRecordingIndicator(session) {
    const indicator = document.createElement("div");
    indicator.id = "hanbi-recording-indicator";
    document.body.appendChild(indicator);
    session.indicator = indicator;
    const update = () => {
      const seconds = Math.floor((Date.now() - session.startedAt) / 1000);
      indicator.textContent = `● REC ${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
    };
    update();
    session.timer = setInterval(update, 1000);
  }

  function toggleRecording(buttonElement) {
    if (recording) {
      if (recording.recorder.state !== "inactive") {
        recording.button.textContent = "SAVE";
        recording.recorder.stop();
      }
      return;
    }
    if (typeof MediaRecorder === "undefined") throw new Error("이 Firefox는 녹화를 지원하지 않습니다.");

    const source = video();
    if (!source) throw new Error("재생 중인 영상을 찾지 못했습니다.");
    const { stream, shared } = acquireCapture(source);

    const mimeType = chooseRecorderMime(MediaRecorder);
    let recorder;
    try {
      recorder = new MediaRecorder(stream, {
        ...(mimeType ? { mimeType } : {}),
        videoBitsPerSecond: recordingVideoBitrate(source),
        audioBitsPerSecond: 192_000,
      });
    }
    catch (error) { if (!shared) stream.getTracks().forEach(track => track.stop()); throw error; }
    const session = {
      recorder, stream, source, channelPath: location.pathname, button: buttonElement, chunks: [], startedAt: Date.now(),
      sharedCapture: shared, audioCleanup: null,
    };
    recording = session;
    recorder.addEventListener("dataavailable", (event) => event.data.size && session.chunks.push(event.data));
    recorder.addEventListener("stop", () => finishRecording(session).catch((error) => {
      resetRecording(session);
      status(error?.message || "녹화 결과 창을 열지 못했습니다.", true);
    }), { once: true });
    recorder.addEventListener("error", (event) => {
      resetRecording(session);
      status(event.error?.message || "녹화에 실패했습니다.", true);
    }, { once: true });
    try { recorder.start(1000); }
    catch (error) { session.failed = true; resetRecording(session); throw error; }
    const stop = () => { if (recorder.state !== 'inactive') recorder.stop(); };
    source.addEventListener('emptied', stop);
    source.addEventListener('ended', stop);
    session.removeSourceListeners = () => {
      source.removeEventListener('emptied', stop);
      source.removeEventListener('ended', stop);
    };
    showRecordingIndicator(session);
    buttonElement.textContent = "STOP";
    buttonElement.classList.add("is-recording");
    status(stream.getAudioTracks().length ? "녹화를 시작했습니다." : "오디오 없이 녹화를 시작했습니다.");
  }

  // Derived from cheese-knife's MIT-licensed MediaElementSource → DynamicsCompressor → Gain graph.
  function closeCompressor() {
    if (!compressorData) return;
    connectAudioGraph(compressorData, false);
    compressorData = null;
  }

  function getCompressor(v) {
    if (compressorData?.video === v) return compressorData;
    closeCompressor();
    if (compressorGraphs.has(v)) {
      compressorData = compressorGraphs.get(v);
      return compressorData;
    }
    const Context = window.AudioContext || window.webkitAudioContext;
    if (!Context) return null;
    let ctx;
    try {
      ctx = compressorContext || (compressorContext = new Context());
      const compressor = ctx.createDynamicsCompressor();
      const gain = ctx.createGain();
      compressorData = {
        video: v,
        context: ctx,
        ctx,
        source: ctx.createMediaElementSource(v),
        compressor,
        gain,
        mode: "",
      };
      compressorGraphs.set(v, compressorData);
      for (const [name, value] of Object.entries(compressorDefaults)) compressorData.compressor[name].value = value;
      return compressorData;
    } catch (error) {
      if (compressorData?.video === v) connectAudioGraph(compressorData, false);
      compressorData = null;
      console.warn("[CHZZK All-in-One] Compressor Error", error);
      return null;
    }
  }

  function applyCompressorState(v) {
    if (!v) return;
    syncMonitorCompressor();
    if (compressorData?.video !== v) closeCompressor();
    if (!v || (!compressorEnabled && !compressorData)) return;
    const data = getCompressor(v);
    if (!data) return;
    data.gain.gain.value = compressorGain;
    connectAudioGraph(data, compressorEnabled);
    if (data.ctx.state === "suspended") data.ctx.resume().catch(() => {});
  }

  function syncMonitorCompressor() {
    if (!monitorGraph) return;
    monitorGraph.gain.gain.value = compressorGain;
    connectAudioGraph(monitorGraph, compressorEnabled);
    if (monitorGraph.context.state === "suspended") monitorGraph.context.resume().catch(() => {});
  }

  function resumeCompressor() {
    if (compressorData?.ctx.state === "suspended") compressorData.ctx.resume().catch(() => {});
    if (monitorGraph?.context.state === "suspended") monitorGraph.context.resume().catch(() => {});
  }

  function ensureCompressorControl() {
    const volumeControl = document.querySelector(".pzp-pc__volume-control, .pzp-pc-volume-control");
    let root = document.getElementById("hanbi-audio-compressor");
    if (!volumeControl) {
      root?.remove();
      return;
    }
    if (!root) {
      root = document.createElement("span");
      root.id = "hanbi-audio-compressor";
      root.className = "pzp-pc__volume-control knife-comp";

      const compBtn = button("오디오 컴프레서", "COMP OFF", () => {
        compressorEnabled = !compressorEnabled;
        localStorage.setItem("hanbi_comp_enabled", compressorEnabled);
        applyCompressorState(video());
        syncCompressorControl(root);
      });
      compBtn.dataset.compressorToggle = "1";

      const compSlider = document.createElement("input");
      compSlider.type = "range";
      compSlider.min = "0";
      compSlider.max = "2";
      compSlider.step = "0.01";
      compSlider.ariaLabel = "컴프레서 보정 게인";
      compSlider.addEventListener("input", (event) => {
        compressorGain = Number(event.target.value);
        localStorage.setItem("knifeGain", compressorGain);
        applyCompressorState(video());
        syncCompressorControl(root);
      });
      root.append(compBtn, compSlider);
    }
    if (root.previousElementSibling !== volumeControl) volumeControl.insertAdjacentElement("afterend", root);
    syncCompressorControl(root);
  }

  function syncCompressorControl(root) {
    const buttonElement = root.querySelector("[data-compressor-toggle]");
    const slider = root.querySelector("input[type='range']");
    const active = compressorEnabled && compressorData?.mode === 'compressed' && compressorData.ctx.state === 'running';
    const label = !compressorEnabled ? 'COMP OFF' : active ? 'COMP ON' : 'COMP 대기/원음';
    if (buttonElement.textContent !== label) buttonElement.textContent = label;
    buttonElement.classList.toggle("is-recording", active);
    buttonElement.setAttribute("aria-pressed", String(active));
    slider.value = compressorGain;
    slider.hidden = !compressorEnabled;
    slider.title = `컴프레서 보정 게인 ${Math.round(compressorGain * 100)}%`;
    slider.setAttribute("aria-valuetext", `${Math.round(compressorGain * 100)}%`);
  }

  function ensureTools() {
    const target = document.querySelector(".pzp-pc__bottom-buttons-right");
    const existing = document.getElementById("hanbi-player-tools");
    // const hasPip = Boolean(video()?.requestPictureInPicture);
    const signature = `${features.recorder}:${features.screenshot}:${isLive()}`;
    if (!target) return;
    if (existing?.parentElement === target && existing.dataset.signature === signature) return;
    existing?.remove();

    const root = document.createElement("span");
    root.id = "hanbi-player-tools";
    root.dataset.signature = signature;

    if (features.recorder || recording) {
      const recordButton = button("녹화 시작/중지", "REC", () => toggleRecording(recordButton));
      if (recording) { recording.button = recordButton; recordButton.textContent = 'STOP'; recordButton.classList.add('is-recording'); }
      root.appendChild(recordButton);
    }
    if (features.screenshot) root.appendChild(button("스크린샷", "SHOT", screenshot));
    // if (hasPip) root.appendChild(button("Picture in Picture", "PIP", togglePip));
    if (isLive()) {
      const qualityButton = button("실제 영상 출력 화질", "Q --", () => {
        const source = video();
        const actual = source?.closest('#preAdPlayerWrapper, #midAdPlayerWrapper') ? null : actualQualityHeight(source);
        const selected = selectedQualityRow(source)?.querySelector('.pzp-ui-setting-quality-item__prefix')?.textContent?.trim();
        status(`실제 출력: ${actual ? `${actual}p` : '확인 중'}${selected ? ` · 사이트 선택: ${selected}` : ''}`);
      });
      qualityButton.id = "hanbi-quality-button";
      root.appendChild(qualityButton);
    }
    if (isLive()) root.appendChild(button("타임머신 · 영상이 제공하는 범위 탐색", "TM", showTimeMachine));
    target.prepend(root);
  }

  function selectedQualityRow(source) {
    const pane = source?.closest('.pzp')?.querySelector('.pzp-setting-quality-pane');
    return pane?.querySelector('li.pzp-ui-setting-quality-item.pzp-ui-setting-pane-item--checked, li.pzp-ui-setting-quality-item[aria-checked="true"]') || null;
  }

  function syncQualityDisplay() {
    const source = video();
    const actual = source?.closest('#preAdPlayerWrapper, #midAdPlayerWrapper') ? null : actualQualityHeight(source);
    const button = document.getElementById('hanbi-quality-button');
    if (button) {
      const label = actual ? `Q ${actual}p` : 'Q --';
      if (button.textContent !== label) button.textContent = label;
      button.title = actual ? `실제 디코딩된 영상: ${source.videoWidth}×${actual}` : '실제 영상 화질 확인 중';
    }
    const selected = actual ? selectedQualityRow(source) : null;
    const siteHeight = Number(selected?.querySelector('.pzp-ui-setting-quality-item__prefix')?.textContent?.match(/(\d{3,4})p/i)?.[1]);
    const mismatch = selected && siteHeight && siteHeight !== actual;
    for (const label of document.querySelectorAll('.hanbi-quality-actual')) {
      if (!mismatch || label.parentElement !== selected) label.remove();
    }
    if (mismatch && !selected.querySelector('.hanbi-quality-actual')) {
      const label = document.createElement('span');
      label.className = 'hanbi-quality-actual';
      label.textContent = `실제 출력 ${actual}p`;
      label.title = '사이트 선택 화질과 실제 디코딩된 영상 해상도가 다릅니다.';
      selected.appendChild(label);
    }
  }

  function prepareVideo() {
    const source = video();
    if (recording && (recording.source !== source || recording.channelPath !== location.pathname)) {
      if (recording.recorder.state !== 'inactive') recording.recorder.stop();
    }
    if (!source) return;
    if (!preparedVideos.has(source)) {
      preparedVideos.add(source);
      if (features.autoUnmute && isLive()) source.muted = false;
      source.addEventListener("loadeddata", () => {
        if (features.autoUnmute && isLive()) source.muted = false;
      }, { once: true });
    }
    applyCompressorState(source);
    const control = document.getElementById('hanbi-audio-compressor');
    if (control) syncCompressorControl(control);
  }

  function removeAdPopup() {
    if (!features.hideAdPopup) {
      for (const root of document.querySelectorAll("[data-hanbi-hidden-promo]")) {
        root.removeAttribute("data-hanbi-hidden-promo");
        root.inert = false;
      }
      document.body.classList.remove("hanbi-promo-only");
      dismissedPopups = new WeakSet();
      return;
    }
    for (const popup of document.querySelectorAll("div[class^='popup_container'], [role='dialog'], [role='alertdialog'], [class*='_modal_'][class*='_container_']")) {
      if (!isBlockedPromoNotice(popup.textContent)) continue;
      const root = popupRemovalRoot(popup, document.body);
      const close = root.querySelector("button[aria-label*='닫'], button[aria-label*='close' i], button[class*='close']")
        || [...root.querySelectorAll("button")].find((button) => /닫기|close/i.test(button.textContent));
      if (dismissedPopups.has(popup)) continue;
      dismissedPopups.add(popup);
      // Keep React's tree intact. Its close handler also restores scroll/focus.
      if (close) close.click();
      else if (root !== popup) {
        root.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
        root.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
        root.click();
      }
      if (root.isConnected) {
        root.setAttribute("data-hanbi-hidden-promo", "");
        root.inert = true;
      }
      if (cheatKeyTimeMachinePattern.test(popup.textContent)) showTimeMachine();
    }
    const hiddenPromo = document.querySelector("[data-hanbi-hidden-promo]");
    const otherModal = [...document.querySelectorAll("[aria-modal='true']")].some((node) => !node.closest("[data-hanbi-hidden-promo]"));
    document.body.classList.toggle("hanbi-promo-only", Boolean(hiddenPromo && !otherModal));
  }

  function showTimeMachine() {
    if (!isLive() || document.getElementById("hanbi-time-machine")) return;
    const channelPath = location.pathname;
    const panel = document.createElement("section");
    panel.id = "hanbi-time-machine";
    panel.ariaLabel = "타임머신 탐색";
    panel.innerHTML = '<header><strong>타임머신</strong><button type="button" data-close aria-label="타임머신 닫기">×</button></header><p role="status"></p><button type="button" data-enable>연결 재시도</button><input type="range" aria-label="영상 탐색 위치" step="0.1"><footer><button type="button" data-seek="-30">−30초</button><button type="button" data-seek="30">+30초</button><button type="button" data-live>LIVE</button></footer>';
    (document.fullscreenElement || document.body).appendChild(panel);
    const diagnostics = document.createElement("details");
    diagnostics.innerHTML = '<summary>재생 진단 정보</summary><textarea readonly aria-label="복사할 재생 진단 정보"></textarea>';
    diagnostics.addEventListener("toggle", () => {
      if (!diagnostics.open) return;
      diagnostics.querySelector("textarea").value = JSON.stringify({
        version: api.runtime.getManifest().version,
        page: location.pathname,
        compressor: compressorData?.mode || "off",
        audioContext: compressorContext?.state || "none",
        timeShiftError,
        videos: [...document.querySelectorAll("video")].map((media) => ({
          readyState: media.readyState, networkState: media.networkState, paused: media.paused,
          currentTime: media.currentTime, errorCode: media.error?.code || null,
          width: media.videoWidth, height: media.videoHeight,
          seekable: Array.from({ length: media.seekable.length }, (_, index) => [media.seekable.start(index), media.seekable.end(index)]),
          buffered: Array.from({ length: media.buffered.length }, (_, index) => [media.buffered.start(index), media.buffered.end(index)]),
        })),
      }, null, 2);
    });
    panel.appendChild(diagnostics);
    const slider = panel.querySelector("input");
    const label = panel.querySelector("p");
    const close = () => {
      try { timeShift("restore"); } catch (_) {}
      clearInterval(timeMachineTimer); timeMachineTimer = null; panel.remove();
    };
    panel.querySelector("[data-close]").onclick = close;
    panel.addEventListener("keydown", (event) => { if (event.key === "Escape") { event.stopPropagation(); close(); } });
    const seek = (position) => {
      try { timeShift("seek", position); }
      catch (error) { status(`탐색 실패: ${error.message}`, true); }
    };
    slider.addEventListener("input", () => seek(Number(slider.value)));
    panel.querySelectorAll("[data-seek]").forEach((control) => {
      control.onclick = () => { const source = video(); if (source) seek(source.currentTime + Number(control.dataset.seek)); };
    });
    panel.querySelector("[data-live]").onclick = () => {
      try { timeShift("live"); } catch (error) { status(error.message, true); }
    };
    const enable = () => { try { timeShift("enable"); } catch (_) {} };
    panel.querySelector("[data-enable]").onclick = enable;
    enable();
    const update = () => {
      if (location.pathname !== channelPath || !panel.isConnected) { close(); return; }
      const source = video();
      let state;
      try { state = timeShift("status"); } catch (_) {}
      const ranges = source?.buffered;
      const available = Boolean(ranges?.length && ranges.end(ranges.length - 1) - ranges.start(0) > 1);
      slider.disabled = !available || !state?.hlsFound;
      panel.querySelectorAll("footer button").forEach((control) => { control.disabled = !available; });
      let message = "아직 저장된 영상 버퍼가 없습니다. 재생 후 다시 확인해 주세요.";
      if (available) {
        const start = ranges.start(0), end = ranges.end(ranges.length - 1);
        slider.min = start;
        slider.max = Math.max(start, end - 0.1);
        if (document.activeElement !== slider) slider.value = source.currentTime;
        message = `${state?.active ? "버퍼 유지 ON" : "라이브 모드"} · 저장 ${Math.floor(end - start)}초 · LIVE −${Math.max(0, Math.floor(end - source.currentTime))}초`;
      }
      if (!state?.hlsFound) message = "HLS 플레이어 연결을 찾지 못했습니다. 연결 재시도를 누르거나 진단 정보를 확인해 주세요.";
      if (timeShiftError) message = timeShiftError;
      if (label.textContent !== message) label.textContent = message;
    };
    update();
    timeMachineTimer = setInterval(update, 500);
    panel.querySelector("[data-close]").focus();
  }

  async function fetchFollowingEntries() {
    const entries = new Map();
    const signal = AbortSignal.timeout(8_000);
    // The site's sidebar uses size=505. Page further instead of treating a truncated list as offline.
    for (let page = 0; page < 20; page += 1) {
      const response = await fetch(`https://api.chzzk.naver.com/service/v1/channels/followings?page=${page}&size=505&sortType=FOLLOW`, { credentials: "include", signal, cache: "no-store" });
      if (!response.ok) throw new Error(`팔로잉 HTTP ${response.status}`);
      const payload = await response.json();
      const list = HanbiFollowingLogic.normalizeFollowingPayload(payload);
      if (!list) throw new Error("팔로잉 응답 형식 오류");
      const before = entries.size;
      for (const entry of list) entries.set(entry.channelId, entry);
      if (payload.content.followingList.length < 505) {
        return [...entries.values()];
      }
      if (entries.size === before) break;
    }
    throw new Error("팔로잉 전체 목록을 확인하지 못했습니다.");
  }

  function showFollowingAlert(entry) {
    if (!features.followingAlerts) return false;
    let stack = document.getElementById("hanbi-following-alerts");
    if (!stack) {
      stack = document.createElement("section");
      stack.id = "hanbi-following-alerts";
      stack.ariaLabel = "팔로잉 채널 방송 시작 알림";
      document.body.appendChild(stack);
    }
    const key = `${entry.channelId}:${entry.liveKey}`;
    if ([...stack.children].some((card) => card.dataset.key === key)) return false;
    while (stack.children.length >= 3) stack.firstElementChild.remove();

    const card = document.createElement("article");
    card.className = "hanbi-following-alert";
    card.dataset.key = key;
    const image = document.createElement("img");
    image.src = (entry.liveImageUrl || entry.channelImageUrl || api.runtime.getURL("icons/icon-96.png")).replaceAll("{type}", "480");
    image.alt = "";
    const body = document.createElement("div");
    const badge = document.createElement("b");
    badge.textContent = "LIVE";
    const channel = document.createElement("strong");
    channel.textContent = entry.channelName;
    const title = document.createElement("span");
    title.textContent = entry.liveTitle;
    body.append(badge, channel, title);
    const watch = document.createElement("a");
    watch.href = `/live/${encodeURIComponent(entry.channelId)}`;
    watch.textContent = "방송 보기";
    const close = document.createElement("button");
    close.type = "button";
    close.ariaLabel = "알림 닫기";
    close.textContent = "×";
    close.addEventListener("click", () => card.remove());
    card.append(image, body, watch, close);
    stack.appendChild(card);
    setTimeout(() => card.remove(), 15_000);
    return true;
  }

  async function updateFollowingAlerts() {
    if (!features.followingAlerts || followingUpdating || document.visibilityState !== "visible") return;
    const account = localStorage.getItem("userStatus.idhash");
    if (!account) return;
    followingUpdating = true;
    let pollId;
    try {
      const lease = await api.runtime.sendMessage({ type: "following-poll" });
      if (!lease?.pollId) return;
      pollId = lease.pollId;
      const entries = await fetchFollowingEntries();
      if (!features.followingAlerts || account !== localStorage.getItem("userStatus.idhash")) return;
      const result = await api.runtime.sendMessage({ type: "following-snapshot", entries, account, pollId });
      for (const entry of result?.alerts || []) showFollowingAlert(entry);
    } catch (error) {
      console.warn("[CHZZK All-in-One following]", error.message);
    } finally {
      if (pollId) await api.runtime.sendMessage({ type: "following-poll-end", pollId }).catch(() => {});
      followingUpdating = false;
    }
  }

  function followingSections() {
    const sections = new Set();
    for (const section of document.querySelectorAll("[class*='following'], [data-testid*='following' i], [aria-label*='팔로잉'], [aria-label*='팔로우']")) {
      if (!section.matches("a, button") && section.querySelector("a[href*='/live/']")) sections.add(section);
    }
    for (const label of document.querySelectorAll("h1, h2, h3, h4, strong, [role='heading'], [class*='title'], [class*='header']")) {
      if (!isFollowingSectionLabel(label.textContent) || label.closest("a, button")) continue;
      let section = null;
      let parent = label.parentElement;
      for (let depth = 0; parent && depth < 5; depth += 1, parent = parent.parentElement) {
        if (parent.querySelector("a[href*='/live/']")) {
          section = parent;
          break;
        }
      }
      sections.add(section || label.parentElement);
    }
    const roots = [...sections].filter(Boolean);
    return roots.filter((root) => !roots.some((other) => other !== root && root.contains(other)));
  }

  function scheduleFollowingUpdate() {
    if (!features.followingAlerts || followingUpdateTimer) return;
    followingUpdateTimer = setTimeout(() => {
      followingUpdateTimer = null;
      updateFollowingAlerts();
    }, 250);
  }

  function resetFollowingTimer() {
    clearInterval(followingTimer);
    followingTimer = features.followingAlerts ? setInterval(updateFollowingAlerts, 5_000) : null;
    if (features.followingAlerts) updateFollowingAlerts();
    else {
      document.getElementById("hanbi-following-alerts")?.remove();
    }
  }

  function rememberAndRestoreBlindMessages() {
    const roots = document.querySelectorAll("[role='log'], [class*='live_chatting'], [class*='chatting'][class*='list']");
    const items = new Set([...roots].flatMap((root) => [...root.querySelectorAll(
      "[data-chat-id], [data-message-id], [role='listitem'], [class*='list_item'], [class*='chat'][class*='item']",
    )]));
    for (const item of items) {
      const text = item.querySelector("[data-message-text], [data-chat-text], [data-content], [class*='message_text'], [class*='message'], [class*='content'], [class*='text']") ?? item;
      const reveal = item.querySelector(".hanbi-restored-message");
      if (!features.blindRestore) {
        text.removeAttribute("data-hanbi-blind-masked");
        reveal?.remove();
        continue;
      }

      const current = (text.innerText || text.textContent || "").trim();
      const identity = item.getAttribute("data-chat-id") || item.getAttribute("data-message-id") || "";
      if (!isBlindNotice(current)) {
        text.removeAttribute("data-hanbi-blind-masked");
        reveal?.remove();
        if (current) originalMessages.set(item, { identity, source: text, text: current });
        continue;
      }

      const hidden = [...item.querySelectorAll("[class*='message'], [class*='content'], [class*='text'], [data-message], [data-content]")]
        .find((candidate) => candidate !== text && getComputedStyle(candidate).display === "none" && !isBlindNotice(candidate.textContent));
      const cached = originalMessages.get(item);
      const original = hidden?.textContent?.trim() || (
        identity && cached?.source === text && cached.identity === identity ? cached.text : ""
      );
      if (!original) continue;

      text.setAttribute("data-hanbi-blind-masked", "1");
      const replacement = reveal || document.createElement("span");
      replacement.className = "hanbi-restored-message";
      replacement.title = "확인 가능한 블라인드 원문";
      if (replacement.textContent !== original) replacement.textContent = original;
      if (!replacement.isConnected) text.after(replacement);
    }
  }

  function handleArrowSeek(event) {
    if (!features.arrowSeek || !["ArrowLeft", "ArrowRight"].includes(event.key) || event.ctrlKey || event.altKey || event.metaKey) return;
    if (event.target.closest?.("input, textarea, select, [contenteditable='true'], [role='textbox']")) return;
    const source = video();
    if (!source) return;
    if (isLive()) {
      try {
        const state = timeShift('status');
        if (!state.hlsFound || state.nativeTimeMachine) return;
        timeShift("seek", source.currentTime + (event.key === "ArrowLeft" ? -5 : 5));
        event.preventDefault(); event.stopImmediatePropagation();
      }
      catch (error) { status(error.message, true); }
      return;
    }
    const ranges = source.seekable;
    const target = seekableTarget(ranges, source.currentTime + (event.key === "ArrowLeft" ? -5 : 5));
    if (target === null) return;
    source.currentTime = target;
    event.preventDefault();
    event.stopImmediatePropagation();
  }

  function applyChatFeatures() {
    let style = document.getElementById("hanbi-chat-improvements");
    if (!style) {
      style = document.createElement("style");
      style.id = "hanbi-chat-improvements";
      document.head.appendChild(style);
    }
    const css = [
      features.hideDonation ? "[class*='live_chatting_list_donation_'], [class*='donation'][class*='chat'] { display: none !important; }" : "",
      features.chatFontSizeEnabled ? `[class*='live_chatting_message_text'], [data-message-text] { font-size: ${trendOptions.chatFontSize}px !important; }` : "",
    ].filter(Boolean).join("\n");
    if (style.textContent !== css) style.textContent = css;
  }

  function findFollowingRefreshButton() {
    for (const section of followingSections()) {
      const button = [...section.querySelectorAll("button[aria-label], [role='button'][aria-label]")]
        .find((item) => /새로고침|refresh/i.test(item.getAttribute("aria-label") || "") && !item.disabled);
      if (button) return button;
    }
    return null;
  }

  function resetSidebarRefreshTimer() {
    clearInterval(sidebarRefreshTimer);
    sidebarRefreshTimer = features.sidebarRefresh ? setInterval(() => {
      if (document.visibilityState === "visible" && navigator.onLine !== false) findFollowingRefreshButton()?.click();
    }, 30_000) : null;
  }

  function sidebarLiveLink(target) {
    const link = target.closest?.("a[href*='/live/']");
    if (!features.hoverPreview || !link || link.closest("#hanbi-trends")) return null;
    return followingSections().some((section) => section.contains(link)) ? link : null;
  }

  function stopSidebarPreview() {
    sidebarPreviewToken++;
    sidebarPreviewLink = null;
    sidebarPreviewPlayer?.destroy();
    sidebarPreviewPlayer = null;
    const media = document.getElementById("hanbi-sidebar-hover-preview")?.querySelector("video");
    if (media) {
      media.pause();
      media.removeAttribute("src");
      media.load();
    }
  }

  function sidebarPreviewHlsPath(content) {
    for (const value of [content?.livePlaybackJson, content?.previewPlaybackJson, content?.playbackJson, content?.livePlayback]) {
      try {
        const playback = typeof value === "string" ? JSON.parse(value) : value;
        const media = playback?.media;
        if (!Array.isArray(media)) continue;
        const source = media.find((item) => item?.mediaId === "HLS" && item.protocol === "HLS")
          || media.find((item) => item?.protocol === "HLS");
        const url = new URL(source?.path);
        if (url.protocol === "https:" && /\.m3u8$/i.test(url.pathname)
          && /(^|\.)(?:pstatic\.net|navercdn\.com|akamaized\.net)$/i.test(url.hostname)) return url.href;
      } catch (_) {}
    }
    return "";
  }

  function loadSidebarPreviewHls() {
    sidebarPreviewHlsModule ||= import(api.runtime.getURL("vendor/hls.light.min.mjs"))
      .catch((error) => { sidebarPreviewHlsModule = null; throw error; });
    return sidebarPreviewHlsModule;
  }

  async function startSidebarPreviewVideo(live, preview, token) {
    const active = () => token === sidebarPreviewToken && !preview.hidden && features.hoverPreview;
    const media = preview.querySelector("video");
    const title = preview.querySelector("strong");
    const fallback = () => {
      if (!active()) return;
      preview.classList.remove("is-playing");
      title.textContent = `${live.liveTitle || title.textContent} · 영상 미리보기 불가`;
      stopSidebarPreview();
    };
    try {
      let path = sidebarPreviewHlsPath(live);
      if (!path && /^\d+$/.test(String(live.liveId || ""))) {
        const response = await fetch(`https://api.chzzk.naver.com/service/v1/live/${live.liveId}/auto-play-info`, {
          credentials: "include", signal: AbortSignal.timeout(8_000),
        });
        if (response.ok) {
          const payload = await response.json();
          if (payload?.code === 200) path = sidebarPreviewHlsPath(payload.content);
        }
      }
      if (!active()) return;
      if (!path) { fallback(); return; }
      const { default: Hls } = await loadSidebarPreviewHls();
      if (!active()) return;
      media.muted = true;
      media.playsInline = true;
      media.onplaying = () => {
        if (active()) {
          preview.classList.add("is-playing");
          if (live.liveTitle) title.textContent = live.liveTitle;
        }
      };
      media.onerror = fallback;
      if (Hls.isSupported()) {
        const player = new Hls({ enableWorker: false, capLevelToPlayerSize: true });
        sidebarPreviewPlayer = player;
        player.on(Hls.Events.MEDIA_ATTACHED, () => { if (active()) player.loadSource(path); });
        player.on(Hls.Events.MANIFEST_PARSED, () => { if (active()) media.play().catch(fallback); });
        player.on(Hls.Events.ERROR, (_, error) => { if (error?.fatal) fallback(); });
        player.attachMedia(media);
      } else if (media.canPlayType("application/vnd.apple.mpegurl")) {
        media.src = path;
        media.play().catch(fallback);
      } else fallback();
    } catch (_) { fallback(); }
  }

  async function showSidebarPreview(link) {
    const sourceImage = link.querySelector("img") || link.closest("li, [class*='item']")?.querySelector("img");
    const src = sourceImage?.currentSrc || sourceImage?.src;
    const url = new URL(link.href);
    const channelId = url.pathname.match(/^\/live\/([a-f0-9]{32})\/?$/i)?.[1];
    if (url.hostname !== "chzzk.naver.com" || !channelId) return;
    stopSidebarPreview();
    const token = sidebarPreviewToken;
    sidebarPreviewLink = link;
    let preview = document.getElementById("hanbi-sidebar-hover-preview");
    if (!preview) {
      preview = document.createElement("aside");
      preview.id = "hanbi-sidebar-hover-preview";
      preview.innerHTML = "<div class='hanbi-sidebar-media'><img alt=''><video muted playsinline preload='none'></video></div><strong></strong>";
      document.body.appendChild(preview);
    }
    preview.dataset.channelId = channelId;
    preview.classList.remove("is-playing");
    const image = preview.querySelector("img");
    const title = preview.querySelector("strong");
    title.textContent = sourceImage?.alt || link.textContent.trim() || "라이브 미리보기";
    const showImages = (urls) => {
      const candidates = [...new Set(urls.filter(Boolean).map((url) => url.replaceAll("{type}", "480")))];
      let index = 0;
      image.hidden = true;
      image.onload = () => { image.hidden = false; };
      image.onerror = () => {
        image.hidden = true;
        if (index < candidates.length) image.src = candidates[index++];
        else if (!preview.classList.contains("is-playing")) title.textContent += " · 썸네일을 불러오지 못했습니다";
      };
      if (candidates.length) image.onerror();
      else image.removeAttribute("src");
      return candidates.length > 0;
    };
    showImages([src]);
    preview.hidden = false;
    const rect = link.getBoundingClientRect();
    const width = Math.min(320, innerWidth - 16);
    preview.style.width = `${width}px`;
    preview.style.left = `${Math.max(8, Math.min(innerWidth - width - 8, rect.right + 10))}px`;
    preview.style.top = `${Math.max(8, Math.min(innerHeight - 210, rect.top))}px`;
    try {
      const response = await fetch(`https://api.chzzk.naver.com/service/v3.3/channels/${channelId}/live-detail`, {
        credentials: "include", signal: AbortSignal.timeout(8_000),
      });
      if (!response.ok) throw new Error(`라이브 상세 HTTP ${response.status}`);
      const payload = await response.json();
      if (payload?.code !== 200 || !payload.content) throw new Error("라이브 상세 응답 오류");
      if (token !== sidebarPreviewToken || preview.hidden || preview.dataset.channelId !== channelId || !features.hoverPreview) return;
      const live = payload.content;
      if (live.liveTitle) title.textContent = live.liveTitle;
      if (!showImages([live.liveImageUrl, live.defaultThumbnailImageUrl, src])) title.textContent += " · 썸네일 없음";
      await startSidebarPreviewVideo(live, preview, token);
    } catch (_) {
      if (!src && token === sidebarPreviewToken && !preview.hidden && preview.dataset.channelId === channelId) title.textContent = "방송 썸네일을 불러오지 못했습니다";
    }
  }

  function handleSidebarPreviewOver(event) {
    const link = sidebarLiveLink(event.target);
    if (link && !link.contains(event.relatedTarget)) showSidebarPreview(link);
  }

  function handleSidebarPreviewOut(event) {
    const link = sidebarLiveLink(event.target);
    if (link && !link.contains(event.relatedTarget)) {
      stopSidebarPreview();
      document.getElementById("hanbi-sidebar-hover-preview")?.setAttribute("hidden", "");
    }
  }

  function hideTrendPreview() {
    const preview = document.getElementById("hanbi-trend-preview");
    if (preview) preview.hidden = true;
  }

  function scheduleTrendLayout() {
    if (trendLayoutScheduled) return;
    trendLayoutScheduled = true;
    requestAnimationFrame(() => {
      trendLayoutScheduled = false;
      const bar = document.getElementById("hanbi-trends");
      if (!bar) return;
      const barRect = bar.getBoundingClientRect();
      const y = barRect.top + Math.min(barRect.height / 2, 20);
      const candidates = document.querySelectorAll("aside, [class*='sidebar'], [class*='side_bar'], [class*='navigation']");
      let sidebar = null;
      let sidebarRight = barRect.left - Number(bar.dataset.leftOffset || 0);
      for (const element of candidates) {
        if (element === bar || bar.contains(element)) continue;
        const rect = element.getBoundingClientRect();
        if (rect.left > 8 || rect.right < 48 || rect.right > innerWidth * 0.5) continue;
        if (rect.top > y || rect.bottom < y || rect.height < 120) continue;
        if (getComputedStyle(element).display === "none" || getComputedStyle(element).visibility === "hidden") continue;
        if (rect.right > sidebarRight) {
          sidebar = element;
          sidebarRight = rect.right;
        }
      }
      const currentOffset = Number(bar.dataset.leftOffset || 0);
      const offset = calculateTrendOffset(barRect.left, currentOffset, sidebarRight);
      if (offset !== currentOffset) {
        bar.dataset.leftOffset = String(offset);
        bar.style.setProperty("--hanbi-trend-left", `${offset}px`);
      }
      if (sidebar !== trendSidebar) {
        trendSidebarObserver?.disconnect();
        if (sidebar) trendSidebarObserver?.observe(sidebar);
        trendSidebar = sidebar;
      }
    });
  }

  function showTrendPreview(link) {
    if (!link.dataset.thumb) return;
    let preview = document.getElementById("hanbi-trend-preview");
    if (!preview) {
      preview = document.createElement("aside");
      preview.id = "hanbi-trend-preview";
      preview.role = "tooltip";
      preview.innerHTML = '<img alt=""><div><strong></strong><span></span></div>';
      document.body.appendChild(preview);
    }
    preview.querySelector("img").src = link.dataset.thumb;
    preview.querySelector("img").alt = `${link.dataset.channel} 방송 썸네일`;
    preview.querySelector("strong").textContent = link.dataset.title;
    preview.querySelector("span").textContent = `${link.dataset.channel} · ${link.dataset.viewers}`;
    preview.hidden = false;
    const rect = link.getBoundingClientRect();
    const previewWidth = Math.min(360, innerWidth - 16);
    preview.style.width = `${previewWidth}px`;
    preview.style.left = `${Math.max(8, Math.min(innerWidth - previewWidth - 8, rect.left + rect.width / 2 - previewWidth / 2))}px`;
    preview.style.top = `${rect.bottom + 12 + 230 > innerHeight ? Math.max(8, rect.top - 218) : rect.bottom + 12}px`;
  }

  function ensureTrendBar() {
    let bar = document.getElementById("hanbi-trends");
    const header = document.querySelector("header, [class^='header_container']");
    if (!header) return null;
    if (!bar) {
      bar = document.createElement("nav");
      bar.id = "hanbi-trends";
      bar.ariaLabel = "실시간 인기 방송";
      header.after(bar);
      bar.addEventListener("click", (event) => {
        if (event.target.closest("[data-trend-refresh]")) updateTrends();
      });
      bar.addEventListener("pointerover", (event) => {
        const link = event.target.closest(".hanbi-trend-link");
        if (link && !link.contains(event.relatedTarget)) showTrendPreview(link);
      });
      bar.addEventListener("pointerout", (event) => {
        const link = event.target.closest(".hanbi-trend-link");
        if (link && !link.contains(event.relatedTarget)) hideTrendPreview();
      });
    }
    scheduleTrendLayout();
    return bar;
  }

  async function updateTrends() {
    if (!features.trends || trendUpdating) return;
    const bar = ensureTrendBar();
    if (!bar) return;
    trendUpdating = true;
    try {
      const response = await fetch("https://api.chzzk.naver.com/service/v1/lives?size=50&sortType=POPULAR", { credentials: "include" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const lives = (await response.json())?.content?.data || [];
      const { items, next } = selectTrendStreams(lives, previousViewerMap, trendOptions.minViewers, trendOptions.displayCount);
      previousViewerMap = next;

      const heading = document.createElement("div");
      heading.className = "hanbi-trend-heading";
      const label = document.createElement("strong");
      label.textContent = `🔥 실시간 트렌드 · ${trendOptions.minViewers.toLocaleString()}명+`;
      const refresh = document.createElement("button");
      refresh.type = "button";
      refresh.dataset.trendRefresh = "1";
      refresh.title = "클릭하여 즉시 갱신";
      refresh.textContent = `${new Date().toLocaleTimeString("ko-KR", { hour12: false })} ↻`;
      heading.append(label, refresh);

      const list = document.createElement("div");
      list.className = "hanbi-trend-list";
      list.replaceChildren(...items.map(({ live, channelId, viewers, pumping }, index) => {
        const link = document.createElement("a");
        link.className = `hanbi-trend-link${pumping ? " is-pumping" : ""}`;
        link.href = `/live/${channelId}`;
        link.dataset.thumb = trendThumbnail(live);
        link.dataset.channel = live.channel?.channelName || "스트리머";
        link.dataset.title = live.liveTitle || link.dataset.channel;
        link.dataset.viewers = `시청자 ${viewers.toLocaleString()}명`;
        link.title = link.dataset.title;
        const rank = document.createElement("b");
        rank.textContent = pumping ? "⚡" : String(index + 1);
        const channel = document.createElement("span");
        channel.textContent = link.dataset.channel;
        const count = document.createElement("small");
        count.textContent = viewers >= 10_000 ? `${(viewers / 10_000).toFixed(1)}만` : viewers.toLocaleString();
        link.append(rank, channel, count);
        return link;
      }));
      bar.replaceChildren(heading, list);
    } catch (_) {}
    finally { trendUpdating = false; }
  }

  function resetTrendTimer() {
    clearInterval(trendTimer);
    trendTimer = features.trends ? setInterval(updateTrends, Math.max(1, trendOptions.refreshMinutes) * 60_000) : null;
  }

  function applyVideoFilter(source) {
    const enabled = features.videoFilters || features.sharpness;
    if (!enabled) {
      source.style.filter = "";
      return;
    }
    let svg = document.getElementById("hanbi-video-filter-svg");
    if (!svg) {
      const namespace = "http://www.w3.org/2000/svg";
      svg = document.createElementNS(namespace, "svg");
      svg.id = "hanbi-video-filter-svg";
      svg.setAttribute("aria-hidden", "true");
      const filter = document.createElementNS(namespace, "filter");
      filter.id = "hanbi-video-sharpness";
      const matrix = document.createElementNS(namespace, "feConvolveMatrix");
      matrix.setAttribute("order", "3 3");
      filter.appendChild(matrix);
      svg.appendChild(filter);
      document.body.appendChild(svg);
    }
    const amount = Math.max(0, Number(trendOptions.sharpnessAmount) || 0) / 100;
    svg.querySelector("feConvolveMatrix").setAttribute("kernelMatrix", `0 -${amount} 0 -${amount} ${1 + 4 * amount} -${amount} 0 -${amount} 0`);
    source.style.filter = `brightness(${trendOptions.brightnessAmount}%) contrast(${trendOptions.contrastAmount}%) url("#hanbi-video-sharpness")`;
  }

  function applyFeatures() {
    ensureCompressorControl();
    ensureTools();
    prepareVideo();
    syncQualityDisplay();
    document.querySelector("button[aria-label='광고 SKIP']:not(:disabled)")?.click();
    removeAdPopup();
    rememberAndRestoreBlindMessages();
    applyChatFeatures();
    if (features.trends) {
      if (!document.getElementById("hanbi-trends")) updateTrends();
      else scheduleTrendLayout();
    } else {
      document.getElementById("hanbi-trends")?.remove();
      document.getElementById("hanbi-trend-preview")?.remove();
    }
    if (!features.hoverPreview) {
      stopSidebarPreview();
      document.getElementById("hanbi-sidebar-hover-preview")?.remove();
    }

    const source = video();
    if (source) applyVideoFilter(source);
  }

  function schedule(mutations) {
    if (sidebarPreviewLink?.isConnected === false) {
      stopSidebarPreview();
      document.getElementById("hanbi-sidebar-hover-preview")?.setAttribute("hidden", "");
    }
    const followingChanged = mutations?.some((mutation) => [...mutation.addedNodes].some((node) => {
      if (!(node instanceof Element)) return false;
      const link = node.matches("a[href*='/live/']") ? node : node.querySelector("a[href*='/live/']");
      return Boolean(link?.closest("aside, [class*='navigator'], [class*='sidebar'], [class*='side_bar']"));
    }));
    if (followingChanged) followingMutationPending = true;
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      applyFeatures();
      if (followingMutationPending) {
        followingMutationPending = false;
        scheduleFollowingUpdate();
      }
    });
  }

  api.storage.local.get(["features", "trendOptions"]).then(({ features: saved, trendOptions: savedTrendOptions }) => {
    features = { ...defaults, ...saved };
    trendOptions = { ...trendDefaults, ...savedTrendOptions };
    applyFeatures();
    updateTrends();
    resetTrendTimer();
    resetFollowingTimer();
    resetSidebarRefreshTimer();
  });

  api.runtime.onMessage.addListener((message) => {
    if (message?.type !== "test-following-alert") return undefined;
    return (async () => {
    const shown = showFollowingAlert({
      channelId: "test", channelName: "hanbi 테스트 채널", liveTitle: "팔로잉 방송 시작 팝업 UI 테스트",
      channelImageUrl: api.runtime.getURL("icons/icon-96.png"), liveImageUrl: "", liveKey: String(Date.now()),
    });
    if (!shown) return { shown: false };
    try {
      const entries = await fetchFollowingEntries();
      return { shown: true, apiOk: true, count: entries.length, error: "" };
    } catch (error) {
      return { shown: true, apiOk: false, error: error.message };
    }
    })();
  });

  api.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    if (changes.features) features = { ...defaults, ...changes.features.newValue };
    if (changes.trendOptions) {
      trendOptions = { ...trendDefaults, ...changes.trendOptions.newValue };
      previousViewerMap = new Map();
    }
    if (changes.features || changes.trendOptions) {
      applyFeatures();
      updateTrends();
      resetTrendTimer();
      resetFollowingTimer();
      resetSidebarRefreshTimer();
    }
  });

  document.addEventListener("keydown", handleArrowSeek, true);
  for (const event of ['loadedmetadata', 'resize', 'emptied']) document.addEventListener(event, () => schedule(), true);
  document.addEventListener("pointerdown", resumeCompressor, true);
  document.addEventListener("keydown", resumeCompressor, true);
  document.addEventListener("pointerover", handleSidebarPreviewOver);
  document.addEventListener("pointerout", handleSidebarPreviewOut);
  new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener("pagehide", () => {
    if (recording?.recorder.state !== 'inactive' && recording) recording.recorder.stop();
    clearInterval(trendTimer);
    clearInterval(followingTimer);
    clearInterval(sidebarRefreshTimer);
    stopSidebarPreview();
    clearTimeout(followingUpdateTimer);
    clearInterval(timeMachineTimer);
    trendSidebarObserver?.disconnect();
    closeCompressor();
    retireSharedCapture();
    hideTrendPreview();
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  });
  window.addEventListener('beforeunload', event => {
    if (recording) { event.preventDefault(); event.returnValue = ''; }
  });
  window.addEventListener('pageshow', event => {
    if (!event.persisted) return;
    resetTrendTimer(); resetFollowingTimer(); resetSidebarRefreshTimer(); applyFeatures();
  });
})();
