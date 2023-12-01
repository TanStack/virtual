import path from 'path'
import { BranchConfig, Package } from './types'

export const packages: Package[] = [
  {
    name: '@tanstack/virtual-core',
    packageDir: 'virtual-core',
    srcDir: 'src',
    builds: [
      {
        jsName: 'TanStackVirtualCore',
        entryFile: 'src/index.ts',
        globals: {},
      },
    ],
  },
  {
    name: '@tanstack/react-virtual',
    packageDir: 'react-virtual',
    srcDir: 'src',
    builds: [
      {
        jsName: 'TanStackReactVirtual',
        entryFile: 'src/index.ts',
        globals: {},
      },
    ],
  },
  {
    name: '@tanstack/solid-virtual',
    packageDir: 'solid-virtual',
    srcDir: 'src',
    builds: [
      {
        jsName: 'TanStackSolidVirtual',
        entryFile: 'src/index.ts',
        globals: {},
      },
    ],
  },
  {
    name: '@tanstack/svelte-virtual',
    packageDir: 'svelte-virtual',
    srcDir: 'src',
    builds: [
      {
        jsName: 'TanStackSvelteVirtual',
        entryFile: 'src/index.ts',
        globals: {},
      },
    ],
  },
  {
    name: '@tanstack/vue-virtual',
    packageDir: 'vue-virtual',
    srcDir: 'src',
    builds: [
      {
        jsName: 'TanStackVueVirtual',
        entryFile: 'src/index.ts',
        globals: {},
      },
    ],
  },
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
export const examplesDirs = [
  'examples/react',
  'examples/svelte',
  'examples/vue',
  // 'examples/solid',
]
