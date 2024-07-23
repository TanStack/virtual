// @ts-check

import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { publish } from '@tanstack/config/publish'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

await publish({
  packages: [
    {
      name: '@tanstack/lit-virtual',
      packageDir: 'packages/lit-virtual',
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
      name: '@tanstack/virtual-core',
      packageDir: 'packages/virtual-core',
    },
    {
      name: '@tanstack/vue-virtual',
      packageDir: 'packages/vue-virtual',
    },
  ],
  branchConfigs: {
    main: {
      prerelease: false,
    },
    alpha: {
      prerelease: true,
    },
    beta: {
      prerelease: true,
    },
  },
  rootDir: resolve(__dirname, '..'),
  branch: process.env.BRANCH,
  tag: process.env.TAG,
  ghToken: process.env.GH_TOKEN,
})

process.exit(0)
