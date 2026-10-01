import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: 'tests/e2e', outputDir: 'test-artifacts/results', timeout: 120_000,
  use: { baseURL: 'http://localhost:4173/PROJ_R/', viewport: { width: 1280, height: 720 },
    launchOptions: { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] } },
  webServer: { command: 'npm run preview', url: 'http://localhost:4173/PROJ_R/', reuseExistingServer: true, timeout: 60_000 },
});
