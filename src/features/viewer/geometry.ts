import type { BlockRecord, Facing } from '../../core/contracts.ts';
export type Vec3 = readonly [number, number, number];
export interface ShapeBox { readonly min: Vec3; readonly max: Vec3; readonly color?: number }
export interface BlockShape { readonly boxes: readonly ShapeBox[]; readonly color: number; readonly opacity: number; readonly supported: boolean; readonly axis?: string }
const box = (min: Vec3, max: Vec3, color?: number): ShapeBox => ({ min, max, ...(color === undefined ? {} : {color}) });
const directions: readonly Facing[] = ['east', 'south', 'west', 'north'];
/** Clockwise around the cell center in canonical XZ (not a change to block coordinates). */
function rotate(b: ShapeBox, turns: number): ShapeBox {
  let min = [...b.min], max = [...b.max];
  for (let i = 0; i < turns; i++) { const a = min, c = max; min = [1-c[2]!, a[1]!, a[0]!]; max = [1-a[2]!, c[1]!, c[0]!]; }
  return box(min as unknown as Vec3, max as unknown as Vec3, b.color);
}
const dyeColors: Readonly<Record<string,number>> = {white:0xdedcd1,orange:0xd98535,magenta:0xb75aa9,light_blue:0x80c7de,yellow:0xe0c65a,lime:0x8cb64e,pink:0xd99cab,gray:0x515b60,light_gray:0xa5aaa6,cyan:0x399da6,purple:0x8656a5,blue:0x146db2,brown:0x795638,green:0x5e793c,red:0xb74640,black:0x252b31};
const cubes: Readonly<Record<string, number>> = {
  'minecraft:deepslate_tiles':0x414a50,'minecraft:polished_blackstone':0x3c3a42,'minecraft:iron_block':0xc7c9c6,'minecraft:bone_block':0xdad3b9,
  'minecraft:amethyst_block':0x9973ba,'minecraft:grass_block':0x71934a,'minecraft:bookshelf':0x9f7950,'minecraft:hay_block':0xc4a641,
  'minecraft:furnace':0x7c8184,'minecraft:blast_furnace':0x666d70,'minecraft:crafting_table':0xa27b4e,'minecraft:smithing_table':0x544b43,'minecraft:cartography_table':0xa28c60,'minecraft:barrel':0x987348,
  'minecraft:stone': 0x92989d, 'minecraft:stone_bricks': 0x879298,
  'minecraft:oak_planks': 0xb99a64, 'minecraft:white_concrete': 0xdedcd1,
  'minecraft:glass': 0x9fd7e5, 'minecraft:cyan_stained_glass':0x399da6,'minecraft:light_blue_stained_glass':0x80c7de,
  'minecraft:smooth_quartz':0xe5e1d4,'minecraft:quartz_block':0xe5e1d4,'minecraft:polished_deepslate':0x465057,'minecraft:dirt':0x70543b,'minecraft:oak_leaves':0x507a43,'minecraft:sea_lantern':0xb7e5d7,'minecraft:yellow_terracotta':0xc9a55d,'minecraft:gray_concrete':0x515b60,'minecraft:black_concrete':0x252b31,'minecraft:spruce_planks':0x785b3c,'minecraft:gold_block':0xffbb08,'minecraft:glowstone':0xffc64b,
};
/** Deliberately bounded geometry support; unknown shapes are wireframe markers, never plausible cubes. */
export function shapeForBlock(block: BlockRecord): BlockShape {
  const {id,state:s} = block;
  const common = {color: /quartz/.test(id)?0xe5e1d4:/deepslate/.test(id)?0x465057:/stone|brick/.test(id)?0x879298:0xb99a64, opacity: 1, supported: true};
  if (id.endsWith('_stairs')) {
    const y0 = s.half === 'top' ? 0.5 : 0, y1 = y0 + 0.5;
    const step0 = s.half === 'top' ? 0 : 0.5, step1 = step0 + 0.5;
    const boxes: ShapeBox[] = [box([0,y0,0],[1,y1,1])];
    // Relative left of east is north. Corner occupancy follows state, independent of half.
    for (const x of [0,0.5]) for (const z of [0,0.5]) {
      const forward = x === 0.5, side = s.shape?.endsWith('left') ? z === 0 : z === 0.5;
      const filled = s.shape?.startsWith('inner') ? forward || side : s.shape?.startsWith('outer') ? forward && side : forward;
      if (filled) boxes.push(box([x,step0,z],[x+0.5,step1,z+0.5]));
    }
    return {...common, boxes: boxes.map(b => rotate(b,directions.indexOf(s.facing as Facing)))};
  }
  if (id.endsWith('_slab')) return {...common, boxes:[box([0,s.type === 'top' ? 0.5 : 0,0],[1,s.type === 'bottom' ? 0.5 : 1,1])]};
  if (id.endsWith('_door') && !id.endsWith('_trapdoor')) {
    const turn = directions.indexOf(s.facing as Facing) + (s.open === 'true' ? s.hinge === 'left' ? 1 : 3 : 0);
    return {...common, color:id==='minecraft:iron_door'?0xc7c9c6:0x98734a, boxes:[rotate(box([0,0,0],[3/16,1,1]),turn%4)]};
  }
  if (id.endsWith('_bed')) {
    // Model authored facing north. Only the outer end has legs; the pair shares its middle edge.
    const end = s.part === 'head' ? 0 : 13/16;
    const boxes = [box([0,3/16,0],[1,9/16,1],0xb5574f), box([0,0,end],[3/16,3/16,end+3/16],0x896744), box([13/16,0,end],[1,3/16,end+3/16],0x896744)];
    return {...common,boxes:boxes.map(b=>rotate(b,(directions.indexOf(s.facing as Facing)+1)%4))};
  }
  const northTurns=(directions.indexOf(s.facing as Facing)+1)%4;
  if(id==='minecraft:farmland')return {...common,color:0x715236,boxes:[box([0,0,0],[1,15/16,1])]};
  if(id==='minecraft:pink_tulip'||id==='minecraft:allium'){
    const stem=box([7/16,0,7/16],[9/16,9/16,9/16],0x5d8b42);
    const leaves=[box([4/16,3/16,7/16],[8/16,5/16,9/16],0x6b984b),box([8/16,5/16,7/16],[12/16,7/16,9/16],0x6b984b)];
    if(id==='minecraft:allium')return {...common,color:0xb28ace,boxes:[stem,...leaves,box([5/16,8/16,5/16],[11/16,13/16,11/16]),box([4/16,9/16,6/16],[12/16,12/16,10/16]),box([6/16,9/16,4/16],[10/16,12/16,12/16])]};
    return {...common,color:0xe8a7be,boxes:[stem,...leaves,box([6/16,8/16,6/16],[10/16,10/16,10/16]),box([5/16,9/16,6/16],[7/16,13/16,10/16]),box([9/16,9/16,6/16],[11/16,13/16,10/16]),box([7/16,9/16,5/16],[9/16,12/16,7/16]),box([7/16,9/16,9/16],[9/16,12/16,11/16])]};
  }  if(id==='minecraft:wheat'){
    const height=(2+Number(s.age??0))/10;
    return {...common,color:s.age==='7'?0xd3b653:0x72a346,boxes:[box([.18,0,.18],[.25,height,.82]),box([.75,0,.18],[.82,height,.82]),box([.18,0,.47],[.82,height,.53])]};
  }
  if(id==='minecraft:water')return {...common,color:0x4285ad,opacity:.55,boxes:[box([0,0,0],[1,Number(s.level)>=8?1:(8-Number(s.level??0))/9,1])]};
  if(id.endsWith('_trapdoor')){
    const panel=s.open==='true'?rotate(box([0,0,13/16],[1,1,1]),northTurns):box([0,s.half==='top'?13/16:0,0],[1,s.half==='top'?1:3/16,1]);
    return {...common,boxes:[panel]};
  }
  if(id==='minecraft:iron_bars'||id==='minecraft:glass_pane'||id.endsWith('_stained_glass_pane')||id.endsWith('_fence')){
    const pane=id==='minecraft:glass_pane'||id.endsWith('_stained_glass_pane'),bars=id==='minecraft:iron_bars'||pane,lo=bars?7/16:6/16,hi=1-lo;
    const boxes=[box([lo,0,lo],[hi,1,hi])];
    for(const [direction,turn] of [['east',0],['south',1],['west',2],['north',3]] as const)if(s[direction]==='true'){
      if(bars)boxes.push(rotate(box([hi,0,lo],[1,1,hi]),turn));
      else for(const y of [6/16,12/16])boxes.push(rotate(box([hi,y,7/16],[1,y+3/16,9/16]),turn));
    }
    return {...common,color:pane?(dyeColors[id.slice(10,-19)]??0x9fd7e5):bars?0x9ba5a7:0xb99a64,opacity:pane?.38:1,boxes};
  }
  if(id.endsWith('_fence_gate')){
    const y=s.in_wall==='true'?-3/16:0;
    const boxes=[box([0,5/16+y,7/16],[2/16,1+y,9/16]),box([14/16,5/16+y,7/16],[1,1+y,9/16])];
    if(s.open==='true')for(const x of [0,14/16])boxes.push(box([x,6/16+y,0],[x+2/16,15/16+y,7/16]));
    else for(const h of [6/16,12/16])boxes.push(box([2/16,h+y,7/16],[14/16,h+3/16+y,9/16]));
    return {...common,boxes:boxes.map(b=>rotate(b,northTurns))};
  }
  if(id.endsWith('_pressure_plate'))return {...common,boxes:[box([1/16,0,1/16],[15/16,s.powered==='true'?1/32:1/16,15/16])]};
  if(id==='minecraft:ladder')return {...common,boxes:[box([2/16,0,0],[4/16,1,2/16]),box([12/16,0,0],[14/16,1,2/16]),...Array.from({length:4},(_,i)=>box([4/16,(2+i*4)/16,0],[12/16,(3+i*4)/16,2/16]))].map(b=>rotate(b,(northTurns+2)%4))};
  if(id==='minecraft:lantern'||id==='minecraft:soul_lantern'){
    const y=s.hanging==='true'?1/16:0;
    return {...common,color:0xe6b967,boxes:[box([5/16,y,5/16],[11/16,7/16+y,11/16]),box([6/16,7/16+y,6/16],[10/16,9/16+y,10/16])]};
  }
  if(id==='minecraft:brewing_stand')return {...common,color:0x9c8760,boxes:[box([1/16,0,1/16],[15/16,2/16,15/16]),box([7/16,2/16,7/16],[9/16,14/16,9/16]),box([3/16,5/16,3/16],[13/16,7/16,5/16]),box([7/16,5/16,5/16],[9/16,7/16,14/16])]};
  if(id==='minecraft:enchanting_table')return {...common,color:0x493c51,boxes:[box([0,0,0],[1,12/16,1]),box([3/16,13/16,4/16],[13/16,15/16,12/16],0xd1bd89)]};
  if(id==='minecraft:chest'||id==='minecraft:trapped_chest'){
    const x0=s.type==='right'?0:1/16,x1=s.type==='left'?1:15/16;
    return {...common,boxes:[box([x0,0,1/16],[x1,14/16,15/16]),box([7/16,7/16,0],[9/16,11/16,1/16],0xd1c89c)].map(b=>rotate(b,northTurns))};
  }
  if(id==='minecraft:hopper')return {...common,color:0x5d666c,boxes:[box([0,10/16,0],[1,1,2/16]),box([0,10/16,14/16],[1,1,1]),box([0,10/16,2/16],[2/16,1,14/16]),box([14/16,10/16,2/16],[1,1,14/16]),box([4/16,4/16,4/16],[12/16,10/16,12/16]),s.facing==='down'?box([6/16,0,6/16],[10/16,4/16,10/16]):rotate(box([6/16,4/16,0],[10/16,8/16,6/16]),northTurns)]};
  if(id==='minecraft:cauldron')return {...common,color:0x51565d,boxes:[box([0,0,0],[1,4/16,1]),box([0,4/16,0],[1,1,2/16]),box([0,4/16,14/16],[1,1,1]),box([0,4/16,2/16],[2/16,1,14/16]),box([14/16,4/16,2/16],[1,1,14/16])]};
  if(id==='minecraft:anvil'||id==='minecraft:chipped_anvil'||id==='minecraft:damaged_anvil')return {...common,color:0x555b61,boxes:[box([2/16,0,2/16],[14/16,4/16,14/16]),box([4/16,4/16,3/16],[12/16,5/16,13/16]),box([6/16,5/16,4/16],[10/16,10/16,12/16]),box([3/16,10/16,0],[13/16,1,1])].map(b=>rotate(b,northTurns))};
  if(id==='minecraft:stonecutter')return {...common,boxes:[box([0,0,0],[1,9/16,1]),rotate(box([7/16,9/16,2/16],[9/16,15/16,14/16],0xb8baba),northTurns)]};
  if(id==='minecraft:rail'&&(s.shape==='north_south'||s.shape==='east_west')){
    const boxes=[box([3/16,1/16,0],[4/16,2/16,1],0x9b9c94),box([12/16,1/16,0],[13/16,2/16,1],0x9b9c94),...Array.from({length:3},(_,i)=>box([1/16,0,(1+i*6)/16],[15/16,1/16,(3+i*6)/16]))];
    return {...common,boxes:boxes.map(b=>rotate(b,s.shape==='east_west'?1:0))};
  }
  if(id==='minecraft:lever'){
    const boxes=[box([5/16,0,4/16],[11/16,3/16,12/16],0x848985),box([7/16,3/16,s.powered==='true'?8/16:4/16],[9/16,10/16,s.powered==='true'?12/16:8/16])];
    return {...common,boxes:boxes.map(b=>{const mounted=s.face==='ceiling'?box([b.min[0],1-b.max[1],b.min[2]],[b.max[0],1-b.min[1],b.max[2]],b.color):s.face==='wall'?box([b.min[0],b.min[2],1-b.max[1]],[b.max[0],b.max[2],1-b.min[1]],b.color):b;return rotate(mounted,northTurns);})};
  }
  const dyed=/^minecraft:(.+)_(concrete|wool|stained_glass)$/.exec(id);
  if(dyed&&dyed[1]! in dyeColors)return {...common,color:dyeColors[dyed[1]!]!,opacity:dyed[2]==='stained_glass'?.48:1,boxes:[box([0,0,0],[1,1,1])]};
  if (id.endsWith('_log') || id.endsWith('_wood') || id.endsWith('_stem') || id.endsWith('_hyphae')) return {...common,color:0x806444,...(s.axis === undefined ? {} : {axis:s.axis}),boxes:[box([0,0,0],[1,1,1])]};
  if (id in cubes) return {...common,color:cubes[id]!,opacity:id==='minecraft:glass'?0.38:id.endsWith('glass')?0.48:1,boxes:[box([0,0,0],[1,1,1])]};
  return {color:0xd996df,opacity:1,supported:false,boxes:[box([0,0,0],[1,1,1])]};
}



