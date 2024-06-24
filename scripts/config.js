// @ts-check

import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * List your npm packages here. The first package will be used as the versioner.
 * @type {import('./types').Package[]}
 */
export const packages = [
  {
    name: '@tanstack/virtual-core',
    packageDir: 'packages/virtual-core',
  },
  {
    name: '@tanstack/react-virtual',
    packageDir: 'packages/react-virtual',
  },
  {
    name: '@tanstack/solid-virtual',
    packageDir: 'packages/solid-virtual',
  },
  {
    name: '@tanstack/svelte-virtual',
    packageDir: 'packages/svelte-virtual',
  },
  {
    name: '@tanstack/vue-virtual',
    packageDir: 'packages/vue-virtual',
  },
  {
    name: '@tanstack/angular-virtual',
    packageDir: 'packages/angular-virtual',
  },
]

/**
 * Contains config for publishable branches.
 * @type {Record<string, import('./types').BranchConfig>}
 */
export const branchConfigs = {
  main: {
    prerelease: false,
  },
  next: {
    prerelease: true,
  },
  beta: {
    prerelease: true,
  },
  alpha: {
    prerelease: true,
  },
  rc: {
    prerelease: true,
  },
}

const __dirname = fileURLToPath(new URL('.', import.meta.url))
export const rootDir = resolve(__dirname, '..')
