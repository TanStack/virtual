import { defineConfig, mergeConfig } from "vitest/config"
import { tanstackViteConfig } from "@tanstack/vite-config"
import packageJson from "./package.json"

// @marko/vite is an app plugin requiring SSR+browser build order — it breaks
// the library build. Only include it during test runs (VITEST env is set).
// The build uses tanstackViteConfig which handles .ts source only.
async function buildConfig() {
  const plugins = process.env["VITEST"]
    ? [(await import("@marko/vite")).default() as any]
    : []

  const config = defineConfig({
    plugins,
    test: {
      name: packageJson.name,
      dir: "./tests",
      watch: false,
      environment: "jsdom",
      setupFiles: ["./tests/setup.ts"],
    },
  })

  return mergeConfig(
    config,
    tanstackViteConfig({
      entry: "./src/index.ts",
      srcDir: "./src",
    }),
  )
}

export default buildConfig()