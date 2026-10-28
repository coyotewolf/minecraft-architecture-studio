import type { LibraryEntry } from './library.ts';

export type CollectionSort = 'newest' | 'name' | 'cellCount';
const names = new Intl.Collator('zh-Hant', { numeric: true, sensitivity: 'base' });
const searchable = (text: string) => text.normalize('NFKC').toLocaleLowerCase('zh-Hant');

/** Index-only discovery. Newest means last added, since the library has no timestamps. */
export function discoverEntries(entries: readonly LibraryEntry[], query: string, sort: CollectionSort): LibraryEntry[] {
 const terms = searchable(query).trim().split(/\s+/u).filter(Boolean);
 return entries.map((entry, index) => ({ entry, index }))
  .filter(({ entry }) => terms.every(term => searchable(entry.name + '\n' + entry.notes).includes(term)))
  .sort((a, b) => {
   if (sort === 'newest') return b.index - a.index;
   if (sort === 'name') return names.compare(a.entry.name, b.entry.name) || a.index - b.index;
   return (b.entry.cellCount ?? -1) - (a.entry.cellCount ?? -1) || a.index - b.index;
  }).map(({ entry }) => entry);
}
