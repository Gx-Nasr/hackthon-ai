import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/ui',
  timeout: 60_000,
  use: { baseURL: 'http://127.0.0.1:4174', screenshot: 'only-on-failure', reducedMotion: 'reduce' },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1440, height: 1000 } } },
    { name: 'mobile', use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
  ],
  webServer: {
    command: 'npx vite --host 127.0.0.1 --port 4174 --strictPort',
    url: 'http://127.0.0.1:4174',
    env: { VITE_USE_MOCKS: 'false', VITE_API_BASE_URL: '' },
  },
});
