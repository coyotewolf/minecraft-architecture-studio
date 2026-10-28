import { describe, expect, it } from 'vitest';
import type { LibraryEntry } from './library.ts';
import { discoverEntries } from './discovery.ts';
const entry = (id: string, name: string, cellCount: number | null = null, notes = ''): LibraryEntry => ({ id, name, cellCount, notes, reference: null, projectId: id });
const ids = (entries: LibraryEntry[]) => entries.map(e => e.id);
describe('collection metadata discovery', () => {
 it('searches normalized Unicode titles and notes with every term', () => {
  const entries = [entry('a', '金葉 ＴＯＷＥＲ', 10, '河畔 花園'), entry('b', 'Tower', 20, '屋頂')];
  expect(ids(discoverEntries(entries, ' tower  花園 ', 'name'))).toEqual(['a']);
  expect(discoverEntries(entries, '不存在', 'name')).toEqual([]);
 });
 it('uses reverse insertion order for newest without mutating the index', () => {
  const entries = Object.freeze([entry('a', '先加入'), entry('b', '後加入')]);
  expect(ids(discoverEntries(entries, '  ', 'newest'))).toEqual(['b', 'a']);
  expect(entries.map(e => e.id)).toEqual(['a', 'b']);
 });
 it('sorts numeric names naturally and retains insertion order for equal names', () => {
  expect(ids(discoverEntries([entry('a', '塔10'), entry('b', '塔2'), entry('c', '塔2')], '', 'name'))).toEqual(['b', 'c', 'a']);
 });
 it('places unknown counts last, preserves ties and recognizes zero', () => {
  expect(ids(discoverEntries([entry('u', '未知'), entry('z', '空白', 0), entry('a', '甲', 10), entry('b', '乙', 10), entry('v', '未知')], '', 'cellCount'))).toEqual(['a', 'b', 'z', 'u', 'v']);
 });
 it('returns the original metadata objects and handles an empty collection', () => {
  const item = entry('a', '木屋');
  expect(discoverEntries([item], '', 'name')[0]).toBe(item);
  expect(discoverEntries([], '', 'newest')).toEqual([]);
 });
});
