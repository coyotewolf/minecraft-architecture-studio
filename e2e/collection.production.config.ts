import { defineConfig } from '@playwright/test';
import config from '../playwright.config.ts';
export default defineConfig({...config,testDir:'.',testMatch:'collection.spec.ts',webServer:undefined,reporter:[['list'],['json',{outputFile:'../evidence/collection-complete-building-production-results.json'}]],use:{...config.use,baseURL:'http://127.0.0.1:5174',launchOptions:{...config.use?.launchOptions,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'}}});

