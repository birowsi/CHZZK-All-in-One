(() => {
  "use strict";

  const OrigUint8Array = typeof Uint8Array === "function" ? Uint8Array : null;
  const jsonByteDecoder = typeof TextDecoder === "function" ? new TextDecoder("utf-8", { fatal: true }) : null;
  const jsonByteEncoder = typeof TextEncoder === "function" ? new TextEncoder() : null;

  function isAdMediaSource(src) {
    try {
      const url = new URL(src);
      return /(^|\.)(?:navercdn\.com|pstatic\.net|naver\.com)$/.test(url.hostname)
        && (/\/(?:ads?|adservice)\//i.test(url.pathname)
          || (url.hostname === "glad-vod.pstatic.net" && /^\/a\/read\/v2\/VOD_ALPHA\//i.test(url.pathname)));
    } catch (_) { return false; }
  }
  const isLiveApi = (url) => /^https:\/\/api\.chzzk\.naver\.com\/(?:service|polling)\/v[\d.]+\/channels\/[a-f0-9]{32}\/live-(?:detail|status|playback-json)(?:-meta)?(?:[?#]|$)/i.test(url);
  const isPlaylist = (url) => {
    try {
      const parsed = new URL(url);
      return /(^|\.)(?:navercdn\.com|pstatic\.net|akamaized\.net)$/.test(parsed.hostname) && /\.m3u8$/i.test(parsed.pathname);
    } catch (_) { return false; }
  };
  const isAdFeed = (url) => {
    try {
      const parsed = new URL(url);
      if (/(?:^|\.)veta\.naver\.com$/.test(parsed.hostname)) return true;
      if (parsed.hostname === "elsa-veta.pstatic.net" || parsed.hostname === "tivan.naver.com") return true;
      if (parsed.hostname === "api.chzzk.naver.com") return /seoraksan|live-/i.test(parsed.pathname);
      return /seoraksan/i.test(parsed.pathname) && /(?:^|\.)naver\.com$|(?:^|\.)pstatic\.net$/.test(parsed.hostname);
    } catch (_) { return false; }
  };
  function chooseVariant(variants) {
    return [...variants].sort((a, b) => Number(b.height === 1080) - Number(a.height === 1080) || b.height - a.height || b.fps - a.fps || b.bandwidth - a.bandwidth)[0];
  }
  // Preserve every variant: initial quality is selected on the player, not by deleting choices.
  function filterMasterPlaylist(text) { return text; }
  function patchPlayback(playback) {
    if (!playback || typeof playback !== "object" || !Array.isArray(playback.media)) return false;
    let changed = false;
    if (!playback.meta || typeof playback.meta !== "object") playback.meta = {};
    if (playback.meta.p2p !== false) { playback.meta.p2p = false; changed = true; }
    for (const key of ["p2pQuality", "p"]) {
      if (Array.isArray(playback.live?.[key]) && playback.live[key].length) { playback.live[key] = []; changed = true; }
    }
    for (const media of playback.media) {
      const tracks = media?.encodingTrack || media?.e;
      if (!Array.isArray(tracks)) continue;
      for (const track of tracks) {
        if (!track || typeof track !== "object") continue;
        for (const key of ["p2pPath", "p2pPathUrlEncoding", "h"]) {
          if (Object.hasOwn(track, key)) { delete track[key]; changed = true; }
        }
      }
    }
    return changed;
  }
  function patchPayload(value, seen = new WeakSet(), grid = true) {
    if (!value || typeof value !== "object" || seen.has(value)) return false;
    if (value.code != null && value.code !== 200) return false;
    seen.add(value);
    const content = value;
    let changed = false;
    if (content.dab === true) { content.dab = false; changed = true; }
    if (grid && Array.isArray(content.p2pQuality) && content.p2pQuality.length) { content.p2pQuality = []; changed = true; }
    for (const field of grid ? ["livePlaybackJson", "playbackJson"] : []) {
      if (content[field] && typeof content[field] === "object") {
        if (patchPlayback(content[field])) changed = true;
        continue;
      }
      if (typeof content[field] !== "string") continue;
      try {
        const playback = JSON.parse(content[field]);
        if (patchPlayback(playback)) { content[field] = JSON.stringify(playback); changed = true; }
      } catch (_) {}
    }
    for (const child of Object.values(content)) if (patchPayload(child, seen, grid)) changed = true;
    // Do not fabricate timeMachineActive/tmp or replace the normal source with a clip URL.
    return changed;
  }
  function neutralizeAds(data) {
    if (!data || typeof data !== "object") return false;
    const head = data.head;
    if (head && typeof head === "object") {
      // 광고 소스가 남아 있는 스케줄만 광고 없는 일정으로 교체한다(중복 처리 방지).
      if (head.description === "GFP Video Ad Schedule" && Array.isArray(data.adBreaks)
        && data.adBreaks.some((item) => (Array.isArray(item?.adSources) && item.adSources.length > 0)
          || (typeof item?.adUnitId === "string" && item.adUnitId !== ""))) {
        data.adBreaks = [{ id: "", startDelay: 0, preFetch: 0, adUnitId: "", adSources: [] }];
        return true;
      }
      if (head.description === "Naver SSP Waterfall List" && Array.isArray(data.ads) && data.ads.length > 0) {
        data.ads = [];
        return true;
      }
    }
    const adDisplay = data.content && typeof data.content === "object" ? data.content.playerAdDisplayResponse : null;
    if (adDisplay && typeof adDisplay === "object"
      && typeof adDisplay.preRoll === "boolean" && typeof adDisplay.midRoll === "boolean"
      && (adDisplay.preRoll || adDisplay.midRoll)) {
      adDisplay.preRoll = false;
      adDisplay.midRoll = false;
      return true;
    }
    return false;
  }
  // {" 로 시작하는 JSON 바이트 뷰만 검사해 광고 응답이면 교체된 바이트를 반환한다.
  function neutralizeAdBuffer(view) {
    if (!OrigUint8Array || !jsonByteDecoder || !jsonByteEncoder) return null;
    if (!view || view.length < 2 || view[0] !== 0x7b || view[1] !== 0x22) return null;
    let data;
    try { data = JSON.parse(jsonByteDecoder.decode(view)); } catch (_) { return null; }
    if (!neutralizeAds(data)) return null;
    return jsonByteEncoder.encode(JSON.stringify(data));
  }
  function transformText(text, playlist, grid, live = true) {
    if (playlist) return filterMasterPlaylist(text);
    try {
      const data = JSON.parse(text);
      let changed = neutralizeAds(data);
      if (live && patchPayload(data, new WeakSet(), grid)) changed = true;
      return changed ? JSON.stringify(data) : text;
    } catch (_) { return text; }
  }
  function preserveResponseMetadata(response, original) {
    for (const key of ["url", "redirected", "type"]) Object.defineProperty(response, key, { value: original[key] });
    const clone = response.clone.bind(response);
    response.clone = () => preserveResponseMetadata(clone(), original);
    return response;
  }
  function install(target) {
    if (target.__HANBI_CHZZK_PAGE__) return;
    Object.defineProperty(target, "__HANBI_CHZZK_PAGE__", { value: true });
    let gridEnabled = !target.document;
    target.document?.addEventListener('hanbi-playback-settings', event => {
      try { gridEnabled = JSON.parse(event.detail).gridBypass === true; } catch (_) {}
    });
    if (target.document) target.document.dispatchEvent(new target.CustomEvent('hanbi-playback-ready'));
    const nativeFetch = target.fetch;
    if (typeof nativeFetch === "function") target.fetch = async function(...args) {
      const response = await nativeFetch.apply(this, args);
      const url = response.url || String(args[0]?.url || args[0]);
      if (!response.ok) return response;
      const live = isLiveApi(url);
      const playlist = isPlaylist(url);
      const looksJson = /json/i.test(response.headers.get("content-type") || "");
      if (!live && !playlist && !isAdFeed(url) && !looksJson) return response;
      try {
        const text = await response.clone().text();
        const patched = transformText(text, playlist, gridEnabled, live);
        if (patched === text) return response;
        const headers = new target.Headers(response.headers);
        headers.delete("content-length");
        headers.delete("content-encoding");
        return preserveResponseMetadata(new target.Response(patched, { status: response.status, statusText: response.statusText, headers }), response);
      } catch (_) { return response; }
    };
    const xhr = target.XMLHttpRequest?.prototype;
    if (xhr) {
      const nativeOpen = xhr.open;
      const requests = new WeakMap();
      xhr.open = function(method, url, ...rest) {
        const result = nativeOpen.call(this, method, url, ...rest);
        requests.set(this, { method: String(method).toUpperCase(), url: String(url), async: (rest[0] ?? true) === true });
        return result;
      };
      const vetaProbe = /^https:\/\/nam\.veta\.naver\.com\//;
      const probeRule = (request) => {
        const meta = requests.get(request);
        return !!meta && meta.method === "OPTIONS" && meta.async && vetaProbe.test(meta.url) && request.readyState >= 2;
      };
      // 광고 서버 연결을 확인하는 OPTIONS 응답만 성공으로 보고한다.
      for (const pair of [["status", 200], ["statusText", "OK"]]) {
        const descriptor = Object.getOwnPropertyDescriptor(xhr, pair[0]);
        if (!descriptor?.configurable || typeof descriptor.get !== "function") continue;
        const nativeGetter = descriptor.get;
        Object.defineProperty(xhr, pair[0], { configurable: true, enumerable: descriptor.enumerable, get() {
          if (probeRule(this)) return pair[1];
          return nativeGetter.call(this);
        } });
      }
      // send/abort and synchronous XHR keep their native timing and exceptions.
      for (const property of ["responseText", "response"]) {
        const descriptor = Object.getOwnPropertyDescriptor(xhr, property);
        if (!descriptor?.configurable || typeof descriptor.get !== "function") continue;
        Object.defineProperty(xhr, property, { configurable: true, enumerable: descriptor.enumerable, get() {
          const value = descriptor.get.call(this);
          const url = this.responseURL || requests.get(this)?.url || "";
          if (this.readyState !== 4 || this.status < 200 || this.status >= 300) return value;
          const live = isLiveApi(url);
          const playlist = isPlaylist(url);
          if (!live && !playlist && !isAdFeed(url)) {
            let contentType = "";
            try { contentType = typeof this.getResponseHeader === "function" ? this.getResponseHeader("content-type") || "" : ""; } catch (_) {}
            if (!/json/i.test(String(contentType))) return value;
          }
          if (typeof value === "string") return transformText(value, playlist, gridEnabled, live);
          if (value instanceof ArrayBuffer || ArrayBuffer.isView(value)) {
            try {
              const patched = neutralizeAdBuffer(ArrayBuffer.isView(value)
                ? new OrigUint8Array(value.buffer, value.byteOffset, value.byteLength)
                : new OrigUint8Array(value));
              // responseType='arraybuffer'는 ArrayBuffer 그대로, 나머지는 바이트 뷰를 반환한다.
              if (patched) return value instanceof ArrayBuffer ? patched.buffer.slice(0, patched.byteLength) : patched;
            } catch (_) {}
            return value;
          }
          if (value && typeof value === "object") {
            try {
              const copy = structuredClone(value);
              neutralizeAds(copy);
              if (live) patchPayload(copy, new WeakSet(), gridEnabled);
              return copy;
            } catch (_) { return value; }
          }
          return value;
        } });
      }
    }
    // 응답 본문이 Uint8Array 생성을 거치는 경로에서도 광고 JSON을 무력화한다.
    if (typeof target.Uint8Array === "function" && typeof OrigUint8Array === "function") {
      try {
        target.Uint8Array = new Proxy(target.Uint8Array, {
          construct(source, args, NewTarget) {
            const input = args[0];
            if (args.length && input && typeof input === "object") {
              try {
                const view = input instanceof ArrayBuffer ? new OrigUint8Array(input, args[1] || 0, args[2])
                  : ArrayBuffer.isView(input) && !(input instanceof DataView)
                    ? new OrigUint8Array(input.buffer, input.byteOffset, input.byteLength)
                    : null;
                const patched = view ? neutralizeAdBuffer(view) : null;
                if (patched) return Reflect.construct(source, [patched], NewTarget);
              } catch (_) {}
            }
            return Reflect.construct(source, args, NewTarget);
          },
        });
      } catch (_) {}
    }
    const media = target.HTMLMediaElement?.prototype;
    if (media?.play) {
      const nativePlay = media.play;
      const advanceAd = source => {
        if (!target.location.pathname.startsWith('/live/') || !isAdMediaSource(source.currentSrc || source.src)) return;
        if (Number.isFinite(source.duration) && source.duration > 0 && source.currentTime < source.duration) {
          try { source.currentTime = source.duration; } catch (_) {}
        }
      };
      media.play = function(...args) { advanceAd(this); return nativePlay.apply(this, args); };
      // Delegated media events also cover metadata arriving after play and source replacement.
      const events = ['loadedmetadata', 'durationchange', 'playing'];
      const receive = event => { if (event.target instanceof target.HTMLMediaElement) advanceAd(event.target); };
      const listen = () => events.forEach(type => target.document?.addEventListener(type, receive, true));
      const unlisten = () => events.forEach(type => target.document?.removeEventListener(type, receive, true));
      listen(); target.addEventListener?.('pagehide', unlisten); target.addEventListener?.('pageshow', listen);
    }
  }
  if (typeof window !== "undefined") install(window);
  if (typeof module !== "undefined") module.exports = { chooseVariant, filterMasterPlaylist, patchPayload, isAdMediaSource, install, neutralizeAds, neutralizeAdBuffer, transformText, isAdFeed };
})();
