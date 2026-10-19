import { describe, expect, it } from 'vitest';
import { FEATURED_REFERENCE_ID, REFERENCE_METADATA } from './metadata.ts';
import { emptyReferenceBoard, MAX_REFERENCE_BYTES, parseReferenceBoard, parseReferenceManifest, validateReferenceBlob } from './storage.ts';
const image = () => new Blob(['test image bytes'], { type: 'image/png' });
describe('local reference board boundaries', () => {
  it('defines all eleven references in descending timestamp order with greenhouse featured', () => {
    expect(REFERENCE_METADATA).toHaveLength(11);
    expect(REFERENCE_METADATA[3]!.id).toBe(FEATURED_REFERENCE_ID);
    expect(REFERENCE_METADATA[3]!.name).toContain('05_40_42');
    expect(REFERENCE_METADATA[5]!.name).toContain('05_40_30');
    expect(REFERENCE_METADATA[5]!.title).toContain('星象館');
    expect(REFERENCE_METADATA.every(row => row.notes.includes('沒有已知精確尺寸'))).toBe(true);
    expect(parseReferenceManifest({ images: REFERENCE_METADATA })).toEqual(REFERENCE_METADATA);
  });
  it('rejects remote manifests, duplicate IDs, unknown fields and oversized galleries', () => {
    const first = REFERENCE_METADATA[0]!;
    expect(() => parseReferenceManifest({ images: [{ ...first, url: 'https://example.com/image.png' }] })).toThrow();
    expect(() => parseReferenceManifest({ images: [first, first] })).toThrow();
    expect(() => parseReferenceManifest({ images: [{ ...first, extra: true }] })).toThrow();
    expect(() => parseReferenceManifest({ images: Array(12).fill(first) })).toThrow();
  });
  it('preserves blobs, per-image notes and selected reference in a detached envelope', () => {
    const input = { ...emptyReferenceBoard('project-a'), uploads: [{ id: 'upload:a', name: 'house.png', blob: image() }], selectedId: 'reference-04', notes: { 'reference-04': '觀察：玻璃外牆。推估：樓層高度待驗證。' } };
    const result = parseReferenceBoard(input);
    input.notes['reference-04'] = 'changed';
    expect(result.notes['reference-04']).toContain('觀察');
    expect(result.selectedId).toBe('reference-04'); expect(result.uploads[0]!.blob).toBe(input.uploads[0]!.blob);
    expect(parseReferenceBoard(structuredClone(result))).toEqual(result);
  });
  it('enforces exact image size, supported MIME and per-project upload count', () => {
    expect(validateReferenceBlob(new Blob([new Uint8Array(MAX_REFERENCE_BYTES)], { type: 'image/webp' })).size).toBe(MAX_REFERENCE_BYTES);
    expect(() => validateReferenceBlob(new Blob([new Uint8Array(MAX_REFERENCE_BYTES + 1)], { type: 'image/png' }))).toThrow();
    expect(() => validateReferenceBlob(new Blob([], { type: 'image/png' }))).toThrow();
    expect(() => validateReferenceBlob(new Blob(['<svg/>'], { type: 'image/svg+xml' }))).toThrow();
    expect(() => parseReferenceBoard({ ...emptyReferenceBoard('a'), uploads: Array.from({ length: 12 }, (_, i) => ({ id: `upload:${i}`, name: 'image.png', blob: image() })) })).toThrow();
  });
  it('fails closed for malformed stored records and excessive notes', () => {
    const board = emptyReferenceBoard('a');
    expect(() => parseReferenceBoard({ ...board, schemaVersion: 2 })).toThrow();
    expect(() => parseReferenceBoard({ ...board, unexpected: true })).toThrow();
    expect(() => parseReferenceBoard({ ...board, notes: { picture: 'x'.repeat(4097) } })).toThrow();
    expect(() => parseReferenceBoard({ ...board, uploads: [{ id: 'seed-id', name: 'bad.png', blob: image() }] })).toThrow();
  });
});
