import { test, expect, vi } from 'vitest'
import * as React from 'react'
import { act, render, screen } from '@testing-library/react'

import {
  useVirtualizer,
  useVirtualizerState,
  useWindowVirtualizer,
} from '../src/index'
import type { ReactVirtualizer, ReactVirtualizerOptions } from '../src/index'

type TestVirtualizer = ReactVirtualizer<HTMLDivElement, Element>
type OffsetListener = (offset: number, isScrolling: boolean) => void

// jsdom fires no scroll events. The driver stands in for `observeElementOffset`
// and lets a test emit them: `scrollTo(offset)` while scrolling, and
// `scrollTo(offset, false)` for the settled event that ends `isScrolling`.
function createScrollDriver() {
  let listener: OffsetListener = () => {}
  return {
    observeElementOffset: (_: unknown, cb: OffsetListener) => {
      listener = cb
      cb(0, false)
    },
    scrollTo: (offset: number, isScrolling = true) =>
      listener(offset, isScrolling),
  }
}

// 50px rows in a 200px viewport without overscan: rows 0–3 are visible.
function useTestVirtualizer(
  count: number,
  options: Partial<ReactVirtualizerOptions<HTMLDivElement, Element>> = {},
) {
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
    ...options,
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

// Rows the virtualizer positions itself (`directDomUpdates`), read through the
// state hook. Memoised, so a parent re-render alone does not reach them: they
// mount in their own commit, after the parent's layout effects have run. With
// `empty` set, the container only mounts once there are rows.
const DirectRows = React.memo(function DirectRows({
  virtualizer,
  empty,
}: {
  virtualizer: TestVirtualizer
  empty?: string
}) {
  const virtualItems = useVirtualizerState(virtualizer, (s) => s.virtualItems)
  if (virtualItems.length === 0 && empty !== undefined) {
    return <p>{empty}</p>
  }
  return (
    <div ref={virtualizer.containerRef} style={{ position: 'relative' }}>
      {virtualItems.map((item) => (
        <div
          key={item.key}
          data-testid={`row-${item.index}`}
          data-index={item.index}
          ref={virtualizer.measureElement}
          style={{ position: 'absolute', top: 0, height: 50 }}
        />
      ))}
    </div>
  )
})

const transformOf = (testId: string) =>
  screen.getByTestId(testId).style.transform

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
  let instance: TestVirtualizer | null = null

  function TotalSize({ virtualizer }: { virtualizer: TestVirtualizer }) {
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
  function TotalSize({ virtualizer }: { virtualizer: TestVirtualizer }) {
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

test('useVirtualizerState updates a memoised child on scroll', () => {
  const scroll = createScrollDriver()

  function Rows({ virtualizer }: { virtualizer: TestVirtualizer }) {
    const { virtualItems } = useVirtualizerState(virtualizer)
    return (
      <div>
        {virtualItems.map((item) => (
          <div key={item.key} data-testid={`row-${item.index}`} />
        ))}
      </div>
    )
  }

  const MemoRows = React.memo(Rows)

  function App() {
    const { parentRef, virtualizer } = useTestVirtualizer(100, {
      observeElementOffset: scroll.observeElementOffset,
    })
    return (
      <div ref={parentRef}>
        <MemoRows virtualizer={virtualizer} />
      </div>
    )
  }

  render(<App />)
  expect(screen.getByTestId('row-0')).toBeInTheDocument()

  act(() => scroll.scrollTo(500))

  expect(screen.getByTestId('row-10')).toBeInTheDocument()
  expect(screen.getByTestId('row-13')).toBeInTheDocument()
  expect(screen.queryByTestId('row-0')).not.toBeInTheDocument()
})

test('useVirtualizerState follows isScrolling through a selector', () => {
  const scroll = createScrollDriver()

  function Status({ virtualizer }: { virtualizer: TestVirtualizer }) {
    const isScrolling = useVirtualizerState(virtualizer, (s) => s.isScrolling)
    return <div data-testid="scrolling">{String(isScrolling)}</div>
  }

  const MemoStatus = React.memo(Status)

  function App() {
    const { parentRef, virtualizer } = useTestVirtualizer(100, {
      observeElementOffset: scroll.observeElementOffset,
    })
    return (
      <div ref={parentRef}>
        <MemoStatus virtualizer={virtualizer} />
      </div>
    )
  }

  render(<App />)
  expect(screen.getByTestId('scrolling')).toHaveTextContent('false')

  act(() => scroll.scrollTo(10))
  expect(screen.getByTestId('scrolling')).toHaveTextContent('true')

  act(() => scroll.scrollTo(10, false))
  expect(screen.getByTestId('scrolling')).toHaveTextContent('false')
})

test('a count change still fires onChange while a subscriber is attached', () => {
  const onChange = vi.fn()

  function TotalSize({ virtualizer }: { virtualizer: TestVirtualizer }) {
    const totalSize = useVirtualizerState(virtualizer, (s) => s.totalSize)
    return <div data-testid="total">{totalSize}</div>
  }

  const Memoized = React.memo(TotalSize)

  function App({ count }: { count: number }) {
    const { parentRef, virtualizer } = useTestVirtualizer(count, { onChange })
    return (
      <div ref={parentRef}>
        <Memoized virtualizer={virtualizer} />
      </div>
    )
  }

  const { rerender } = render(<App count={100} />)
  onChange.mockClear()

  // Nothing reads the new range during render, so the publish from
  // `_willUpdate` has to go through `onChange` — exactly once.
  rerender(<App count={2} />)

  expect(screen.getByTestId('total')).toHaveTextContent('100')
  expect(onChange).toHaveBeenCalledTimes(1)
})

test('useVirtualizerState works with useWindowVirtualizer', () => {
  const scroll = createScrollDriver()

  function App() {
    const virtualizer = useWindowVirtualizer({
      count: 100,
      estimateSize: () => 50,
      overscan: 0,
      measureElement: () => 50,
      observeElementRect: (_, cb) => {
        cb({ height: 200, width: 200 })
      },
      observeElementOffset: scroll.observeElementOffset,
      // jsdom does not implement `window.scrollTo`.
      scrollToFn: () => {},
    })
    const { virtualItems } = useVirtualizerState(virtualizer)
    return (
      <div>
        {virtualItems.map((item) => (
          <div key={item.key} data-testid={`row-${item.index}`} />
        ))}
      </div>
    )
  }

  render(<App />)
  expect(screen.getByTestId('row-0')).toBeInTheDocument()

  act(() => scroll.scrollTo(500))

  expect(screen.getByTestId('row-10')).toBeInTheDocument()
  expect(screen.queryByTestId('row-0')).not.toBeInTheDocument()
})

test('directDomUpdates positions rows a memoised child mounts after a count change', () => {
  function App({ count }: { count: number }) {
    const { parentRef, virtualizer } = useTestVirtualizer(count, {
      directDomUpdates: true,
    })
    return (
      <div ref={parentRef}>
        <DirectRows virtualizer={virtualizer} />
      </div>
    )
  }

  const { rerender } = render(<App count={2} />)
  expect(screen.queryByTestId('row-2')).not.toBeInTheDocument()

  rerender(<App count={100} />)

  expect(transformOf('row-2')).toBe('translate3d(0, 100px, 0)')
  expect(transformOf('row-3')).toBe('translate3d(0, 150px, 0)')
})

test('directDomUpdates positions rows a memoised child mounts when the owner read the state', () => {
  function App({ count }: { count: number }) {
    const { parentRef, virtualizer } = useTestVirtualizer(count, {
      directDomUpdates: true,
    })
    // Reading the state here marks the new range as seen, so `_willUpdate`
    // reaches the child without an `onChange` and the owner does not render
    // again: its layout effect has run before the child's rows mount.
    const totalSize = useVirtualizerState(virtualizer, (s) => s.totalSize)
    return (
      <div ref={parentRef}>
        <div data-testid="total">{totalSize}</div>
        <DirectRows virtualizer={virtualizer} />
      </div>
    )
  }

  const { rerender } = render(<App count={2} />)
  rerender(<App count={100} />)

  expect(screen.getByTestId('total')).toHaveTextContent('5000')
  expect(transformOf('row-2')).toBe('translate3d(0, 100px, 0)')
  expect(transformOf('row-3')).toBe('translate3d(0, 150px, 0)')
})

test('directDomUpdates positions rows a memoised child mounts together with the container', () => {
  function App({ count }: { count: number }) {
    const { parentRef, virtualizer } = useTestVirtualizer(count, {
      directDomUpdates: true,
    })
    const totalSize = useVirtualizerState(virtualizer, (s) => s.totalSize)
    return (
      <div ref={parentRef}>
        <div data-testid="total">{totalSize}</div>
        <DirectRows virtualizer={virtualizer} empty="No rows" />
      </div>
    )
  }

  const { rerender } = render(<App count={0} />)
  expect(screen.getByText('No rows')).toBeInTheDocument()

  // The rows' refs run before the container's, so `containerRef` has to
  // position the rows that registered ahead of it.
  rerender(<App count={100} />)

  expect(screen.getByTestId('total')).toHaveTextContent('5000')
  expect(screen.getByTestId('row-1').parentElement).toHaveStyle({
    height: '5000px',
  })
  expect(transformOf('row-1')).toBe('translate3d(0, 50px, 0)')
  expect(transformOf('row-3')).toBe('translate3d(0, 150px, 0)')
})
