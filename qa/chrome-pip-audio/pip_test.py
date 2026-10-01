import asyncio, json, sys, time, tempfile
from playwright.async_api import async_playwright
EXT=sys.argv[1]; SP=__import__('os').path.dirname(__import__('os').path.abspath(__file__))
CH='/live/'+'a'*32
html=open(f'{SP}/fake.html',encoding='utf-8').read(); media=open(f'{SP}/test.webm','rb').read()
async def route(r):
    u=r.request.url
    if u.endswith('/test.webm'): await r.fulfill(status=200, body=media, headers={'content-type':'video/webm','access-control-allow-origin':'*'})
    elif 'api.chzzk.naver.com' in u: await r.fulfill(status=200, body='{"code":200,"content":{"data":[]}}', headers={'content-type':'application/json','access-control-allow-origin':'https://chzzk.naver.com','access-control-allow-credentials':'true'})
    elif u.startswith('https://chzzk.naver.com/'): await r.fulfill(status=200, body=html, headers={'content-type':'text/html'})
    elif u.startswith('http'): await r.abort()
    else: await r.continue_()
async def main():
    res={}
    async with async_playwright() as p:
        ctx=await p.chromium.launch_persistent_context(tempfile.mkdtemp(), headless=False,
            args=[f'--disable-extensions-except={EXT}',f'--load-extension={EXT}','--autoplay-policy=no-user-gesture-required'])
        await ctx.route('**/*', route)
        page=await ctx.new_page()
        print('goto',flush=True); await page.goto('https://chzzk.naver.com'+CH, wait_until='domcontentloaded'); print('loaded',flush=True)
        await page.evaluate("document.getElementById('main').play()")
        await page.wait_for_selector('#hanbi-player-tools', timeout=15000)
        res['buttons']=await page.eval_on_selector_all('#hanbi-player-tools button','b=>b.map(x=>x.textContent)'); print('buttons', res['buttons'], flush=True)
        await page.click('#hanbi-player-tools button:has-text("REC")')
        await page.wait_for_timeout(1500)
        res['afterRec']=await page.eval_on_selector_all('#hanbi-player-tools button','b=>b.map(x=>x.textContent)'); print('afterRec', res['afterRec'], flush=True)
        t0=time.time()
        if await page.query_selector('#hanbi-pip-button'): await page.click('#hanbi-pip-button')
        else: await page.click('#gesture')
        await page.wait_for_timeout(1500)
        res['pipActive']=await page.evaluate("document.pictureInPictureElement?.id||null"); print('pipActive', res['pipActive'], flush=True)
        res['pipButtonPressed']=await page.evaluate("document.getElementById('hanbi-pip-button')?.getAttribute('aria-pressed')"); print('pipButtonPressed', res['pipButtonPressed'], flush=True)
        # 1) a larger video appears (ad overlay / preview)
        await page.evaluate("""(()=>{const v=document.createElement('video');v.src='/test.webm';v.muted=true;v.loop=true;v.style.width='1200px';v.style.height='700px';document.getElementById('other').appendChild(v);return v.play()})()""")
        await page.wait_for_timeout(2500)
        res['afterBiggerVideo']=await page.evaluate("!!document.getElementById('hanbi-recording-indicator')"); print('afterBiggerVideo', res['afterBiggerVideo'], flush=True)
        # 2) SPA navigation away while in PiP
        await page.evaluate("history.pushState({},'','/lives'); document.body.appendChild(document.createElement('i'))")
        await page.wait_for_timeout(2500)
        res['afterSpaNav']=await page.evaluate("!!document.getElementById('hanbi-recording-indicator')"); print('afterSpaNav', res['afterSpaNav'], flush=True)
        # 3) hide tab: open another tab in front
        other=await ctx.new_page(); await other.goto('about:blank'); await other.bring_to_front()
        await page.wait_for_timeout(4000)
        res['afterTabSwitch']=await page.evaluate("!!document.getElementById('hanbi-recording-indicator')"); print('afterTabSwitch', res['afterTabSwitch'], flush=True)
        await page.bring_to_front()
        res['indicator']=await page.evaluate("document.getElementById('hanbi-recording-indicator')?.textContent||null"); print('indicator', res['indicator'], flush=True)
        # stop
        async with ctx.expect_page(timeout=20000) as info:
            await page.click('#hanbi-player-tools button:has-text("STOP")')
        result=await info.value
        logs=[]; result.on('console', lambda m: logs.append(m.type+': '+m.text)); result.on('pageerror', lambda e: logs.append('pageerror: '+str(e)))
        await result.wait_for_load_state()
        for i in range(40):
            t=await result.evaluate("document.body.innerText")
            if '불러오는 중' not in t: break
            await result.wait_for_timeout(500)
        res['resultWait']=i*0.5; print('resultWait', i*0.5, 'logs', logs, flush=True)
        sw=[w for w in ctx.service_workers]; print('workers', [w.url for w in sw], flush=True)
        res['elapsed']=round(time.time()-t0,1); print('elapsed', res['elapsed'], flush=True)
        res['resultUrl']=result.url.split('?')[0].split('/')[-1]; print('resultUrl', res['resultUrl'], flush=True)
        res['resultVideo']=await result.evaluate("""(async()=>{const v=document.querySelector('video'); if(!v) return document.body.innerText.slice(0,300);
          const wait=(ms)=>new Promise(r=>setTimeout(r,ms));
          for(let i=0;i<20 && v.readyState<1;i++) await wait(250);
          let d=v.duration; if(!isFinite(d)){v.currentTime=1e9; for(let i=0;i<20 && !isFinite(v.duration);i++) await wait(250); d=v.duration;}
          return {duration:d,w:v.videoWidth,h:v.videoHeight,text:document.body.innerText.replace(/\\s+/g,' ').slice(0,240)}})()"""); print('resultVideo',res['resultVideo'],flush=True)
        await ctx.close()
    print(json.dumps(res,ensure_ascii=False,indent=1))
asyncio.run(main())
