// Firefox E2E harness for CHZZK All-in-One.
// Uses real production Firefox + geckodriver + WebDriver BiDi webExtension.install
// (temporary add-on install, release-Firefox compatible since Firefox 128).
// The extension is installed per-session into a throwaway profile; the user's
// real Firefox profile is never touched.
"use strict";

const fs = require("fs");
const path = require("path");
const http = require("http");
const { Builder, Browser, until, By } = require("selenium-webdriver");
const geckodriverModule = require("geckodriver");
const geckodriverPath = typeof geckodriverModule === "string" ? geckodriverModule : geckodriverModule.path;
const { spawn } = require("child_process");

const FIREFOX = "C:/Program Files/Mozilla Firefox/firefox.exe";
const GECKODRIVER_PORT = Number(process.env.GECKODRIVER_PORT || 4444);
// BiDi websocket port is auto-assigned via --websocket-port 0.

// selenium-webdriver 4.49 CJS/ESM dual-loading breaks instanceof checks for
// firefox.ServiceBuilder, so we manage geckodriver ourselves and attach via
// usingServer instead of setFirefoxService.
async function startGeckodriver() {
  // --websocket-port 0: auto-assign a free BiDi port; read the assigned URL
  // from the session's webSocketUrl capability (a fixed default like 9222 can
  // collide with other software on the machine).
  const proc = spawn(geckodriverPath, ["--port", String(GECKODRIVER_PORT), "--websocket-port", "0"], { stdio: ["ignore", "pipe", "pipe"] });
  let output = "";
  proc.stdout.on("data", (d) => { output += d; });
  proc.stderr.on("data", (d) => { output += d; });
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    if (proc.exitCode !== null || proc.signalCode) throw new Error("geckodriver 조기 종료 (code " + proc.exitCode + "):\n" + output);
    try {
      const res = await fetch(`http://127.0.0.1:${GECKODRIVER_PORT}/status`);
      if (res.ok) return proc;
    } catch (_) {}
    await new Promise((r) => setTimeout(r, 300));
  }
  proc.kill();
  throw new Error("geckodriver 기동 실패:\n" + output);
}

function projectFile(rel) {
  return path.resolve(__dirname, "..", "..", rel);
}

class BiDi {
  constructor(ws) { this.ws = ws; this.nextId = 1; this.waiters = new Map(); }
  static async connect(url) {
    const ws = new WebSocket(url);
    await new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error("BiDi WebSocket 연결 시간 초과: " + url)), 20000);
      ws.onopen = () => { clearTimeout(t); resolve(); };
      ws.onerror = () => { clearTimeout(t); reject(new Error("BiDi WebSocket 연결 실패: " + url)); };
    });
    const bidi = new BiDi(ws);
    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id !== undefined && bidi.waiters.has(msg.id)) {
        const { resolve, reject } = bidi.waiters.get(msg.id);
        bidi.waiters.delete(msg.id);
        if (msg.type === "error") reject(new Error(`${msg.error}: ${msg.message}`));
        else resolve(msg.result);
      }
    };
    return bidi;
  }
  send(method, params = {}) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.waiters.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
      setTimeout(() => {
        if (this.waiters.has(id)) { this.waiters.delete(id); reject(new Error("BiDi 응답 시간 초과: " + method)); }
      }, 30000);
    });
  }
  async subscribe(events, contexts) {
    await this.send("session.subscribe", { events, contexts });
  }
  on(method, handler) {
    this.ws.addEventListener("message", (event) => {
      const msg = JSON.parse(event.data);
      if (msg.method === method) handler(msg.params);
    });
  }
  close() { try { this.ws.close(); } catch (_) {} }
}

async function launch({ installExtension = true, headless = false } = {}) {
  const geckoProc = await startGeckodriver();
  const args = ["-width", "1600", "-height", "1000"];
  const prefs = {
    "media.volume_scale": "0",  // never blast audio during QA
    "app.update.enabled": false,
    "datareporting.policy.dataSubmissionEnabled": false,
    "toolkit.telemetry.enabled": false,
    "browser.shell.checkDefaultBrowser": false,
    "browser.startup.homepage_override.mstone": "ignore",
  };
  const mozOptions = { binary: FIREFOX, args, prefs };
  if (headless) mozOptions.args.push("-headless");

  const capabilities = {
    browserName: "firefox",
    webSocketUrl: true,  // required: geckodriver only exposes BiDi when requested
    "moz:firefoxOptions": mozOptions,
  };

  const driver = await new Builder()
    .forBrowser(Browser.FIREFOX)
    .usingServer(`http://127.0.0.1:${GECKODRIVER_PORT}`)
    .withCapabilities(capabilities)
    .build();

  const session = await driver.getSession();
  const wsUrl = session.getCapabilities().get("webSocketUrl");
  if (!wsUrl) throw new Error("webSocketUrl capability를 받지 못했다 (geckodriver/Firefox BiDi 미지원)");
  const bidi = await BiDi.connect(wsUrl);

  let extensionId = null;
  if (installExtension) {
    // Install the unpacked project root (contains manifest.json): tests the
    // exact working tree. Note: BiDi archivePath install of the bsdtar-built
    // XPI fails with nsIZipReader.open on Firefox 156 — see qa report.
    const root = path.resolve(__dirname, "..", "..");
    const result = await bidi.send("webExtension.install", {
      extensionData: { type: "path", path: root },
    });
    extensionId = result?.extension ?? null;
  }
  return { driver, bidi, geckoProc, extensionId };
}

function version() {
  return JSON.parse(fs.readFileSync(projectFile("manifest.json"), "utf8")).version;
}

async function shutdown(session) {
  if (!session) return;
  try { session.bidi?.close(); } catch (_) {}
  try { await session.driver?.quit(); } catch (_) {}
  try { session.geckoProc?.kill(); } catch (_) {}
}

// CHZZK helpers -----------------------------------------------------------

async function fetchLiveChannels(size = 8) {
  const res = await fetch(`https://api.chzzk.naver.com/service/v1/lives?size=${size}`, {
    headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:140.0) Gecko/20100101 Firefox/140.0", "Accept": "application/json" },
  });
  const body = await res.json();
  return (body?.content?.data ?? [])
    .filter((item) => !item.adult)
    .map((item) => ({
      liveId: item.liveId,
      channelId: item.channelId ?? item.channel?.channelId,
      title: item.liveTitle,
      viewers: item.concurrentUserCount,
    }))
    .filter((item) => item.channelId);
}

// Video/pipeline probes evaluated in the page context ----------------------

const VIDEO_PROBE = () => {
  const videos = Array.from(document.querySelectorAll("video"));
  const main = videos.find((v) => v.videoHeight >= 360 && !v.closest("[class*='ad']")) || videos[0];
  if (!main) return null;
  const q = main.getVideoPlaybackQuality ? main.getVideoPlaybackQuality() : null;
  return {
    count: videos.length,
    currentTime: main.currentTime,
    readyState: main.readyState,
    networkState: main.networkState,
    paused: main.paused,
    videoWidth: main.videoWidth,
    videoHeight: main.videoHeight,
    bufferedEnd: main.buffered.length ? main.buffered.end(main.buffered.length - 1) : 0,
    totalFrames: q?.totalVideoFrames ?? null,
    droppedFrames: q?.droppedVideoFrames ?? null,
    muted: main.muted,
    src: (main.currentSrc || "").slice(0, 90),
  };
};

const EXT_PROBE = () => {
  const q = (sel) => document.querySelectorAll(sel).length;
  const tools = document.getElementById("hanbi-player-tools");
  return {
    toolbars: q("#hanbi-player-tools"),
    rawButtons: q("#hanbi-raw-button"),
    trendBars: q("[id*='hanbi-trend'], [id*='hanbi-trending']"),
    previews: q("[id*='hanbi-shot-preview'], [id*='hanbi-preview-overlay']"),
    toolButtons: tools ? Array.from(tools.querySelectorAll("button")).map((b) => b.textContent.trim()) : [],
    duplicateIds: (() => {
      const seen = new Set(), dups = new Set();
      for (const el of document.querySelectorAll("[id^='hanbi']")) {
        if (seen.has(el.id)) dups.add(el.id);
        seen.add(el.id);
      }
      return Array.from(dups);
    })(),
  };
};

// Frame cadence sampling (page-side rAF). Returns quantiles over the window.
async function sampleFrameCadence(driver, ms) {
  return driver.executeAsyncScript(`
    const done = arguments[arguments.length - 1];
    const budget = ${ms};
    const intervals = [];
    let last = performance.now();
    let raf;
    const tick = (now) => {
      intervals.push(now - last);
      last = now;
      if (now - start < budget) raf = requestAnimationFrame(tick);
      else {
        intervals.sort((a, b) => a - b);
        const at = (p) => intervals[Math.min(intervals.length - 1, Math.floor(p * intervals.length))];
        const hitches = intervals.filter((i) => i > 50).length;
        done({ n: intervals.length, p50: at(0.5), p95: at(0.95), p99: at(0.99), hitches });
      }
    };
    const start = performance.now();
    raf = requestAnimationFrame(tick);
  `);
}

// Firefox process metrics via PowerShell (aggregate all firefox.exe processes).
function firefoxProcessSnapshot() {
  const { execFileSync } = require("child_process");
  try {
    const out = execFileSync("powershell.exe", [
      "-NoProfile", "-Command",
      "Get-Process firefox -ErrorAction SilentlyContinue | Measure-Object -Sum -Property @{Expression={[long]$_.WorkingSet64}} | Select-Object -ExpandProperty Sum",
    ], { timeout: 20000 }).toString().trim();
    return { workingSetBytes: Number(out) || 0 };
  } catch (_) {
    return { workingSetBytes: 0 };
  }
}

const results = { scenarios: [], consoleErrors: [] };
function record(scenario) {
  results.scenarios.push(scenario);
  const tag = scenario.pass ? "PASS" : "FAIL";
  console.log(`${tag} ${scenario.name}` + (scenario.detail ? ` — ${JSON.stringify(scenario.detail).slice(0, 400)}` : ""));
}

module.exports = {
  BiDi, launch, shutdown, version, projectFile,
  fetchLiveChannels, VIDEO_PROBE, EXT_PROBE, sampleFrameCadence,
  firefoxProcessSnapshot, results, record,
  By, until,
};
