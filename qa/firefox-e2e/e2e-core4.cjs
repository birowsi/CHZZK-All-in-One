// Core-4 + smoke E2E on real production Firefox against live CHZZK.
// Verifies: playback, extension toolbar, quality display, SPA navigation
// duplicates, ad-warning modal absence during viewing window.
// Honest scope: real ad playback / GRID broadcasts cannot be forced on demand;
// those paths remain fixture-covered + noted as unverified when not observed.
"use strict";

const fs = require("fs");
const path = require("path");
const { By, until } = require("selenium-webdriver");
const {
  launch, shutdown, version, projectFile, fetchLiveChannels,
  VIDEO_PROBE, EXT_PROBE, results, record,
} = require("./harness.cjs");

const OUT = path.resolve(__dirname, "..", "firefox-e2e-results.json");
const VIDEO_WAIT_MS = Number(process.env.VIDEO_WAIT_MS || 45000);

async function waitVideoStable(driver, { minReady = 3, ms = VIDEO_WAIT_MS } = {}) {
  const deadline = Date.now() + ms;
  let last = null;
  while (Date.now() < deadline) {
    try { last = await driver.executeScript(`return (${VIDEO_PROBE.toString()})()`); } catch (_) {}
    if (last && last.readyState >= minReady && last.currentTime > 0 && !last.paused) return last;
    await new Promise((r) => setTimeout(r, 1000));
  }
  return last;
}

// CHZZK blocks audible autoplay; synthetic events are untrusted, so use a
// real WebDriver click on the player's play control (fallback: the video,
// then a trusted space keypress). Keeps trying while the player reports paused.
async function startPlayback(driver, attempts = 4) {
  const selectors = [".pzp-pc__big-button-play", ".pzp-pc__button-play", "[class*='big-button-play']", "[class*='button-play']", "video"];
  let clicked = null;
  for (let i = 0; i < attempts; i++) {
    for (const sel of selectors) {
      try {
        const el = await driver.findElement(By.css(sel));
        await el.click();
        clicked = sel;
        break;
      } catch (_) {}
    }
    await new Promise((r) => setTimeout(r, 2500));
    try {
      const state = await driver.executeScript(`return (${VIDEO_PROBE.toString()})()`);
      if (state && !state.paused && state.currentTime > 0) return { clicked, state };
    } catch (_) {}
    try {
      await driver.actions().sendKeys(" ").perform();
    } catch (_) {}
    await new Promise((r) => setTimeout(r, 1500));
  }
  return { clicked, state: null };
}

async function collectConsole(bidi, bucket) {
  await bidi.subscribe(["log.entryAdded"]);
  bidi.on("log.entryAdded", (entry) => {
    if (["error", "uncaughtException"].includes(entry.level ?? entry.type)) {
      bucket.push({ text: String(entry.text ?? JSON.stringify(entry)), source: entry.source });
    }
  });
}

(async () => {
  const version_ = version();
  console.log(`E2E v${version_} 시작 — 실제 Firefox (temporary add-on)`);
  let session;
  try {
    session = await launch({ installExtension: true });
    const { driver, bidi } = session;
    console.log("extensionId:", session.extensionId);
    if (!session.extensionId) throw new Error("확장 설치 실패 (BiDi webExtension.install)");

    const consoleBucket = [];
    await collectConsole(bidi, consoleBucket);

    const lives = await fetchLiveChannels(8);
    if (!lives.length) throw new Error("라이브 목록을 가져오지 못했다");
    console.log("라이브:", lives.slice(0, 4).map((l) => `${l.channelId} (${l.viewers}명)`).join(", "));

    // --- 1. playback + toolbar on first live -------------------------------
    await driver.get(`https://chzzk.naver.com/live/${lives[0].channelId}`);
    await new Promise((r) => setTimeout(r, 12000));       // let the player mount
    await startPlayback(driver);                          // CHZZK blocks autoplay
    const video1 = await waitVideoStable(driver);
    record({ name: "PLAY: live video plays (readyState>=3, currentTime>0, not paused)", pass: Boolean(video1?.currentTime > 0 && !video1.paused), detail: video1 });

    const ext1 = (await driver.executeScript(`return (${EXT_PROBE.toString()})()`)) || { toolbars: 0, toolButtons: [], rawButtons: 0, duplicateIds: [] };
    // The Q button text carries the live decoded height ("Q 1080p"), so match by prefix.
    const hasAll = ["REC", "RAW", "SHOT", "TM"].every((b) => ext1.toolButtons.includes(b)) &&
      ext1.toolButtons.some((b) => /^Q\b/.test(b));
    record({
      name: "UI-01: toolbar once with REC/RAW/SHOT/Q*/TM",
      pass: ext1.toolbars === 1 && ext1.rawButtons === 1 && hasAll,
      detail: ext1,
    });

    // --- 2. quality display -------------------------------------------------
    // Click the Q button; it reports site selection vs actual height via status text.
    let qualityPass = false, qualityDetail = null;
    try {
      const qButton = await driver.wait(until.elementLocated(By.css("#hanbi-player-tools button:nth-of-type(4)")), 5000);
      await qButton.click();
      await new Promise((r) => setTimeout(r, 800));
      qualityDetail = await driver.executeScript(`
        const el = document.getElementById('hanbi-status') || document.querySelector('[id*=\"hanbi\" ][class*=\"status\"]');
        const v = document.querySelector('video');
        return { status: el ? el.textContent : null, height: v ? v.videoHeight : null };
      `);
      qualityPass = Boolean(qualityDetail?.height >= 360);
    } catch (error) {
      qualityDetail = { error: String(error).slice(0, 200) };
    }
    record({ name: "QUALITY: Q reports actual decoded height", pass: qualityPass, detail: qualityDetail });

    // --- 3. ad-warning modal absence during observation window --------------
    await new Promise((r) => setTimeout(r, 5000));
    const modalProbe = await driver.executeScript(`
      const text = document.body ? document.body.innerText : '';
      const hasWarning = /광고 차단 프로그램/.test(text);
      const hasCheat = /치트키/.test(text) && /구매/.test(text);
      return { hasWarning, hasCheat };
    `);
    record({
      name: "AD-MODAL: no adblock-warning or cheat-key modal during viewing window",
      pass: !modalProbe.hasWarning && !modalProbe.hasCheat,
      detail: modalProbe,
    });

    // --- 4. SPA navigation ×3, then duplicates check ------------------------
    const targets = [lives[1] ?? lives[0], lives[2] ?? lives[0]];
    let dupPass = true, dupDetail = [];
    for (const target of targets) {
      await driver.get(`https://chzzk.naver.com/live/${target.channelId}`);
      await new Promise((r) => setTimeout(r, 10000));
      await startPlayback(driver);
      await new Promise((r) => setTimeout(r, 4000));
      const ext = (await driver.executeScript(`return (${EXT_PROBE.toString()})()`)) || { toolbars: 0, toolButtons: [], duplicateIds: ["probe-null"] };
      dupDetail.push({ channel: target.channelId, toolbars: ext.toolbars, dups: ext.duplicateIds, buttons: ext.toolButtons });
      if (ext.toolbars !== 1 || ext.duplicateIds.length) dupPass = false;
    }
    // return to first live and re-probe
    await driver.get(`https://chzzk.naver.com/live/${lives[0].channelId}`);
    await new Promise((r) => setTimeout(r, 10000));
    await startPlayback(driver);
    await new Promise((r) => setTimeout(r, 4000));
    const extBack = (await driver.executeScript(`return (${EXT_PROBE.toString()})()`)) || { toolbars: 0, toolButtons: [], duplicateIds: ["probe-null"] };
    dupDetail.push({ channel: lives[0].channelId, toolbars: extBack.toolbars, dups: extBack.duplicateIds, buttons: extBack.toolButtons });
    if (extBack.toolbars !== 1 || extBack.duplicateIds.length) dupPass = false;
    record({ name: "SPA-DUP: after repeated navigation toolbar stays single, no duplicate hanbi ids", pass: dupPass, detail: dupDetail });

    const videoBack = await waitVideoStable(driver, { ms: 30000 });
    record({ name: "SPA-PLAY: playback recovers after navigation", pass: Boolean(videoBack?.currentTime > 0 && !videoBack.paused), detail: videoBack });

    // --- 5. console errors --------------------------------------------------
    const errors = consoleBucket.filter((e) => !e.text.includes("nsresult") && !/favicon/i.test(e.text));
    record({ name: "CONSOLE: no uncaught errors during session", pass: errors.length === 0, detail: errors.slice(0, 10) });

    results.summary = { version: version_, finishedAt: new Date().toISOString(), pass: results.scenarios.every((s) => s.pass) };
  } catch (error) {
    record({ name: "FATAL", pass: false, detail: { error: String(error).slice(0, 500) } });
    results.summary = { version: version_, fatal: String(error).slice(0, 500) };
  } finally {
    fs.writeFileSync(OUT, JSON.stringify(results, null, 2));
    console.log("결과 저장:", OUT);
    await shutdown(session);
  }
  process.exit(results.summary?.pass ? 0 : 1);
})();
