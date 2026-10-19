import { describe, expect, it } from 'vitest';
import { createAtriumProject } from './glass-atrium.ts';
import { parseProject, stableJson } from '../core/model.ts';
import { normalizeBlockState } from '../core/versioned-registry.ts';
import { inventory } from '../features/build/model.ts';

const project = createAtriumProject();
const cells = new Map(project.blocks.map(b => [[b.pos.x,b.pos.y,b.pos.z].join(','),b]));
const at = (x: number,y: number,z: number) => cells.get([x,y,z].join(','));

describe('Estimated concept-art glass atrium fixture', () => {
  it('is deterministic, valid, unique and bounded to 33 by 19 by 45', () => {
    expect(parseProject(project)).toEqual(project);
    expect(stableJson(createAtriumProject())).toBe(stableJson(project));
    expect(cells.size).toBe(project.blocks.length);
    expect(new Set(project.blocks.map(b => b.uid)).size).toBe(project.blocks.length);
    expect(project.blocks.length).toBeLessThan(10_000);
    expect(project.blocks.length).toBeLessThan(50_000);
    for (const [axis,min,max] of [['x',-16,16],['y',0,18],['z',-22,22]] as const) {
      expect(Math.min(...project.blocks.map(b=>b.pos[axis]))).toBe(min);
      expect(Math.max(...project.blocks.map(b=>b.pos[axis]))).toBe(max);
    }
    for (const b of project.blocks) expect(normalizeBlockState(b.id,b.state)).toEqual(b.state);
  });
  it('retains a complete supported floor and four luminous glass insets', () => {
    for(let x=-16;x<=16;x++)for(let z=-22;z<=22;z++) {
      expect(at(x,0,z)).toBeDefined(); expect(at(x,1,z)).toBeDefined();
    }
    for(const x of [-5,5])for(const z of [-15,15]) {
      expect(at(x,0,z)?.id).toBe('minecraft:sea_lantern');
      expect(at(x,1,z)?.id).toBe('minecraft:cyan_stained_glass');
    }
    for(const z of [-22,22])for(let x=-2;x<=2;x++)expect(at(x,1,z)?.state.facing).toBe(z<0?'south':'north');
  });
  it('keeps a five-wide internal aisle and three-wide facade entrances clear', () => {
    for(let x=-2;x<=2;x++)for(let z=-19;z<=19;z++)for(let y=2;y<=4;y++)expect(at(x,y,z)).toBeUndefined();
    for(const z of [-20,20])for(let x=-1;x<=1;x++)for(let y=2;y<=4;y++)expect(at(x,y,z)).toBeUndefined();
  });
  it('has a closed stepped roof cross-section at every depth with no filled interior', () => {
    for(let z=-20;z<=20;z++)for(let x=-14;x<=14;x++) {
      const top=8+Math.floor(10*Math.sqrt(Math.max(0,1-(x/14)**2)));
      const adjacent=Math.abs(x)===14?7:8+Math.floor(10*Math.sqrt(Math.max(0,1-((x+(x<0?-1:1))/14)**2)));
      for(let y=Math.min(top,adjacent+1);y<=top;y++)expect(at(x,y,z)?.category).toBe('Roof');
      expect(at(x,top+1,z)).toBeUndefined();
    }
    expect(at(0,17,0)).toBeUndefined();
    expect(at(0,18,0)?.id).toBe('minecraft:yellow_terracotta');
    expect(at(0,18,1)?.id).toBe('minecraft:cyan_stained_glass');
  });
  it('labels every cell as estimated reference geometry and computes a complete inventory', () => {
    for(const block of project.blocks) {
      expect(block.source).toEqual({origin:'ai_estimated',confidence:.35,referenceRegionId:'reference-greenhouse'});
      expect(block.edits).toEqual({createdByTransactionId:'reference-atrium',lastModifiedByTransactionId:'reference-atrium',userModified:false});
    }
    const materials=inventory(project);
    expect(materials.unresolved).toEqual([]);
    expect(materials.occupiedCells).toBe(project.blocks.length);
    expect(materials.totalInventoryItems).toBe(project.blocks.length);
    expect(materials.items.some(item=>item.itemId==='minecraft:cyan_stained_glass')).toBe(true);
  });
});
