import {describe,expect,it} from 'vitest';
import {HighDetailBuilder} from './high-detail.ts';
import {assembleCampus,campusToJson,campusToCsv} from './index.ts';
import {campusJsonChunks,campusCsvChunks} from './stream-export.ts';
const b=new HighDetailBuilder({id:'export-example',title:'引號 "標題",第二行\n測試',origin:[-20,4,18],references:['reference-01'],features:['含 "引號"'],notes:'估計\n非實測'});
for(let x=0;x<7;x++)b.set(x,0,0,'minecraft:quartz_stairs','Floor, "quoted"',{facing:'west',half:'top',shape:'inner_left'});
const campus=assembleCampus(b.finishParts(3));
describe('bounded campus export chunks',()=>{
 it('matches the complete existing JSON schema byte-for-byte across parts',()=>{
  const chunks=[...campusJsonChunks(campus)];expect(chunks.join('')).toBe(campusToJson(campus));expect(JSON.parse(chunks.join('')).districts).toHaveLength(3);
  expect(chunks.filter(c=>c.startsWith('{"id"'))).toHaveLength(3);
 });
 it('matches CSV quoting, placement state and negative coordinates with bounded rows',()=>{
  const chunks=[...campusCsvChunks(campus,2)];expect(chunks.join('')).toBe(campusToCsv(campus));expect(chunks).toHaveLength(5);
  expect(chunks.slice(1).every(chunk=>chunk.slice(2).split('\r\n').length<=2)).toBe(true);
  expect(chunks.join('')).toContain('"Floor, ""quoted"""');expect(chunks.join('')).toContain('"-20"');
 });
 it('handles empty campuses without stray comma/newline and rejects unbounded row sizes',()=>{
  const empty=assembleCampus([]);expect([...campusJsonChunks(empty)].join('')).toBe(campusToJson(empty));expect([...campusCsvChunks(empty)].join('')).toBe(campusToCsv(empty));
  for(const size of [0,-1,5001,1.5,Infinity])expect(()=>[...campusCsvChunks(campus,size)]).toThrow();
 });
});
