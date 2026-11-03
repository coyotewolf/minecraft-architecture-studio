import type { BlockPos, Facing } from './contracts.ts';

// Editor resource/precision boundary, NOT a claim about Minecraft world limits.
export const MAX_COORDINATE = 30_000_000;
export const DIRECTIONS: Readonly<Record<Facing, BlockPos>> = Object.freeze({
  north: Object.freeze({ x: 0, y: 0, z: -1 }),
  east: Object.freeze({ x: 1, y: 0, z: 0 }),
  south: Object.freeze({ x: 0, y: 0, z: 1 }),
  west: Object.freeze({ x: -1, y: 0, z: 0 }),
});
export function position(x: number, y: number, z: number): BlockPos {
  for (const value of [x, y, z]) {
    if (!Number.isSafeInteger(value) || Math.abs(value) > MAX_COORDINATE) {
      throw new RangeError('Coordinates must be bounded signed integers');
    }
  }
  return Object.freeze({ x: x === 0 ? 0 : x, y: y === 0 ? 0 : y, z: z === 0 ? 0 : z });
}
export function coordinateKey(pos: BlockPos): string {
  const p = position(pos.x, pos.y, pos.z);
  return `${p.x},${p.y},${p.z}`;
}
export function cellCenter(pos: BlockPos): BlockPos {
  const p = position(pos.x, pos.y, pos.z);
  return Object.freeze({ x: p.x + 0.5, y: p.y + 0.5, z: p.z + 0.5 });
}
/** Continuous point to containing cell; not the M2 face-aware picking adapter. */
export function containingCell(point: BlockPos): BlockPos {
  return position(Math.floor(point.x), Math.floor(point.y), Math.floor(point.z));
}
/** Clockwise on a north-up XZ plan, around the origin cell: north -> east. */
export function rotateYQuarter(pos: BlockPos): BlockPos {
  position(pos.x, pos.y, pos.z);
  return position(-pos.z, pos.y, pos.x);
}
