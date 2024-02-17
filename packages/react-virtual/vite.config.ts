import { defineConfig, mergeConfig } from 'vitest/config'
import { tanstackBuildConfig } from '@tanstack/config/build'
import react from '@vitejs/plugin-react'

const config = defineConfig({
  plugins: [react()],
  test: {
    name: 'react-form',
    watch: false,
    environment: 'jsdom',
    setupFiles: ['test-setup.ts'],
  },
})

export default mergeConfig(
  config,
  tanstackBuildConfig({
    entry: './src/index.tsx',
    srcDir: './src',
  }),
)
