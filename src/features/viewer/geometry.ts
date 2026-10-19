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
const cubes: Readonly<Record<string, number>> = {
  'minecraft:stone': 0x92989d, 'minecraft:stone_bricks': 0x879298,
  'minecraft:oak_planks': 0xb99a64, 'minecraft:white_concrete': 0xdedcd1,
  'minecraft:glass': 0x9fd7e5,
};
/** Deliberately bounded geometry support; unknown shapes are wireframe markers, never plausible cubes. */
export function shapeForBlock(block: BlockRecord): BlockShape {
  const {id,state:s} = block;
  const common = {color: 0xb99a64, opacity: 1, supported: true};
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
    return {...common, color:0x98734a, boxes:[rotate(box([0,0,0],[3/16,1,1]),turn%4)]};
  }
  if (id.endsWith('_bed')) {
    // Model authored facing north. Only the outer end has legs; the pair shares its middle edge.
    const end = s.part === 'head' ? 0 : 13/16;
    const boxes = [box([0,3/16,0],[1,9/16,1],0xb5574f), box([0,0,end],[3/16,3/16,end+3/16],0x896744), box([13/16,0,end],[1,3/16,end+3/16],0x896744)];
    return {...common,boxes:boxes.map(b=>rotate(b,(directions.indexOf(s.facing as Facing)+1)%4))};
  }
  if (id.endsWith('_log') || id.endsWith('_wood') || id.endsWith('_stem') || id.endsWith('_hyphae')) return {...common,color:0x806444,...(s.axis === undefined ? {} : {axis:s.axis}),boxes:[box([0,0,0],[1,1,1])]};
  if (id in cubes) return {...common,color:cubes[id]!,opacity:id==='minecraft:glass'?0.38:1,boxes:[box([0,0,0],[1,1,1])]};
  return {color:0xd996df,opacity:1,supported:false,boxes:[box([0,0,0],[1,1,1])]};
}
