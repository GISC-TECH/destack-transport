import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:8002',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'off',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      testIgnore: '**/mobile-responsive.spec.js',
    },
    {
      name: 'mobile-320',
      testMatch: '**/mobile-responsive.spec.js',
      use: { ...devices['Desktop Chrome'], viewport: { width: 320, height: 568 }, hasTouch: true, isMobile: true },
    },
    {
      name: 'mobile-360',
      testMatch: '**/mobile-responsive.spec.js',
      use: { ...devices['Desktop Chrome'], viewport: { width: 360, height: 800 }, hasTouch: true, isMobile: true },
    },
    {
      name: 'mobile-390',
      testMatch: '**/mobile-responsive.spec.js',
      use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true },
    },
  ],
});
