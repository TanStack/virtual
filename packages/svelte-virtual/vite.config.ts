import { svelte } from '@sveltejs/vite-plugin-svelte'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [svelte()],
  test: {
    dir: './tests',
    watch: false,
  },
})
