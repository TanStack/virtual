import * as path from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import rollupReplace from '@rollup/plugin-replace'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    rollupReplace({
      preventAssignment: true,
      values: {
        __DEV__: JSON.stringify(true),
        'process.env.NODE_ENV': JSON.stringify('development'),
      },
    }),
    react(),
  ],
  resolve: process.env.USE_SOURCE
    ? {
        alias: {
          '@tanstack/react-virtual': path.resolve(
            __dirname,
            '../../packages/react-virtual/src/index.tsx',
          ),
        },
      }
    : {},
})
