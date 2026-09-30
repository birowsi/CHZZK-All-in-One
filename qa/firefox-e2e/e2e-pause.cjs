// 1.1.15 pause-buffer E2E: pausing a live (no TM panel) must keep loading
// fragments — currentTime frozen while buffered.end advances — and resume
// from the paused point. QA-CHECKLIST section 25, item added with 1.1.15.
"use strict";

const fs = require("fs");
const path = require("path");
const { By } = require("selenium-webdriver");
const { launch, shutdown, fetchLiveChannels, results, record, version } = require("./harness.cjs");

const label = (process.env.RUN_LABEL || '').replace(/[^a-z0-9-]/gi, '');
const OUT = path.resolve(__dirname, "..", `firefox-e2e-pause-results-${version()}${label ? '-'+label : ''}.json`);
const PAUSE_MS = Number(process.env.PAUSE_MINUTES || 6) * 60 * 1000;
const tmSource = fs.readFileSync(path.resolve(__dirname, '../../timeshift.js'), 'utf8');
const FIND_HLS = 'const hlsOwners = new WeakMap();\n' + tmSource.slice(tmSource.indexOf('  function findHls('), tmSource.indexOf('  function mediaCandidates('));

const PROBE = () => {
  const vs = Array.from(document.querySelectorAll("#live_player_layout video"));
  const v = vs.find((x) => x.videoHeight >= 360 && !x.closest('#preAdPlayerWrapper, #midAdPlayerWrapper'));
  if (!v) return null;
  const roots = [document.getElementById('live_player_layout'), v.closest('pzp-player'), v.parentElement];
  const hls = roots.map(findHls).find(Boolean);
  if(hls && window.__qaPauseHls !== hls) {
    window.__qaPauseHls = hls;
    window.__qaPauseErrors = [];
    hls.on('hlsError', (_, error) => {
      if(window.__qaPauseErrors.length < 30) window.__qaPauseErrors.push({details:error.details, fatal:error.fatal, name:error.error?.name, at:v.currentTime});
    });
  }
  return { ct: v.currentTime, paused: v.paused, be: v.buffered.length ? v.buffered.end(v.buffered.length - 1) : 0, bs: v.buffered.length ? v.buffered.start(0) : 0, h: v.videoHeight, rs: v.readyState,
    hls: hls && { maxBufferLength:hls.config.maxBufferLength, maxMaxBufferLength:hls.config.maxMaxBufferLength, state:hls.streamController.state, loading:hls.loadingEnabled, buffering:hls.bufferingEnabled }, errors:window.__qaPauseErrors || [] };
};

async function probe(driver) {
  try { return await driver.executeScript(`${FIND_HLS}\nreturn (${PROBE.toString()})()`); } catch (_) { return null; }
}

async function pressSpace(driver) {
  try { await driver.actions().sendKeys(" ").perform(); } catch (_) {}
}

(async () => {
  console.log("PAUSE-BUFFER E2E 시작");
  let session;
  try {
    session = await launch({ installExtension: true, headless: process.env.HEADLESS === '1' });
    const { driver } = session;
    results.environment = { version: version(), browserVersion:(await driver.getCapabilities()).get('browserVersion'), pauseMs:PAUSE_MS, headless:process.env.HEADLESS === '1' };

    const lives = await fetchLiveChannels(20);
    if (!lives.length) throw new Error("라이브 목록 없음");
    await driver.get(`https://chzzk.naver.com/live/${lives[0].channelId}`);
    await new Promise((r) => setTimeout(r, 12000));

    // start playback
    for (const sel of [".pzp-pc__big-button-play", "[class*='big-button-play']", "video"]) {
      try { await driver.findElement(By.css(sel)).click(); break; } catch (_) {}
    }
    let p = await probe(driver);
    for (let i = 0; i < 6 && (!p || p.paused); i++) {
      await pressSpace(driver);
      await new Promise((r) => setTimeout(r, 2500));
      p = await probe(driver);
    }
    if (!p || p.paused) throw new Error("재생 시작 실패");
    console.log("재생 시작:", JSON.stringify(p));
    await new Promise((r) => setTimeout(r, 5000));

    // pause via trusted space keypress (pzp keyboard shortcut)
    const before = await probe(driver);
    await pressSpace(driver);
    await new Promise((r) => setTimeout(r, 2000));
    const pausedState = await probe(driver);
    if (!pausedState?.paused) {
      await pressSpace(driver);
      await new Promise((r) => setTimeout(r, 2000));
    }
    const pausePoint = await probe(driver);
    record({
      name: "PAUSE: video pauses via keyboard",
      pass: Boolean(pausePoint?.paused),
      detail: pausePoint,
    });

    if (pausePoint?.paused) {
      // sample during pause: currentTime must stay, buffered.end must advance
      const samples = [];
      const deadline = Date.now() + PAUSE_MS;
      while (Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, 15000));
        const s = await probe(driver);
        if (s) samples.push({ t: Date.now() - deadline + PAUSE_MS, ...s });
        process.stdout.write(`\r일시정지 관찰 ${Math.round((1 - (deadline - Date.now()) / PAUSE_MS) * 100)}%  `);
      }
      console.log();
      const first = samples[0], last = samples[samples.length - 1];
      const ctStable = samples.every(s => s.paused && Math.abs(s.ct - pausePoint.ct) < 1.5);
      // A single startup burst followed by minutes of no loading must fail.
      const tail = samples[Math.max(0, samples.length - 4)];
      const quotaHit = last.errors?.some(error => error.details === 'bufferFullError') === true;
      const beAdvanced = samples.length >= 3 && !quotaHit &&
        last.be - first.be > (last.t - first.t) / 1000 * 0.7 &&
        last.be - tail.be > (last.t - tail.t) / 1000 * 0.7;
      record({
        name: "PAUSE-BUFFER: currentTime frozen while buffered.end advances (no TM panel)",
        pass: ctStable && beAdvanced,
        detail: { pausePoint, first, last, samples, ctStable, beAdvanced, quotaHit },
      });

      // resume: must start from the paused point, not the live edge
      await pressSpace(driver);
      await new Promise((r) => setTimeout(r, 2500));
      let resumed = await probe(driver);
      for (let i = 0; i < 4 && (!resumed || resumed.paused); i++) {
        await pressSpace(driver);
        await new Promise((r) => setTimeout(r, 2000));
        resumed = await probe(driver);
      }
      const resumed2 = await probe(driver);
      const resumedFromPause = resumed2 ? resumed2.ct > pausePoint.ct && resumed2.ct < pausePoint.ct + 12 : false;
      record({
        name: "PAUSE-RESUME: playback resumes from the paused point",
        pass: Boolean(resumed2 && !resumed2.paused && resumedFromPause),
        detail: { pausePoint, resumed: resumed2, resumedFromPause },
      });
    }

    results.summary = { finishedAt: new Date().toISOString(), pass: results.scenarios.every((s) => s.pass) };
    if(process.env.CHECK_XPI === '1') {
      await session.bidi.send('webExtension.uninstall', { extension:session.extensionId });
      const archive = path.resolve(__dirname, '../../dist', `chzzk-all-in-one-firefox-v${version()}.xpi`);
      const installed = await session.bidi.send('webExtension.install', { extensionData:{type:'archivePath',path:archive} });
      const installResult = {version:version(), browserVersion:results.environment.browserVersion, extension:installed.extension, temporary:true, success:true};
      fs.writeFileSync(path.resolve(__dirname, '..', `firefox-xpi-install-${version()}.json`), JSON.stringify(installResult,null,2));
      console.log('XPI temporary install',JSON.stringify(installResult));
    }
  } catch (error) {
    record({ name: "FATAL", pass: false, detail: { error: String(error).slice(0, 400) } });
    results.summary = { fatal: String(error).slice(0, 400) };
  } finally {
    fs.writeFileSync(OUT, JSON.stringify(results, null, 2));
    console.log("저장:", OUT);
    await shutdown(session);
    process.exit(results.summary?.pass === true ? 0 : 1);
  }
})();
