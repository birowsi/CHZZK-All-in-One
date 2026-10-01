import json, re, shutil, os, sys
src=__import__('os').path.abspath(__import__('os').path.join(__import__('os').path.dirname(__file__),'..','..')); out=sys.argv[1]
ps=open(f'{src}/build.ps1',encoding='utf-8').read()
block=ps[ps.index('$files = @('):ps.index(')',ps.index('$files = @('))]
files=re.findall(r'"([^"]+)"',block)+['chrome-worker.js','chrome-grid.js']
shutil.rmtree(out,ignore_errors=True)
for f in files:
    os.makedirs(os.path.dirname(f'{out}/{f}'),exist_ok=True); shutil.copy(f'{src}/{f}',f'{out}/{f}')
m=json.load(open(f'{src}/manifest.json',encoding='utf-8'))
m.pop('browser_specific_settings'); m['minimum_chrome_version']='120'
m['permissions']=[p for p in m['permissions'] if p!='webRequestBlocking']+['alarms']
m['background']={'service_worker':'chrome-worker.js'}
m['content_security_policy']['extension_pages']=m['content_security_policy']['extension_pages'].replace("worker-src 'self' blob:","worker-src 'self'")
json.dump(m,open(f'{out}/manifest.json','w',encoding='utf-8'),ensure_ascii=False,indent=2)
print(len(files),'files')
