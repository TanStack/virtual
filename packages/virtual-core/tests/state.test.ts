import { expect, test, vi } from 'vitest'
import { Virtualizer } from '../src/index'

function createStoreVirtualizer(
  overrides: Partial<ConstructorParameters<typeof Virtualizer>[0]> = {},
) {
  const scrollElement = document.createElement('div')
  return new Virtualizer<HTMLDivElement, HTMLDivElement>({
    count: 100,
    estimateSize: () => 50,
    getScrollElement: () => scrollElement,
    scrollToFn: vi.fn(),
    observeElementRect: (_, cb) => cb({ width: 200, height: 200 }),
    observeElementOffset: (_, cb) => cb(0, false),
    ...(overrides as object),
  })
}

test('getState keeps its identity until a field changes', () => {
  const virtualizer = createStoreVirtualizer()
  virtualizer._willUpdate()

  const first = virtualizer.getState()
  expect(virtualizer.getState()).toBe(first)
  expect(first.range).toEqual({ startIndex: 0, endIndex: 3 })
  expect(first.virtualItems.map((item) => item.index)).toEqual([0, 1, 2, 3, 4])
  expect(first.totalSize).toBe(5000)
  expect(first.isScrolling).toBe(false)

  virtualizer.setOptions({ ...virtualizer.options, count: 10 })
  const next = virtualizer.getState()
  expect(next).not.toBe(first)
  expect(next.totalSize).toBe(500)
  expect(virtualizer.getState()).toBe(next)
})

test('subscribe notifies listeners when the state changes and unsubscribes', () => {
  const virtualizer = createStoreVirtualizer()
  virtualizer._willUpdate()

  const listener = vi.fn()
  const unsubscribe = virtualizer.subscribe(listener)

  virtualizer.resizeItem(0, 80)
  expect(listener).toHaveBeenCalledTimes(1)
  expect(virtualizer.getState().totalSize).toBe(5030)

  // A publish that leaves the snapshot untouched does not wake listeners.
  virtualizer._willUpdate()
  virtualizer._willUpdate()
  expect(listener).toHaveBeenCalledTimes(1)

  unsubscribe()
  virtualizer.resizeItem(0, 120)
  expect(listener).toHaveBeenCalledTimes(1)
})

test('subscribe publishes a scroll direction flip within the same range', () => {
  let emitOffset: (offset: number, isScrolling: boolean) => void = () => {}
  const virtualizer = createStoreVirtualizer({
    observeElementOffset: (_, cb) => {
      emitOffset = cb
      cb(0, false)
    },
  })
  virtualizer._willUpdate()

  emitOffset(20, true)
  expect(virtualizer.getState().scrollDirection).toBe('forward')

  const listener = vi.fn()
  virtualizer.subscribe(listener)
  const range = virtualizer.getState().range

  emitOffset(15, true)
  expect(virtualizer.getState().range).toEqual(range)
  expect(virtualizer.getState().scrollDirection).toBe('backward')
  expect(listener).toHaveBeenCalledTimes(1)
})

test('_willUpdate publishes options set since the last notify', () => {
  const virtualizer = createStoreVirtualizer()
  virtualizer._willUpdate()

  const listener = vi.fn()
  virtualizer.subscribe(listener)
  virtualizer._willUpdate()
  listener.mockClear()

  virtualizer.setOptions({ ...virtualizer.options, count: 2 })
  expect(listener).not.toHaveBeenCalled()

  virtualizer._willUpdate()
  expect(listener).toHaveBeenCalledTimes(1)
  expect(virtualizer.getState().totalSize).toBe(100)
})
