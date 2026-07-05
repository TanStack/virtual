import { defineConfig } from 'vite'
import marko from '@marko/run/vite'
import path from 'node:path'

export default defineConfig({
  plugins: [marko() as any],
  resolve: {
    alias: {
      // Run the gates against virtual-core SOURCE so no core build is needed —
      // and so the optional core fix can be gate-verified by editing src alone.
      '@tanstack/virtual-core': path.resolve(
        __dirname,
        '../../../virtual-core/src/index.ts',
      ),
    },
  },
})
