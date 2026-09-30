// Performance run: baseline (extension off) vs ON (extension installed) on the
// same live channel. Usage: node perf-run.cjs <off|on> [minutes]
// Writes qa/perf-<mode>.json with video/frame/process/network metrics.
"use strict";

const fs = require("fs");
const path = require("path");
const { launch, shutdown, fetchLiveChannels, sampleFrameCadence, firefoxProcessSnapshot, results } = require("./harness.cjs");

const MODE = process.argv[2] === "on" ? "on" : "off";
const MINUTES = Number(process.argv[3] || Number(process.env.PERF_MINUTES || 10));
const OUT = path.resolve(__dirname, "..", `perf-${MODE}.json`);

const VIDEO_SAMPLER = `
  const done = arguments[arguments.length - 1];
  const budget = arguments[0];
  const samples = [];
  const probe = () => {
    const vs = Array.from(document.querySelectorAll('video'));
    const v = vs.find(x => x.videoHeight >= 360 && !x.closest("[class*='ad']")) || vs[0];
    if (v) {
      const q = v.getVideoPlaybackQuality ? v.getVideoPlaybackQuality() : null;
      samples.push({ t: Date.now(), ct: +v.currentTime.toFixed(3), rs: v.readyState, paused: v.paused,
        be: v.buffered.length ? +v.buffered.end(v.buffered.length - 1).toFixed(3) : 0,
        w: v.videoWidth, h: v.videoHeight,
        tf: q ? q.totalVideoFrames : null, df: q ? q.droppedVideoFrames : null });
    }
  };
  const iv = setInterval(probe, 1000);
  probe();
  setTimeout(() => { clearInterval(iv); done(samples); }, budget);
`;

const HANBI_DOM = () => ({
  hanbiNodes: document.querySelectorAll("[id^='hanbi']").length,
  toolbars: document.querySelectorAll("#hanbi-player-tools").length,
  duplicateIds: (() => {
    const seen = new Set(), dups = new Set();
    for (const el of document.querySelectorAll("[id^='hanbi']")) {
      if (seen.has(el.id)) dups.add(el.id);
      seen.add(el.id);
    }
    return Array.from(dups);
  })(),
});

async function ensurePlayback(driver) {
  const { By } = require("selenium-webdriver");
  for (let i = 0; i < 4; i++) {
    for (const sel of [".pzp-pc__big-button-play", ".pzp-pc__button-play", "[class*='big-button-play']", "[class*='button-play']", "video"]) {
      try { await driver.findElement(By.css(sel)).click(); break; } catch (_) {}
    }
    await new Promise((r) => setTimeout(r, 2500));
    try {
      const v = await driver.executeScript(`const vs=document.querySelectorAll('video'); const v=vs[0]; return v?{paused:v.paused,ct:v.currentTime}:null`);
      if (v && !v.paused && v.ct > 0) return true;
    } catch (_) {}
    try { await driver.actions().sendKeys(" ").perform(); } catch (_) {}
  }
  return false;
}

// CPU/memory must only cover the QA Firefox, not the user's own browser.
// Snapshot the firefox PIDs that exist before the QA session; everything new
// is ours. (Content processes spawn dynamically, so re-diff each sample.)
const BASELINE_PIDS = new Set(
  require("child_process").execFileSync("powershell.exe", ["-NoProfile", "-Command",
    "(Get-Process firefox -ErrorAction SilentlyContinue).Id"], { timeout: 20000 }).toString().trim().split(/\r?\n/).filter(Boolean),
);

function cpuSeconds() {
  const { execFileSync } = require("child_process");
  try {
    const raw = execFileSync("powershell.exe", ["-NoProfile", "-Command",
      "Get-Process firefox -ErrorAction SilentlyContinue | ForEach-Object { \"\$(\$_.Id) \$(\$_.TotalProcessorTime.TotalSeconds) \$(\$_.WorkingSet64)\" }"], { timeout: 30000 }).toString().trim().split(/\r?\n/).filter(Boolean);
    let cpu = 0, ws = 0;
    for (const line of raw) {
      const [pid, cpuS, wsB] = line.split(" ");
      if (BASELINE_PIDS.has(pid)) continue;
      cpu += Number(cpuS) || 0;
      ws += Number(wsB) || 0;
    }
    return { cpuSeconds: cpu, workingSetBytes: ws, qaProcessCount: raw.length - BASELINE_PIDS.size };
  } catch (_) { return { cpuSeconds: 0, workingSetBytes: 0, qaProcessCount: 0 }; }
}

(async () => {
  console.log(`PERF mode=${MODE} minutes=${MINUTES}`);
  let session;
  try {
    session = await launch({ installExtension: MODE === "on" });
    const { driver, bidi } = session;
    await driver.manage().setTimeouts({ script: (MINUTES * 60 + 120) * 1000 });

    // network counting via BiDi
    const netCounts = new Map();
    await bidi.subscribe(["network.responseCompleted"]);
    bidi.on("network.responseCompleted", (params) => {
      const url = params?.request?.url ?? params?.context ?? "";
      const m = String(url).match(/^https:\/\/([^/]+)\/([^?]*)/);
      if (!m) return;
      const host = m[1];
      if (!/chzzk|naver/.test(host)) return;
      const key = host;
      netCounts.set(key, (netCounts.get(key) ?? 0) + 1);
    });

    const lives = await fetchLiveChannels(20);
    if (!lives.length) throw new Error("라이브 목록 없음");
    // Pin the channel across the off/on pair when CHZZK_CHANNEL_ID is set.
    // Widen the fetch so a mid-viewership pinned channel is actually found.
    const pinned = process.env.CHZZK_CHANNEL_ID;
    const channel = lives.find((l) => l.channelId === pinned) ?? lives[0];
    console.log("대상 채널:", channel.channelId, channel.title);

    await driver.get(`https://chzzk.naver.com/live/${channel.channelId}`);
    await new Promise((r) => setTimeout(r, 12000));
    const playing = await ensurePlayback(driver);
    if (!playing) throw new Error("재생 시작 실패");

    const startProc = cpuSeconds();
    const startedAt = Date.now();
    const chunks = [], cadence = [], procSeries = [{ ...startProc, t: startedAt }];
    const netStart = new Map(netCounts);
    let domSeries = [];

    const totalMs = MINUTES * 60 * 1000;
    let elapsed = 0;
    while (elapsed < totalMs) {
      const windowMs = Math.min(60_000, totalMs - elapsed);
      const samples = await driver.executeAsyncScript(VIDEO_SAMPLER, windowMs);
      chunks.push(samples);
      // frame cadence 3×10s: first/third/fifth minute window
      const cadenceDone = cadence.length;
      if ((cadenceDone === 0 && elapsed >= totalMs * 0.08) || (cadenceDone === 1 && elapsed >= totalMs * 0.45) || (cadenceDone === 2 && elapsed >= totalMs * 0.85)) {
        try { cadence.push({ at: Date.now(), ...(await sampleFrameCadence(driver, 10_000)) }); } catch (_) {}
      }
      elapsed += windowMs;
      const proc = cpuSeconds();
      procSeries.push({ ...proc, t: Date.now() });
      try { domSeries.push(await driver.executeScript(`return (${HANBI_DOM.toString()})()`)); } catch (_) {}
      const pct = Math.round((elapsed / totalMs) * 100);
      process.stdout.write(`\r진행 ${pct}%  `);
    }
    console.log();

    const samples = chunks.flat();
    const playingSamples = samples.filter((s) => !s.paused);
    const stalls = [];
    for (let i = 1; i < playingSamples.length; i++) {
      const gapMs = playingSamples[i].t - playingSamples[i - 1].t;
      const advanceS = playingSamples[i].ct - playingSamples[i - 1].ct;
      // 1x playback advances ~1s per 1s of wall time; flag real stalls only.
      if (gapMs > 5000 || advanceS < (gapMs / 1000) * 0.4) stalls.push({ at: playingSamples[i].t, gapMs, advanceS });
    }
    const endProc = procSeries[procSeries.length - 1];
    const netDelta = {};
    for (const [k, v] of netCounts) {
      const d = v - (netStart.get(k) ?? 0);
      if (d > 0) netDelta[k] = d;
    }
    const cad = (arr, key) => { const s = arr.map((x) => x[key]).filter(Number.isFinite).sort((a, b) => a - b); return s.length ? { p50: s[Math.floor(s.length * 0.5)], p95: s[Math.floor(s.length * 0.95)], p99: s[Math.floor(s.length * 0.99)] } : null; };
    const allIntervals = [];
    for (const c of cadence) { /* per-window stats already reduced */ }

    results.summary = {
      mode: MODE,
      channel: { id: channel.channelId, title: channel.title },
      minutes: MINUTES,
      startedAt: new Date(startedAt).toISOString(),
      finishedAt: new Date().toISOString(),
      playback: {
        sampleCount: samples.length,
        pausedSampleCount: samples.length - playingSamples.length,
        stallCount: stalls.length,
        stalls: stalls.slice(0, 10),
        startHeight: samples[0]?.h ?? null,
        endHeight: samples[samples.length - 1]?.h ?? null,
        droppedFrames: samples.length && samples[samples.length - 1].df !== null ? samples[samples.length - 1].df - (samples.find((s) => s.df !== null)?.df ?? 0) : null,
        currentTimeStart: samples[0]?.ct ?? null,
        currentTimeEnd: samples[samples.length - 1]?.ct ?? null,
      },
      frameCadence: { windows: cadence, p50: cad(cadence, "p50")?.p50, p95: cad(cadence, "p95")?.p95, p99: cad(cadence, "p99")?.p99, hitchWindows: cadence.filter((c) => c.hitches > 0).length },
      process: {
        cpuSecondsStart: startProc.cpuSeconds,
        cpuSecondsEnd: endProc.cpuSeconds,
        cpuSecondsDelta: +(endProc.cpuSeconds - startProc.cpuSeconds).toFixed(1),
        avgCpuPercent: +(((endProc.cpuSeconds - startProc.cpuSeconds) / (MINUTES * 60)) * 100).toFixed(1),
        workingSetStartMB: Math.round(startProc.workingSetBytes / 1048576),
        workingSetEndMB: Math.round(endProc.workingSetBytes / 1048576),
        workingSetDeltaMB: Math.round((endProc.workingSetBytes - startProc.workingSetBytes) / 1048576),
      },
      network: netDelta,
      dom: {
        hanbiNodesStart: domSeries[0]?.hanbiNodes ?? null,
        hanbiNodesEnd: domSeries[domSeries.length - 1]?.hanbiNodes ?? null,
        maxHanbiNodes: Math.max(0, ...domSeries.map((d) => d.hanbiNodes)),
        duplicateIds: [...new Set(domSeries.flatMap((d) => d.duplicateIds))],
      },
      sampleVideoSeries: samples.filter((_, i) => i % 15 === 0),  // 15s-빈도 축약본
      procSeries,
    };
  } catch (error) {
    results.summary = { mode: MODE, fatal: String(error).slice(0, 500) };
  } finally {
    fs.writeFileSync(OUT, JSON.stringify(results, null, 2));
    console.log("저장:", OUT);
    await shutdown(session);
    process.exit(0);
  }
})();
