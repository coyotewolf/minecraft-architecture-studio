import type { BlockRecord, BlockState, LogicalStructure, MinecraftId, Project } from '../core/contracts.ts';
import { parseProject } from '../core/model.ts';
import { createEmptyProject } from '../core/project.ts';
import { normalizeBlockState } from '../core/versioned-registry.ts';

/** Deliberately open demonstration house, not an imported or AI-generated design. */
export function createDemoProject(): Project {
  const blocks: BlockRecord[] = [];
  const logicalStructures: LogicalStructure[] = [];
  const occupied = new Set<string>();
  function add(x: number, y: number, z: number, id: MinecraftId, category: string,
    state: BlockState = {}, logicalStructureId?: string): string {
    const key = [x, y, z].join(',');
    if (occupied.has(key)) throw new Error('Duplicate demonstration coordinate: ' + key);
    occupied.add(key);
    const uid = 'demo:' + key;
    blocks.push({
      uid, id, pos: { x, y, z }, state: normalizeBlockState(id, state), category,
      source: { origin: 'user_created' },
      edits: { createdByTransactionId: 'demo-create', lastModifiedByTransactionId: 'demo-create', userModified: false },
      ...(logicalStructureId === undefined ? {} : { logicalStructureId }),
    });
    return uid;
  }

  // The upper floor leaves an opening for the last step of the staircase.
  for (const y of [0, 4, 8]) {
    for (let x = -4; x <= 4; x++) {
      for (let z = -3; z <= 3; z++) {
        if (y === 4 && x === 2 && z === -1) continue;
        add(x, y, z, y === 0 ? 'minecraft:stone_bricks' : 'minecraft:oak_planks',
          y === 0 ? '基礎' : y === 4 ? '樓板' : '屋頂');
      }
    }
  }
  for (const x of [-4, 4]) {
    for (const z of [-3, 3]) {
      for (const y of [1, 2, 3, 5, 6, 7]) add(x, y, z, 'minecraft:oak_log', '柱', { axis: 'y' });
    }
  }
  for (const y of [3, 7]) {
    for (const z of [-3, 3]) {
      for (let x = -3; x <= 3; x++) add(x, y, z, 'minecraft:oak_log', '橫樑', { axis: 'x' });
    }
    for (const x of [-4, 4]) {
      for (let z = -2; z <= 2; z++) add(x, y, z, 'minecraft:oak_log', '橫樑', { axis: 'z' });
    }
  }
  // Partial north/east windows leave the south/west elevations open for inspection.
  for (const y of [2, 6]) {
    for (const x of [-3, -2, 2, 3]) add(x, y, -3, 'minecraft:glass', '窗');
    for (const z of [-1, 0, 1]) add(4, y, z, 'minecraft:glass', '窗');
  }
  for (let step = 0; step < 4; step++) {
    add(2, step + 1, 2 - step, 'minecraft:oak_stairs', '樓梯', { facing: 'north', half: 'bottom', shape: 'straight' });
  }
  for (const [index, facing] of ['east', 'south', 'west'].entries()) {
    add(index, 5, 2, 'minecraft:oak_stairs', '造型展示', { facing, half: 'top', shape: 'straight' });
  }
  for (const [index, type] of ['double', 'bottom', 'top'].entries()) {
    add(index - 3, 1, 1, 'minecraft:oak_slab', '半磚展示', { type });
  }
  const doorLower = add(0, 1, -3, 'minecraft:oak_door', '門',
    { facing: 'north', half: 'lower', hinge: 'left', open: 'false', powered: 'false' }, 'demo-door');
  const doorUpper = add(0, 2, -3, 'minecraft:oak_door', '門',
    { facing: 'north', half: 'upper', hinge: 'left', open: 'false', powered: 'false' }, 'demo-door');
  logicalStructures.push({ uid: 'demo-door', kind: 'door', anchorUid: doorLower, memberUids: [doorLower, doorUpper] });
  const bedFoot = add(-2, 5, 0, 'minecraft:red_bed', '家具',
    { facing: 'north', part: 'foot', occupied: 'false' }, 'demo-bed');
  const bedHead = add(-2, 5, -1, 'minecraft:red_bed', '家具',
    { facing: 'north', part: 'head', occupied: 'false' }, 'demo-bed');
  logicalStructures.push({ uid: 'demo-bed', kind: 'bed', anchorUid: bedFoot, memberUids: [bedFoot, bedHead] });

  return parseProject({
    ...createEmptyProject('two-floor-demo', '雙層木屋・展示模型'),
    designRevision: 'demo-v1', blocks, logicalStructures,
  });
}
