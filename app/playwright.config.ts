import { defineConfig } from '@playwright/test';

// Its own port and server, so the test build can carry Google settings that point at the fakes in tests/e2e.
export default defineConfig({
  testDir: 'tests/e2e',
  use: {
    baseURL: 'http://localhost:5181',
    launchOptions: process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
  },
  webServer: {
    command: 'npx vite --port 5181 --strictPort',
    url: 'http://localhost:5181',
    reuseExistingServer: false,
    env: { VITE_GOOGLE_CLIENT_ID: 'e2e-client.apps.googleusercontent.com', VITE_GOOGLE_API_KEY: 'e2e-key', VITE_GOOGLE_APP_ID: '123456789' },
  },
});
