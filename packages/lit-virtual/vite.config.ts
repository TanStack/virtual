import { defineConfig, mergeConfig } from 'vitest/config'
import packageJson from './package.json'
import dts from 'vite-plugin-dts'
import { resolve } from 'node:path'

const config = defineConfig({
  test: {
    name: packageJson.name,
    watch: false,
    environment: 'jsdom'
  },
})

export default mergeConfig(config, {
  plugins: [
    dts({
      include: ['src'],
    }),
  ],
  build: {
    lib: {
      entry: resolve('src', 'index.ts'),
      formats: ['es', 'cjs'],
      fileName: (format: string) => {
        if (format === 'cjs') return 'cjs/[name].cjs'
        return 'esm/[name].js'
      },
    },
    rollupOptions: {
      external: ['lit']
    },
  },
})
