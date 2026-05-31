import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright-Smoke-Tests fuer osss.pro.
 *
 * Sprint Phase-2 (2026-05-31). 5 zentrale Flows getestet:
 *   1. Landing-Page laedt + Security-Header
 *   2. Register-Form rendert + Honeypot/Turnstile present
 *   3. Login-Page rendert + Form-Validation
 *   4. Public Schedule laedt fuer existierendes Gym
 *   5. Leads-Search-Filter funktioniert (gegen Test-Account)
 *
 * Konfiguration:
 *   PLAYWRIGHT_BASE_URL   — default https://www.osss.pro (Production)
 *                           Lokal: http://localhost:3000 (npm run dev)
 *   PLAYWRIGHT_TEST_EMAIL — fuer Login-Flow, Test-Account
 *   PLAYWRIGHT_TEST_PASSWORD
 *   PLAYWRIGHT_GYM_ID     — fuer Public-Schedule-Test
 *
 * Run:
 *   npm run test:e2e                    # alle Browser
 *   npm run test:e2e -- --ui            # debug UI
 *   PLAYWRIGHT_BASE_URL=http://localhost:3000 npm run test:e2e
 */

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'html',

  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'https://www.osss.pro',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 10_000,
    navigationTimeout: 30_000,
  },

  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    // Webkit + Firefox optional, in CI nur Chromium fuer Geschwindigkeit
    ...(process.env.CI ? [] : [
      { name: 'webkit', use: { ...devices['Desktop Safari'] } },
      { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    ]),
  ],
})
