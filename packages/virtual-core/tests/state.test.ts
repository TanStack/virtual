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

test('subscribe notifies listeners alongside onChange and unsubscribes', () => {
  const onChange = vi.fn()
  const virtualizer = createStoreVirtualizer({ onChange })
  virtualizer._willUpdate()

  const listener = vi.fn()
  const unsubscribe = virtualizer.subscribe(listener)

  onChange.mockClear()
  virtualizer.measure()
  expect(onChange).toHaveBeenCalledTimes(1)
  expect(listener).toHaveBeenCalledTimes(1)
  expect(listener).toHaveBeenCalledWith(false)

  unsubscribe()
  virtualizer.measure()
  expect(listener).toHaveBeenCalledTimes(1)
})
