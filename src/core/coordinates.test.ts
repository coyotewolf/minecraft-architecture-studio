import { describe, expect, it } from 'vitest';
import { cellCenter, containingCell, coordinateKey, DIRECTIONS, MAX_COORDINATE, position, rotateYQuarter } from './coordinates.ts';

describe('canonical coordinates', () => {
  it.each([0.2, NaN, Infinity, -Infinity, Number.MAX_SAFE_INTEGER, MAX_COORDINATE + 1])('rejects invalid x=%s', x => {
    expect(() => position(x, 0, 0)).toThrow(RangeError);
  });
  it('validates all axes and normalizes negative zero', () => {
    expect(() => position(0, 0.1, 0)).toThrow();
    expect(() => position(0, 0, NaN)).toThrow();
    expect(Object.is(position(-0, 0, 0).x, -0)).toBe(false);
  });
  it('has collision-free signed keys on a dense neighborhood', () => {
    const keys = new Set<string>();
    for (let x = -3; x <= 3; x++) for (let y = -3; y <= 3; y++) for (let z = -3; z <= 3; z++) {
      keys.add(coordinateKey(position(x, y, z)));
    }
    expect(keys.size).toBe(343);
    expect(coordinateKey(position(1, 23, 4))).not.toBe(coordinateKey(position(12, 3, 4)));
  });
  it.each([-MAX_COORDINATE, -12, -1, 0, 1, MAX_COORDINATE])('roundtrips center at %s', x => {
    const p = position(x, -2, 5);
    expect(containingCell(cellCenter(p))).toEqual(p);
  });
  it('uses floor for negative continuous points', () => {
    expect(containingCell({ x: -0.01, y: 0, z: -1.01 })).toEqual({ x: -1, y: 0, z: -2 });
  });
  it('rotates clockwise north to east without changing Y', () => {
    expect(rotateYQuarter(DIRECTIONS.north)).toEqual(DIRECTIONS.east);
    expect(rotateYQuarter(DIRECTIONS.east)).toEqual(DIRECTIONS.south);
    let p = position(-4, 7, 2);
    for (let i = 0; i < 4; i++) p = rotateYQuarter(p);
    expect(p).toEqual({ x: -4, y: 7, z: 2 });
  });
  it('does not expose mutable direction or position records', () => {
    expect(Object.isFrozen(DIRECTIONS.north)).toBe(true);
    expect(Object.isFrozen(position(1, 2, 3))).toBe(true);
  });
});
