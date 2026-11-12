# Dependency refresh — 2026-11-12

Base: ad79083e3a02536f8bab6cb8b76eb3024fab399c.

Updated React/React DOM 19.3.1, Three.js vendor subset 0.187.0, Vite 8.3.8, Vitest 5.1.0, TypeScript 6.0.3, Playwright 1.65.0 and compatible type/lint packages. TypeScript 7 remains excluded because typescript-eslint requires <6.1; Node types match Node 24. The minimatch 11.0.1 security override is retained.

The Three.js files are unchanged official npm release files with MIT license, upstream Git provenance and four pinned hashes. Upstream no longer provides pre-minified modules; Vite minifies release output. The restricted vendor exports and canonical model contracts remain unchanged. npm lock and clean install both report Three 0.187.0.

## Executed locally

- Clean `npm ci --no-audit --no-fund`: passed.
- `NODE_OPTIONS=--max-old-space-size=2048 npm run check`: passed typecheck, lint, all 40 files / 1,467 tests and client/server builds.
- `npm run verify:vendor`: four upstream hashes passed.
- `npm run verify:lint-toolchain`: matcher, intentional lint errors and ignore coverage passed.
- `npm ls --all`: no invalid dependency tree.
- Secret scanner tests: 4 passed; source/history scan: no findings.

The bounded heap allows timely collection for large campus fixtures in constrained environments; CI uses the same limit without weakening assertions. Local Chromium previously could not create required Unix sockets. Added CI browser coverage for viewer, editor, blueprint, persistence and mobile-editor flows; exact-head CI must pass before merge. No production deployment, live AI provider, or Minecraft game validation is claimed.
