import assert from 'node:assert/strict';
import console from 'node:console';
import process from 'node:process';
import { fileURLToPath, URL } from 'node:url';
import { createServer } from 'vite';

const root = fileURLToPath(new URL('../', import.meta.url));
const server = await createServer({ root, server: { middlewareMode: true } });
function bounds(blocks) {
  assert(blocks.length > 0, 'Expected occupied cells');
  const min = { x: Infinity, y: Infinity, z: Infinity };
  const max = { x: -Infinity, y: -Infinity, z: -Infinity };
  for (const { pos } of blocks) for (const axis of ['x', 'y', 'z']) {
    min[axis] = Math.min(min[axis], pos[axis]);
    max[axis] = Math.max(max[axis], pos[axis]);
  }
  return { min, max, span: { x: max.x-min.x+1, y: max.y-min.y+1, z: max.z-min.z+1 } };
}
try {
  const { createGoldenLeafParts } = await server.ssrLoadModule('/src/fixtures/buildings/golden-leaf.ts');
  const { parseProject } = await server.ssrLoadModule('/src/core/model.ts');
  const { inventory } = await server.ssrLoadModule('/src/features/build/model.ts');
  const parts = createGoldenLeafParts();
  assert(parts.length > 0, 'No golden leaf parts');
  const positions = new Set(), uids = new Set(), materialCounts = new Map(), blocks = [];
  let totalItems = 0;
  const partReports = parts.map(part => {
    // Parsing includes pinned registry ID/state and logical-structure validation.
    parseProject(part.project);
    assert(part.project.blocks.length < 50000, 'Part exceeds editable limit');
    const localUids = new Set(part.project.blocks.map(b => b.uid));
    for (const structure of part.project.logicalStructures) {
      assert(structure.memberUids.every(uid => localUids.has(uid)), 'Logical pair split between parts');
    }
    for (const block of part.project.blocks) {
      const key = [block.pos.x, block.pos.y, block.pos.z].join(',');
      assert(!positions.has(key), 'Duplicate position: '+key);
      assert(!uids.has(block.uid), 'Duplicate UID: '+block.uid);
      positions.add(key); uids.add(block.uid); blocks.push(block);
    }
    const materials = inventory(part.project);
    assert(materials.totalInventoryItems !== null, 'Unresolved inventory items');
    totalItems += materials.totalInventoryItems;
    for (const item of materials.items) materialCounts.set(item.itemId, (materialCounts.get(item.itemId) ?? 0)+item.required);
    return { id: part.id, cells: part.project.blocks.length, bounds: bounds(part.project.blocks), registryValid: true, logicalStructures: part.project.logicalStructures.length };
  });
  const envelope = bounds(blocks);
  const ys = [...new Set([envelope.min.y, ...[.05,.15,.3,.5,.7,.85,.95,1].map(f => Math.round(envelope.min.y+(envelope.max.y-envelope.min.y)*f))])];
  const sections = ys.map(y => {
    const cells = blocks.filter(b => b.pos.y === y);
    return { y, cells: cells.length, ...(cells.length ? { bounds: bounds(cells) } : {}) };
  });
  console.log(JSON.stringify({ fixture: 'golden-leaf', validation: 'canonical-only', front: '-Z', rear: '+Z', parts: partReports, cells: blocks.length, totalItems, uniquePositions: positions.size, uniqueUids: uids.size, bounds: envelope, sections, materials: [...materialCounts].sort(([a],[b])=>a.localeCompare(b)).map(([itemId,required])=>({itemId,required})), visualAcceptance: 'not assessed by this script', minecraftAcceptance: 'not tested' }, null, 2));
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
} finally { await server.close(); }
