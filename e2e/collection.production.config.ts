import { defineConfig } from '@playwright/test';
import config from '../playwright.config.ts';
const production={...config};delete production.webServer;
export default defineConfig({...production,testDir:'.',testMatch:['collection.spec.ts','safe-entry.spec.ts','cad.spec.ts'],reporter:[['list'],['json',{outputFile:'../evidence/collection-complete-building-production-results.json'}]],use:{...config.use,baseURL:'http://127.0.0.1:5174',launchOptions:{...config.use?.launchOptions,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'}}});

