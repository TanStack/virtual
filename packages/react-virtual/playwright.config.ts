import { defineConfig } from '@playwright/test'

// Not 5173: that is vite's default dev port, and with reuseExistingServer a stray
// `vite dev` from any other project in the tree means the suite silently runs
// against the WRONG app instead of failing. --strictPort below turns a port that is
// genuinely taken into an immediate error rather than a quiet rebind that leaves
// Playwright waiting on a dead URL.
const PORT = Number(process.env.VITE_SERVER_PORT ?? 5273)
const baseURL = `http://localhost:${PORT}`

export default defineConfig({
  testDir: './e2e/app/test',
  use: {
    baseURL,
    // Without a trace a CI-only failure is a stack trace with no page state, and
    // the DOM at the moment a scroll offset went wrong is the whole diagnosis. The
    // trace carries screenshots itself.
    trace: 'retain-on-failure',
  },
  webServer: {
    command: `VITE_SERVER_PORT=${PORT} vite build --config e2e/app/vite.config.ts && VITE_SERVER_PORT=${PORT} vite build --config e2e/app/react-compiler-vite.config.ts && VITE_SERVER_PORT=${PORT} vite preview --config e2e/app/vite.config.ts --port ${PORT} --strictPort`,
    url: `${baseURL}/scroll/`,
    reuseExistingServer: !process.env.CI,
    stdout: 'pipe',
  },
})
