(() => {
  "use strict";

  const STREAM_INFO = "#EXT-X-STREAM-INF";
  const isAdMediaSource = (src) => /(?:\.mp4(?:[?#]|$)|\/service\/)/i.test(src || "");

  function chooseVariant(variants) {
    return [...variants].sort((a, b) =>
      Number(b.height === 1080) - Number(a.height === 1080) ||
      b.height - a.height || b.fps - a.fps || b.bandwidth - a.bandwidth
    )[0];
  }

  function filterMasterPlaylist(text) {
    if (typeof text !== "string" || !text.includes("#EXTM3U") || !text.includes(STREAM_INFO)) return text;

    const lines = text.split(/\r?\n/);
    const blocks = [];
    for (let start = 0; start < lines.length; start += 1) {
      if (!lines[start].startsWith(STREAM_INFO)) continue;
      let end = start + 1;
      while (end < lines.length && lines[end].startsWith("#")) end += 1;
      const resolution = lines[start].match(/RESOLUTION=\d+x(\d+)/i);
      if (resolution && lines[end]?.trim()) {
        blocks.push({
          start,
          end,
          height: Number(resolution[1]),
          fps: Number(lines[start].match(/FRAME-RATE=([\d.]+)/i)?.[1] || 0),
          bandwidth: Number(lines[start].match(/(?:AVERAGE-)?BANDWIDTH=(\d+)/i)?.[1] || 0),
        });
      }
      start = end;
    }

    if (blocks.length < 2) return text;
    const keep = chooseVariant(blocks);
    const drop = new Set();
    for (const block of blocks) {
      if (block === keep) continue;
      for (let line = block.start; line <= block.end; line += 1) drop.add(line);
    }
    return lines.filter((_, index) => !drop.has(index)).join(text.includes("\r\n") ? "\r\n" : "\n");
  }

  function patchPlayback(playback) {
    let changed = false;
    if (playback?.meta?.p2p !== false) {
      playback.meta.p2p = false;
      changed = true;
    }
    for (const media of playback?.media || []) {
      for (const track of media?.encodingTrack || []) {
        for (const key of ["p2pPath", "p2pPathUrlEncoding"]) {
          if (Object.prototype.hasOwnProperty.call(track, key)) {
            delete track[key];
            changed = true;
          }
        }
      }
    }
    return changed;
  }

  function patchPayload(value, seen = new WeakSet()) {
    if (!value || typeof value !== "object" || seen.has(value)) return false;
    seen.add(value);
    let changed = false;

    if (Object.prototype.hasOwnProperty.call(value, "dab") && value.dab !== false) {
      value.dab = false;
      changed = true;
    }
    if (Array.isArray(value.p2pQuality) && value.p2pQuality.length) {
      value.p2pQuality = [];
      changed = true;
    }
    if (typeof value.livePlaybackJson === "string") {
      try {
        const playback = JSON.parse(value.livePlaybackJson);
        if (patchPlayback(playback)) {
          value.livePlaybackJson = JSON.stringify(playback);
          changed = true;
        }
      } catch (_) {}
    }

    for (const child of Object.values(value)) {
      if (patchPayload(child, seen)) changed = true;
    }
    return changed;
  }

  function patchJsonText(text) {
    if (typeof text !== "string" || !/(?:"dab"|"p2pQuality"|"livePlaybackJson")/.test(text)) return text;
    try {
      const data = JSON.parse(text);
      return patchPayload(data) ? JSON.stringify(data) : text;
    } catch (_) {
      return text;
    }
  }

  function patchResponse(response) {
    const nativeJson = response.json?.bind(response);
    const nativeText = response.text?.bind(response);
    const nativeClone = response.clone?.bind(response);
    try {
      Object.defineProperties(response, {
        ...(nativeJson && { json: { configurable: true, value: async () => {
          const data = await nativeJson();
          patchPayload(data);
          return data;
        } } }),
        ...(nativeText && { text: { configurable: true, value: async () => patchJsonText(await nativeText()) } }),
        ...(nativeClone && { clone: { configurable: true, value: () => patchResponse(nativeClone()) } }),
      });
    } catch (_) {}
    return response;
  }

  function install(target) {
    if (target.__HANBI_CHZZK_PAGE__) return;
    Object.defineProperty(target, "__HANBI_CHZZK_PAGE__", { value: true });

    const nativeFetch = target.fetch;
    if (typeof nativeFetch === "function") {
      target.fetch = async (...args) => {
        const response = await nativeFetch.apply(target, args);
        const url = typeof args[0] === "string" ? args[0] : args[0]?.url || response.url;
        if (!/\.m3u8(?:[?#]|$)/i.test(url)) return patchResponse(response);
        try {
          const text = await response.clone().text();
          const filtered = filterMasterPlaylist(text);
          if (filtered === text) return response;
          const headers = new target.Headers(response.headers);
          headers.delete("content-length");
          return new target.Response(filtered, {
            status: response.status,
            statusText: response.statusText,
            headers,
          });
        } catch (_) {
          return response;
        }
      };
    }

    const xhr = target.XMLHttpRequest?.prototype;
    if (xhr) {
      const nativeOpen = xhr.open;
      const urls = new WeakMap();
      xhr.open = function(method, url, ...rest) {
        urls.set(this, String(url || ""));
        return nativeOpen.call(this, method, url, ...rest);
      };
      for (const property of ["responseText", "response"]) {
        const descriptor = Object.getOwnPropertyDescriptor(xhr, property);
        if (!descriptor?.configurable || typeof descriptor.get !== "function") continue;
        Object.defineProperty(xhr, property, {
          configurable: true,
          enumerable: descriptor.enumerable,
          get() {
            const value = descriptor.get.call(this);
            if (typeof value === "string") {
              return /\.m3u8(?:[?#]|$)/i.test(urls.get(this) || this.responseURL || "")
                ? filterMasterPlaylist(value)
                : patchJsonText(value);
            }
            patchPayload(value);
            return value;
          },
        });
      }
    }

    const media = target.HTMLMediaElement?.prototype;
    if (media?.play) {
      const nativePlay = media.play;
      media.play = function(...args) {
        const src = this.currentSrc || this.src || "";
        if (location.pathname.startsWith("/live/") && isAdMediaSource(src)) {
          this.removeAttribute("src");
          this.load();
        }
        return nativePlay.apply(this, args);
      };
    }
  }

  if (typeof window !== "undefined") install(window);
  if (typeof module !== "undefined") module.exports = { chooseVariant, filterMasterPlaylist, patchPayload, isAdMediaSource };
})();
