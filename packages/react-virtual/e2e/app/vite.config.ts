import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  root: __dirname,
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        scroll: path.resolve(__dirname, 'scroll/index.html'),
        'measure-element': path.resolve(
          __dirname,
          'measure-element/index.html',
        ),
        'smooth-scroll': path.resolve(
          __dirname,
          'smooth-scroll/index.html',
        ),
      },
    },
  },
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
