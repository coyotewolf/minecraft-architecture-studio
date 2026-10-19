/* global fetch */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { Buffer } from 'node:buffer';
import process from 'node:process';
import { log } from 'node:console';
import { resolve, join } from 'node:path';
import { fileURLToPath, URL } from 'node:url';

const commit = '15411f050f040e4c5df09352a75a9912ad8c3eeb';
const sources = [
  ['blocks.json', 'data/pc/1.20/blocks.json', 'f265dc1be54a0b7d6ee60a541c5c5df2c075a51d'],
  ['items.json', 'data/pc/1.20/items.json', 'd00049aa169472e75bc3a953ba5e960995f397d1'],
  ['dataPaths.json', 'data/dataPaths.json', 'b6c1eb84c9f291e81599f0ed40d774569a05059b'],
  ['version.json', 'data/pc/1.20.1/version.json', 'bab0091809bfd4a4d2c2899d72afe94b14f735ff'],
];
const input = {};
const hashes = {};
for (const [name, path, expected] of sources) {
  let bytes;
  if (process.argv[2]) bytes = await readFile(join(resolve(process.argv[2]), name));
  else {
    const response = await fetch('https://raw.githubusercontent.com/PrismarineJS/minecraft-data/' + commit + '/' + path);
    if (!response.ok) throw new Error('Fetch failed: ' + path + ' (' + response.status + ')');
    bytes = Buffer.from(await response.arrayBuffer());
  }
  const blob = createHash('sha1').update('blob ' + bytes.length + '\0').update(bytes).digest('hex');
  if (blob !== expected) throw new Error('Pinned source hash mismatch: ' + name);
  hashes[name] = { gitBlob: blob, sha256: createHash('sha256').update(bytes).digest('hex') };
  input[name] = JSON.parse(bytes.toString('utf8'));
}
const paths = input['dataPaths.json'].pc['1.20.1'];
if (paths.blocks !== 'pc/1.20' || paths.items !== 'pc/1.20' || paths.version !== 'pc/1.20.1') throw new Error('Unexpected source mapping');
if (input['version.json'].minecraftVersion !== '1.20.1' || input['version.json'].version !== 763) throw new Error('Unexpected version');
if (input['blocks.json'].length !== 1003 || input['items.json'].length !== 1255) throw new Error('Unexpected registry size');
const blocks = input['blocks.json'].map(block => {
  const properties = {};
  const defaults = {};
  let combinations = 1;
  for (const property of block.states) {
    const domain = property.type === 'bool' ? ['true', 'false'] : property.values;
    if (!Array.isArray(domain) || domain.length !== property.num_values || new Set(domain).size !== domain.length || !domain.every(v => typeof v === 'string')) throw new Error('Invalid state domain: ' + block.name);
    properties[property.name] = domain;
    combinations *= domain.length;
  }
  if (combinations !== block.maxStateId - block.minStateId + 1) throw new Error('Invalid state span: ' + block.name);
  let offset = block.defaultState - block.minStateId;
  if (!Number.isInteger(offset) || offset < 0 || offset >= combinations) throw new Error('Default out of range: ' + block.name);
  for (const property of [...block.states].reverse()) {
    const domain = properties[property.name];
    defaults[property.name] = domain[offset % domain.length];
    offset = Math.floor(offset / domain.length);
  }
  return { id: 'minecraft:' + block.name, properties, defaults };
});
const items = Object.fromEntries(input['items.json'].map(item => {
  if (!Number.isInteger(item.stackSize) || item.stackSize < 1 || item.stackSize > 64) throw new Error('Invalid item stack: ' + item.name);
  return ['minecraft:' + item.name, item.stackSize];
}));
if (new Set(blocks.map(b => b.id)).size !== blocks.length || Object.keys(items).length !== 1255) throw new Error('Duplicate IDs');
const projection = { minecraftVersion: '1.20.1', protocol: 763, sourceCommit: commit, hashes, blocks, items };
const outputDir = fileURLToPath(new URL('../src/data/', import.meta.url));
await mkdir(outputDir, { recursive: true });
const output = JSON.stringify(projection) + '\n';
await writeFile(join(outputDir, 'java-1.20.1.json'), output);
log(JSON.stringify({ blocks: blocks.length, items: Object.keys(items).length, bytes: Buffer.byteLength(output), sha256: createHash('sha256').update(output).digest('hex') }));
