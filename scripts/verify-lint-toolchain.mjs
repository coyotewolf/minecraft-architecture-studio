import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import process from 'node:process';
import { fileURLToPath, URL } from 'node:url';
import { ESLint } from 'eslint';

const root = fileURLToPath(new URL('../', import.meta.url));
const lock = JSON.parse(await readFile(new URL('../package-lock.json', import.meta.url), 'utf8'));
const matchers = Object.entries(lock.packages).filter(([name]) => /(?:^|\/)minimatch$/.test(name));
assert.ok(matchers.length > 0, 'Expected the audited matcher dependency');
for (const [name, metadata] of matchers) assert.equal(metadata.version, '11.0.1', name);

const eslint = new ESLint({ cwd: root });
const valid = await eslint.lintText('export const checkedValue: number = 1;', { filePath: 'src/__lint_regression__.ts' });
assert.equal(valid[0].errorCount, 0, 'Valid TypeScript must remain accepted');
const invalidTs = await eslint.lintText('const unused: number = 1; export {};', { filePath: 'src/__lint_regression__.ts' });
assert.ok(invalidTs[0].messages.some(message => message.ruleId === '@typescript-eslint/no-unused-vars'));
const invalidJs = await eslint.lintText('missingGlobal();', { filePath: 'scripts/__lint_regression__.mjs' });
assert.ok(invalidJs[0].messages.some(message => message.ruleId === 'no-undef'));
assert.equal(await eslint.isPathIgnored('src/features/build/model.ts'), false);
for (const name of ['vendor/three/build/three.module.min.js', 'dist/assets/app.js', 'node_modules/example/index.js']) {
  assert.equal(await eslint.isPathIgnored(name), true, name);
}

// Exercise the advisory's globstar/parent expansion shape in a time-bounded child.
const output = execFileSync(process.execPath, ['--input-type=module', '-e', `
  import { Minimatch } from 'minimatch';
  const matcher = new Minimatch('a/**/../'.repeat(24) + 'target', { optimizationLevel: 2, braceExpandMax: 64 });
  matcher.match('not-a-match');
  console.log('bounded-glob-ok');
`], { cwd: root, timeout: 3000, encoding: 'utf8' });
assert.equal(output.trim(), 'bounded-glob-ok');
process.stdout.write('Verified patched matcher, bounded glob expansion, lint errors and source/ignore coverage.\n');
