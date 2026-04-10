import { defineConfig, mergeConfig } from "vitest/config"
import { tanstackViteConfig } from "@tanstack/vite-config"
import marko from "@marko/vite"
import packageJson from "./package.json"

const config = defineConfig({
  // @marko/vite compiles .marko files for the browser in the vitest/jsdom
  // environment, producing templates with mount() for DOM rendering.
  plugins: [marko()],
  test: {
    name: packageJson.name,
    dir: "./tests",
    watch: false,
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
  },
})

export default mergeConfig(
  config,
  tanstackViteConfig({
    entry: "./src/index.ts",
    srcDir: "./src",
  }),
)