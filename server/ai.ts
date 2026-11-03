import type { IncomingMessage, ServerResponse } from 'node:http';
import { parseAiRequest, validateAiResponse } from '../src/features/ai/proposals.ts';
import { isTrustedHost } from './host.ts';
export interface AiConfig {url:string;key:string;model:string;publicOrigin:string}
export function configFromEnv(env:NodeJS.ProcessEnv):AiConfig{return {url:env.STUDIO_AI_URL??'',key:env.STUDIO_AI_KEY??'',model:env.STUDIO_AI_MODEL??'configured-service',publicOrigin:env.STUDIO_PUBLIC_ORIGIN??''};}
function enabled(config:AiConfig):boolean{
  if(!config.url||!config.key)return false;
  try{const u=new URL(config.url);return !u.username&&!u.password&&(u.protocol==='https:'||(u.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(u.hostname)));}catch{return false;}
}
function reply(res:ServerResponse,status:number,data:unknown){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(data));}
async function body(req:IncomingMessage,signal:AbortSignal):Promise<unknown>{
  const cancel=()=>req.destroy(new Error('Request aborted'));signal.addEventListener('abort',cancel,{once:true});
  try{
  const chunks:Buffer[]=[];let bytes=0;
  for await(const chunk of req){bytes+=Buffer.byteLength(chunk);if(bytes>20*1024*1024)throw new Error('請求超過 20 MiB');chunks.push(Buffer.from(chunk));}
  return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
  }finally{signal.removeEventListener('abort',cancel);}
}
async function responseJson(response:Response):Promise<unknown>{
  if(!response.body)throw new Error('模型服務沒有回應內容');
  const reader=response.body.getReader(),chunks:Uint8Array[]=[];let size=0;
  try{while(true){const next=await reader.read();if(next.done)break;size+=next.value.length;if(size>8*1024*1024)throw new Error('模型回覆過大');chunks.push(next.value);}}
  finally{await reader.cancel();}
  return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
}
/** Generic service adapter; no personal connector credentials or client-provided URL. */
export function createAiHandler(config:AiConfig,fetcher:typeof fetch=fetch){
  let active=false,lastRequest=0;
  return async(req:IncomingMessage,res:ServerResponse):Promise<boolean>=>{
    if(!req.url?.startsWith('/api/ai/'))return false;
    if(!isTrustedHost(req.headers.host,config.publicOrigin)){reply(res,403,{error:'不允許的主機名稱'});return true;}
    const available=enabled(config);
    if(req.url==='/api/ai/capabilities'&&req.method==='GET'){
      reply(res,200,{enabled:available,model:config.model,reason:available?'已設定模型服務；每次傳送需明確同意。':'尚未設定服務端模型網址與金鑰，AI 已停用；手動編輯可正常使用。'});return true;}
    if(req.url!=='/api/ai/propose'||req.method!=='POST'){reply(res,404,{error:'找不到 API'});return true;}
    if(!available){reply(res,503,{error:'AI 尚未設定，請先設定服務端 API。'});return true;}
    const expected=config.publicOrigin||'http://'+req.headers.host;
    if(req.headers.origin!==expected||!req.headers['content-type']?.startsWith('application/json')){reply(res,403,{error:'來源或內容類型不符'});return true;}
    if(active||Date.now()-lastRequest<2000){reply(res,429,{error:'已有請求或操作過於頻繁，請稍後再試'});return true;}
    active=true;lastRequest=Date.now();
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),60000);
    const disconnected=()=>{if(!res.writableEnded)controller.abort();};res.on('close',disconnected);
    try{
      const request=parseAiRequest(await body(req,controller.signal));
      const response=await fetcher(config.url,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+config.key},body:JSON.stringify({...request,model:config.model}),signal:controller.signal,redirect:'error'});
      if(!response.ok)throw new Error('模型服務回覆錯誤，狀態 '+response.status);
      const result=validateAiResponse(request,await responseJson(response));reply(res,200,result);
    }catch(error){reply(res,400,{error:error instanceof Error&&error.name==='AbortError'?'模型服務已取消或逾時':'提案未通過驗證或服務失敗，請檢查服務設定與輸入。'});}
    finally{clearTimeout(timer);res.off('close',disconnected);active=false;}
    return true;
  };
}

