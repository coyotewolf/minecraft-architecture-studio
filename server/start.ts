import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { configFromEnv, createAiHandler } from './ai.ts';
const root=resolve('dist'),api=createAiHandler(configFromEnv(process.env));
const mime:Record<string,string>={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon'};
const server=createServer(async(req,res)=>{
  try{
    if(await api(req,res))return;
    if(req.method!=='GET'&&req.method!=='HEAD'){res.writeHead(405);res.end();return;}
    const path=decodeURIComponent(new URL(req.url??'/','http://localhost').pathname);
    const file=resolve(root,'.'+(path==='/'?'/index.html':path));
    if(!file.startsWith(root+sep)){res.writeHead(403);res.end();return;}
    const info=await stat(file);if(!info.isFile())throw new Error('not file');
    res.writeHead(200,{'Content-Type':mime[extname(file)]??'application/octet-stream','X-Content-Type-Options':'nosniff'});
    if(req.method==='HEAD')res.end();else createReadStream(file).pipe(res);
  }catch{if(!res.headersSent)res.writeHead(404);res.end('Not found');}
});
server.requestTimeout=70000;server.headersTimeout=10000;
server.listen(Number(process.env.PORT||5174),'127.0.0.1',()=>process.stdout.write('Studio available at http://127.0.0.1:'+String(process.env.PORT||5174)+'\n'));

