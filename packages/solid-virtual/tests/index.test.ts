import { expect, test } from 'vitest'
import { createRoot, createSignal, flush } from 'solid-js'

import { createVirtualizer } from '../src/index'

test('preserves measured sizes when reactive options change', () => {
  const [count, setCount] = createSignal(2)
  const { virtualizer, dispose } = createRoot((dispose) => ({
    dispose,
    virtualizer: createVirtualizer<HTMLDivElement, HTMLDivElement>({
      get count() {
        return count()
      },
      getScrollElement: () => null,
      estimateSize: () => 60,
      initialRect: { width: 800, height: 600 },
    }),
  }))
  flush()

  expect(virtualizer.getTotalSize()).toBe(120)
  virtualizer.resizeItem(0, 100)
  flush()
  expect(virtualizer.getTotalSize()).toBe(160)

  setCount(3)
  flush()

  expect(virtualizer.itemSizeCache.get(0)).toBe(100)
  expect(virtualizer.getTotalSize()).toBe(220)
  dispose()
})

test('reconciles virtual items by index', () => {
  const [count, setCount] = createSignal(2)
  const { virtualizer, dispose } = createRoot((dispose) => ({
    dispose,
    virtualizer: createVirtualizer<HTMLDivElement, HTMLDivElement>({
      get count() {
        return count()
      },
      getScrollElement: () => null,
      estimateSize: () => 60,
      initialRect: { width: 800, height: 600 },
    }),
  }))
  flush()

  const items = virtualizer.getVirtualItems()
  const first = items[0]
  expect(items.map((item) => item.index)).toEqual([0, 1])

  setCount(3)
  flush()

  expect(virtualizer.getVirtualItems().map((item) => item.index)).toEqual([
    0, 1, 2,
  ])
  expect(virtualizer.getVirtualItems()[0]).toBe(first)

  virtualizer.resizeItem(0, 100)
  flush()

  expect(virtualizer.getVirtualItems()[0]).toBe(first)
  expect(first.size).toBe(100)
  expect(virtualizer.getVirtualItems()[1]!.start).toBe(100)
  dispose()
})
