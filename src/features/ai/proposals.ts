import type { BlockPos, EditTransaction, Project } from '../../core/contracts.ts';
import { VoxelEngine } from '../../core/engine.ts';
import { object, parsePosition, parseProject, text } from '../../core/model.ts';
export interface AiScope {min:BlockPos;max:BlockPos}
export function parseScope(raw:unknown):AiScope{
  const s=object(raw,['min','max']),min=parsePosition(s.min),max=parsePosition(s.max);
  let volume=1;for(const a of ['x','y','z'] as const){if(min[a]>max[a])throw new Error('範圍起點須小於終點');volume*=max[a]-min[a]+1;}
  if(volume>10000)throw new Error('AI 範圍最多 10,000 格');return {min,max};
}
export interface AiRequest {kind:'analyze'|'generate'|'edit';project:Project;scope:AiScope;prompt:string;images:readonly {name:string;mime:string;dataUrl:string}[];dimensions?:BlockPos;consent:true}
function dimensions(raw:unknown):BlockPos{const d=parsePosition(raw);if([d.x,d.y,d.z].some(n=>n<1||n>256))throw new Error('提議尺寸須介於 1–256');return d;}
export function parseAiRequest(raw:unknown):AiRequest{
  const r=object(raw,['kind','project','scope','prompt','images','dimensions','consent']);
  if(!['analyze','generate','edit'].includes(String(r.kind))||r.consent!==true)throw new Error('需選擇操作並明確同意傳送與費用');
  if(typeof r.prompt!=='string'||!r.prompt.trim()||r.prompt.length>4096)throw new Error('請輸入 1–4096 字的需求');
  if(!Array.isArray(r.images)||r.images.length>4)throw new Error('最多 4 張圖片');
  const images=r.images.map(raw=>{const i=object(raw,['name','mime','dataUrl']);
    const name=text(i.name),mime=text(i.mime);
    if(!['image/png','image/jpeg','image/webp'].includes(mime)||typeof i.dataUrl!=='string')throw new Error('不支援的圖片格式');
    const prefix='data:'+mime+';base64,';
    if(!i.dataUrl.startsWith(prefix)||i.dataUrl.length>2800000||!(/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/).test(i.dataUrl.slice(prefix.length)))throw new Error('圖片資料無效或超過 2 MiB');
    const payload=i.dataUrl.slice(prefix.length),bytes=payload.length/4*3-(payload.endsWith('==')?2:payload.endsWith('=')?1:0);
    if(!bytes||bytes>2*1024*1024)throw new Error('圖片超過 2 MiB 或空白');
    return {name,mime,dataUrl:i.dataUrl};});
  if(r.kind==='analyze'&&!images.length)throw new Error('分析至少需要一張圖片');
  return {kind:r.kind as AiRequest['kind'],project:parseProject(r.project),scope:parseScope(r.scope),prompt:r.prompt,images,consent:true,...(r.dimensions===undefined?{}:{dimensions:dimensions(r.dimensions)})};
}
function message(value:unknown):string{if(typeof value!=='string'||value.length>4096)throw new Error('AI 說明格式無效');return value;}
function uncertainty(value:unknown):readonly string[]{if(!Array.isArray(value)||value.length>100)throw new Error('AI 不確定性清單無效');return value.map(message);}
export function validateProposal(project:Project,raw:unknown,scope:AiScope):{transaction:EditTransaction;summary:string;uncertainties:readonly string[]}{
  const s=parseScope(scope),p=object(raw,['kind','minecraftVersion','baseRevision','transaction','summary','uncertainties']);
  if(p.kind!=='proposal'||p.minecraftVersion!=='1.20.1'||p.baseRevision!==project.designRevision)throw new Error('AI 提案版本不符或設計已變更，請重新產生');
  const t=object(p.transaction,['id','baseRevision','cause','collisionPolicy','changes','structures']);
  if(t.baseRevision!==project.designRevision||t.cause!=='ai_approved'||t.collisionPolicy!=='cancel'||!Array.isArray(t.changes)||!t.changes.length||t.changes.length>5000)throw new Error('AI 提案必須是有界限且不自動覆蓋的變更');
  const known=new Set(project.blocks.map(b=>b.uid));
  for(const raw of t.changes){
    const c=object(raw,['pos','before','after']),pos=parsePosition(c.pos);
    if((['x','y','z'] as const).some(a=>pos[a]<s.min[a]||pos[a]>s.max[a]))throw new Error('AI 提案超出核准範圍');
    if(c.after){const b=c.after as Record<string,unknown>;if(!known.has(String(b.uid))){
      const source=b.source as Record<string,unknown>|undefined;
      if(!source||!['observed','inferred','ai_estimated'].includes(String(source.origin))||typeof source.confidence!=='number'||source.confidence<0||source.confidence>1)throw new Error('AI 新增方塊須標示來源與信心程度');
    }}
  }
  const result=new VoxelEngine(project).preview(t as unknown as EditTransaction);
  if(!result.ok)throw new Error(result.diagnostics.map(d=>d.message).join('；'));
  return {transaction:result.normalized,summary:message(p.summary),uncertainties:uncertainty(p.uncertainties)};
}
export function validateAiResponse(request:AiRequest,raw:unknown):unknown{
  if(request.kind==='analyze'){
    const a=object(raw,['kind','summary','dimensions','uncertainties']);if(a.kind!=='analysis')throw new Error('預期建築分析結果');
    return {kind:'analysis',summary:message(a.summary),dimensions:dimensions(a.dimensions),uncertainties:uncertainty(a.uncertainties)};
  }
  const p=validateProposal(request.project,raw,request.scope);
  return {kind:'proposal',minecraftVersion:'1.20.1',baseRevision:request.project.designRevision,...p};
}

