import type { Campus } from './index.ts';
/** Each part stays independently serializable; never assemble the whole campus JSON string. */
export function* campusJsonChunks(campus:Campus):Generator<string>{
 const header={schema:'minecraft-campus-1',title:'群島未來基地',coordinateConvention:'x-east-y-up-z-south',minecraftVersion:'1.20.1',note:'AI Estimated Area; handcrafted interpretation of 11 concept images. Each district is a valid independently editable Project. Coordinates are global.'};
 yield JSON.stringify(header).slice(0,-1)+',"districts":[';
 for(let i=0;i<campus.districts.length;i++){if(i>0)yield ',';yield JSON.stringify(campus.districts[i]);}
 yield ']}';
}
const quote=(value:unknown)=>'"'+String(value).replaceAll('"','""')+'"';
/** Bounded row batches avoid both a million-row intermediate array and a monolithic CSV string. */
export function* campusCsvChunks(campus:Campus,rowsPerChunk=5000):Generator<string>{
 if(!Number.isInteger(rowsPerChunk)||rowsPerChunk<1||rowsPerChunk>5000)throw new Error('CSV chunk size must be 1..5000 rows');
 yield ['District','UID','Block ID','X','Y','Z','Category','Placement State','AI Estimated Area'].map(quote).join(',');
 let rows:string[]=[];
 for(const b of campus.blocks){
  rows.push([b.componentId,b.uid,b.id,b.pos.x,b.pos.y,b.pos.z,b.category,JSON.stringify(b.state),b.source.origin==='ai_estimated'||b.source.origin==='inferred'].map(quote).join(','));
  if(rows.length===rowsPerChunk){yield '\r\n'+rows.join('\r\n');rows=[];}
 }
 if(rows.length)yield '\r\n'+rows.join('\r\n');
}
