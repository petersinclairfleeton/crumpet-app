import { defineConfig } from '@playwright/test';
import base from './playwright.config';

// Takes the guide's screenshots (public/guide/*.jpg) from the real app:
//   CHROMIUM_PATH=… npx playwright test -c playwright.shots.config.ts
export default defineConfig({
  ...base,
  testDir: 'tests/shots',
  testMatch: '*.shots.ts',
  timeout: 120_000,
  use: { ...base.use, viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1.5, colorScheme: 'light' },
});
