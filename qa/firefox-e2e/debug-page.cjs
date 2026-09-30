// Debug: page state after navigating to a live channel.
"use strict";
const { launch, shutdown, fetchLiveChannels } = require("./harness.cjs");

(async () => {
  let session;
  try {
    session = await launch({ installExtension: true });
    const { driver } = session;
    const lives = await fetchLiveChannels(4);
    console.log("lives:", JSON.stringify(lives.map((l) => l.channelId)));
    await driver.get(`https://chzzk.naver.com/live/${lives[0].channelId}`);
    await new Promise((r) => setTimeout(r, 20000));
    const state = await driver.executeScript(`
      return {
        url: location.href,
        title: document.title,
        videos: Array.from(document.querySelectorAll('video')).map(v => ({
          src: (v.currentSrc || '').slice(0, 60), readyState: v.readyState, paused: v.paused,
          w: v.videoWidth, h: v.videoHeight, cls: v.className.slice(0, 50),
        })),
        hanbi: {
          toolbars: document.querySelectorAll('#hanbi-player-tools').length,
          buttons: Array.from(document.querySelectorAll('#hanbi-player-tools button')).map(b => b.textContent.trim()),
        },
        bodySnippet: (document.body.innerText || '').replace(/\\s+/g, ' ').slice(0, 300),
        console: window.__errors || null,
      };
    `);
    console.log(JSON.stringify(state, null, 2));
  } catch (error) {
    console.error("FATAL:", String(error).slice(0, 600));
  } finally {
    await shutdown(session);
    process.exit(0);
  }
})();
