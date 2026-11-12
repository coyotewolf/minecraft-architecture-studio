import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import process from 'node:process';
import { URL } from 'node:url';

const upstreamCommit = '7e89746a687bb88271253698fa108b1dd59825d0';
const expectedFiles = {
  "build/three.module.js": "4dc5bcedc5dc72dabb37a3da0a98bbaa05321a8a",
  "build/three.core.js": "0ee9b6d588348c3177b91d6093cfe8b167778db8",
  "examples/jsm/controls/OrbitControls.js": "ca690bfa0acc298d2379514e097caa4b97f07f54",
  "LICENSE": "8ada2a5f982916b0ba4b7a0aa7de347587e745d7"
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
