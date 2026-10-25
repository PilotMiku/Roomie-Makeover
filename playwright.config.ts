import { defineConfig, devices } from '@playwright/test';
import { resolveBasePath } from './build/base.ts';

const base = resolveBasePath(process.env);
export default defineConfig({
  testDir: './e2e',
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: `http://127.0.0.1:4173${base}`,
    trace: 'retain-on-failure',
    channel: process.env.PLAYWRIGHT_CHANNEL,
  },
  projects:
    process.env.PLAYWRIGHT_ENGINE === 'firefox'
      ? [
          {
            name: 'firefox',
            use: { ...devices['Desktop Firefox'], channel: undefined },
          },
        ]
      : [
          { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
          {
            name: 'mobile',
            use: {
              ...devices['iPhone SE'],
              viewport: { width: 375, height: 667 },
              defaultBrowserType: 'chromium',
            },
          },
        ],
  webServer: {
    command: 'npm run preview -- --port 4173 --strictPort',
    url: `http://127.0.0.1:4173${base}`,
    reuseExistingServer: false,
  },
});
