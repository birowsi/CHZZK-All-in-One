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

  if (typeof module !== "undefined") module.exports = { chooseRecorderMime, isBlindNotice, isAdBlockNotice, isBlockedPromoNotice, needsFirefoxAudioMonitor, calculateTrendOffset, selectTrendStreams, trendThumbnail };
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
  };
  const trendDefaults = { minViewers: 1000, displayCount: 10, refreshMinutes: 1, sharpnessAmount: 100 };
  let features = { ...defaults };
  let trendOptions = { ...trendDefaults };
  let recording = null;
  let scheduled = false;
  let trendTimer = null;
  let followingTimer = null;
  let followingUpdating = false;
  let trendUpdating = false;
  let trendLayoutScheduled = false;
  let trendSidebar = null;
  const trendSidebarObserver = typeof ResizeObserver === "function" ? new ResizeObserver(() => scheduleTrendLayout()) : null;
  let previousViewerMap = new Map();
  let previewUrl = null;
  const preparedVideos = new WeakSet();
  const originalMessages = new WeakMap();
  const audioContexts = new WeakMap();
  let compressorEnabled = localStorage.getItem("hanbi_comp_enabled") === "true";
  let compressorStrength = Number(localStorage.getItem("hanbi_comp_strength")) || 12;

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

  function getCompressor(v) {
    let data = audioContexts.get(v);
    if (!data) {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const source = ctx.createMediaElementSource(v);
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -30;
      comp.knee.value = 10;
      comp.attack.value = 0;
      comp.release.value = 0.25;
      data = { ctx, source, comp, connected: false };
      audioContexts.set(v, data);
    }
    return data;
  }

  function applyCompressorState(v) {
    if (!v) return;
    try {
      const data = getCompressor(v);
      if (compressorEnabled) {
        if (!data.connected) {
          data.source.disconnect();
          data.source.connect(data.comp);
          data.comp.connect(data.ctx.destination);
          data.connected = true;
        }
        data.comp.ratio.value = compressorStrength;
      } else {
        if (data.connected) {
          data.source.disconnect();
          data.comp.disconnect();
          data.source.connect(data.ctx.destination);
          data.connected = false;
        }
      }
    } catch (e) { console.warn("[CHZZK All-in-One] Compressor Error", e); }
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
    root.style.display = "inline-flex";
    root.style.alignItems = "center";
    
    // Compressor UI
    const compWrapper = document.createElement("span");
    compWrapper.className = "hanbi-comp-wrapper";
    compWrapper.style.display = "inline-flex";
    compWrapper.style.alignItems = "center";
    compWrapper.style.marginRight = "4px";

    const compBtn = button("소리 정규화", compressorEnabled ? "COMP ON" : "COMP OFF", () => {
      compressorEnabled = !compressorEnabled;
      localStorage.setItem("hanbi_comp_enabled", compressorEnabled);
      compBtn.textContent = compressorEnabled ? "COMP ON" : "COMP OFF";
      compBtn.classList.toggle("is-recording", compressorEnabled);
      compSlider.style.display = compressorEnabled ? "inline-block" : "none";
      applyCompressorState(video());
    });
    if (compressorEnabled) compBtn.classList.add("is-recording");
    
    const compSlider = document.createElement("input");
    compSlider.type = "range";
    compSlider.min = "1";
    compSlider.max = "20";
    compSlider.value = compressorStrength;
    compSlider.title = "컴프레서 강도 조절";
    compSlider.style.width = "60px";
    compSlider.style.display = compressorEnabled ? "inline-block" : "none";
    compSlider.style.margin = "0 4px";
    compSlider.style.cursor = "pointer";
    compSlider.addEventListener("input", (e) => {
      compressorStrength = Number(e.target.value);
      localStorage.setItem("hanbi_comp_strength", compressorStrength);
      applyCompressorState(video());
    });

    compWrapper.append(compBtn, compSlider);
    root.appendChild(compWrapper);

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
    if (!source || preparedVideos.has(source)) return;
    preparedVideos.add(source);
    if (features.autoUnmute && isLive()) {
      source.muted = false;
      source.addEventListener("loadeddata", () => { source.muted = false; }, { once: true });
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
    followingUpdating = true;
    try {
      const claim = await api.runtime.sendMessage({ type: "claim-following-poll" });
      if (!claim?.granted) return;
      const entries = await fetchFollowingEntries();
      const result = await api.runtime.sendMessage({ type: "following-snapshot", entries });
      for (const entry of result?.alerts || []) showFollowingAlert(entry);
    } catch (_) {}
    finally { followingUpdating = false; }
  }

  async function fetchFollowingEntries() {
    const response = await fetch("https://api.chzzk.naver.com/service/v1/channels/followings/live", { credentials: "include" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const entries = HanbiFollowingLogic.normalizeFollowingPayload(await response.json());
    if (!entries) throw new Error("응답 형식 오류");
    return entries;
  }

  function resetFollowingTimer() {
    clearInterval(followingTimer);
    followingTimer = features.followingAlerts ? setInterval(updateFollowingAlerts, 15_000) : null;
    if (features.followingAlerts) updateFollowingAlerts();
    else document.getElementById("hanbi-following-alerts")?.remove();
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

  function applyFeatures() {
    ensureTools();
    prepareVideo();
    removeAdPopup();
    rememberAndRestoreBlindMessages();
    if (features.trends) {
      if (!document.getElementById("hanbi-trends")) updateTrends();
      else scheduleTrendLayout();
    } else {
      document.getElementById("hanbi-trends")?.remove();
      document.getElementById("hanbi-trend-preview")?.remove();
    }

    const source = video();
    if (source) {
      let filterString = "";
      if (features.videoFilters) {
        filterString += `brightness(${trendOptions.brightnessAmount}%) contrast(${trendOptions.contrastAmount}%) `;
      }
      if (features.sharpness) {
        filterString += `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg'><filter id='sharpness'><feConvolveMatrix order='3 3' kernelMatrix='0 -${trendOptions.sharpnessAmount / 100} 0 -${trendOptions.sharpnessAmount / 100} ${1 + 4 * (trendOptions.sharpnessAmount / 100)} -${trendOptions.sharpnessAmount / 100} 0 -${trendOptions.sharpnessAmount / 100} 0' /></filter></svg>#sharpness")`;
      }
      source.style.filter = filterString.trim() || "none";
    }
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      applyFeatures();
    });
  }

  api.storage.local.get(["features", "trendOptions"]).then(({ features: saved, trendOptions: savedTrendOptions }) => {
    features = { ...defaults, ...saved };
    trendOptions = { ...trendDefaults, ...savedTrendOptions };
    applyFeatures();
    updateTrends();
    resetTrendTimer();
    resetFollowingTimer();
  });

  api.runtime.onMessage.addListener(async (message) => {
    if (message?.type !== "test-following-alert") return undefined;
    const shown = showFollowingAlert({
      channelId: "test", channelName: "hanbi 테스트 채널", liveTitle: "팔로잉 방송 시작 팝업 UI 테스트",
      channelImageUrl: api.runtime.getURL("icons/icon-96.png"), liveImageUrl: "", liveKey: String(Date.now()),
    });
    if (!shown) return { shown: false };
    try {
      const entries = await fetchFollowingEntries();
      return { shown: true, apiOk: true, count: entries.length };
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
    }
  });

  new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener("pagehide", () => {
    clearInterval(trendTimer);
    clearInterval(followingTimer);
    trendSidebarObserver?.disconnect();
    hideTrendPreview();
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, { once: true });
})();
