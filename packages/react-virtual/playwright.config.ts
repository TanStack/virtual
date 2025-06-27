import { defineConfig } from '@playwright/test'

const PORT = 5173
const baseURL = `http://localhost:${PORT}`

export default defineConfig({
  testDir: './e2e/app/test',
  use: {
    baseURL,
  },
  webServer: {
    command: `VITE_SERVER_PORT=${PORT} vite build --config e2e/app/vite.config.ts && VITE_SERVER_PORT=${PORT} vite preview --config e2e/app/vite.config.ts --port ${PORT}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    stdout: 'pipe',
  },
})
