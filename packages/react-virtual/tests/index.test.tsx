import { beforeEach, test, expect, vi } from 'vitest'
import * as React from 'react'
import { renderToString } from 'react-dom/server'
import { act, render, screen } from '@testing-library/react'

import { useVirtualizer, Range } from '../src/index'
import type { Rect } from '../src/index'

beforeEach(() => {
  Object.defineProperties(HTMLElement.prototype, {
    scrollHeight: {
      configurable: true,
      get: () => Number.MAX_SAFE_INTEGER,
    },
    scrollWidth: {
      configurable: true,
      get: () => Number.MAX_SAFE_INTEGER,
    },
  })
})

let renderer: vi.Mock<undefined, []>

type OffsetCallback = (offset: number, isScrolling: boolean) => void

interface ListProps {
  count?: number
  overscan?: number
  height?: number
  width?: number
  itemSize?: number
  rangeExtractor?: (range: Range) => number[]
  dynamic?: boolean
  gap?: number
  useFlushSync?: boolean
  initialRect?: Rect
  // When given, the list installs a stub `observeElementOffset` and stores
  // its callback here so tests can drive scroll notifications directly.
  offsetCallbackRef?: React.MutableRefObject<OffsetCallback | null>
}

function List({
  count = 200,
  overscan,
  height = 200,
  width = 200,
  itemSize,
  rangeExtractor,
  dynamic,
  gap,
  useFlushSync,
  initialRect,
  offsetCallbackRef,
}: ListProps) {
  renderer()

  const parentRef = React.useRef<HTMLDivElement>(null)

  const elementRectCallbackRef = React.useRef<
    ((rect: { height: number; width: number }) => void) | null
  >(null)

  const rowVirtualizer = useVirtualizer({
    count,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 50,
    overscan,
    observeElementRect: (_, cb) => {
      cb({ height, width })
      elementRectCallbackRef.current = cb
    },
    measureElement: () => itemSize ?? 0,
    rangeExtractor,
    gap,
    useFlushSync,
    ...(initialRect ? { initialRect } : {}),
    ...(offsetCallbackRef
      ? {
          observeElementOffset: (_: unknown, cb: OffsetCallback) => {
            cb(0, false)
            offsetCallbackRef.current = cb
          },
        }
      : {}),
  })

  React.useEffect(() => {
    elementRectCallbackRef.current?.({ height, width })
  }, [height, width])

  const measureElement = dynamic ? rowVirtualizer.measureElement : undefined

  const items = rowVirtualizer.getVirtualItems()

  return (
    <div
      ref={parentRef}
      style={{ height, width, overflow: 'auto' }}
      data-testid="scroller"
    >
      <div
        style={{
          height: rowVirtualizer.getTotalSize(),
          width: '100%',
          position: 'relative',
        }}
      >
        {items.map((virtualRow) => (
          <div
            data-testid={`item-${virtualRow.key}`}
            key={virtualRow.key}
            data-index={virtualRow.index}
            ref={measureElement}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              transform: `translateY(${virtualRow.start}px)`,
              height: itemSize,
            }}
          >
            Row {virtualRow.index}
          </div>
        ))}
      </div>
    </div>
  )
}

beforeEach(() => {
  renderer = vi.fn(() => undefined)
})

test('should render', () => {
  render(<List />)

  expect(screen.queryByText('Row 0')).toBeInTheDocument()
  expect(screen.queryByText('Row 4')).toBeInTheDocument()
  expect(screen.queryByText('Row 5')).not.toBeInTheDocument()

  expect(renderer).toHaveBeenCalledTimes(2)
})

test('should render with overscan', () => {
  render(<List overscan={0} />)

  expect(screen.queryByText('Row 0')).toBeInTheDocument()
  expect(screen.queryByText('Row 3')).toBeInTheDocument()
  expect(screen.queryByText('Row 4')).not.toBeInTheDocument()

  expect(renderer).toHaveBeenCalledTimes(2)
})

test('should render given dynamic size', async () => {
  render(<List itemSize={100} dynamic />)

  expect(screen.queryByText('Row 0')).toBeInTheDocument()
  expect(screen.queryByText('Row 1')).toBeInTheDocument()
  expect(screen.queryByText('Row 2')).toBeInTheDocument()
  expect(screen.queryByText('Row 3')).not.toBeInTheDocument()

  expect(renderer).toHaveBeenCalledTimes(3)
})

test('should use rangeExtractor', () => {
  render(<List rangeExtractor={() => [0, 1]} />)

  expect(screen.queryByText('Row 0')).toBeInTheDocument()
  expect(screen.queryByText('Row 1')).toBeInTheDocument()
  expect(screen.queryByText('Row 2')).not.toBeInTheDocument()
})

test('should handle count change', () => {
  const { rerender } = render(<List count={2} />)

  expect(screen.queryByText('Row 0')).toBeInTheDocument()
  expect(screen.queryByText('Row 1')).toBeInTheDocument()
  expect(screen.queryByText('Row 2')).not.toBeInTheDocument()

  rerender(<List count={10} />)

  expect(screen.queryByText('Row 2')).toBeInTheDocument()
  expect(screen.queryByText('Row 4')).toBeInTheDocument()
  expect(screen.queryByText('Row 5')).not.toBeInTheDocument()
})

test('should handle gap change', () => {
  const { rerender } = render(<List count={10} gap={0} />)

  expect(screen.getByTestId('item-1')).toHaveStyle({
    transform: 'translateY(50px)',
  })

  rerender(<List count={10} gap={40} />)

  expect(screen.getByTestId('item-1')).toHaveStyle({
    transform: 'translateY(90px)',
  })
  expect(screen.getByTestId('item-2')).toHaveStyle({
    transform: 'translateY(180px)',
  })
})

test('should handle handle height change', () => {
  const { rerender } = render(<List count={0} height={0} />)

  expect(screen.queryByText('Row 0')).not.toBeInTheDocument()
  rerender(<List count={1} height={200} />)
  expect(screen.queryByText('Row 0')).toBeInTheDocument()
})

// --- useSyncExternalStore subscription -------------------------------------
//
// Re-renders are driven by `useSyncExternalStore`. Scroll notifications
// reach React through the store's subscription; notifications raised while
// React is committing (initial measurement, item refs) are caught by a
// layout effect so the corrected range still paints in the same frame.

function createOffsetRef() {
  return { current: null } as React.MutableRefObject<OffsetCallback | null>
}

test('should re-render when the scroll offset changes', () => {
  const offsetRef = createOffsetRef()
  render(<List offsetCallbackRef={offsetRef} />)

  expect(screen.queryByText('Row 0')).toBeInTheDocument()
  expect(renderer).toHaveBeenCalledTimes(2)

  // 200px viewport, 50px rows, overscan 1: offset 250 → rows 4..9.
  act(() => offsetRef.current!(250, true))

  expect(screen.queryByText('Row 3')).not.toBeInTheDocument()
  expect(screen.queryByText('Row 4')).toBeInTheDocument()
  expect(screen.queryByText('Row 9')).toBeInTheDocument()
  expect(screen.queryByText('Row 10')).not.toBeInTheDocument()
  expect(renderer).toHaveBeenCalledTimes(3)

  // Scroll settles: `isScrolling` flips, range unchanged → one more render.
  act(() => offsetRef.current!(250, false))
  expect(renderer).toHaveBeenCalledTimes(4)
})

// Runs `fn` outside React's act environment so that nothing but the hook's
// own scheduling decides when the update commits.
function withoutAct<T>(fn: () => T): T {
  const g = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  const prev = g.IS_REACT_ACT_ENVIRONMENT
  g.IS_REACT_ACT_ENVIRONMENT = false
  try {
    return fn()
  } finally {
    g.IS_REACT_ACT_ENVIRONMENT = prev
  }
}

test('should commit synchronously during scroll with useFlushSync', () => {
  const offsetRef = createOffsetRef()
  render(<List offsetCallbackRef={offsetRef} />)

  withoutAct(() => {
    offsetRef.current!(250, true)
    // `flushSync` has already committed by the time the scroll handler
    // returns — no scheduler turn in between.
    expect(screen.queryByText('Row 0')).not.toBeInTheDocument()
    expect(screen.queryByText('Row 5')).toBeInTheDocument()
  })
})

test('should let React schedule the commit with useFlushSync: false', async () => {
  const offsetRef = createOffsetRef()
  render(<List offsetCallbackRef={offsetRef} useFlushSync={false} />)

  await withoutAct(async () => {
    offsetRef.current!(250, true)
    // Not flushed synchronously …
    expect(screen.queryByText('Row 0')).toBeInTheDocument()
    expect(screen.queryByText('Row 5')).not.toBeInTheDocument()

    // … but React picks the store change up on its own.
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(screen.queryByText('Row 0')).not.toBeInTheDocument()
    expect(screen.queryByText('Row 5')).toBeInTheDocument()
  })
})

test('should render on the server', () => {
  const html = renderToString(
    <List initialRect={{ height: 200, width: 200 }} />,
  )

  expect(html).toContain('data-testid="item-0"')
  expect(html).toContain('data-testid="item-4"')
  expect(html).not.toContain('data-testid="item-5"')
})

test('should work in StrictMode', () => {
  const offsetRef = createOffsetRef()
  render(
    <React.StrictMode>
      <List offsetCallbackRef={offsetRef} />
    </React.StrictMode>,
  )

  expect(screen.queryByText('Row 0')).toBeInTheDocument()
  expect(screen.queryByText('Row 4')).toBeInTheDocument()
  expect(screen.queryByText('Row 5')).not.toBeInTheDocument()

  act(() => offsetRef.current!(250, true))

  expect(screen.queryByText('Row 3')).not.toBeInTheDocument()
  expect(screen.queryByText('Row 4')).toBeInTheDocument()
  expect(screen.queryByText('Row 9')).toBeInTheDocument()
})

test('should ignore notifications after unmount', () => {
  const offsetRef = createOffsetRef()
  const { unmount } = render(<List offsetCallbackRef={offsetRef} />)
  const renders = renderer.mock.calls.length

  unmount()

  expect(() => act(() => offsetRef.current!(250, true))).not.toThrow()
  expect(renderer).toHaveBeenCalledTimes(renders)
})
