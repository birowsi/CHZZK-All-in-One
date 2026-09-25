(() => {
  "use strict";
  function higherQualityUrl(value) {
    try {
      const url = new URL(value);
      if (url.protocol !== "https:" || !/(^|\.)(?:navercdn\.com|pstatic\.net|akamaized\.net)$/.test(url.hostname)) return null;
      if (!url.pathname.includes("480p") || !url.pathname.endsWith(".m3u8")) return null;
      url.pathname = url.pathname.replace("480p", "1080p");
      return url.href;
    } catch (_) { return null; }
  }
  const logic = { higherQualityUrl };
  globalThis.HanbiGridLogic = logic;
  if (typeof module !== "undefined") module.exports = logic;
})();
