import type { MinecraftId } from '../../core/contracts.ts';
import { DistrictBuilder, type District } from './builder.ts';
/** Authored island shells, gardens and bridges are real build cells, not a background mesh. */
export function createLandscapeDistricts(districts:readonly District[]):District[] {
 const b=new DistrictBuilder({id:'campus-landscape',title:'群島岩壁與花園橋網',origin:[0,0,0],references:['reference-01'],features:['不規則高差岩島與層疊山脊','白色曲線高架步道與環形廣場','密植針葉林、露台花園與懸垂植栽','逐格藍玻璃瀑布','東側雙景觀環門與泡泡觀景塔'],notes:'依總覽圖重新設計島群與標高；地形為中空岩殼及支柱，藍玻璃水景為靜態雕塑。海面是展示背景，不計入施工材料。'});
 const occupied=new Set(districts.flatMap(d=>d.project.blocks.map(v=>`${v.pos.x},${v.pos.y},${v.pos.z}`)));
 const reserved=districts.map(d=>{let x0=Infinity,x1=-Infinity,z0=Infinity,z1=-Infinity;for(const v of d.project.blocks){x0=Math.min(x0,v.pos.x);x1=Math.max(x1,v.pos.x);z0=Math.min(z0,v.pos.z);z1=Math.max(z1,v.pos.z);}return{x0,x1,z0,z1,y:d.origin[1]};});
 const inside=(x:number,z:number,pad=0)=>reserved.some(r=>x>=r.x0-pad&&x<=r.x1+pad&&z>=r.z0-pad&&z<=r.z1+pad);
 const hash=(x:number,z:number)=>{const n=Math.sin(x*127.1+z*311.7)*43758.5453;return n-Math.floor(n);};
 const columns=new Map<string,{x:number;z:number;y:number}>();
 function column(x:number,z:number,y:number){const key=x+','+z,old=columns.get(key);if(!old||y>old.y)columns.set(key,{x,z,y});}
 for(const r of reserved){
  for(let x=r.x0-10;x<=r.x1+10;x++)for(let z=r.z0-10;z<=r.z1+10;z++){
   const dx=Math.max(r.x0-x,0,x-r.x1),dz=Math.max(r.z0-z,0,z-r.z1),edge=Math.hypot(dx,dz);
   const margin=6+2*Math.sin(x*.19)+2*Math.cos(z*.23);
   if(edge<=margin)column(x,z,r.y-1-Math.max(0,Math.floor(edge-3)/2|0));
  }
 }
 // Forested escarpment behind the factory and airport; stepped strata, rather than a flat display tray.
 for(const [cx,cz,rx,rz,height] of [[-115,-147,62,23,64],[-150,-85,22,57,48],[38,-154,77,18,43],[132,-94,23,55,34],[-153,34,20,60,27]] as const){
  for(let x=cx-rx;x<=cx+rx;x++)for(let z=cz-rz;z<=cz+rz;z++){
   const q=((x-cx)/rx)**2+((z-cz)/rz)**2;
   if(q>1+.05*Math.sin(x*.3)*Math.cos(z*.3)||inside(x,z,2))continue;
   column(x,z,Math.floor(height-22*q+3*Math.sin(x*.2)*Math.cos(z*.18)));
  }
 }
 // Small planted islands fill the central landscape without filling the blue channels.
 for(const [cx,cz,rx,rz,y] of [[-50,33,18,16,14],[7,67,25,17,15],[100,64,16,14,11],[103,0,14,18,12],[-46,170,8,13,6],[45,125,10,12,7],[-57,-42,18,11,19],[2,-67,16,12,27]] as const){
  for(let x=cx-rx;x<=cx+rx;x++)for(let z=cz-rz;z<=cz+rz;z++)if(((x-cx)/rx)**2+((z-cz)/rz)**2<=1+.07*Math.sin(x)&&!inside(x,z))column(x,z,y);
 }
 const cliffMaterials:readonly MinecraftId[]=['minecraft:stone','minecraft:stone','minecraft:stone_bricks','minecraft:light_gray_concrete','minecraft:gray_concrete'];
 for(const c of columns.values()){
  b.set(c.x,c.y,c.z,'minecraft:grass_block','Landscape');
  const neighbors=[[1,0],[-1,0],[0,1],[0,-1]].map(([dx,dz])=>columns.get((c.x+dx!)+','+(c.z+dz!))?.y??-10);
  const low=Math.min(...neighbors);
  if(low<c.y)for(let y=Math.max(-10,low+1);y<c.y;y++){
   const rib=Math.floor(hash(Math.floor(c.x/2),Math.floor(c.z/2))*4),material=cliffMaterials[(Math.floor(y/7)+rib+100)%cliffMaterials.length]!;
   b.set(c.x,y,c.z,material,'Cliff');
   if(y<c.y-3&&y%9===0&&hash(c.x+y,c.z)>.87)b.set(c.x,y,c.z,'minecraft:oak_leaves','Landscape',{persistent:'true',distance:'1'});
  }
  if(c.x%12===0&&c.z%12===0)for(let y=-10;y<c.y;y++)b.set(c.x,y,c.z,'minecraft:stone','Foundation');
 }
 const pathCells=new Set<string>();
 function place(x:number,y:number,z:number,id:MinecraftId='minecraft:smooth_quartz',cat='Bridge') {if(!occupied.has(`${x},${y},${z}`))b.set(x,y,z,id,cat,id==='minecraft:oak_leaves'?{persistent:'true',distance:'1'}:{});}
 function deck(cx:number,y:number,cz:number,wide=2){
  for(let dx=-wide;dx<=wide;dx++)for(let dz=-wide;dz<=wide;dz++)if(dx*dx+dz*dz<=wide*wide+1){const x=cx+dx,z=cz+dz;pathCells.add(x+','+z);place(x,y,z,'minecraft:smooth_quartz','Floor');for(let h=1;h<=3;h++)b.clear(x,y+h,z);}
 }
 function curve(points:readonly(readonly[number,number,number])[],rail=true){
  const samples:{x:number;y:number;z:number}[]=[];
  for(let seg=0;seg<points.length-1;seg++){const a=points[seg]!,v=points[seg+1]!,length=Math.max(1,Math.ceil(Math.hypot(v[0]-a[0],v[2]-a[2])*2));for(let i=0;i<=length;i++){const t=i/length;samples.push({x:Math.round(a[0]+(v[0]-a[0])*t),y:Math.round(a[1]+(v[1]-a[1])*t),z:Math.round(a[2]+(v[2]-a[2])*t)});}}
  for(const p of samples)deck(p.x,p.y,p.z);
  for(let i=0;i<samples.length;i++){
   const p=samples[i]!,next=samples[Math.min(i+1,samples.length-1)]!,prev=samples[Math.max(0,i-1)]!;
   const angle=Math.atan2(next.z-prev.z,next.x-prev.x);
   if(rail)for(const side of [-1,1]){const x=p.x+Math.round(-Math.sin(angle)*3*side),z=p.z+Math.round(Math.cos(angle)*3*side);if(!pathCells.has(x+','+z)&&!inside(x,z)){place(x,p.y,z);place(x,p.y+1,z,'minecraft:white_concrete');}}
   if(i%36===0&&!inside(p.x,p.z))for(let y=-10;y<p.y;y++)place(p.x,y,p.z,'minecraft:white_concrete','Structure');
   if(i%30===0&&!inside(p.x,p.z)){place(p.x+3,p.y+2,p.z,'minecraft:gold_block','Decoration');place(p.x+3,p.y+3,p.z,'minecraft:lantern','Decoration');}
  }
 }
 function arc(cx:number,cz:number,rx:number,rz:number,y:number,from=0,to=Math.PI*2){const pts:[number,number,number][]=[];for(let i=0;i<=80;i++){const a=from+(to-from)*i/80;pts.push([Math.round(cx+rx*Math.cos(a)),y,Math.round(cz+rz*Math.sin(a))]);}curve(pts);}
 arc(4,61,29,19,20);arc(-103,1,39,29,15);arc(58,12,36,25,15);arc(-105,165,42,29,11);arc(-54,105,28,24,11);
 curve([[-103,15,30],[-79,18,38],[-54,20,44],[-25,20,61]]);
 curve([[-25,20,61],[-37,18,87],[-55,11,81]]);
 curve([[4,20,42],[0,13,21]]);curve([[32,20,58],[56,17,41],[86,15,28],[115,14,48]]);
 curve([[4,20,80],[-8,17,103],[-8,9,120]]);curve([[25,20,70],[51,17,65],[65,11,67]]);
 curve([[-81,13,92],[-81,13,122],[-87,11,139]]);curve([[-62,11,167],[-42,10,175]]);
 curve([[25,10,164],[43,12,147],[57,12,131],[60,10,119]]);curve([[78,13,94],[92,12,108],[103,9,117]]);
 curve([[-104,39,-74],[-75,34,-55],[-49,29,-44],[-29,23,-21],[-21,15,-10]]);
 curve([[-61,40,-100],[-39,40,-94],[-17,39,-89],[7,37,-80]]);
 // Enclosed north-side command connection: floor local37 + origin12 = world49.
 // Seven shallow east-facing rises reach the airport's existing world56 south bridge.
 // Architecture doorway carving is applied by the campus assembler, never by this helper.
 const skyCenters:{x:number;z:number}[]=[];
 for(let z=-10;z>=-45;z--)skyCenters.push({x:0,z});
 for(let x=1;x<=55;x++)skyCenters.push({x,z:-45});
 for(let z=-46;z>=-71;z--)skyCenters.push({x:55,z});
 const skyFootprint=new Map<string,{x:number;z:number}>(),skyInterior=new Set<string>();
 for(const p of skyCenters)for(let dx=-2;dx<=2;dx++)for(let dz=-2;dz<=2;dz++){
  const x=p.x+dx,z=p.z+dz,key=x+','+z;skyFootprint.set(key,{x,z});pathCells.add(key);
  if(Math.abs(dx)<=1&&Math.abs(dz)<=1)skyInterior.add(key);
 }
 const skyFloor=(x:number)=>49+Math.max(0,Math.min(7,Math.floor(x/7)));
 for(const [key,p] of skyFootprint){
  const y=skyFloor(p.x);
  place(p.x,y,p.z,'minecraft:smooth_quartz','Floor');
  // Clear only landscape-authored objects from the walking volume, not district geometry.
  for(let h=1;h<=5;h++)b.clear(p.x,y+h,p.z);
  if(skyInterior.has(key)&&p.x>=7&&p.x<=49&&p.x%7===0&&!occupied.has(`${p.x},${y},${p.z}`))
   b.set(p.x,y,p.z,'minecraft:quartz_stairs','Skywalk stairs',{facing:'east'});
  const rib=(p.x===0||p.x===55)?p.z%7===0:p.x%7===0;
  if(!skyInterior.has(key))for(let h=1;h<=5;h++)place(p.x,y+h,p.z,h===1?'minecraft:gold_block':rib?'minecraft:white_concrete':'minecraft:cyan_stained_glass','Skywalk envelope');
  place(p.x,y+6,p.z,rib?'minecraft:white_concrete':'minecraft:light_blue_stained_glass','Roof');
 }
 // Open both end caps; the command shell and airport bridge provide the continuation.
 for(const [cx,cz] of [[0,-10],[55,-71]] as const)for(let dx=-1;dx<=1;dx++)for(let dz=-2;dz<=2;dz++)for(let h=1;h<=5;h++)b.clear(cx+dx,skyFloor(cx+dx)+h,cz+dz);
 // Sparse grounded piers support the long crossing without obstructing its interior.
 for(const [x,z] of [[0,-31],[21,-45],[42,-45],[55,-58]] as const){
  const y=skyFloor(x),ground=columns.get(x+','+z)?.y??-10;
  for(let h=ground+1;h<y;h++)place(x,h,z,'minecraft:white_concrete','Skywalk support');
 }
 // Eastern paired rings have actual depth and raised circular planted pedestals.
 for(const [cx,cz,r] of [[109,-1,23],[130,13,26]] as const){
  arc(cx,cz,r-2,12,17);
  for(let y=17;y<=17+r*2;y++)for(let x=cx-r-1;x<=cx+r+1;x++){const d=Math.hypot(x-cx,y-(17+r));if(d>=r-1&&d<=r+1)for(let z=cz;z<=cz+1;z++)place(x,y,z,'minecraft:white_concrete','Ring');}
 }
 // Stacked spherical observation rooms at the left of the central tower.
 for(let y=15;y<=61;y++)place(-45,y,-2,'minecraft:white_concrete','Structure');
 for(const cy of [26,41,56])for(let y=cy-7;y<=cy+7;y++){const radius=Math.sqrt(Math.max(0,9*9-(y-cy)**2));for(let x=-9;x<=9;x++)for(let z=-9;z<=9;z++){const q=x*x+z*z;if(q<=radius*radius&&(q>=(radius-1.2)**2||y===cy-3)){place(-45+x,y,-2+z,y===cy-3||y%7===0?'minecraft:white_concrete':'minecraft:cyan_stained_glass',y===cy-3?'Floor':'Windows');}}}
 // Dense authored conifers. Trees avoid buildings and every bridge walking channel.
 let treeCount=0;
 for(const c of columns.values())if(c.x%6===0&&c.z%6===0&&hash(c.x,c.z)>.22&&!inside(c.x,c.z,3)&&![-3,0,3].some(dx=>[-3,0,3].some(dz=>pathCells.has((c.x+dx)+','+(c.z+dz))))) {
  const height=6+Math.floor(hash(c.z,c.x)*7);treeCount++;
  for(let h=1;h<=height;h++)place(c.x,c.y+h,c.z,'minecraft:oak_log','Landscape');
  for(let h=3;h<=height+1;h++){const r=Math.min(3,Math.floor((height+2-h)/3));for(let dx=-r;dx<=r;dx++)for(let dz=-r;dz<=r;dz++)if(Math.abs(dx)+Math.abs(dz)<=r+1&&(dx!==0||dz!==0||h>height))place(c.x+dx,c.y+h,c.z+dz,'minecraft:oak_leaves','Landscape');}
 }
 // Plant the exposed terrace margins too: the reference is a garden city, not bare concrete slabs.
 for(const d of districts){
  if(d.id==='campus-airport'||d.id==='campus-dragons'||d.id==='campus-industry')continue;
  const r=reserved[districts.indexOf(d)]!;
  for(let x=r.x0+2;x<r.x1-2;x+=5)for(let z=r.z0+2;z<r.z1-2;z+=5){
   if(pathCells.has(x+','+z)||hash(x,z)<.38)continue;
   const floor=occupied.has(x+','+(r.y+1)+','+z)?r.y+1:r.y;
   if(!occupied.has(x+','+floor+','+z))continue;
   let clear=true;for(let dx=-1;dx<=1;dx++)for(let dz=-1;dz<=1;dz++)for(let h=1;h<=5;h++)if(occupied.has((x+dx)+','+(floor+h)+','+(z+dz))||pathCells.has((x+dx)+','+(z+dz)))clear=false;
   if(!clear)continue;
   place(x,floor+1,z,'minecraft:dirt','Landscape');place(x,floor+2,z,'minecraft:oak_log','Landscape');
   for(let dx=-1;dx<=1;dx++)for(let dz=-1;dz<=1;dz++)place(x+dx,floor+3,z+dz,hash(x,z)>.8?'minecraft:pink_wool':'minecraft:oak_leaves','Landscape');
   place(x,floor+4,z,'minecraft:oak_leaves','Landscape');
  }
 }
 // Narrow waterfalls follow exposed cliff columns down to the sea, with pale foam at their feet.
 for(const c of columns.values())if(c.x%17===0&&c.z%3===0&&c.y>4&&!columns.has(c.x+','+(c.z+1))){for(let y=-10;y<=c.y;y++)for(let w=0;w<=1;w++)place(c.x+w,y,c.z+1,'minecraft:light_blue_stained_glass','Waterfall');for(let x=c.x-2;x<=c.x+3;x++)for(let z=c.z+1;z<=c.z+4;z++)if(hash(x,z)>.5)place(x,-10,z,'minecraft:white_stained_glass','Waterfall');}
 if(treeCount===0)throw new Error('Missing reference forest');
 return b.finishRegions();
}

