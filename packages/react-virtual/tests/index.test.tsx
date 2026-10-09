import { beforeEach, test, expect, vi } from 'vitest'
import * as React from 'react'
import { act, render, screen } from '@testing-library/react'

import { useVirtualizer, Range } from '../src/index'
import type { ReactVirtualizer } from '../src/index'

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

interface ListProps {
  count?: number
  overscan?: number
  height?: number
  width?: number
  itemSize?: number
  rangeExtractor?: (range: Range) => number[]
  dynamic?: boolean
  gap?: number
  initialOffset?: number
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
  initialOffset,
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
    initialOffset,
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

test('should not flushSync while measuring an item from its ref callback', () => {
  // `measureElement` is passed as a ref, so React calls it while committing. When
  // the measured size differs from the estimate for an item above the current
  // scroll offset, the virtualizer compensates the scroll position and notifies
  // synchronously. Calling flushSync from there makes React warn — it cannot flush
  // while it is already committing.
  const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

  render(<List itemSize={100} dynamic initialOffset={400} />)

  expect(
    errorSpy.mock.calls.filter((args) => String(args[0]).includes('flushSync')),
  ).toEqual([])

  errorSpy.mockRestore()
})

// `directDomUpdates` rows rendered by a child component that re-renders on its
// own — local state, context, a resolved Suspense boundary — commit without the
// owner, so the owner's layout effect never positions them. With fixed-size
// rows, measuring them does not notify either.
function DirectList({
  children,
}: {
  children: (
    virtualizer: ReactVirtualizer<HTMLDivElement, HTMLDivElement>,
  ) => React.ReactNode
}) {
  const parentRef = React.useRef<HTMLDivElement>(null)

  const virtualizer = useVirtualizer({
    count: 10,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 50,
    observeElementRect: (_, cb) => cb({ height: 200, width: 200 }),
    measureElement: () => 50,
    directDomUpdates: true,
  })

  return (
    <div ref={parentRef} style={{ height: 200, overflow: 'auto' }}>
      {children(virtualizer)}
    </div>
  )
}

const DirectRows = React.memo(function DirectRows({
  virtualizer,
  show,
}: {
  virtualizer: ReactVirtualizer<HTMLDivElement, HTMLDivElement>
  show: (setVisible: (visible: boolean) => void) => void
}) {
  const [visible, setVisible] = React.useState(false)
  show(setVisible)

  return (
    <div ref={virtualizer.containerRef} style={{ position: 'relative' }}>
      {virtualizer
        .getVirtualItems()
        .filter((item) => visible || item.index !== 2)
        .map((item) => (
          <div
            key={item.key}
            data-testid={`item-${item.key}`}
            data-index={item.index}
            ref={virtualizer.measureElement}
            style={{ position: 'absolute', top: 0, height: 50 }}
          />
        ))}
    </div>
  )
})

test('directDomUpdates positions a row a child mounts without the owner', () => {
  let setVisible: (visible: boolean) => void = () => {}

  render(
    <DirectList>
      {(virtualizer) => (
        <DirectRows
          virtualizer={virtualizer}
          show={(set) => (setVisible = set)}
        />
      )}
    </DirectList>,
  )

  expect(screen.getByTestId('item-1')).toHaveStyle({
    transform: 'translate3d(0, 50px, 0)',
  })
  expect(screen.queryByTestId('item-2')).not.toBeInTheDocument()

  act(() => setVisible(true))

  expect(screen.getByTestId('item-2')).toHaveStyle({
    transform: 'translate3d(0, 100px, 0)',
  })
})

const DirectContainer = React.memo(function DirectContainer({
  virtualizer,
  show,
}: {
  virtualizer: ReactVirtualizer<HTMLDivElement, HTMLDivElement>
  show: (setVisible: (visible: boolean) => void) => void
}) {
  const [visible, setVisible] = React.useState(false)
  show(setVisible)

  if (!visible) return null

  return (
    <div ref={virtualizer.containerRef} style={{ position: 'relative' }}>
      {virtualizer.getVirtualItems().map((item) => (
        <div
          key={item.key}
          data-testid={`item-${item.key}`}
          data-index={item.index}
          ref={virtualizer.measureElement}
          style={{ position: 'absolute', top: 0, height: 50 }}
        />
      ))}
    </div>
  )
})

test('directDomUpdates positions rows a child mounts together with the container', () => {
  let setVisible: (visible: boolean) => void = () => {}

  render(
    <DirectList>
      {(virtualizer) => (
        <DirectContainer
          virtualizer={virtualizer}
          show={(set) => (setVisible = set)}
        />
      )}
    </DirectList>,
  )

  // React attaches the rows' refs before the container's, so they register
  // before there is a container to position them in.
  act(() => setVisible(true))

  expect(screen.getByTestId('item-3')).toHaveStyle({
    transform: 'translate3d(0, 150px, 0)',
  })
})
