import { defineConfig } from '@playwright/test';
import config from './collection.production.config.ts';
export default defineConfig({...config,testMatch:['generator.spec.ts'],reporter:[['list'],['json',{outputFile:'../evidence/generator-production-results.json'}]]});
