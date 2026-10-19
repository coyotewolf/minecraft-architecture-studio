import js from '@eslint/js';
import tseslint from 'typescript-eslint';
export default tseslint.config(
  { ignores: ['dist/**', 'dist-server/**', 'node_modules/**', 'vendor/**', 'test-results/**', 'playwright-report/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  { files:['src/features/viewer/runtime.js'],languageOptions:{globals:{window:'readonly',ResizeObserver:'readonly'}} },
);
