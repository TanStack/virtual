import { defineConfig } from '@playwright/test'

// Unique per-example port. CI runs several example e2e suites in parallel, so a
// port shared across examples collides: one suite claims it and the rest either
// fail to start ("port already used") or attach to a different example's app and
// then miss the elements they assert on. Override with MARKO_E2E_PORT to point a
// run at a manually started server.
const PORT = Number(process.env.MARKO_E2E_PORT ?? 4180)
const baseURL = `http://localhost:${PORT}`

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  retries: 0,
  workers: 1,
  use: {
    baseURL,
  },
  webServer: {
    command: `npm run dev -- --port ${PORT}`,
    url: baseURL,
    // Reuse a manually-started dev server (npm run dev -- --port 4180) if one is
    // already up — simpler to debug; CI should start its own.
    reuseExistingServer: !process.env.CI,
    // Surface the dev server's output in the test terminal so a crashing or
    // slow-compiling server is visible instead of a silent stall.
    stdout: 'pipe',
    stderr: 'pipe',
    timeout: 120_000,
  },
})
