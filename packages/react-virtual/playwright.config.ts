import { defineConfig } from '@playwright/test'

const PORT = 5173

export default defineConfig({
  testDir: './e2e/app/test',
  use: {
    baseURL: `http://localhost:${PORT}`,
  },
  webServer: {
    command: 'vite --config e2e/app/vite.config.ts',
    port: PORT,
    reuseExistingServer: !process.env.CI,
    stdout: 'pipe',
  },
})
