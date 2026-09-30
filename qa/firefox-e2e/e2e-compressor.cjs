// Real Firefox, temporary profile/add-on. No user profile or account required.
const fs = require('node:fs');
const path = require('node:path');
const { Key } = require('selenium-webdriver');
const { launch, shutdown, version, fetchLiveChannels, By } = require('./harness.cjs');
const report = { version: version(), samples: [], checks: [], errors: [] };
const out = path.resolve(__dirname, '..', `firefox-compressor-${report.version}.json`);
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const probe = () => ({
  label: document.querySelector('[data-compressor-toggle]')?.textContent,
  slider: document.querySelector('#hanbi-audio-compressor input')?.value,
  gain: localStorage.getItem('knifeGain'), enabled: localStorage.getItem('hanbi_comp_enabled'),
  controls: document.querySelectorAll('#hanbi-audio-compressor').length,
  sliderDetails: (() => { const s=document.querySelector('#hanbi-audio-compressor input'); return s && {min:s.min,max:s.max,step:s.step,focused:document.activeElement===s,rect:s.getBoundingClientRect().toJSON()}; })(),
  events: window.__hanbiCompEvents || [],
  sameInitialRoot: window.__hanbiCompRoot === document.querySelector('#hanbi-audio-compressor'),
  bubbled: window.__hanbiCompBubbled || 0,
  video: [...document.querySelectorAll('video')].filter(v => !v.closest('#hanbi-sidebar-hover-preview'))
    .map(v => ({ height: v.videoHeight, time: v.currentTime, paused: v.paused, error: v.error?.code || null })),
});
(async () => {
  let session;
  try {
    session = await launch({ headless: true });
    report.browser = (await session.driver.getCapabilities()).get('browserVersion');
    await session.bidi.subscribe(['log.entryAdded']);
    session.bidi.on('log.entryAdded', entry => {
      if (['warn','error'].includes(entry.level)) report.errors.push({ level: entry.level,
        text: String(entry.text || '').replace(/https?:\/\/[^\s]+/g, '[URL omitted]').slice(0, 500) });
    });
    const lives = await fetchLiveChannels(4);
    if (!lives.length) throw new Error('No live channel');
    report.channel = lives[0].channelId;
    const driver = session.driver;
    await driver.get(`https://chzzk.naver.com/live/${report.channel}`);
    await driver.wait(async () => (await driver.findElements(By.css('[data-compressor-toggle]'))).length > 0, 45000);
    if (await driver.executeScript(() => [...document.querySelectorAll('video')].some(v => v.videoHeight > 0 && v.paused))) {
      for (const selector of ['.pzp-pc__big-button-play', '.pzp-pc__button-play', 'video']) {
        try { await (await driver.findElement(By.css(selector))).click(); break; } catch (_) {}
      }
    }
    await sleep(3000);
    const sample = async name => {
      const data = await driver.executeScript(probe); report.samples.push({ name, ...data });
      console.log(name, JSON.stringify({ ...data, events: data.events.length })); return data;
    };
    await sample('initial');
    await driver.executeScript(() => {
      window.__hanbiCompEvents=[];
      window.__hanbiCompRoot=document.querySelector('#hanbi-audio-compressor');
      window.__hanbiCompBubbled=0;
      document.querySelector('#hanbi-audio-compressor').parentElement.addEventListener('click',event=>{
        if(event.target.closest?.('#hanbi-audio-compressor')) window.__hanbiCompBubbled++;
      });
      for(const type of ['click','keydown','input','change']) document.addEventListener(type,event=>{
        if(event.target.closest?.('#hanbi-audio-compressor')) window.__hanbiCompEvents.push({type,key:event.key,value:event.target.value,trusted:event.isTrusted});
      },true);
    });
    await (await driver.findElement(By.css('[data-compressor-toggle]'))).click();
    await sleep(1200); const on = await sample('on');
    report.checks.push({ name: 'toggle ON', pass: on.enabled === 'true' && on.label === 'COMP ON' });
    if(on.enabled !== 'true') throw new Error('Trusted toggle click did not change state');
    report.playRequest = await driver.executeAsyncScript(callback => {
      const media=[...document.querySelectorAll('video')].find(v=>v.videoHeight>0);
      media.play().then(()=>callback('resolved'),error=>callback(error.name));
    });
    await sleep(1200);
    const playing = await sample('playback start');
    const slider = await driver.findElement(By.css('#hanbi-audio-compressor input'));
    const rect = await slider.getRect();
    await driver.actions().move({origin:slider,x:-Math.floor(rect.width/2)+4,y:0}).press().release().perform();
    await slider.sendKeys(Key.HOME); await sleep(800); const zero = await sample('gain zero');
    report.checks.push({ name: 'gain zero persists', pass: zero.gain === '0' && zero.slider === '0' });
    await driver.actions().move({origin:slider,x:Math.floor(rect.width/2)-4,y:0}).press().release().perform();
    await slider.sendKeys(Key.END); await sleep(800); const high = await sample('gain two');
    report.checks.push({ name: 'gain two persists', pass: high.gain === '2' && high.slider === '2' });
    await driver.actions().move({origin:slider,x:Math.floor(rect.width/2)-4,y:0}).press()
      .move({origin:slider,x:12,y:0,duration:500}).pause(1000).release().perform();
    const dragged = await sample('drag');
    report.checks.push({ name: 'drag gain persists', pass: Number(dragged.gain) > 0 && Number(dragged.gain) < 2 && dragged.slider === dragged.gain });
    const retainedGain = dragged.gain;
    report.checks.push({ name: 'playback continues during controls', pass: dragged.video.some(v=>v.height>0 && !v.paused && v.time>playing.video.find(start=>start.height>0)?.time) });
    // Lifecycle fixture, not a claim that CHZZK cloned the toolbar in this session.
    await driver.executeScript(() => {
      const root=document.querySelector('#hanbi-audio-compressor'); root.replaceWith(root.cloneNode(true));
    });
    await sleep(800); const rebuilt = await sample('injected DOM clone');
    report.checks.push({ name: 'clone keeps ON/gain and one control', pass: rebuilt.enabled === 'true' && rebuilt.slider === retainedGain && rebuilt.controls === 1 });
    await (await driver.findElement(By.css('[data-compressor-toggle]'))).click();
    await sleep(1200); const off = await sample('off');
    report.checks.push({ name: 'toggle OFF persists', pass: off.enabled === 'false' && off.label === 'COMP OFF' });
    report.checks.push({ name: 'COMP click does not reach player ancestors', pass: off.bubbled === 0 });
    await driver.navigate().refresh();
    await driver.wait(async () => (await driver.findElements(By.css('[data-compressor-toggle]'))).length > 0, 45000);
    await sleep(1000); const reloaded = await sample('reload');
    report.checks.push({ name: 'reload keeps OFF and gain', pass: reloaded.enabled === 'false' && reloaded.label === 'COMP OFF' && reloaded.slider === retainedGain });
    report.pass = report.checks.every(check => check.pass);
  } catch (error) { report.fatal = String(error).replace(/https?:\/\/[^\s]+/g, '[URL omitted]').slice(0,600); report.pass = false; }
  finally { await shutdown(session); fs.writeFileSync(out, JSON.stringify(report,null,2)); console.log(out, report.pass); process.exit(report.pass ? 0 : 1); }
})();
