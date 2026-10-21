import { defineConfig } from '@playwright/test';
import { existsSync } from 'node:fs';
if (existsSync('.env')) process.loadEnvFile('.env');
export default defineConfig({
  testDir: './tests/e2e', fullyParallel: false, workers: 1, timeout: 30_000,
  use: { baseURL: 'http://127.0.0.1:3000', screenshot: 'only-on-failure', trace: 'off' },
  webServer: [
    { command: 'npm run serve:test -w @arrowfin/api', url: 'http://127.0.0.1:4000/api/health', reuseExistingServer: !process.env.CI, timeout: 60_000 },
    { command: 'npm run start -w @arrowfin/web', env: { NODE_ENV: 'production', PORT: '3000' }, url: 'http://127.0.0.1:3000', reuseExistingServer: !process.env.CI, timeout: 60_000 },
  ],
});
