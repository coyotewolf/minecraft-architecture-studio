import { parseProject } from '../../core/model.ts';
import type { BlockRecord, ItemRequirement } from '../../core/contracts.ts';
import { inventory } from '../../features/build/model.ts';
import { itemStackSize } from '../../core/versioned-registry.ts';
import type { District } from './builder.ts';
import { createLandmarkDistricts } from './landmarks.ts';
import { createIndustryDistricts } from './industry.ts';
import { createGardenDistricts } from './gardens.ts';
import { createLandscapeDistricts } from './landscape.ts';
import { createLandmarkDistrictsV3 } from './landmarks-v3.ts';
import { createIndustryDistrictsV3 } from './industry-v3.ts';
import { createGardenDistrictsV3 } from './gardens-v3.ts';
import { createLandscapeDistrictsV3 } from './landscape-v3.ts';
export interface Campus { readonly districts:readonly District[]; readonly blocks:readonly BlockRecord[]; readonly items:readonly ItemRequirement[]; readonly totalItems:number|null }
export function assembleCampus(districts:readonly District[]):Campus {
 const positions=new Set<string>(),uids=new Set<string>(),counts=new Map<ItemRequirement['itemId'],number>();const blocks:BlockRecord[]=[];let resolved=true;
 for(const d of districts){const summary=inventory(d.project);if(summary.totalInventoryItems===null)resolved=false;for(const item of summary.items)counts.set(item.itemId,(counts.get(item.itemId)??0)+item.required);
  for(const b of d.project.blocks){const key=`${b.pos.x},${b.pos.y},${b.pos.z}`;if(positions.has(key)||uids.has(b.uid))throw new Error(`基地分區重疊：${d.title} / ${key}`);positions.add(key);uids.add(b.uid);blocks.push(b);}
 }
 const items=[...counts].sort(([a],[b])=>a.localeCompare(b)).map(([itemId,required])=>{const maxStack=itemStackSize(itemId);return {itemId,required,maxStack,fullStacks:Math.floor(required/maxStack),remainder:required%maxStack};});
 return {districts,blocks,items,totalItems:resolved?items.reduce((sum,i)=>sum+i.required,0):null};
}
let cached:Campus|undefined;
export function createCampusV2():Campus {if(cached)return cached;const districts=[...createLandmarkDistricts(),...createIndustryDistricts(),...createGardenDistricts()];const connected=districts.map(d=>d.id!=='teardrop-command'?d:{...d,project:parseProject({...d.project,designRevision:d.project.designRevision+'-skywalk',blocks:d.project.blocks.filter(b=>!(Math.abs(b.pos.x)<=1&&b.pos.y>=50&&b.pos.y<=54&&b.pos.z>=-14&&b.pos.z<=-13))})});cached=assembleCampus([...connected,...createLandscapeDistricts(connected)]);return cached;}
export function campusToJson(campus:Campus):string {return JSON.stringify({schema:'minecraft-campus-1',title:'群島未來基地',coordinateConvention:'x-east-y-up-z-south',minecraftVersion:'1.20.1',note:'AI Estimated Area; handcrafted interpretation of 11 concept images. Each district is a valid independently editable Project. Coordinates are global.',districts:campus.districts},null,0);}
export function campusToCsv(campus:Campus):string {const q=(v:unknown)=>'"'+String(v).replaceAll('"','""')+'"';return [['District','UID','Block ID','X','Y','Z','Category','Placement State','AI Estimated Area'],...campus.blocks.map(b=>[b.componentId,b.uid,b.id,b.pos.x,b.pos.y,b.pos.z,b.category,JSON.stringify(b.state),b.source.origin==='ai_estimated'||b.source.origin==='inferred'])].map(r=>r.map(q).join(',')).join('\r\n');}

let cachedV3:Campus|undefined;
export function createCampus():Campus {if(cachedV3)return cachedV3;const buildings=[...createLandmarkDistrictsV3(),...createIndustryDistrictsV3(),...createGardenDistrictsV3()];cachedV3=assembleCampus([...buildings,...createLandscapeDistrictsV3(buildings)]);return cachedV3;}
