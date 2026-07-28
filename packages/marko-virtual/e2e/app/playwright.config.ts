import { defineConfig } from '@playwright/test'

// One app, one server, one config for the whole Marko browser suite. Each scenario
// is a route (`/chat`, `/table`, `/ssr-slice`, the option gates, …) rather than its
// own project: 19 example-local suites meant 19 dev servers, 19 ports and 19 copies
// of this file, and a port that silently moved (marko-run falls back to a random
// free port) surfaced only as a 120s webServer timeout with the real error hidden.
//
// Override to point a run at a manually started server.
const PORT = Number(process.env.MARKO_E2E_PORT ?? 4199)
const baseURL = `http://localhost:${PORT}`

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  // No retries: these are scroll/measurement assertions, and a retry that turns
  // red into green would hide exactly the timing regressions the suite exists to
  // catch. Nx flags a task that passes only on re-run as flaky instead.
  retries: 0,
  // Serial by design. The specs assert on scroll offsets and measured sizes, which
  // are sensitive to machine load; one worker keeps a failure meaningful. The whole
  // suite is ~45s, so there is nothing to buy back here.
  workers: 1,
  use: {
    baseURL,
    // Without a trace a CI-only failure is a stack trace with no page state, and
    // the DOM at the moment the scroll offset went wrong is the entire diagnosis
    // for this suite. The trace carries screenshots itself, so no separate
    // screenshot setting is needed.
    trace: 'retain-on-failure',
  },
  webServer: {
    // Build and serve, not the dev server. This is the app users deploy: the
    // production SSR/resume path, no HMR client injected into the console-error
    // assertions, and every route compiled up front so no test pays a cold Marko
    // compile mid-assertion (which showed up as intermittent chat and
    // window-ssr-slice failures on a cold tree — i.e. on CI). The build is ~2s, and
    // it matches how react-virtual's suite runs. Anything that can only be observed
    // in dev (core's debug logging is compiled out by NODE_ENV) belongs in the
    // vitest tier, not here — see tests/options.test.ts.
    command: `npm run build && npm run preview -- --port ${PORT}`,
    url: baseURL,
    // Reuse a manually-started server if one is already up — `npm run dev -- --port
    // 4199` for HMR while writing a spec, or `npm run preview`. CI starts its own.
    reuseExistingServer: !process.env.CI,
    // Surface the dev server's output in the test terminal so a crashing or
    // slow-compiling server is visible instead of a silent stall.
    stdout: 'pipe',
    stderr: 'pipe',
    timeout: 120_000,
  },
})
