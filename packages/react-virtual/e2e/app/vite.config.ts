import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  root: __dirname,
  plugins: [react()],
  resolve: {
    alias: {
      '@tanstack/react-virtual': path.resolve(__dirname, '../../src/index'),
      '@tanstack/virtual-core': path.resolve(
        __dirname,
        '../../../virtual-core/src/index',
      ),
    },
  },
})
