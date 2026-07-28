import { defineConfig } from 'vite'
import marko from '@marko/run/vite'
import path from 'node:path'

export default defineConfig({
  plugins: [marko() as any],
  resolve: {
    alias: {
      // Run the suite against SOURCE so no build is needed — and so a core or
      // adapter fix can be verified by editing src alone. These are path aliases,
      // not dependencies: adding @tanstack/marko-virtual to this app's
      // package.json would create the pnpm symlink cycle described in README.md.
      //
      // The adapter alias covers the example fixtures that import the package's JS
      // API (sticky's defaultRangeExtractor). Without it the suite would resolve
      // that import to dist/ and silently become build-dependent again — which is
      // how the previous per-example setup broke: a missing dist/tags surfaced only
      // as a 120s webServer timeout.
      '@tanstack/marko-virtual': path.resolve(__dirname, '../../src/index.ts'),
      '@tanstack/virtual-core': path.resolve(
        __dirname,
        '../../../virtual-core/src/index.ts',
      ),
    },
  },
})
