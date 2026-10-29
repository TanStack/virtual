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

test('getState keeps range referentially stable while its indexes match', () => {
  const virtualizer = createStoreVirtualizer()
  virtualizer._willUpdate()

  const first = virtualizer.getState()
  virtualizer.resizeItem(0, 80)
  const next = virtualizer.getState()

  expect(next).not.toBe(first)
  expect(next.totalSize).not.toBe(first.totalSize)
  expect(next.range).toBe(first.range)
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

test('_willUpdate publishes options set during render without an onChange', () => {
  const onChange = vi.fn()
  const virtualizer = createStoreVirtualizer({ onChange })
  virtualizer._willUpdate()

  const listener = vi.fn()
  virtualizer.subscribe(listener)
  virtualizer._willUpdate()
  listener.mockClear()
  onChange.mockClear()

  // A render sets a new count and reads the new range 0–1 through getState.
  virtualizer.setOptions({ ...virtualizer.options, count: 2 })
  expect(virtualizer.getState().range).toEqual({ startIndex: 0, endIndex: 1 })
  expect(listener).not.toHaveBeenCalled()

  // The commit counts that range as rendered, so it is not reported again.
  virtualizer._willUpdate()
  expect(listener).toHaveBeenCalledTimes(1)
  expect(onChange).not.toHaveBeenCalled()
  expect(virtualizer.getState().totalSize).toBe(100)
})

test('onChange does not depend on subscribers or getState reads', () => {
  const run = (read: boolean) => {
    let emitOffset: (offset: number, isScrolling: boolean) => void = () => {}
    const onChange = vi.fn()
    const virtualizer = createStoreVirtualizer({
      onChange,
      observeElementOffset: (_, cb) => {
        emitOffset = cb
        cb(0, false)
      },
    })
    virtualizer._willUpdate()
    onChange.mockClear()

    // The range moves from 0–3 to 0–1 outside a render.
    virtualizer.setOptions({ ...virtualizer.options, count: 2 })
    if (read) {
      virtualizer.subscribe(() => {})
      expect(virtualizer.getState().range).toEqual({
        startIndex: 0,
        endIndex: 1,
      })
    }

    emitOffset(0, false)
    return onChange.mock.calls.length
  }

  expect(run(false)).toBe(1)
  expect(run(true)).toBe(1)
})

test('getVirtualItems counts the range it returns as rendered', () => {
  let emitOffset: (offset: number, isScrolling: boolean) => void = () => {}
  const onChange = vi.fn()
  const virtualizer = createStoreVirtualizer({
    onChange,
    observeElementOffset: (_, cb) => {
      emitOffset = cb
      cb(0, false)
    },
  })
  virtualizer._willUpdate()
  onChange.mockClear()

  virtualizer.setOptions({ ...virtualizer.options, count: 2 })
  expect(virtualizer.getVirtualItems()).toHaveLength(2)

  emitOffset(0, false)
  expect(onChange).not.toHaveBeenCalled()
})

test('_willUpdate publishes a change that keeps the range without an onChange', () => {
  const onChange = vi.fn()
  const virtualizer = createStoreVirtualizer({ onChange })
  virtualizer._willUpdate()

  const listener = vi.fn()
  virtualizer.subscribe(listener)
  virtualizer._willUpdate()
  listener.mockClear()
  onChange.mockClear()

  // Half the rows: the total size changes, the visible range 0–3 does not.
  virtualizer.setOptions({ ...virtualizer.options, count: 50 })
  virtualizer._willUpdate()

  expect(listener).toHaveBeenCalledTimes(1)
  expect(onChange).not.toHaveBeenCalled()
  expect(virtualizer.getState().totalSize).toBe(2500)
  expect(virtualizer.getState().range).toEqual({ startIndex: 0, endIndex: 3 })
})
