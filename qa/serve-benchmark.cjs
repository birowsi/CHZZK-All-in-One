const http = require('node:http'), fs = require('node:fs'), path = require('node:path');
const root = path.resolve(__dirname, '..');
http.createServer((req,res) => {
  const url = new URL(req.url, 'http://127.0.0.1');
  if (!['/qa/mp4-benchmark.html','/record-result-logic.js'].includes(url.pathname) && !url.pathname.startsWith('/vendor/ffmpeg/')) { res.writeHead(404);res.end();return; }
  const file=path.resolve(root,'.'+url.pathname);
  if (!file.startsWith(root+path.sep)) {res.writeHead(403);res.end();return;}
  fs.readFile(file,(error,body)=>{if(error){res.writeHead(404);res.end();return;}res.setHeader('Content-Type',file.endsWith('.wasm')?'application/wasm':file.endsWith('.js')?'text/javascript':'text/html');res.end(body);});
}).listen(8765,'127.0.0.1',()=>console.log('Benchmark: http://127.0.0.1:8765/qa/mp4-benchmark.html'));
