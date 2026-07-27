import { expect, test } from 'vitest'
import { transformSync } from '@babel/core'

/**
 * Pins the React Compiler contract this package's snapshot hooks exist for.
 *
 * babel-plugin-react-compiler ships a hardcoded type entry marking
 * `useVirtualizer` from '@tanstack/react-virtual' as known-incompatible
 * ("returns functions that cannot be memoized safely"), so components
 * calling it are skipped — never memoized. That skip is keyed on the
 * imported property name, so components calling `useVirtualizerSnapshot`
 * compile normally, and the snapshot's identity semantics (see
 * snapshot.test.tsx) are what keep the compiled output correct.
 *
 * If either half of this test starts failing after a compiler upgrade, the
 * ecosystem contract changed: re-evaluate the guidance in the docs.
 */
function compile(source: string): string {
  const result = transformSync(source, {
    configFile: false,
    babelrc: false,
    filename: 'consumer.tsx',
    parserOpts: { plugins: ['typescript', 'jsx'] },
    plugins: [['babel-plugin-react-compiler', { panicThreshold: 'none' }]],
  })
  if (result?.code == null) throw new Error('babel produced no output')
  return result.code
}

const consumerOf = (hookCall: string) => `
  import * as React from 'react'
  import { useVirtualizer, useVirtualizerSnapshot } from '@tanstack/react-virtual'

  export function List() {
    const parentRef = React.useRef(null)
    ${hookCall}
    return (
      <div ref={parentRef}>
        {items.map((item) => (
          <div key={item.key}>{item.index}</div>
        ))}
      </div>
    )
  }
`

test('components calling useVirtualizerSnapshot are compiled', () => {
  const code = compile(
    consumerOf(`
      const { virtualItems: items } = useVirtualizerSnapshot({
        count: 100,
        getScrollElement: () => parentRef.current,
        estimateSize: () => 40,
      })
    `),
  )

  // The memo cache is the signature of a compiled component.
  expect(code).toContain('_c(')
})

test('components calling useVirtualizer are skipped as known-incompatible', () => {
  const code = compile(
    consumerOf(`
      const virtualizer = useVirtualizer({
        count: 100,
        getScrollElement: () => parentRef.current,
        estimateSize: () => 40,
      })
      const items = virtualizer.getVirtualItems()
    `),
  )

  expect(code).not.toContain('_c(')
})
