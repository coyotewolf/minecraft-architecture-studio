import { DistrictBuilder, type District } from './builder.ts';
/** Connections are authored in world coordinates; reserved building footprints remain owned by their districts. */
export function createLandscapeDistricts(districts:readonly District[]):District[] {
 const b=new DistrictBuilder({id:'campus-landscape',title:'群島地景・橋樑與環線',origin:[0,0,0],references:['reference-01'],features:['分島岩壁與承台','跨區步行橋網','植栽與路燈','藍色玻璃瀑布雕塑','兩座景觀圓環','三層泡泡觀景艙','中央塔至空港的高架玻璃天橋'],notes:'島形、道路與高差為 AI Estimated Area；藍玻璃代表靜態水景，非流體模擬。'});
 const occupied=new Set(districts.flatMap(d=>d.project.blocks.map(v=>`${v.pos.x},${v.pos.y},${v.pos.z}`)));
 const reserved= districts.map(d=>{const xs=d.project.blocks.map(v=>v.pos.x),zs=d.project.blocks.map(v=>v.pos.z);return {x0:Math.min(...xs),x1:Math.max(...xs),z0:Math.min(...zs),z1:Math.max(...zs)};});
 function free(x:number,y:number,z:number){return !occupied.has(`${x},${y},${z}`);}
 for(const r of reserved){
  // An open structural shell rather than a falsely counted solid island.
  for(let x=r.x0;x<=r.x1;x++)for(let z=r.z0;z<=r.z1;z++){
   if(free(x,-1,z))b.set(x,-1,z,'minecraft:stone','Foundation');
   if(x===r.x0||x===r.x1||z===r.z0||z===r.z1)for(let y=-7;y<=-2;y++)b.set(x,y,z,(x+z+y)%4===0?'minecraft:stone_bricks':'minecraft:stone','Landscape');
  }
  for(const x of [r.x0+3,r.x1-3])for(let y=-7;y<=-2;y++)b.set(x,y,r.z1+1,'minecraft:light_blue_stained_glass','Landscape');
 }
 function road(x0:number,z0:number,x1:number,z1:number){const n=Math.max(Math.abs(x1-x0),Math.abs(z1-z0));for(let i=0;i<=n;i++){const x=Math.round(x0+(x1-x0)*i/n),z=Math.round(z0+(z1-z0)*i/n);for(let w=-2;w<=2;w++){const xx=x+(x0===x1?w:0),zz=z+(z0===z1?w:0);if(free(xx,1,zz))b.set(xx,1,zz,Math.abs(w)===2?'minecraft:white_concrete':'minecraft:stone_bricks','Floor');if(Math.abs(w)===2&&!reserved.some(r=>xx>=r.x0&&xx<=r.x1&&zz>=r.z0&&zz<=r.z1)&&free(xx,2,zz))b.set(xx,2,zz,'minecraft:smooth_quartz','Structure');}if(i%12===0&&!reserved.some(r=>x>=r.x0&&x<=r.x1&&z>=r.z0&&z<=r.z1))for(let y=-7;y<=0;y++)b.set(x,y,z,'minecraft:white_concrete','Structure');}}
 // Orthogonal spine network connects the floor plates while preserving buildings.
 road(-112,-36,126,-36);road(-112,46,126,46);road(-112,105,126,105);
 for(const x of [-112,-45,25,126])road(x,-36,x,105);
 for(const d of districts){const [x,,z]=d.origin;const target=z<-36?-36:z<46?46:105;road(x,z,x,target);}
 for(const [cx,cz] of [[100,38],[121,52]] as const)for(let y=3;y<=29;y++)for(let x=cx-13;x<=cx+13;x++){const r=Math.hypot(x-cx,y-16);if(r>=12&&r<13)for(let z=cz;z<=cz+1;z++)if(free(x,y,z))b.set(x,y,z,'minecraft:white_concrete','Structure');}
 for(let x=-105;x<=115;x+=20)for(const z of [-34,48,107]){if(reserved.some(r=>x-2<=r.x1&&x+2>=r.x0&&z-2<=r.z1&&z+2>=r.z0))continue;b.floor(x-2,z-2,x+2,z+2,0,'minecraft:dirt');b.tree(x,1,z);}

 // Three observation pods on a structural spine, seen beside the main tower in the overview image.
 for(let y=0;y<=38;y++)b.box(-36,y,-7,-34,y,-5,'minecraft:white_concrete','Structure');
 for(const floor of [11,21,31])for(let y=floor;y<=floor+8;y++){
   const r=Math.floor(3+5*Math.sin(Math.PI*(y-floor)/8));
   for(let x=-r;x<=r;x++)for(let z=-r;z<=r;z++)if(x*x+z*z<=r*r){
     const edge=(Math.abs(x)+1)**2+z*z>r*r||x*x+(Math.abs(z)+1)**2>r*r;
     if(y===floor||y===floor+8||edge)b.set(-35+x,y,-5+z,y===floor||y===floor+8?'minecraft:smooth_quartz':'minecraft:cyan_stained_glass',y===floor?'Floor':'Windows');
   }
   if(y===floor+1){b.set(-32,y,-5,'minecraft:crafting_table','Decoration');b.set(-38,y,-5,'minecraft:sea_lantern','Decoration');}
 }
 for(let y=1;y<=33;y++){b.clear(-34,y,-6);b.set(-34,y,-6,'minecraft:ladder','Structure',{facing:'east'});}
 b.floor(-39,-10,-31,0,0,'minecraft:stone_bricks');b.floor(-39,-10,-31,0,1);
 for(let y=2;y<=4;y++)b.clear(-34,y,-5);
 function sky(x:number,z:number,y=19){
   for(let w=-2;w<=2;w++){
     if(free(x+w,y,z))b.set(x+w,y,z,'minecraft:smooth_quartz','Floor');
     if(Math.abs(w)===2)for(let h=1;h<=4;h++)if(free(x+w,y+h,z))b.set(x+w,y+h,z,z%7===0?'minecraft:white_concrete':'minecraft:cyan_stained_glass','Structure');
     if(free(x+w,y+5,z))b.set(x+w,y+5,z,'minecraft:cyan_stained_glass','Roof');
   }
 }
 for(let z=-15;z>=-26;z--)sky(0,z);
 for(let x=0;x<=39;x++){for(let z=-28;z<=-24;z++){if(free(x,19,z))b.set(x,19,z,'minecraft:smooth_quartz','Floor');if(Math.abs(z+26)===2)for(let h=20;h<=23;h++)if(free(x,h,z))b.set(x,h,z,x%7===0?'minecraft:white_concrete':'minecraft:cyan_stained_glass','Structure');if(free(x,24,z))b.set(x,24,z,'minecraft:cyan_stained_glass','Roof');}}
 for(let z=-26;z>=-68;z--)sky(39,z);
 // Clear elbows into a continuous three-wide corridor; keep the outer walls and roof.
 for(let x=-1;x<=1;x++)for(let z=-27;z<=-25;z++)for(let y=20;y<=23;y++)b.clear(x,y,z);
 for(let x=38;x<=40;x++)for(let z=-27;z<=-25;z++)for(let y=20;y<=23;y++)b.clear(x,y,z);
 for(let x=38;x<=40;x++)for(const [z,y] of [[-69,19],[-70,18]] as const)b.set(x,y,z,'minecraft:quartz_stairs','Structure',{facing:'south'});
 for(const [x,z] of [[0,-24],[20,-26],[39,-40],[39,-60]] as const)for(let y=2;y<=18;y++)if(free(x,y,z))b.set(x,y,z,'minecraft:white_concrete','Structure');
 return b.finishRegions();
}

