import { describe, expect, it } from 'vitest';
import { createDemoProject } from '../../fixtures/two-floor-house.ts';
import { createEmptyProject } from '../../core/project.ts';
import { MAX_IMPORT_BYTES, parseProject } from '../../core/model.ts';
import { constructionToCsv, csvToModel, modelToCsv } from './exports.ts';

describe('full canonical XYZ CSV', () => {
  it('roundtrips all demo records including negative positions, states, provenance and logical groups', () => {
    const project = createDemoProject();
    const csv = modelToCsv(project);
    expect(csvToModel(csv)).toEqual(project);
    expect(csv.split('\r\n').length - 1).toBe(project.blocks.length + 2);
    expect(project.blocks.some(b => b.pos.x < 0)).toBe(true);
    expect(project.logicalStructures.length).toBeGreaterThan(0);
    expect(modelToCsv(csvToModel(csv))).toBe(csv);
  });
  it('roundtrips an empty model and escaped quotes/newlines without formula cells', () => {
    const p = createEmptyProject('quoted', '=SUM(A1:A2), "名稱"\r\n下一行');
    const csv = modelToCsv(p);
    expect(csvToModel(csv)).toEqual(p);
    expect(csv).toContain('"{""');
    expect(csv.split('\r\n')[1]!.startsWith('"project","","","","{' )).toBe(true);
  });
  it('preserves optional metadata and source confidence exactly', () => {
    const base = createDemoProject();
    const p = parseProject({ ...base, blocks: base.blocks.map((b, i) => i ? b : { ...b,
      category: '外牆,"一樓"\n標記', componentId: 'front', constructionPhaseId: 'phase-1',
      source: { origin: 'inferred', confidence: 0.75, referenceRegionId: 'photo-1' },
      edits: { ...b.edits, userModified: true },
    }) });
    expect(csvToModel(modelToCsv(p))).toEqual(p);
  });
  it('accepts valid LF CSV and a final row without newline', () => {
    const csv = modelToCsv(createDemoProject());
    expect(csvToModel(csv.replaceAll('\r\n', '\n').trimEnd())).toEqual(createDemoProject());
  });
  it('rejects disagreement between visible XYZ and canonical payload', () => {
    const csv = modelToCsv(createDemoProject());
    expect(() => csvToModel(csv.replace(/"block","-?\d+"/, '"block","999"'))).toThrow('座標');
  });
  it('rejects unknown columns, truncated quotes, extra cells and missing metadata', () => {
    const csv = modelToCsv(createEmptyProject('empty', ''));
    expect(() => csvToModel(csv.replace('"record"', '"type"'))).toThrow();
    expect(() => csvToModel(csv.slice(0, -3))).toThrow();
    expect(() => csvToModel(csv.replace('"record",', '"record","extra",'))).toThrow();
    expect(() => csvToModel(csv.split('\r\n')[0]!)).toThrow();
    expect(() => csvToModel(csv + '\r\n')).toThrow();
  });
  it('rejects invalid quote escapes and duplicate or partial block records', () => {
    const csv = modelToCsv(createDemoProject());
    expect(() => csvToModel(csv.replace('"block"', '"block"junk'))).toThrow('引號');
    const lines = csv.trimEnd().split('\r\n');
    expect(() => csvToModel([...lines, lines[2]!].join('\r\n'))).toThrow('Duplicate');
    const doorIndex = lines.findIndex(line => line.includes('oak_door'));
    expect(doorIndex).toBeGreaterThan(1);
    expect(() => csvToModel(lines.filter((_, i) => i !== doorIndex).join('\r\n'))).toThrow();
  });
  it('rejects unsupported metadata version and unknown nested block fields', () => {
    const csv = modelToCsv(createDemoProject());
    expect(() => csvToModel(csv.replace('""schemaVersion"":1', '""schemaVersion"":99'))).toThrow();
    expect(() => csvToModel(csv.replace('""uid"":', '""unknown"":1,""uid"":'))).toThrow();
  });
  it('enforces the byte bound before CSV parsing', () => {
    expect(() => csvToModel('x'.repeat(MAX_IMPORT_BYTES + 1))).toThrow('384 MiB');
    expect(() => csvToModel('界'.repeat(Math.floor(MAX_IMPORT_BYTES / 3) + 1))).toThrow('384 MiB');
  });
});


describe('player construction CSV', () => {
  it('derives one readable row per cell with coordinates, state and estimate flags', () => {
    const project = createDemoProject();
    const rows = constructionToCsv(project).trimEnd().split('\r\n');
    expect(rows).toHaveLength(project.blocks.length + 1);
    expect(rows[0]).toContain('"Block Name","X","Y","Z"');
    project.blocks.forEach((block, i) => {
      expect(rows[i + 1]).toContain('"' + block.id + '"');
      expect(rows[i + 1]).toContain(['', block.pos.x, block.pos.y, block.pos.z, ''].join('","'));
      expect(rows[i + 1]).toContain(JSON.stringify(block.state).replaceAll('"', '""'));
      expect(rows[i + 1]?.endsWith('"' + ['inferred', 'ai_estimated'].includes(block.source.origin) + '"')).toBe(true);
    });
  });
  it('neutralizes spreadsheet formula labels while preserving canonical metadata', () => {
    const p = createDemoProject(), category = '=HYPERLINK("example")';
    const project = {...p, blocks: p.blocks.map((b,i) => i ? b : {...b, category})};
    expect(constructionToCsv(project)).toContain("'=HYPERLINK");
    expect(project.blocks[0]?.category).toBe(category);
    expect(csvToModel(modelToCsv(project))).toEqual(project);
  });
});
