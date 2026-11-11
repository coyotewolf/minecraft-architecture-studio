import { defineConfig } from 'vitest/config';
import { configFromEnv, createAiHandler } from './server/ai.ts';
export default defineConfig({
  plugins:[{name:'studio-ai-api',configureServer(server){const handler=createAiHandler(configFromEnv(process.env));server.middlewares.use((req,res,next)=>{void handler(req,res).then(handled=>{if(!handled)next();}).catch(next);});}}],
  // Large canonical fixtures compete for CPU and memory; run files sequentially.
  test: { environment: 'node', include: ['src/**/*.test.ts'], fileParallelism: false },
  server: { host: '127.0.0.1', port: 5173, strictPort: true },
});
