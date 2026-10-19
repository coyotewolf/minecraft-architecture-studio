import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
  server: { host: '127.0.0.1', port: 5173, strictPort: true },
});
