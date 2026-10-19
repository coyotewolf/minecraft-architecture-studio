import { describe, expect, it } from 'vitest';
import { blueprintCellAt, type BlueprintGrid } from './BlueprintPanel.tsx';

const grid: BlueprintGrid = { originX: -10, originZ: -12, cellSize: 20, columns: 21, rows: 21, offsetX: 76, offsetY: 32, width: 520, height: 480 };
describe('blueprint canonical cell projection', () => {
  it('maps negative coordinates and exact boundaries with floor semantics', () => {
    expect(blueprintCellAt(grid, 76, 32, -4)).toEqual({ x: -10, y: -4, z: -12 });
    expect(blueprintCellAt(grid, 95.999, 51.999, 2)).toEqual({ x: -10, y: 2, z: -12 });
    expect(blueprintCellAt(grid, 96, 52, 2)).toEqual({ x: -9, y: 2, z: -11 });
    expect(blueprintCellAt(grid, 286, 282, 3)).toEqual({ x: 0, y: 3, z: 0 });
  });
  it('rejects label gutters and the exclusive far edges', () => {
    for (const [x, y] of [[75.999, 32], [76, 31.999], [496, 32], [76, 452], [-1, -1]]) {
      expect(blueprintCellAt(grid, x!, y!, 0)).toBeNull();
    }
    expect(blueprintCellAt(grid, 495.999, 451.999, 0)).toEqual({ x: 10, y: 0, z: 8 });
  });
  it('maps the same signed target at both zoom endpoints and a narrower viewport', () => {
    for (const cellSize of [8, 48]) {
      const resized = { ...grid, cellSize, columns: 5, rows: 7, originX: -2, originZ: -3 };
      expect(blueprintCellAt(resized, resized.offsetX + 1.5 * cellSize, resized.offsetY + 2.5 * cellSize, 4))
        .toEqual({ x: -1, y: 4, z: -1 });
    }
  });
});
