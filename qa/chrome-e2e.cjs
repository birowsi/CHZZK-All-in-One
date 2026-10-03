// Run with the already installed Playwright runtime and CHROME_QA_EXECUTABLE.
const { chromium } = require('playwright');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const version = require('../manifest.json').version;
const extension = path.join(root, 'dist', `chzzk-all-in-one-chrome-v${version}`);
const report = { version, checks: {}, errors: [], browser: '', live: null, playlists: [] };
(async () => {
  const profile = await fs.mkdtemp(path.join(os.tmpdir(), 'hanbi-chrome-qa-'));
  let context;
  try {
    context = await chromium.launchPersistentContext(profile, {
      executablePath: process.env.CHROME_QA_EXECUTABLE,
      channel: 'chromium',
      headless: true,
      ignoreDefaultArgs: ['--disable-extensions'],
      args: [`--load-extension=${extension}`, `--disable-extensions-except=${extension}`],
    });
    report.browser = context.browser().version();
    context.on('console', message => { if (message.type() === 'error' && !message.text().includes('Failed to load resource') && !message.text().includes('browser is shutting down')) report.errors.push(message.text().slice(0, 300)); });
    const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker', { timeout: 15000 });
    const id = new URL(worker.url()).hostname;
    const popup = await context.newPage();
    await popup.goto(`chrome-extension://${id}/index.html`);
    await popup.addScriptTag({ url: `chrome-extension://${id}/recording-transport.js` });
    assert.equal(await popup.evaluate(() => chrome.runtime.getManifest().version), version);
    report.checks.extensionLoaded = true;
    if (!process.env.CHROME_QA_LIVE_ONLY) {
    const result = await popup.evaluate(async () => {
      const canvas = document.createElement('canvas'); canvas.width = 320; canvas.height = 180;
      const ctx = canvas.getContext('2d');
      const stream = canvas.captureStream(30);
      const audio = new AudioContext(); await audio.resume();
      const oscillator = audio.createOscillator(), output = audio.createMediaStreamDestination();
      oscillator.connect(output); oscillator.start(); stream.addTrack(output.stream.getAudioTracks()[0]);
      const recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp8,opus' });
      const chunks = [];
      const done = new Promise(resolve => { recorder.ondataavailable = event => chunks.push(event.data); recorder.onstop = resolve; });
      const timer = setInterval(() => { ctx.fillStyle = '#111'; ctx.fillRect(0,0,320,180); ctx.fillStyle = '#00ffa3'; ctx.fillText(String(Date.now()), 20,90); }, 30);
      recorder.start(); await new Promise(resolve => setTimeout(resolve, 1200)); recorder.stop(); await done;
      clearInterval(timer); stream.getTracks().forEach(track => track.stop()); oscillator.stop(); await audio.close();
      const blob = new Blob(chunks, { type: recorder.mimeType });
      const saved = await HanbiRecordingTransport.save(chrome, { blob, mimeType: blob.type, fileName: 'chrome-qa-synthetic', startedAt: Date.now()-1200, stoppedAt: Date.now() });
      const recovered = await HanbiRecordingTransport.read(chrome, saved.id);
      const hash = async file => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', await file.arrayBuffer()))).join(',');
      const equal = await hash(blob) === await hash(recovered.blob);
      const large = new Blob([new Uint8Array(1024 * 1024 + 7).fill(173)], { type: 'video/webm' });
      const largeSaved = await HanbiRecordingTransport.save(chrome, { blob: large, mimeType: large.type, fileName: 'chrome-qa-transfer' });
      const largeRecovered = await HanbiRecordingTransport.read(chrome, largeSaved.id);
      const largeEqual = await hash(large) === await hash(largeRecovered.blob);
      await HanbiRecordingTransport.request(chrome, { type: 'delete-recording', id: largeSaved.id });
      return { id: saved.id, size: blob.size, equal, largeEqual, mimeType: blob.type };
    });
    assert.ok(result.equal && result.largeEqual && result.size > 0);
    report.checks.recordingTransport = result;
    const resultTab = context.pages().find(page => page.url().includes(`record-result.html?id=${result.id}`));
    assert.ok(resultTab);
    await resultTab.waitForFunction(() => document.querySelector('#result-video').readyState >= 2, { timeout: 15000 });
    report.checks.resultVideo = await resultTab.evaluate(() => ({ width: document.querySelector('video').videoWidth, height: document.querySelector('video').videoHeight, status: document.querySelector('#status').textContent }));
    const downloadWait = resultTab.waitForEvent('download', { timeout: 30000 });
    await resultTab.locator('button[data-format="mp4"], #mp4, #convert-mp4').first().click({ timeout: 3000 }).catch(async () => {
      await resultTab.getByRole('button', { name: /MP4/ }).first().click();
    });
    const download = await downloadWait;
    assert.equal(await download.failure(), null);
    report.checks.mp4Download = { name: download.suggestedFilename(), bytes: (await fs.stat(await download.path())).size };
    const mp4Bytes = await fs.readFile(await download.path());
    report.checks.mp4Playback = await popup.evaluate(async bytes => {
      const player = document.createElement('video');
      const url = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: 'video/mp4' }));
      player.src = url;
      await new Promise((resolve, reject) => { player.onloadedmetadata = resolve; player.onerror = () => reject(new Error('MP4 playback failed')); });
      const result = { width: player.videoWidth, height: player.videoHeight, duration: player.duration };
      URL.revokeObjectURL(url); return result;
    }, [...mp4Bytes]);
    assert.equal(report.checks.mp4Playback.width, 320);
    const cdp = await context.newCDPSession(popup);
    await cdp.send('ServiceWorker.enable'); await cdp.send('ServiceWorker.stopAllWorkers');
    const restored = await popup.evaluate(async id => { const data = await HanbiRecordingTransport.read(chrome, id); return data.blob.size; }, result.id);
    assert.equal(restored, result.size);
    report.checks.recordingAfterWorkerRestart = true;
    } else {
      const previous = JSON.parse(await fs.readFile(path.join(__dirname, 'chrome-e2e-results.json'), 'utf8'));
      assert.equal(previous.version, version, 'Core checks must use the current build version');
      report.coreChecksFromPreviousRun = true;
      report.reusedChecks = ['recordingTransport', 'resultVideo', 'mp4Download', 'mp4Playback', 'recordingAfterWorkerRestart'];
      for (const key of report.reusedChecks) {
        assert.ok(previous.checks[key], `Missing prior core check: ${key}`);
        report.checks[key] = previous.checks[key];
      }
    }
    const live = await context.newPage();
    live.on('response', response => {
      const url = new URL(response.url());
      if (url.pathname.endsWith('.m3u8')) report.playlists.push({ source: url.pathname.startsWith('/hanbi-chrome-qa/') ? 'fixture' : 'site', host: url.hostname, quality: url.pathname.match(/(?:^|\/)(1080p|720p|480p|360p)(?:\/|$)/)?.[1] || 'other', status: response.status() });
    });
    await live.goto('https://chzzk.naver.com/', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await live.waitForSelector('a[href^="/live/"]', { timeout: 20000 });
    const livePath = process.env.CHROME_QA_LIVE_PATH || await live.locator('a[href^="/live/"]').evaluateAll(links => {
      const candidates = links.filter(link => link.textContent.trim() && !/아시안|올림픽|중계|스포츠|MBC|KBS|SBS|19세|후방|구독전용/i.test(link.textContent));
      return (candidates[0] || links[0]).getAttribute('href');
    });
    await live.goto('https://chzzk.naver.com' + livePath, { waitUntil: 'domcontentloaded', timeout: 30000 });
    try {
      await live.waitForFunction(() => [...document.querySelectorAll('video')].some(video => video.videoHeight > 0 && video.readyState >= 2 && !video.paused), { timeout: 30000 });
    } catch (error) {
      report.live = await live.evaluate(() => ({ page: location.pathname, title: document.title,
        videos: [...document.querySelectorAll('video')].map(video => ({ width: video.videoWidth, height: video.videoHeight, readyState: video.readyState, paused: video.paused, error: video.error?.code ?? null })),
        notices: [...document.querySelectorAll('[class*="error"], [class*="popup"]')].map(node => node.textContent).filter(Boolean).slice(0,5) }));
      report.gridState = await popup.evaluate(async () => ({ rules: await chrome.declarativeNetRequest.getSessionRules(), failures: (await chrome.storage.session.get('chromeGridFailures')).chromeGridFailures?.length || 0 }));
      throw error;
    }
    const sample = () => live.evaluate(() => [...document.querySelectorAll('video')].filter(video => video.videoHeight > 0).map(video => ({ width: video.videoWidth, height: video.videoHeight, currentTime: video.currentTime, paused: video.paused, error: video.error?.code ?? null })));
    const before = await sample(); await live.waitForTimeout(10000); const after = await sample();
    report.live = { page: livePath, before, after, progressing: after.some((video, i) => video.currentTime > (before[i]?.currentTime ?? Infinity) + 5) };
    assert.ok(report.live.progressing);
    await live.screenshot({ path: path.join(__dirname, 'chrome-live-preview.png') });
    const rules = await popup.evaluate(() => chrome.declarativeNetRequest.getSessionRules());
    assert.ok(rules.some(rule => rule.id === 1000));
    const tabId = await popup.evaluate(async url => (await chrome.tabs.query({ url })).at(-1).id, 'https://chzzk.naver.com' + livePath);
    const matches = await popup.evaluate(async tabId => chrome.declarativeNetRequest.testMatchOutcome({ url: 'https://live.navercdn.com/path/480p/main.m3u8?token=test', type: 'xmlhttprequest', tabId }), tabId);
    assert.ok(matches.matchedRules.some(rule => rule.ruleId === 1000));
    report.checks.gridRuleMatched = true;
    const fixtureUrl = 'https://live.navercdn.com/hanbi-chrome-qa/480p/main.m3u8?token=test';
    const fixtureRequests = [];
    await live.route('https://live.navercdn.com/hanbi-chrome-qa/**', async route => {
      const quality = new URL(route.request().url()).pathname.includes('1080p') ? '1080p' : '480p';
      fixtureRequests.push(quality);
      await route.fulfill({ status: quality === '1080p' ? 403 : 200,
        headers: { 'access-control-allow-origin': '*' }, body: quality });
    });
    const fixtureStatus = await live.evaluate(async url => (await fetch(url)).status, fixtureUrl);
    assert.equal(fixtureStatus, 403);
    await popup.waitForFunction(async () => (await chrome.storage.session.get('chromeGridFailures')).chromeGridFailures?.some(item => item.url.includes('/hanbi-chrome-qa/')), { timeout: 5000 });
    assert.equal(await live.evaluate(async url => (await fetch(url)).status, fixtureUrl), 200);
    assert.deepEqual(fixtureRequests, ['1080p', '480p']);
    report.checks.gridFixtureFallback = { firstStatus: fixtureStatus, retryStatus: 200, requests: fixtureRequests };
    await live.unroute('https://live.navercdn.com/hanbi-chrome-qa/**');
    await live.waitForSelector('#hanbi-player-tools', { timeout: 10000 });
    report.checks.toolbar = await live.locator('#hanbi-player-tools').innerText();
    const rec = live.locator('#hanbi-player-tools button').filter({ hasText: /^REC$/ });
    await rec.click();
    await live.waitForFunction(() => [...document.querySelectorAll('#hanbi-player-tools button')].some(button => button.textContent === 'STOP'), { timeout: 5000 });
    await live.waitForTimeout(2500);
    const realResultPromise = context.waitForEvent('page', { timeout: 15000 });
    await live.locator('video').first().hover();
    await live.locator('#hanbi-player-tools button').filter({ hasText: /^STOP$/ }).first().click();
    const realResult = await realResultPromise;
    await realResult.waitForFunction(() => document.querySelector('#result-video')?.readyState >= 2, { timeout: 20000 });
    await realResult.waitForFunction(() => Number.isFinite(document.querySelector('#result-video').duration), { timeout: 7000 });
    report.checks.liveRecording = await realResult.evaluate(() => ({
      width: document.querySelector('video').videoWidth, height: document.querySelector('video').videoHeight,
      duration: document.querySelector('video').duration, metadata: document.querySelector('#file-meta').textContent,
    }));
    const raw = live.locator('#hanbi-raw-button');
    await live.evaluate(() => {
      window.__hanbiQaRaw = [];
      document.addEventListener('hanbi-raw-result', event => { window.__hanbiQaRaw.push(JSON.parse(event.detail)); });
      document.addEventListener('hanbi-raw-error', event => { window.__hanbiQaRaw.push({ error: event.detail }); });
    });
    await raw.click();
    await live.waitForFunction(() => document.querySelector('#hanbi-raw-button')?.textContent === 'STOP', { timeout: 10000 });
    const ahead = await live.evaluate(() => { const video = [...document.querySelectorAll('video')].find(video => video.videoHeight > 0); return video?.buffered.length ? video.buffered.end(video.buffered.length-1) - video.currentTime : 0; });
    await live.waitForFunction(() => window.__hanbiQaRaw.some(item => item.error), { timeout: Math.min(35000, Math.max(8000, (ahead + 5) * 1000)) }).catch(error => {
      if (error.name !== 'TimeoutError') throw error;
    });
    report.rawMessages = await live.evaluate(() => window.__hanbiQaRaw);
    const rawError = report.rawMessages.find(item => item.error)?.error;
    if (rawError) {
      report.checks.rawDownload = { supported: false, reason: rawError };
    } else {
      assert.equal(await raw.innerText(), 'STOP');
      const rawDownloadPromise = live.waitForEvent('download', { timeout: 15000 });
      await raw.click();
      const rawDownload = await rawDownloadPromise;
      assert.equal(await rawDownload.failure(), null);
      const rawPath = await rawDownload.path();
      report.checks.rawDownload = { supported: true, name: rawDownload.suggestedFilename(), bytes: (await fs.stat(rawPath)).size };
      assert.ok(report.checks.rawDownload.bytes > 0);
    }
    await live.locator('#hanbi-player-tools button').filter({ hasText: /^TM$/ }).click();
    await live.waitForFunction(() => document.querySelector('#hanbi-time-machine [role="status"]')?.textContent.includes('버퍼 유지 ON'), { timeout: 10000 });
    report.checks.timeMachine = { status: await live.locator('#hanbi-time-machine [role="status"]').innerText() };
    const beforeSeek = await sample();
    await live.locator('#hanbi-time-machine [data-seek="-30"]').click();
    const afterSeek = await sample();
    assert.ok(afterSeek[0].currentTime < beforeSeek[0].currentTime);
    report.checks.timeMachine.seekedBack = true;
    await live.locator('#hanbi-time-machine [data-live]').click();
    await live.locator('#hanbi-time-machine [data-close]').click();
  } catch (error) {
    report.failure = error.message; process.exitCode = 1;
  } finally {
    if (context) await context.close();
    const resolved = path.resolve(profile);
    if (path.dirname(resolved).toLowerCase() !== path.resolve(os.tmpdir()).toLowerCase() || !path.basename(resolved).startsWith('hanbi-chrome-qa-')) throw new Error('Unexpected QA profile path');
    await fs.rm(resolved, { recursive: true, force: true });
    await fs.writeFile(path.join(__dirname, 'chrome-e2e-results.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
  }
})();
