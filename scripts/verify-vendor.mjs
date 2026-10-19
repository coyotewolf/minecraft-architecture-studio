import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import process from 'node:process';
import { URL } from 'node:url';

const upstreamCommit = '0af9729d0c143a86a1d725d6e2c3ad83301f3f34';
const expectedFiles = {
  'build/three.module.min.js': '20d3c112761a519c7780a5ccc9f72a40937fa83b',
  'build/three.core.min.js': '70c40977daa0f6e1e312c6b58e9bfe49cb5a87a4',
  'examples/jsm/controls/OrbitControls.js': 'eea26706dae735dade19367026185f6e68f5cf55',
  LICENSE: 'cf781430404b0ae0ba7d8dea3457a3515dd7c9b9',
};

try {
  for (const [relativePath, expectedHash] of Object.entries(expectedFiles)) {
    const contents = await readFile(new URL('../vendor/three/' + relativePath, import.meta.url));
    const actualHash = createHash('sha1')
      .update('blob ' + contents.byteLength + '\0')
      .update(contents)
      .digest('hex');
    if (actualHash !== expectedHash) {
      throw new Error('Upstream hash mismatch: ' + relativePath);
    }
  }
  process.stdout.write('Verified 4 upstream files / commit ' + upstreamCommit + '\n');
} catch (error) {
  process.stderr.write((error instanceof Error ? error.message : String(error)) + '\n');
  process.exitCode = 1;
}
