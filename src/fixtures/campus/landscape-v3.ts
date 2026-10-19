import { REFERENCE_ORIGINS as O, referencePoint as at } from './reference-layout.ts';
import type { MinecraftId } from '../../core/contracts.ts';
import type { District } from './builder.ts';
import { HighDetailBuilder } from './high-detail.ts';
/** Higher-resolution terrain surfaces with irregular joined islands. Every visible structure is a canonical cell. */
export function createLandscapeDistrictsV3(districts:readonly District[]):District[]{
 const b=new HighDetailBuilder({id:'campus-landscape',title:'曲線群島、山脊森林與多層白橋',origin:[0,0,0],references:['reference-01'],features:['非矩形連接岩島、凹岸與層疊山脊','高針葉林、低花叢及懸崖植栽','多層迴轉白橋、圓形廣場與窄欄杆','空港長廊、雙景觀環與玻璃瀑布'],notes:'地形採中空岩殼施工，地表、樹木、橋與靜態玻璃水景皆有真實座標；海面不計備料，背面與山體內部為 AI Estimated Area。'});
 const occupied=new Set<string>();
 const groups=new Map<string,{x0:number;x1:number;z0:number;z1:number;y:number}>();
 for(const d of districts){const id=d.parentGroupId??d.id,r=groups.get(id)??{x0:Infinity,x1:-Infinity,z0:Infinity,z1:-Infinity,y:d.origin[1]};for(const v of d.project.blocks){occupied.add(`${v.pos.x},${v.pos.y},${v.pos.z}`);r.x0=Math.min(r.x0,v.pos.x);r.x1=Math.max(r.x1,v.pos.x);r.z0=Math.min(r.z0,v.pos.z);r.z1=Math.max(r.z1,v.pos.z);}groups.set(id,r);}
 const reserved=[...groups.values()];const inside=(x:number,z:number,pad=0)=>reserved.some(r=>x>=r.x0-pad&&x<=r.x1+pad&&z>=r.z0-pad&&z<=r.z1+pad);
 const hash=(x:number,z:number)=>{const n=Math.sin(x*127.1+z*311.7)*43758.5453;return n-Math.floor(n);};
 const put=(x:number,y:number,z:number,id:MinecraftId='minecraft:white_concrete',cat='Landscape')=>{if(!occupied.has(`${x},${y},${z}`))b.set(x,y,z,id,cat,id==='minecraft:oak_leaves'?{persistent:'true',distance:'1'}:{});};
 const cols=new Map<string,{x:number;z:number;y:number}>();
 function column(x:number,z:number,y:number){const key=x+','+z,old=cols.get(key);if(!old||old.y<y)cols.set(key,{x,z,y});}
 // Island footprints exceed their architecture and merge into coves instead of outlining each rectangular foundation.
 for(const r of reserved){const cx=(r.x0+r.x1)/2,cz=(r.z0+r.z1)/2,rx=(r.x1-r.x0)*.64+14,rz=(r.z1-r.z0)*.64+14;
  for(let x=Math.floor(cx-rx-8);x<=cx+rx+8;x++)for(let z=Math.floor(cz-rz-8);z<=cz+rz+8;z++){
   const q=((x-cx)/rx)**2+((z-cz)/rz)**2,noise=.12*Math.sin(x*.075+z*.04)+.08*Math.cos(z*.11)+.035*Math.sin(x*.43);
   const under=x>=r.x0&&x<=r.x1&&z>=r.z0&&z<=r.z1;
   if(q>1+noise&&!under)continue;
   const edgeDrop=Math.max(0,Math.floor((q-.48)*16));
   column(x,z,under?r.y-1:Math.max(3,r.y-1-edgeDrop+Math.round(2*Math.sin(x*.12)*Math.cos(z*.09))));
  }
 }
 // Reference-space ridges and garden islets share the same calibrated construction frame.
 const landforms:[number,number,number,number,number][]=[];
 for(const [px,py,y,rx,rz]of[[130,120,105,65,45],[360,65,110,85,42],[660,85,90,95,38],[970,100,85,100,35],[1415,185,70,52,65],[80,440,65,40,85],[1000,575,32,31,28],[590,552,34,35,24],[740,615,30,34,25],[1125,610,29,28,32],[520,730,24,28,22]] as const){const [x,,z]=at(px,py,y);landforms.push([x,z,rx,rz,y]);}
 // Garden terraces occupy the spaces between landmarks rather than isolated display plinths.
 for(const [px,py,y,rx,rz]of[[405,455,29,33,30],[505,475,30,42,28],[610,485,28,38,30],[675,535,27,37,30],[800,568,24,30,32],[875,590,22,30,28],[930,685,18,34,28],[660,675,19,31,30],[470,650,22,33,27],[350,580,24,30,35],[240,690,22,28,32],[380,790,17,28,28],[795,800,16,33,28],[1000,770,17,32,25],[1100,745,17,28,26]]as const){const[x,,z]=at(px,py,y);landforms.push([x,z,rx,rz,y]);}
 for(const[px,py,y,rx,rz]of[[560,325,53,45,39],[670,355,48,42,34],[820,360,43,42,37],[990,290,58,45,35],[1210,330,42,40,32]]as const){const[x,,z]=at(px,py,y);landforms.push([x,z,rx,rz,y]);}
 const podBase=at(550,350,78);landforms.push([podBase[0],podBase[2],31,28,36]);
 for(const[cx,cz,rx,rz,height]of landforms){
  for(let x=cx-rx;x<=cx+rx;x++)for(let z=cz-rz;z<=cz+rz;z++){
   const q=((x-cx)/rx)**2+((z-cz)/rz)**2;if(q>1+.08*Math.sin(x*.12)*Math.cos(z*.15)||inside(x,z,3))continue;
   column(x,z,Math.floor(height-22*q+4*Math.sin(x*.07)*Math.cos(z*.08)+2*Math.sin(x*.21+z*.15)));
  }
 }
 // Lower planted ledges articulate the exposed cliffs while retaining canals.
 const shoreline=[...cols.values()].filter(c=>![[1,0],[-1,0],[0,1],[0,-1]].every(([dx,dz])=>cols.has((c.x+dx!)+','+(c.z+dz!))));
 for(const c of shoreline)for(let dx=-9;dx<=9;dx++)for(let dz=-9;dz<=9;dz++){
  const distance=Math.hypot(dx,dz);if(distance>8+2*hash(c.x,c.z)||inside(c.x+dx,c.z+dz))continue;
  column(c.x+dx,c.z+dz,Math.max(1,c.y-5-Math.floor(distance*1.5)));
 }
 const rock:readonly MinecraftId[]=['minecraft:stone','minecraft:light_gray_concrete','minecraft:stone','minecraft:gray_concrete','minecraft:stone_bricks'];
 for(const c of cols.values()){
  put(c.x,c.y,c.z,'minecraft:grass_block');
  const low=Math.min(...[[1,0],[-1,0],[0,1],[0,-1]].map(([dx,dz])=>cols.get((c.x+dx!)+','+(c.z+dz!))?.y??-4));
  for(let y=Math.max(-4,low+1);y<c.y;y++){
   const material=rock[(Math.floor((y+12)/9)+Math.floor(hash(Math.floor(c.x/3),Math.floor(c.z/3))*3))%rock.length]!;put(c.x,y,c.z,material,'Cliff');
   if(y<c.y-5&&y%13===0&&hash(c.x+y,c.z)>.83)put(c.x,y,c.z,'minecraft:oak_leaves','Cliff planting');
  }
  if(c.x%18===0&&c.z%18===0)for(let y=-4;y<c.y;y++)put(c.x,y,c.z,'minecraft:stone','Foundation');
 }
 const path=new Set<string>();
 function curve(points:readonly(readonly[number,number,number])[],width=3){
  const samples:{x:number;y:number;z:number}[]=[];
  for(let seg=0;seg<points.length-1;seg++){
   const p0=points[Math.max(0,seg-1)]!,p1=points[seg]!,p2=points[seg+1]!,p3=points[Math.min(points.length-1,seg+2)]!;
   const length=Math.max(1,Math.ceil(Math.hypot(p2[0]-p1[0],p2[2]-p1[2])*1.5));
   for(let i=0;i<=length;i++){const t=i/length;const v=[0,1,2].map(a=>Math.round(.5*((2*p1[a]!)+(-p0[a]!+p2[a]!)*t+(2*p0[a]!-5*p1[a]!+4*p2[a]!-p3[a]!)*t*t+(-p0[a]!+3*p1[a]!-3*p2[a]!+p3[a]!)*t*t*t)));samples.push({x:v[0]!,y:v[1]!,z:v[2]!});}
  }
  const unique=[...new Map(samples.map(p=>[`${p.x},${p.y},${p.z}`,p])).values()];
  for(const p of unique)for(let dx=-width;dx<=width;dx++)for(let dz=-width;dz<=width;dz++)if(dx*dx+dz*dz<=width*width+1){const x=p.x+dx,z=p.z+dz;path.add(x+','+z);put(x,p.y,z,'minecraft:smooth_quartz','Bridge floor');for(let h=1;h<=4;h++)b.clear(x,p.y+h,z);}
  for(let i=0;i<unique.length;i++){const p=unique[i]!,next=unique[Math.min(i+1,unique.length-1)]!,prev=unique[Math.max(0,i-1)]!,angle=Math.atan2(next.z-prev.z,next.x-prev.x);
   for(const side of[-1,1]){const x=p.x+Math.round(-Math.sin(angle)*(width+1)*side),z=p.z+Math.round(Math.cos(angle)*(width+1)*side);if(!path.has(x+','+z)&&!inside(x,z)){put(x,p.y,z);put(x,p.y+1,z,'minecraft:iron_bars','Railing');if(i%22===0){put(x,p.y+1,z);put(x,p.y+2,z,'minecraft:lantern','Lighting');}}}
   if(i%28===0&&!inside(p.x,p.z)){const ground=cols.get(p.x+','+p.z)?.y??-4;for(let y=ground+1;y<p.y;y++)for(let dx=-1;dx<=1;dx++)put(p.x+dx,y,p.z,'minecraft:white_concrete','Bridge piers');}
  }
 }
 function arc(cx:number,cz:number,rx:number,rz:number,y:number){const ps:[number,number,number][]=[];for(let i=0;i<=120;i++){const a=i*Math.PI/60;ps.push([Math.round(cx+rx*Math.cos(a)),y,Math.round(cz+rz*Math.sin(a))]);}curve(ps,3);}
 const plaza=at(710,570,45);arc(plaza[0],plaza[2],49,32,45);
 // Filled radial court: fountain, eight paths, lawn beds and planter edging.
 for(let dx=-48;dx<=48;dx++)for(let dz=-31;dz<=31;dz++){
  const q=(dx/48)**2+(dz/31)**2;if(q>1)continue;const x=plaza[0]+dx,z=plaza[2]+dz;
  const angle=Math.atan2(dz/31,dx/48),radial=Math.abs(Math.sin(angle*4))<.14;
  const basin=dx*dx+dz*dz<100;path.add(x+','+z);
  put(x,45,z,basin?'minecraft:light_blue_stained_glass':radial||q>.81?'minecraft:smooth_quartz':'minecraft:grass_block','Plaza');
  if(!basin&&!radial&&q<.73&&q>.2&&x%6===0&&z%6===0){put(x,46,z,'minecraft:oak_leaves','Plaza planting');if((x+z)%12===0)put(x,47,z,'minecraft:pink_wool','Plaza planting');}
  if(q>.72&&q<.8)put(x,46,z,'minecraft:white_concrete','Planter edging');
 }
 for(let h=46;h<=51;h++)put(plaza[0],h,plaza[2],h===51?'minecraft:sea_lantern':'minecraft:white_concrete','Fountain');
 for(const[dx,dz]of[[-26,-18],[26,-18],[-26,18],[26,18]]as const)for(let y=(cols.get((plaza[0]+dx)+','+(plaza[2]+dz))?.y??-4)+1;y<45;y++)for(let w=-1;w<=1;w++)put(plaza[0]+dx+w,y,plaza[2]+dz,'minecraft:white_concrete','Plaza pier');
 arc(O.ring[0],O.ring[2],65,48,35);arc(O.twins[0],O.twins[2],58,42,36);arc(O.sphere[0],O.sphere[2],49,42,25);
 curve([[O.ring[0],35,O.ring[2]+47],at(425,513,38),at(580,530,43),[plaza[0]-45,45,plaza[2]]]);
 curve([[plaza[0]-40,45,plaza[2]+20],at(570,630,37),[O.sphere[0],25,O.sphere[2]-40]]);
 curve([[plaza[0],45,plaza[2]-30],[O.command[0],O.command[1]+1,O.command[2]+22]]);
 curve([[plaza[0]+45,45,plaza[2]],at(920,540,40),[O.twins[0]+55,36,O.twins[2]+15],[O.workshop[0]-23,34,O.workshop[2]+20]]);
 curve([[plaza[0],45,plaza[2]+30],at(705,655,34),[O.greenhouses[0],23,O.greenhouses[2]-44]]);
 curve([[plaza[0]+35,45,plaza[2]+24],at(850,615,33),[O.temples[0]-25,27,O.temples[2]-16]]);
 curve([[O.apartments[0]+38,31,O.apartments[2]],at(310,735,29),[O.pavilions[0]-30,22,O.pavilions[2]-30]]);
 curve([[O.pavilions[0]+45,22,O.pavilions[2]],[O.greenhouses[0]-35,23,O.greenhouses[2]+33]]);
 curve([[O.greenhouses[0]+35,24,O.greenhouses[2]+25],at(880,770,28),[O.temples[0]+25,27,O.temples[2]+16]]);
 curve([[O.temples[0]+27,30,O.temples[2]],at(1060,706,29),[O.dragons[0]-73,23,O.dragons[2]+10]]);
 curve([[O.industry[0]+58,83,O.industry[2]+15],at(575,185,83),at(810,190,81),[O.airport[0]-80,O.airport[1]+1,O.airport[2]-12]],4);
 curve([[O.industry[0],71,O.industry[2]+36],at(380,260,62),[O.ring[0]+40,35,O.ring[2]-15]]);
 // Repeated garden rotundas and crossing walks fill the middle distance of the reference.
 for(const[px,py,y,r]of[[470,410,55,14],[610,450,47,16],[840,455,45,13],[910,530,40,13],[520,565,37,18],[580,655,31,12],[830,710,26,18],[1020,650,32,17]]as const){
  const[cx,,cz]=at(px,py,y);arc(cx,cz,r,r*.72,y);
  for(let x=cx-r+3;x<=cx+r-3;x++)for(let z=cz-Math.floor(r*.72)+3;z<=cz+Math.floor(r*.72)-3;z++)if(((x-cx)/(r-3))**2+((z-cz)/(r*.72-3))**2<=1){
   put(x,y,z,Math.abs(x-cx)<=1||Math.abs(z-cz)<=1?'minecraft:smooth_quartz':'minecraft:grass_block','Rotunda floor');path.add(x+','+z);
   if(Math.abs(x-cx)>3&&Math.abs(z-cz)>3&&x%5===0&&z%5===0){put(x,y+1,z,'minecraft:oak_leaves','Rotunda garden');if((x+z)%10===0)put(x,y+2,z,'minecraft:pink_wool','Rotunda garden');}
  }
  for(const dx of[-r+4,r-4])for(let h=(cols.get((cx+dx)+','+cz)?.y??-4)+1;h<y;h++)put(cx+dx,h,cz,'minecraft:white_concrete','Rotunda support');
 }
 curve([at(350,585,32),at(460,565,35),at(520,565,37),at(610,560,41),[plaza[0]-40,45,plaza[2]+12]],2);
 curve([at(580,655,31),at(665,680,29),at(750,715,27),at(830,710,26),at(940,695,28),at(1020,650,32)],2);
 // High glazed command-to-airport corridor. Its narrow openings are authored into both buildings.
 const sky:{x:number;z:number;y:number}[]=[];
 const airportDeck=O.airport[1]+45;
 const skyRoute=[[O.command[0],117,O.command[2]-22],[O.command[0],117,O.command[2]-55],[O.airport[0],airportDeck,O.airport[2]+77],[O.airport[0],airportDeck,O.airport[2]+65]] as const;
 for(let k=0;k<skyRoute.length-1;k++){const a=skyRoute[k]!,v=skyRoute[k+1]!,n=Math.max(Math.abs(v[0]-a[0]),Math.abs(v[2]-a[2]));for(let i=0;i<=n;i++)sky.push({x:Math.round(a[0]+(v[0]-a[0])*i/n),y:Math.round(a[1]+(v[1]-a[1])*i/n),z:Math.round(a[2]+(v[2]-a[2])*i/n)});}
 const skyFoot=new Map<string,{x:number;z:number;y:number}>();const skyInner=new Set<string>();
 for(const p of sky)for(let dx=-4;dx<=4;dx++)for(let dz=-4;dz<=4;dz++){const x=p.x+dx,z=p.z+dz,key=x+','+z;skyFoot.set(key,{x,z,y:p.y});if(Math.abs(dx)<=3&&Math.abs(dz)<=3)skyInner.add(key);path.add(key);}
 for(const[key,p]of skyFoot){put(p.x,p.y,p.z,'minecraft:smooth_quartz','Skywalk floor');for(let h=1;h<=5;h++)b.clear(p.x,p.y+h,p.z);const rib=p.x%10===0||p.z%10===0;if(!skyInner.has(key))for(let h=1;h<=5;h++)put(p.x,p.y+h,p.z,h===1?'minecraft:gold_block':rib?'minecraft:white_concrete':'minecraft:cyan_stained_glass','Skywalk envelope');put(p.x,p.y+6,p.z,rib?'minecraft:white_concrete':'minecraft:light_blue_stained_glass','Skywalk roof');}
 for(const[cx,cz,y]of[[O.command[0],O.command[2]-22,117],[O.airport[0],O.airport[2]+65,airportDeck]]as const)for(let dx=-3;dx<=3;dx++)for(let dz=-4;dz<=4;dz++)for(let h=1;h<=5;h++)b.clear(cx+dx,y+h,cz+dz);
 for(let i=15;i<sky.length-8;i+=30){const p=sky[i]!;for(let h=(cols.get(p.x+','+p.z)?.y??-4)+1;h<p.y;h++)for(let dx=-1;dx<=1;dx++)put(p.x+dx,h,p.z,'minecraft:white_concrete','Skywalk piers');}
 for(const[px,py,r]of[[1070,395,39],[1170,420,44]]as const){const[cx,,cz]=at(px,py,39+r);arc(cx,cz,r-2,22,39);for(let y=39;y<=39+r*2;y++)for(let x=cx-r-2;x<=cx+r+2;x++){const d=Math.hypot(x-cx,y-(39+r));if(d>=r-1&&d<=r+1)for(let z=cz;z<=cz+2;z++)put(x,y,z,'minecraft:white_concrete','Scenic ring');}}
 const[ox,,oz]=at(550,350,78);
 for(let y=-3;y<=114;y++)for(let x=-2;x<=2;x++)for(let z=-1;z<=1;z++)put(ox+x,y,oz+z,'minecraft:white_concrete','Observation spine');
 arc(ox,oz,25,22,39);curve([[ox-24,39,oz],[O.ring[0]+55,35,O.ring[2]]]);curve([[ox+24,39,oz],[O.command[0]-24,O.command[1]+1,O.command[2]]]);
 for(const cy of[52,78,104])for(let y=cy-12;y<=cy+12;y++){const r=Math.sqrt(Math.max(0,15*15-(y-cy)**2));for(let x=-15;x<=15;x++)for(let z=-15;z<=15;z++)if(x*x+z*z<=r*r&&(x*x+z*z>=(r-1)**2||y===cy-5))put(ox+x,y,oz+z,y===cy-5||y%8===0?'minecraft:white_concrete':'minecraft:cyan_stained_glass','Observation pod');}
 // Full-height conifers with uneven spacing and genuinely narrow branches.
 for(const c of cols.values())if(c.x%9===0&&c.z%9===0&&hash(c.x,c.z)>.2&&!inside(c.x,c.z,4)&&![-5,0,5].some(dx=>[-5,0,5].some(dz=>path.has((c.x+dx)+','+(c.z+dz))))) {
  const height=9+Math.floor(hash(c.z,c.x)*11);for(let h=1;h<=height;h++)put(c.x,c.y+h,c.z,'minecraft:oak_log','Forest trunk');
  for(let h=4;h<=height+1;h++){const radius=Math.min(4,Math.max(0,Math.floor((height+2-h)/4)));for(let dx=-radius;dx<=radius;dx++)for(let dz=-radius;dz<=radius;dz++)if(Math.abs(dx)+Math.abs(dz)<=radius+1&&(dx!==0||dz!==0||h>height))put(c.x+dx,c.y+h,c.z+dz,'minecraft:oak_leaves','Forest crown');}
 }
 // Small flowers, lawns and occasional pink ornamental crowns soften the architectural terraces.
 for(const c of cols.values())if(c.x%5===0&&c.z%5===0&&!inside(c.x,c.z,1)&&!path.has(c.x+','+c.z)&&hash(c.x,c.z)>.75){put(c.x,c.y+1,c.z,'minecraft:oak_leaves','Garden');if(hash(c.z,c.x)>.6)put(c.x,c.y+2,c.z,'minecraft:pink_wool','Flowering garden');}
 for(const c of cols.values())if(c.x%29===0&&c.y>8&&!cols.has(c.x+','+(c.z+1))){for(let y=-3;y<=c.y;y++)for(let w=0;w<3;w++)put(c.x+w,y,c.z+1,'minecraft:light_blue_stained_glass','Waterfall');for(let x=c.x-3;x<=c.x+5;x++)for(let z=c.z+1;z<=c.z+6;z++)if(hash(x,z)>.45)put(x,-3,z,'minecraft:white_stained_glass','Foam');}
 return b.finishParts();
}

