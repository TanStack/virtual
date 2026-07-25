import { beforeEach, expect, test, vi } from 'vitest'
import * as React from 'react'
import { act, render, screen } from '@testing-library/react'
import { renderToString } from 'react-dom/server'

import {
  useVirtualizerSnapshot,
  useWindowVirtualizerSnapshot,
} from '../src/index'
import type { VirtualizerSnapshot } from '../src/index'

let renderer: ReturnType<typeof vi.fn>

const captured: {
  results: Array<VirtualizerSnapshot<HTMLDivElement, HTMLDivElement>>
  offsetCb: ((offset: number, isScrolling: boolean) => void) | null
} = { results: [], offsetCb: null }

beforeEach(() => {
  renderer = vi.fn(() => undefined)
  captured.results = []
  captured.offsetCb = null
})

interface SnapshotListProps {
  count?: number
  height?: number
  width?: number
  label?: string
}

function SnapshotList({
  count = 200,
  height = 200,
  width = 200,
  label = '',
}: SnapshotListProps) {
  renderer()

  const parentRef = React.useRef<HTMLDivElement>(null)

  const result = useVirtualizerSnapshot<HTMLDivElement, HTMLDivElement>({
    count,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 50,
    observeElementRect: (_, cb) => {
      cb({ height, width })
    },
    observeElementOffset: (_, cb) => {
      cb(0, false)
      captured.offsetCb = cb
    },
  })
  captured.results.push(result)

  const { virtualItems, totalSize } = result

  return (
    <div
      ref={parentRef}
      style={{ height, width, overflow: 'auto' }}
      data-testid="scroller"
    >
      <div style={{ height: totalSize, width: '100%', position: 'relative' }}>
        {virtualItems.map((virtualRow) => (
          <div
            data-testid={`item-${virtualRow.key}`}
            key={virtualRow.key}
            data-index={virtualRow.index}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              transform: `translateY(${virtualRow.start}px)`,
              height: 50,
            }}
          >
            Row {virtualRow.index}
            {label}
          </div>
        ))}
      </div>
    </div>
  )
}

test('renders the initial range from the snapshot', () => {
  render(<SnapshotList />)

  expect(screen.queryByText('Row 0')).toBeInTheDocument()
  expect(screen.queryByText('Row 4')).toBeInTheDocument()
  expect(screen.queryByText('Row 5')).not.toBeInTheDocument()
})

test('keeps snapshot and result referentially stable across unrelated re-renders', () => {
  const { rerender } = render(<SnapshotList />)
  const afterMount = captured.results[captured.results.length - 1]!

  rerender(<SnapshotList label="!" />)
  const afterRerender = captured.results[captured.results.length - 1]!

  // The compiler contract: no geometry change -> identical references, so
  // memoization keyed on these values stays correct.
  expect(afterRerender.virtualItems).toBe(afterMount.virtualItems)
  expect(afterRerender.totalSize).toBe(afterMount.totalSize)
  expect(afterRerender.virtualizer).toBe(afterMount.virtualizer)
  expect(afterRerender).toBe(afterMount)
})

test('publishes a new snapshot when the scroll offset changes the range', () => {
  render(<SnapshotList />)
  const before = captured.results[captured.results.length - 1]!

  act(() => {
    captured.offsetCb!(500, true)
  })

  const after = captured.results[captured.results.length - 1]!

  expect(screen.queryByText('Row 10')).toBeInTheDocument()
  expect(screen.queryByText('Row 0')).not.toBeInTheDocument()
  expect(after.virtualItems).not.toBe(before.virtualItems)
  expect(after.virtualizer).toBe(before.virtualizer)
})

test('renders under StrictMode', () => {
  render(
    <React.StrictMode>
      <SnapshotList />
    </React.StrictMode>,
  )

  expect(screen.queryByText('Row 0')).toBeInTheDocument()
  expect(screen.queryByText('Row 4')).toBeInTheDocument()
})

test('renders the initial range on the server via getServerSnapshot', () => {
  function ServerList() {
    const { virtualItems, totalSize } = useVirtualizerSnapshot<
      HTMLDivElement,
      HTMLDivElement
    >({
      count: 200,
      getScrollElement: () => null,
      estimateSize: () => 50,
      initialRect: { height: 200, width: 200 },
    })
    return (
      <div style={{ height: totalSize }}>
        {virtualItems.map((virtualRow) => (
          <div key={virtualRow.key}>Row {virtualRow.index}</div>
        ))}
      </div>
    )
  }

  const html = renderToString(<ServerList />)

  // renderToString separates adjacent text nodes with comment markers, so
  // match the index text node itself rather than the joined string.
  expect(html).toMatch(/>0</)
  expect(html).toMatch(/>4</)
  expect(html).not.toMatch(/>5</)
})

test('useWindowVirtualizerSnapshot renders items', () => {
  function WindowList() {
    const { virtualItems } = useWindowVirtualizerSnapshot<HTMLDivElement>({
      count: 50,
      estimateSize: () => 50,
    })
    return (
      <div>
        {virtualItems.map((virtualRow) => (
          <div key={virtualRow.key}>Row {virtualRow.index}</div>
        ))}
      </div>
    )
  }

  render(<WindowList />)

  expect(screen.queryByText('Row 0')).toBeInTheDocument()
})
