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

  const blindNoticePattern = /(?:클린봇이\s*부적절한\s*표현을\s*감지|(?:관리자|운영자).*?(?:블라인드|숨김|삭제|차단|가림)|(?:블라인드|숨김|삭제|차단|가림).*?(?:메시지|채팅))/i;
  const adBlockNoticePattern = /광고\s*차단\s*프로그램.*사용\s*중/i;
  const cheatKeyTimeMachinePattern = /치트키를\s*구매하면\s*타임머신\s*기능을\s*이용할\s*수\s*있어요/i;
  const isBlindNotice = (text) => blindNoticePattern.test(text || "");
  const isAdBlockNotice = (text) => adBlockNoticePattern.test(text || "");
  const isBlockedPromoNotice = (text) => isAdBlockNotice(text) || cheatKeyTimeMachinePattern.test(text || "");
  const needsFirefoxAudioMonitor = (userAgent, audioTrackCount) => userAgent.includes("Firefox") && audioTrackCount > 0;
  const calculateTrendOffset = (barLeft, currentOffset, sidebarRight) => Math.max(0, Math.ceil(sidebarRight - (barLeft - currentOffset)));
  const clampSeekTime = (current, delta, start, end) => Math.max(start, Math.min(end, current + delta));
  const channelIdFromHref = (href) => String(href || "").match(/^\/live\/([^/?#]+)/)?.[1] || "";
  const isFollowingSectionLabel = (text) => /^(?:팔로잉|팔로우)(?:\s*(?:채널|방송))?$|^following(?:\s+(?:channels?|live))?$/i.test(String(text || "").replace(/\s+/g, " ").trim());
  const compressorDefaults = { threshold: -50, knee: 40, ratio: 12, attack: 0, release: 0.25 };

  function connectAudioGraph(graph, compressed) {
    if (!graph || graph.failed) return false;
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
      graph.mode = compressed ? "compressed" : "bypass";
      return true;
    } catch (_) {
      graph.mode = "";
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
      if (!firstRun && viewers < threshold) continue;
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

  if (typeof module !== "undefined") module.exports = { chooseRecorderMime, isBlindNotice, isAdBlockNotice, isBlockedPromoNotice, needsFirefoxAudioMonitor, calculateTrendOffset, clampSeekTime, channelIdFromHref, isFollowingSectionLabel, compressorDefaults, connectAudioGraph, selectTrendStreams, trendThumbnail };
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
  let scheduled = false;
  let trendTimer = null;
  let followingTimer = null;
  let followingUpdateTimer = null;
  let sidebarRefreshTimer = null;
  let followingUpdating = false;
  let followingMutationPending = false;
  let followingEmptySince = 0;
  let trendUpdating = false;
  let trendLayoutScheduled = false;
  let trendSidebar = null;
  const trendSidebarObserver = typeof ResizeObserver === "function" ? new ResizeObserver(() => scheduleTrendLayout()) : null;
  let previousViewerMap = new Map();
  let previewUrl = null;
  const preparedVideos = new WeakSet();
  const originalMessages = new WeakMap();
  let compressorData = null;
  let compressorEnabled = localStorage.getItem("hanbi_comp_enabled") === "true";
  let compressorGain = Math.max(0, Math.min(2, Number(localStorage.getItem("knifeGain")) || 1));

  const isLive = () => /^\/live\/[^/]+/.test(location.pathname);

  function video() {
    return [...document.querySelectorAll("video")]
      .filter((item) => item.videoWidth && item.readyState >= 2 && item.getBoundingClientRect().width)
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
      Promise.resolve(onClick(event)).catch((error) => {
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
      document.body.appendChild(overlay);
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

  async function togglePip() {
    const source = video();
    if (!source?.requestPictureInPicture) throw new Error("PIP를 지원하지 않는 영상입니다.");
    if (document.pictureInPictureElement) await document.exitPictureInPicture();
    else await source.requestPictureInPicture();
  }

  function resetRecording(session) {
    const audioCleanup = session.audioCleanup;
    session.audioCleanup = null;
    audioCleanup?.();
    session.stream.getTracks().forEach((track) => track.stop());
    clearInterval(session.timer);
    session.indicator?.remove();
    session.button.textContent = "REC";
    session.button.classList.remove("is-recording");
    if (recording === session) recording = null;
  }

  function monitorFirefoxAudio(source, stream) {
    const tracks = stream.getAudioTracks();
    if (!needsFirefoxAudioMonitor(navigator.userAgent, tracks.length)) return null;
    try {
      const context = new AudioContext();
      const input = context.createMediaStreamSource(new MediaStream(tracks));
      const gain = context.createGain();
      const syncVolume = () => { gain.gain.value = source.muted ? 0 : source.volume; };
      syncVolume();
      input.connect(gain).connect(context.destination);
      source.addEventListener("volumechange", syncVolume);
      context.resume().catch(console.error);
      return () => {
        source.removeEventListener("volumechange", syncVolume);
        input.disconnect();
        gain.disconnect();
        context.close().catch(console.error);
      };
    } catch (error) {
      console.warn("[CHZZK All-in-One recorder] Firefox audio monitor unavailable", error);
      return null;
    }
  }

  async function finishRecording(session) {
    if (session.failed) return;
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
    const capture = source.mozCaptureStream || source.captureStream;
    if (typeof capture !== "function") throw new Error("이 영상은 녹화를 지원하지 않습니다.");
    const stream = capture.call(source);
    if (!stream.getVideoTracks().length) throw new Error("영상 트랙을 가져오지 못했습니다.");

    const mimeType = chooseRecorderMime(MediaRecorder);
    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    const session = {
      recorder, stream, button: buttonElement, chunks: [], startedAt: Date.now(),
      audioCleanup: monitorFirefoxAudio(source, stream),
    };
    recording = session;
    recorder.addEventListener("dataavailable", (event) => event.data.size && session.chunks.push(event.data));
    recorder.addEventListener("stop", () => finishRecording(session).catch((error) => {
      resetRecording(session);
      status(error?.message || "녹화 결과 창을 열지 못했습니다.", true);
    }), { once: true });
    recorder.addEventListener("error", (event) => {
      session.failed = true;
      resetRecording(session);
      status(event.error?.message || "녹화에 실패했습니다.", true);
    }, { once: true });
    recorder.start(1000);
    showRecordingIndicator(session);
    buttonElement.textContent = "STOP";
    buttonElement.classList.add("is-recording");
    status(stream.getAudioTracks().length ? "녹화를 시작했습니다." : "오디오 없이 녹화를 시작했습니다.");
  }

  // Derived from cheese-knife's MIT-licensed MediaElementSource → DynamicsCompressor → Gain graph.
  function closeCompressor() {
    if (!compressorData) return;
    connectAudioGraph(compressorData, false);
    compressorData.ctx.close().catch(() => {});
    compressorData = null;
  }

  function getCompressor(v) {
    if (compressorData?.video === v) return compressorData;
    closeCompressor();
    const Context = window.AudioContext || window.webkitAudioContext;
    if (!Context) return null;
    let ctx;
    try {
      ctx = new Context();
      compressorData = {
        video: v,
        context: ctx,
        ctx,
        source: ctx.createMediaElementSource(v),
        compressor: ctx.createDynamicsCompressor(),
        gain: ctx.createGain(),
        mode: "",
      };
      for (const [name, value] of Object.entries(compressorDefaults)) compressorData.compressor[name].value = value;
      return compressorData;
    } catch (error) {
      ctx?.close?.().catch(() => {});
      compressorData = null;
      console.warn("[CHZZK All-in-One] Compressor Error", error);
      return null;
    }
  }

  function applyCompressorState(v) {
    if (compressorData?.video !== v) closeCompressor();
    if (!v || (!compressorEnabled && !compressorData)) return;
    const data = getCompressor(v);
    if (!data) return;
    data.gain.gain.value = compressorGain;
    connectAudioGraph(data, compressorEnabled);
    if (compressorEnabled) data.ctx.resume().catch(() => {});
  }

  function resumeCompressor() {
    if (compressorEnabled && compressorData?.ctx.state === "suspended") compressorData.ctx.resume().catch(() => {});
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
        syncCompressorControl(root);
        applyCompressorState(video());
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
        syncCompressorControl(root);
        applyCompressorState(video());
      });
      root.append(compBtn, compSlider);
    }
    if (root.previousElementSibling !== volumeControl) volumeControl.insertAdjacentElement("afterend", root);
    syncCompressorControl(root);
  }

  function syncCompressorControl(root) {
    const buttonElement = root.querySelector("[data-compressor-toggle]");
    const slider = root.querySelector("input[type='range']");
    buttonElement.textContent = compressorEnabled ? "COMP ON" : "COMP OFF";
    buttonElement.classList.toggle("is-recording", compressorEnabled);
    buttonElement.setAttribute("aria-pressed", String(compressorEnabled));
    slider.value = compressorGain;
    slider.hidden = !compressorEnabled;
    slider.title = `컴프레서 보정 게인 ${Math.round(compressorGain * 100)}%`;
    slider.setAttribute("aria-valuetext", `${Math.round(compressorGain * 100)}%`);
  }

  function ensureTools() {
    const target = document.querySelector(".pzp-pc__bottom-buttons-right");
    const existing = document.getElementById("hanbi-player-tools");
    const hasPip = Boolean(video()?.requestPictureInPicture);
    const signature = `${features.recorder}:${features.screenshot}:${hasPip}`;
    if (!target) return;
    if (existing?.parentElement === target && existing.dataset.signature === signature) return;
    existing?.remove();

    const root = document.createElement("span");
    root.id = "hanbi-player-tools";
    root.dataset.signature = signature;

    if (features.recorder) {
      const recordButton = button("녹화 시작/중지", "REC", () => toggleRecording(recordButton));
      root.appendChild(recordButton);
    }
    if (features.screenshot) root.appendChild(button("스크린샷", "SHOT", screenshot));
    if (hasPip) root.appendChild(button("Picture in Picture", "PIP", togglePip));
    target.prepend(root);
  }

  function prepareVideo() {
    const source = video();
    if (!source) return;
    if (!preparedVideos.has(source)) {
      preparedVideos.add(source);
      if (features.autoUnmute && isLive()) source.muted = false;
      source.addEventListener("loadeddata", () => {
        if (features.autoUnmute && isLive()) source.muted = false;
      }, { once: true });
    }
    applyCompressorState(source);
  }

  function removeAdPopup() {
    if (!features.hideAdPopup) return;
    for (const popup of document.querySelectorAll("div[class^='popup_container'], [role='dialog'], [class*='_modal_'][class*='_container_']")) {
      if (isBlockedPromoNotice(popup.textContent)) popup.remove();
    }
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
    if (!features.followingAlerts || followingUpdating) return;
    const { ready, entries } = collectFollowingEntries();
    if (!ready) return;
    if (!entries.length) {
      followingEmptySince ||= Date.now();
      if (Date.now() - followingEmptySince < 8_000) return;
    } else {
      followingEmptySince = 0;
    }
    followingUpdating = true;
    try {
      const result = await api.runtime.sendMessage({ type: "following-snapshot", entries });
      for (const entry of result?.alerts || []) showFollowingAlert(entry);
    } catch (_) {}
    finally { followingUpdating = false; }
  }

  function followingSections() {
    const sections = new Set();
    for (const section of document.querySelectorAll("[class*='following'], [data-testid*='following' i], [aria-label*='팔로잉'], [aria-label*='팔로우']")) {
      if (!section.matches("a, button") && section.querySelector("a[href^='/live/']")) sections.add(section);
    }
    for (const label of document.querySelectorAll("h1, h2, h3, h4, strong, [role='heading'], [class*='title'], [class*='header']")) {
      if (!isFollowingSectionLabel(label.textContent) || label.closest("a, button")) continue;
      let section = null;
      let parent = label.parentElement;
      for (let depth = 0; parent && depth < 5; depth += 1, parent = parent.parentElement) {
        if (parent.querySelector("a[href^='/live/']")) {
          section = parent;
          break;
        }
      }
      sections.add(section || label.parentElement);
    }
    const roots = [...sections].filter(Boolean);
    return roots.filter((root) => !roots.some((other) => other !== root && root.contains(other)));
  }

  function collectFollowingEntries() {
    const sections = followingSections();
    const entries = new Map();
    for (const section of sections) {
      for (const link of section.querySelectorAll("a[href^='/live/']")) {
        const channelId = channelIdFromHref(link.getAttribute("href"));
        if (!channelId || entries.has(channelId)) continue;
        const image = link.querySelector("img") || link.closest("li, [class*='item']")?.querySelector("img");
        const channelName = link.querySelector("[class*='channel_name'], [class*='name']")?.textContent?.trim()
          || image?.alt?.trim() || link.textContent?.trim().split("\n")[0] || "팔로잉 채널";
        const liveTitle = link.querySelector("[class*='live_title'], [class*='title']")?.textContent?.trim()
          || "방송을 시작했습니다";
        entries.set(channelId, {
          channelId,
          channelName,
          channelImageUrl: image?.currentSrc || image?.src || "",
          liveImageUrl: image?.currentSrc || image?.src || "",
          liveTitle,
          liveKey: "open",
        });
      }
    }
    return { ready: sections.length > 0, entries: [...entries.values()] };
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
      followingEmptySince = 0;
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
        cached?.source === text && cached.identity === identity ? cached.text : ""
      );
      if (!original) continue;

      text.setAttribute("data-hanbi-blind-masked", "1");
      const replacement = reveal || document.createElement("span");
      replacement.className = "hanbi-restored-message";
      replacement.title = "확인 가능한 블라인드 원문";
      replacement.textContent = original;
      if (!replacement.isConnected) text.after(replacement);
    }
  }

  function handleArrowSeek(event) {
    if (!features.arrowSeek || !["ArrowLeft", "ArrowRight"].includes(event.key) || event.ctrlKey || event.altKey || event.metaKey) return;
    if (event.target.closest?.("input, textarea, select, [contenteditable='true'], [role='textbox']")) return;
    const source = video();
    if (!source) return;
    const ranges = source.seekable;
    const start = ranges?.length ? ranges.start(0) : 0;
    const end = ranges?.length ? ranges.end(ranges.length - 1) : (Number.isFinite(source.duration) ? source.duration : source.currentTime + 5);
    source.currentTime = clampSeekTime(source.currentTime, event.key === "ArrowLeft" ? -5 : 5, start, end);
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
    style.textContent = [
      features.hideDonation ? "[class*='live_chatting_list_donation_'], [class*='donation'][class*='chat'] { display: none !important; }" : "",
      features.chatFontSizeEnabled ? `[class*='live_chatting_message_text'], [data-message-text] { font-size: ${trendOptions.chatFontSize}px !important; }` : "",
    ].filter(Boolean).join("\n");
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
    const link = target.closest?.("a[href^='/live/']");
    if (!features.hoverPreview || !link || link.closest("#hanbi-trends")) return null;
    return followingSections().some((section) => section.contains(link)) ? link : null;
  }

  function showSidebarPreview(link) {
    const sourceImage = link.querySelector("img") || link.closest("li, [class*='item']")?.querySelector("img");
    const src = sourceImage?.currentSrc || sourceImage?.src;
    if (!src) return;
    let preview = document.getElementById("hanbi-sidebar-hover-preview");
    if (!preview) {
      preview = document.createElement("aside");
      preview.id = "hanbi-sidebar-hover-preview";
      preview.innerHTML = "<img alt=''><strong></strong>";
      document.body.appendChild(preview);
    }
    preview.querySelector("img").src = src;
    preview.querySelector("strong").textContent = sourceImage.alt || link.textContent.trim() || "라이브 미리보기";
    preview.hidden = false;
    const rect = link.getBoundingClientRect();
    const width = Math.min(320, innerWidth - 16);
    preview.style.width = `${width}px`;
    preview.style.left = `${Math.max(8, Math.min(innerWidth - width - 8, rect.right + 10))}px`;
    preview.style.top = `${Math.max(8, Math.min(innerHeight - 210, rect.top))}px`;
  }

  function handleSidebarPreviewOver(event) {
    const link = sidebarLiveLink(event.target);
    if (link && !link.contains(event.relatedTarget)) showSidebarPreview(link);
  }

  function handleSidebarPreviewOut(event) {
    const link = sidebarLiveLink(event.target);
    if (link && !link.contains(event.relatedTarget)) document.getElementById("hanbi-sidebar-hover-preview")?.setAttribute("hidden", "");
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
    if (!features.hoverPreview) document.getElementById("hanbi-sidebar-hover-preview")?.remove();

    const source = video();
    if (source) applyVideoFilter(source);
  }

  function schedule(mutations) {
    const followingChanged = mutations?.some((mutation) => [...mutation.addedNodes].some((node) => {
      if (!(node instanceof Element)) return false;
      const link = node.matches("a[href^='/live/']") ? node : node.querySelector("a[href^='/live/']");
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

  api.runtime.onMessage.addListener(async (message) => {
    if (message?.type !== "test-following-alert") return undefined;
    const shown = showFollowingAlert({
      channelId: "test", channelName: "hanbi 테스트 채널", liveTitle: "팔로잉 방송 시작 팝업 UI 테스트",
      channelImageUrl: api.runtime.getURL("icons/icon-96.png"), liveImageUrl: "", liveKey: String(Date.now()),
    });
    if (!shown) return { shown: false };
    try {
      const { ready, entries } = collectFollowingEntries();
      return { shown: true, apiOk: ready, count: entries.length, error: ready ? "" : "팔로잉 사이드바를 찾지 못함" };
    } catch (error) {
      return { shown: true, apiOk: false, error: error.message };
    }
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
  document.addEventListener("pointerdown", resumeCompressor, true);
  document.addEventListener("keydown", resumeCompressor, true);
  document.addEventListener("pointerover", handleSidebarPreviewOver);
  document.addEventListener("pointerout", handleSidebarPreviewOut);
  new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener("pagehide", () => {
    clearInterval(trendTimer);
    clearInterval(followingTimer);
    clearInterval(sidebarRefreshTimer);
    clearTimeout(followingUpdateTimer);
    trendSidebarObserver?.disconnect();
    closeCompressor();
    hideTrendPreview();
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, { once: true });
})();
