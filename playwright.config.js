import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  // Tests proxy /data and /hist through to the live SolarLog device
  // (see bs-config.cjs), so waitForLoadState('networkidle') is at the mercy
  // of that device's real-world latency. Retries + a longer timeout absorb
  // that jitter without masking genuine regressions (a real bug still fails
  // on retry). See docs/e2e-network-flakiness.md for the investigation.
  timeout: 45_000,
  retries: 2,
  use: {
    baseURL: 'http://localhost:3000',
  },
  webServer: {
    command: 'npm start',
    url: 'http://localhost:3000/index.html',
    reuseExistingServer: !process.env.CI,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
});
