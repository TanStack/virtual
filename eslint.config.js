// @ts-check

// @ts-expect-error
import { tanstackConfig } from '@tanstack/config/eslint'

export default [
  ...tanstackConfig,
  {
    name: 'tanstack/temp',
    rules: {
      'ts/ban-types': 'off',
      'ts/naming-convention': 'off',
      'ts/no-unnecessary-condition': 'off',
      'no-self-assign': 'off',
    },
  },
]
