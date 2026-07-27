import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  retries: 0,
  workers: 1,
  use: {
    baseURL: 'http://localhost:4199',
  },
  webServer: {
    command: 'npm run dev -- --port 4199',
    url: 'http://localhost:4199',
    // Reuse a manually-started dev server (npm run dev -- --port 4199) if one is
    // already up — simpler to debug; CI should start its own.
    reuseExistingServer: !process.env.CI,
    stdout: 'pipe',
    stderr: 'pipe',
    timeout: 120_000,
  },
})
