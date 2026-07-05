import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  retries: 0,
  workers: 1,
  use: {
    baseURL: 'http://localhost:4173',
  },
  webServer: {
    command: 'npm run dev -- --port 4173',
    url: 'http://localhost:4173',
    // Reuse a manually-started dev server (npm run dev -- --port 4173) if one is
    // already up — simpler to debug; CI should start its own.
    reuseExistingServer: !process.env.CI,
    // Surface the dev server's output in the test terminal so a crashing or
    // slow-compiling server is visible instead of a silent stall.
    stdout: 'pipe',
    stderr: 'pipe',
    timeout: 120_000,
  },
})
