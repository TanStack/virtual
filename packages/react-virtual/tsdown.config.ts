import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['./src/index.tsx'],
  unbundle: true,
  format: ['esm'],
})