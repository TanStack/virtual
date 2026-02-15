import { beforeEach, expect, test, vi } from 'vitest'
import { render } from 'preact'
import { useEffect, useRef } from 'preact/hooks'
import { act } from 'preact/test-utils'
import { useVirtualizer } from '../src/index'
import type { ComponentChildren } from 'preact'
import type { Range } from '../src/index'

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

let renderer: ReturnType<typeof vi.fn>

interface ListProps {
  count?: number
  overscan?: number
  height?: number
  width?: number
  itemSize?: number
  rangeExtractor?: (range: Range) => Array<number>
  dynamic?: boolean
}

function List({
  count = 200,
  overscan,
  height = 200,
  width = 200,
  itemSize,
  rangeExtractor,
  dynamic,
}: ListProps) {
  renderer()

  const parentRef = useRef<HTMLDivElement>(null)

  const elementRectCallbackRef = useRef<
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
  })

  useEffect(() => {
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

function mount(ui: ComponentChildren) {
  const container = document.createElement('div')
  document.body.appendChild(container)
  act(() => {
    render(ui, container)
  })
  return {
    container,
    rerender(nextUi: ComponentChildren) {
      act(() => {
        render(nextUi, container)
      })
    },
  }
}

const queryByText = (text: string) =>
  Array.from(document.querySelectorAll('div')).find(
    (el) => el.textContent === text,
  )

beforeEach(() => {
  renderer = vi.fn(() => undefined)
})

test('should render', () => {
  mount(<List />)

  expect(queryByText('Row 0')).toBeTruthy()
  expect(queryByText('Row 4')).toBeTruthy()
  expect(queryByText('Row 5')).toBeFalsy()

  expect(renderer).toHaveBeenCalledTimes(2)
})

test('should render with overscan', () => {
  mount(<List overscan={0} />)

  expect(queryByText('Row 0')).toBeTruthy()
  expect(queryByText('Row 3')).toBeTruthy()
  expect(queryByText('Row 4')).toBeFalsy()

  expect(renderer).toHaveBeenCalledTimes(2)
})

test('should render given dynamic size', () => {
  mount(<List itemSize={100} dynamic />)

  expect(queryByText('Row 0')).toBeTruthy()
  expect(queryByText('Row 1')).toBeTruthy()
  expect(queryByText('Row 2')).toBeTruthy()
  expect(queryByText('Row 3')).toBeFalsy()

  expect(renderer).toHaveBeenCalledTimes(3)
})

test('should render given dynamic size after scroll', () => {
  mount(<List itemSize={100} dynamic />)

  expect(queryByText('Row 0')).toBeTruthy()
  expect(queryByText('Row 1')).toBeTruthy()
  expect(queryByText('Row 2')).toBeTruthy()
  expect(queryByText('Row 3')).toBeFalsy()

  expect(renderer).toHaveBeenCalledTimes(3)
  renderer.mockReset()

  const scroller = document.querySelector('[data-testid="scroller"]') as
    | HTMLDivElement
    | undefined

  if (!scroller) {
    throw new Error('scroller not found')
  }

  act(() => {
    scroller.scrollTop = 400
    scroller.dispatchEvent(new Event('scroll'))
  })

  expect(queryByText('Row 2')).toBeFalsy()
  expect(queryByText('Row 3')).toBeTruthy()
  expect(queryByText('Row 6')).toBeTruthy()
  expect(queryByText('Row 7')).toBeFalsy()

  expect(renderer).toHaveBeenCalledTimes(2)
})

test('should use rangeExtractor', () => {
  mount(<List rangeExtractor={() => [0, 1]} />)

  expect(queryByText('Row 0')).toBeTruthy()
  expect(queryByText('Row 1')).toBeTruthy()
  expect(queryByText('Row 2')).toBeFalsy()
})

test('should handle count change', () => {
  const { rerender } = mount(<List count={2} />)

  expect(queryByText('Row 0')).toBeTruthy()
  expect(queryByText('Row 1')).toBeTruthy()
  expect(queryByText('Row 2')).toBeFalsy()

  rerender(<List count={10} />)

  expect(queryByText('Row 2')).toBeTruthy()
  expect(queryByText('Row 4')).toBeTruthy()
  expect(queryByText('Row 5')).toBeFalsy()
})

test('should handle handle height change', () => {
  const { rerender } = mount(<List count={0} height={0} />)

  expect(queryByText('Row 0')).toBeFalsy()
  rerender(<List count={1} height={200} />)
  expect(queryByText('Row 0')).toBeTruthy()
})
