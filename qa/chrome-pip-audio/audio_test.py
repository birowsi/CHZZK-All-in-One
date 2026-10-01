import asyncio, json, sys, tempfile, subprocess, math, re
from playwright.async_api import async_playwright
EXT=sys.argv[1]; SP=__import__('os').path.dirname(__import__('os').path.abspath(__file__))
html=open(f'{SP}/fake.html',encoding='utf-8').read().replace(' muted playsinline',' playsinline')
media=open(f'{SP}/audio.webm','rb').read()
async def route(r):
    u=r.request.url
    if u.endswith('/test.webm'): await r.fulfill(status=200, body=media, headers={'content-type':'video/webm'})
    elif 'api.chzzk.naver.com' in u: await r.fulfill(status=200, body='{"code":200,"content":{"data":[]}}', headers={'content-type':'application/json','access-control-allow-origin':'https://chzzk.naver.com','access-control-allow-credentials':'true'})
    elif u.startswith('https://chzzk.naver.com/'): await r.fulfill(status=200, body=html, headers={'content-type':'text/html'})
    elif u.startswith('http'): await r.abort()
    else: await r.continue_()
def spread(samples):
    s=sorted(x for x in samples if x>0)
    if len(s)<10: return None
    loud=s[int(len(s)*0.85)]; quiet=s[int(len(s)*0.15)]
    return {'loud_dB':round(20*math.log10(loud),1),'quiet_dB':round(20*math.log10(quiet),1),'range_dB':round(20*math.log10(loud/quiet),1)}
async def measure(page):
    await page.wait_for_timeout(4500)
    d=json.loads(await page.evaluate("document.documentElement.dataset.probe||'{}'"))
    return {'ctx':d.get('state'), **(spread(d.get('samples',[])) or {})}
async def main():
    res={}
    async with async_playwright() as p:
        ctx=await p.chromium.launch_persistent_context(tempfile.mkdtemp(), headless=False, accept_downloads=True,
            args=[f'--disable-extensions-except={EXT}',f'--load-extension={EXT}','--autoplay-policy=no-user-gesture-required'])
        await ctx.route('**/*', route)
        page=await ctx.new_page()
        await page.goto('https://chzzk.naver.com/live/'+'a'*32, wait_until='domcontentloaded')
        await page.evaluate("document.getElementById('main').play()")
        await page.wait_for_selector('#hanbi-audio-compressor button', timeout=15000)
        comp='#hanbi-audio-compressor button'
        await page.click(comp); res['label_on']=await page.text_content(comp)
        res['on_gain1']=await measure(page); print('on', res['on_gain1'], flush=True)
        await page.click(comp); res['label_off']=await page.text_content(comp)
        res['off']=await measure(page); print('off', res['off'], flush=True)
        await page.click(comp)
        await page.evaluate("""(()=>{const s=document.querySelector('#hanbi-audio-compressor input'); s.value='2'; s.dispatchEvent(new Event('input',{bubbles:true}));})()""")
        res['on_gain2']=await measure(page); print('gain2', res['on_gain2'], flush=True)
        # muted recording keeps source audio
        await page.evaluate("document.getElementById('main').muted=true")
        res['muted_probe']=await measure(page); print('muted', res['muted_probe'], flush=True)
        await page.click('#hanbi-player-tools button:has-text("REC")')
        await page.wait_for_timeout(8000)
        async with ctx.expect_page(timeout=20000) as info:
            await page.click('#hanbi-player-tools button:has-text("STOP")')
        result=await info.value
        await result.wait_for_load_state()
        await result.wait_for_selector('video', timeout=20000)
        await result.wait_for_timeout(1500)
        btn=result.locator('button', has_text='원본').first
        async with result.expect_download(timeout=20000) as dl:
            await btn.click()
        path=f'{SP}/muted-rec'+(('.'+(await dl.value).suggested_filename.split('.')[-1]))
        await (await dl.value).save_as(path)
        out=subprocess.run(['ffmpeg','-hide_banner','-i',path,'-af','astats=metadata=1:reset=0','-f','null','-'],capture_output=True,text=True).stderr
        res['muted_rec_file']=path.split('/')[-1]
        res['muted_rec_audio']={k:re.findall(k+r': (\S+)',out)[-1] for k in ['RMS level dB','Peak level dB'] if re.findall(k+r': (\S+)',out)}
        res['muted_rec_streams']=re.findall(r'Stream #\S+: (\w+: \w+)',out)
        await ctx.close()
    print(json.dumps(res,ensure_ascii=False,indent=1))
asyncio.run(main())
