import path from 'path'
import { BranchConfig, Package } from './types'

// TODO: List your npm packages here. The first package will be used as the versioner.
export const packages: Package[] = [
  {
    name: '@tanstack/virtual-core',
    packageDir: 'virtual-core',
    srcDir: 'src',
  },
  {
    name: '@tanstack/react-virtual',
    packageDir: 'react-virtual',
    srcDir: 'src',
    dependencies: ['@tanstack/virtual-core'],
  },
  {
    name: '@tanstack/solid-virtual',
    packageDir: 'solid-virtual',
    srcDir: 'src',
    dependencies: ['@tanstack/virtual-core'],
  },
  {
    name: '@tanstack/svelte-virtual',
    packageDir: 'svelte-virtual',
    srcDir: 'src',
    dependencies: ['@tanstack/virtual-core'],
  },
  {
    name: '@tanstack/vue-virtual',
    packageDir: 'vue-virtual',
    srcDir: 'src',
    dependencies: ['@tanstack/virtual-core'],
  }
]

export const latestBranch = 'main'

export const branchConfigs: Record<string, BranchConfig> = {
  main: {
    prerelease: false,
    ghRelease: true,
  },
  next: {
    prerelease: true,
    ghRelease: true,
  },
  beta: {
    prerelease: true,
    ghRelease: true,
  },
  alpha: {
    prerelease: true,
    ghRelease: true,
  },
}

export const rootDir = path.resolve(__dirname, '..')
export const examplesDirs = ['examples/react']
