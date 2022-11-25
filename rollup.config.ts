import type { OutputOptions, RollupOptions } from 'rollup'
import babel from '@rollup/plugin-babel'
import { terser } from 'rollup-plugin-terser'
import size from 'rollup-plugin-size'
import visualizer from 'rollup-plugin-visualizer'
import replace from '@rollup/plugin-replace'
import nodeResolve from '@rollup/plugin-node-resolve'
import path from 'path'
import svelte from 'rollup-plugin-svelte'

type Options = {
  input: string | string[]
  packageDir: string
  external: RollupOptions['external']
  banner: string
  jsName: string
  outputFile: string
  globals: Record<string, string>
  forceDevEnv: boolean
  forceBundle: boolean
}

const forceEnvPlugin = (type: 'development' | 'production') =>
  replace({
    'process.env.NODE_ENV': `"${type}"`,
    delimiters: ['', ''],
    preventAssignment: true,
  })

const babelPlugin = babel({
  babelHelpers: 'bundled',
  exclude: /node_modules/,
  extensions: ['.ts', '.tsx'],
})

export default function rollup(options: RollupOptions): RollupOptions[] {
  return [
    ...buildConfigs({
      name: 'virtual-core',
      packageDir: 'packages/virtual-core',
      jsName: 'VirtualCore',
      outputFile: 'index',
      entryFile: ['src/index.ts'],
      globals: {},
    }),
    ...buildConfigs({
      name: 'react-virtual',
      packageDir: 'packages/react-virtual',
      jsName: 'ReactVirtual',
      outputFile: 'index',
      entryFile: ['src/index.tsx'],
      globals: {
        '@tanstack/virtual-core': 'VirtualCore',
        react: 'React',
        'react-dom': 'ReactDOM',
      },
      bundleUMDGlobals: ['@tanstack/virtual-core'],
    }),
    ...buildConfigs({
      name: 'solid-virtual',
      packageDir: 'packages/solid-virtual',
      jsName: 'SolidVirtual',
      outputFile: 'index',
      entryFile: 'src/index.tsx',
      globals: {
        '@tanstack/virtual-core': 'VirtualCore',
        'solid-js/store': 'SolidStore',
        'solid-js': 'Solid',
      },
      bundleUMDGlobals: ['@tanstack/virtual-core'],
    }),
    ...buildConfigs({
      name: 'svelte-virtual',
      packageDir: 'packages/svelte-virtual',
      jsName: 'SvelteVirtual',
      outputFile: 'index',
      entryFile: 'src/index.ts',
      globals: {
        '@tanstack/virtual-core': 'VirtualCore',
        svelte: 'Svelte',
        'svelte/internal': 'SvelteInternal',
        'svelte/store': 'SvelteStore',
      },
      bundleUMDGlobals: ['@tanstack/virtual-core'],
    }),
  ]
}

function buildConfigs(opts: {
  packageDir: string
  name: string
  jsName: string
  outputFile: string
  entryFile: string | string[]
  globals: Record<string, string>
  // This option allows to bundle specified dependencies for umd build
  bundleUMDGlobals?: string[]
  // Force prod env build
  forceDevEnv?: boolean
  forceBundle?: boolean
  skipUmdBuild?: boolean
}): RollupOptions[] {
  const firstEntry = path.resolve(
    opts.packageDir,
    Array.isArray(opts.entryFile) ? opts.entryFile[0] : opts.entryFile,
  )
  const entries = Array.isArray(opts.entryFile)
    ? opts.entryFile
    : [opts.entryFile]
  const input = entries.map((entry) => path.resolve(opts.packageDir, entry))
  const externalDeps = Object.keys(opts.globals)

  const bundleUMDGlobals = opts.bundleUMDGlobals || []
  const umdExternal = externalDeps.filter(
    (external) => !bundleUMDGlobals.includes(external),
  )

  const external = (moduleName) => externalDeps.includes(moduleName)
  const banner = createBanner(opts.name)

  const options: Options = {
    input,
    jsName: opts.jsName,
    outputFile: opts.outputFile,
    packageDir: opts.packageDir,
    external,
    banner,
    globals: opts.globals,
    forceDevEnv: opts.forceDevEnv || false,
    forceBundle: opts.forceBundle || false,
  }

  let builds = [mjs(options), esm(options), cjs(options)]

  if (!opts.skipUmdBuild) {
    builds = builds.concat([
      umdDev({ ...options, external: umdExternal, input: firstEntry }),
      umdProd({ ...options, external: umdExternal, input: firstEntry }),
    ])
  }

  return builds
}

function mjs({
  input,
  packageDir,
  external,
  banner,
  outputFile,
  forceDevEnv,
  forceBundle,
}: Options): RollupOptions {
  const bundleOutput: OutputOptions = {
    format: 'esm',
    file: `${packageDir}/build/lib/${outputFile}.mjs`,
    sourcemap: true,
    banner,
  }

  const normalOutput: OutputOptions = {
    format: 'esm',
    dir: `${packageDir}/build/lib`,
    sourcemap: true,
    banner,
    preserveModules: true,
    entryFileNames: '[name].mjs',
  }

  return {
    // ESM
    external,
    input,
    output: forceBundle ? bundleOutput : normalOutput,
    plugins: [
      svelte({
        compilerOptions: {
          hydratable: true,
        },
      }),
      babelPlugin,
      nodeResolve({ extensions: ['.ts', '.tsx'] }),
      forceDevEnv ? forceEnvPlugin('development') : undefined,
    ],
  }
}

function esm({
  input,
  packageDir,
  external,
  banner,
  outputFile,
  forceDevEnv,
  forceBundle,
}: Options): RollupOptions {
  const bundleOutput: OutputOptions = {
    format: 'esm',
    file: `${packageDir}/build/lib/${outputFile}.esm.js`,
    sourcemap: true,
    banner,
  }

  const normalOutput: OutputOptions = {
    format: 'esm',
    dir: `${packageDir}/build/lib`,
    sourcemap: true,
    banner,
    preserveModules: true,
    entryFileNames: '[name].esm.js',
  }

  return {
    // ESM
    external,
    input,
    output: forceBundle ? bundleOutput : normalOutput,
    plugins: [
      svelte({
        compilerOptions: {
          hydratable: true,
        },
      }),
      babelPlugin,
      nodeResolve({ extensions: ['.ts', '.tsx'] }),
      forceDevEnv ? forceEnvPlugin('development') : undefined,
    ],
  }
}

function cjs({
  input,
  external,
  packageDir,
  banner,
  outputFile,
  forceDevEnv,
  forceBundle,
}: Options): RollupOptions {
  const bundleOutput: OutputOptions = {
    format: 'cjs',
    file: `${packageDir}/build/lib/${outputFile}.js`,
    sourcemap: true,
    exports: 'named',
    banner,
  }

  const normalOutput: OutputOptions = {
    format: 'cjs',
    dir: `${packageDir}/build/lib`,
    sourcemap: true,
    exports: 'named',
    banner,
    preserveModules: true,
    entryFileNames: '[name].js',
  }

  return {
    // CJS
    external,
    input,
    output: forceBundle ? bundleOutput : normalOutput,
    plugins: [
      svelte(),
      babelPlugin,
      nodeResolve({ extensions: ['.ts', '.tsx'] }),
      forceDevEnv ? forceEnvPlugin('development') : undefined,
    ],
  }
}

function umdDev({
  input,
  external,
  packageDir,
  outputFile,
  globals,
  banner,
  jsName,
}: Options): RollupOptions {
  return {
    // UMD (Dev)
    external,
    input,
    output: {
      format: 'umd',
      sourcemap: true,
      file: `${packageDir}/build/umd/${outputFile}.development.js`,
      name: jsName,
      globals,
      banner,
    },
    plugins: [
      svelte(),
      babelPlugin,
      nodeResolve({ extensions: ['.ts', '.tsx'] }),
      forceEnvPlugin('development'),
    ],
  }
}

function umdProd({
  input,
  external,
  packageDir,
  outputFile,
  globals,
  banner,
  jsName,
}: Options): RollupOptions {
  return {
    // UMD (Prod)
    external,
    input,
    output: {
      format: 'umd',
      sourcemap: true,
      file: `${packageDir}/build/umd/${outputFile}.production.js`,
      name: jsName,
      globals,
      banner,
    },
    plugins: [
      svelte(),
      babelPlugin,
      nodeResolve({ extensions: ['.ts', '.tsx'] }),
      forceEnvPlugin('production'),
      terser({
        mangle: true,
        compress: true,
      }),
      size({}),
      visualizer({
        filename: `${packageDir}/build/stats-html.html`,
        gzipSize: true,
      }),
      visualizer({
        filename: `${packageDir}/build/stats.json`,
        json: true,
        gzipSize: true,
      }),
    ],
  }
}

function createBanner(libraryName: string) {
  return `/**
 * ${libraryName}
 *
 * Copyright (c) TanStack
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.md file in the root directory of this source tree.
 *
 * @license MIT
 */`
}
