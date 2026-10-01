import { test, expect, vi } from 'vitest'
import * as React from 'react'
import { act, render, screen } from '@testing-library/react'

import { useVirtualizer, useVirtualizerState } from '../src/index'
import type { Virtualizer } from '../src/index'

function useTestVirtualizer(count: number) {
  const parentRef = React.useRef<HTMLDivElement>(null)
  const virtualizer = useVirtualizer({
    count,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 50,
    overscan: 0,
    // jsdom has no layout, so a real measurement would collapse every row.
    measureElement: () => 50,
    observeElementRect: (_, cb) => {
      cb({ height: 200, width: 200 })
    },
  })
  return { parentRef, virtualizer }
}

function StateList({ count }: { count: number }) {
  const { parentRef, virtualizer } = useTestVirtualizer(count)
  const { virtualItems, totalSize } = useVirtualizerState(virtualizer)

  return (
    <div ref={parentRef} style={{ height: 200, overflow: 'auto' }}>
      <div data-testid="sizer" style={{ height: totalSize }}>
        {virtualItems.map((item) => (
          <div
            key={item.key}
            data-index={item.index}
            ref={virtualizer.measureElement}
            style={{ height: 50 }}
          >
            Row {item.index}
          </div>
        ))}
      </div>
    </div>
  )
}

test('useVirtualizerState renders the visible items and total size', () => {
  render(<StateList count={100} />)

  expect(screen.getByText('Row 0')).toBeInTheDocument()
  expect(screen.getByText('Row 3')).toBeInTheDocument()
  expect(screen.queryByText('Row 4')).not.toBeInTheDocument()
  expect(screen.getByTestId('sizer')).toHaveStyle({ height: '5000px' })
})

test('useVirtualizerState reflects a count change in the same render', () => {
  const { rerender } = render(<StateList count={100} />)

  rerender(<StateList count={2} />)

  expect(screen.getByText('Row 1')).toBeInTheDocument()
  expect(screen.queryByText('Row 2')).not.toBeInTheDocument()
  expect(screen.getByTestId('sizer')).toHaveStyle({ height: '100px' })
})

test('useVirtualizerState with a selector re-renders only when the selection changes', () => {
  const renders = vi.fn()
  let instance: Virtualizer<HTMLDivElement, Element> | null = null

  function TotalSize({
    virtualizer,
  }: {
    virtualizer: Virtualizer<HTMLDivElement, Element>
  }) {
    const totalSize = useVirtualizerState(virtualizer, (s) => s.totalSize)
    renders(totalSize)
    return <div data-testid="total">{totalSize}</div>
  }

  const Memoized = React.memo(TotalSize)

  function App() {
    const { parentRef, virtualizer } = useTestVirtualizer(100)
    instance = virtualizer
    return (
      <div ref={parentRef}>
        <Memoized virtualizer={virtualizer} />
      </div>
    )
  }

  render(<App />)
  expect(screen.getByTestId('total')).toHaveTextContent('5000')
  const rendersBefore = renders.mock.calls.length

  // A notify that leaves totalSize untouched must not re-render the child.
  act(() => instance!.measure())
  expect(renders.mock.calls.length).toBe(rendersBefore)

  act(() => instance!.resizeItem(0, 150))
  expect(screen.getByTestId('total')).toHaveTextContent('5100')
})

test('useVirtualizerState updates a memoised child when the parent changes count', () => {
  function TotalSize({
    virtualizer,
  }: {
    virtualizer: Virtualizer<HTMLDivElement, Element>
  }) {
    const totalSize = useVirtualizerState(virtualizer, (s) => s.totalSize)
    return <div data-testid="total">{totalSize}</div>
  }

  const Memoized = React.memo(TotalSize)

  function App({ count }: { count: number }) {
    const { parentRef, virtualizer } = useTestVirtualizer(count)
    return (
      <div ref={parentRef}>
        <Memoized virtualizer={virtualizer} />
      </div>
    )
  }

  const { rerender } = render(<App count={100} />)
  expect(screen.getByTestId('total')).toHaveTextContent('5000')

  rerender(<App count={2} />)
  expect(screen.getByTestId('total')).toHaveTextContent('100')
})
