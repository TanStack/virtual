import * as path from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import rollupReplace from '@rollup/plugin-replace'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
})
