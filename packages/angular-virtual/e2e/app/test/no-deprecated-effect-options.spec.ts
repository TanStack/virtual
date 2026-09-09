import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { expect, test } from '@playwright/test'
import { glob } from 'tinyglobby'

const ANGULAR_EXAMPLE_SOURCE_GLOB = 'examples/angular/*/src/**/*.ts'
const DEPRECATED_EFFECT_OPTION = 'allowSignalWrites'
const DEPRECATED_EFFECT_OPTION_PATTERN = new RegExp(
  `\\b${DEPRECATED_EFFECT_OPTION}\\s*:\\s*true\\b`,
)
const REPO_ROOT_RELATIVE_PATH = '../../../../..'
const SOURCE_FILE_ENCODING = 'utf-8'

test('Angular examples do not pass deprecated effect options', async () => {
  const repoRoot = resolve(import.meta.dirname, REPO_ROOT_RELATIVE_PATH)
  const files = await glob(ANGULAR_EXAMPLE_SOURCE_GLOB, { cwd: repoRoot })

  const matches: Array<string> = []

  for (const file of files) {
    const source = await readFile(resolve(repoRoot, file), SOURCE_FILE_ENCODING)
    if (DEPRECATED_EFFECT_OPTION_PATTERN.test(source)) {
      matches.push(file)
    }
  }

  expect(matches, `${DEPRECATED_EFFECT_OPTION} is deprecated`).toEqual([])
})
