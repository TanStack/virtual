import { defineConfig, mergeConfig } from 'vitest/config'
import { tanstackBuildConfig } from '@tanstack/config/build'
import packageJson from './package.json'

const config = defineConfig({
  test: {
    name: packageJson.name,
    watch: false,
  },
})

export default mergeConfig(
  config,
  tanstackBuildConfig({
    entry: './src/index.ts',
    srcDir: './src',
  }),
)
