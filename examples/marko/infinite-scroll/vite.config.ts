import { defineConfig } from 'vite'
import marko from '@marko/run/vite'

export default defineConfig({
  // Cast to any: the workspace resolves two Vite majors — @marko/run/vite is
  // built against Vite 8, while the examples pin Vite 6 — and their Plugin types
  // are structurally incompatible (the hotUpdate hook signature differs), so
  // defineConfig (typed against Vite 6 here) rejects the Vite 8 plugin. The
  // plugin is correct at runtime; drop the cast once the tree is on one Vite.
  plugins: [marko() as any],
})
