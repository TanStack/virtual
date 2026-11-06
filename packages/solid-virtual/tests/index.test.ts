import { expect, test } from 'vitest'
import { createRoot, createSignal } from 'solid-js'

import { createVirtualizer } from '../src/index'

test('preserves measured sizes when reactive options change', async () => {
  await createRoot(async (dispose) => {
    const [count, setCount] = createSignal(2)
    const virtualizer = createVirtualizer<HTMLDivElement, HTMLDivElement>({
      get count() {
        return count()
      },
      getScrollElement: () => null,
      estimateSize: () => 60,
      initialRect: { width: 800, height: 600 },
    })

    expect(virtualizer.getTotalSize()).toBe(120)
    virtualizer.resizeItem(0, 100)
    // `resizeItem` notifies with `sync: false`, so it lands one microtask later.
    await Promise.resolve()
    expect(virtualizer.getTotalSize()).toBe(160)

    setCount(3)

    expect(virtualizer.itemSizeCache.get(0)).toBe(100)
    expect(virtualizer.getTotalSize()).toBe(220)
    dispose()
  })
})

test('applies size changes after the current synchronous pass', async () => {
  await createRoot(async (dispose) => {
    const virtualizer = createVirtualizer<HTMLDivElement, HTMLDivElement>({
      count: 100,
      getScrollElement: () => null,
      estimateSize: () => 50,
      initialRect: { width: 100, height: 200 },
    })

    // The store array <For> iterates: reconcile mutates this exact object.
    const items = virtualizer.getVirtualItems()
    const before = items.length
    expect(before).toBeGreaterThan(1)
    expect(virtualizer.getTotalSize()).toBe(100 * 50)

    virtualizer.resizeItem(0, 4000)
    expect(items.length).toBe(before)
    expect(virtualizer.getTotalSize()).toBe(100 * 50)

    await Promise.resolve()

    expect(items.length).toBeLessThan(before)
    expect(virtualizer.getTotalSize()).toBe(4000 + 99 * 50)
    dispose()
  })
})

test('drops a pending size change after dispose', async () => {
  const { virtualizer, items } = createRoot((dispose) => {
    const instance = createVirtualizer<HTMLDivElement, HTMLDivElement>({
      count: 100,
      getScrollElement: () => null,
      estimateSize: () => 50,
      initialRect: { width: 100, height: 200 },
    })
    const virtualItems = instance.getVirtualItems()
    dispose()
    return { virtualizer: instance, items: virtualItems }
  })

  const before = items.length
  virtualizer.resizeItem(0, 4000)
  await Promise.resolve()

  expect(items.length).toBe(before)
})
