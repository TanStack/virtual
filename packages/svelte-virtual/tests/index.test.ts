import { get } from 'svelte/store'
import { describe, expect, test, vi } from 'vitest'
import { createVirtualizer, createWindowVirtualizer } from '../src'
import type { SvelteVirtualizer } from '../src'

type TestVirtualizer =
  | SvelteVirtualizer<Element, Element>
  | SvelteVirtualizer<Window, Element>

describe.each([
  ['createVirtualizer', createVirtualizer<Element, Element>],
  ['createWindowVirtualizer', createWindowVirtualizer<Element>],
] as const)('%s', (_name, create) => {
  test('preserves onChange across partial option updates', () => {
    const onChange = vi.fn()
    const subscriber = vi.fn()
    const store = create({
      count: 100,
      estimateSize: () => 40,
      getScrollElement: () => null,
      onChange,
    })
    const unsubscribe = store.subscribe(subscriber)
    const virtualizer = get<TestVirtualizer>(store)

    try {
      for (const options of [{ count: 110 }, { overscan: 2 }, {}]) {
        subscriber.mockClear()
        virtualizer.setOptions(options)
        expect(subscriber).toHaveBeenCalledOnce()
        expect(virtualizer.options.count).toBe(110)
        expect(virtualizer.getTotalSize()).toBe(4400)

        onChange.mockClear()
        subscriber.mockClear()
        virtualizer.measure()

        expect(onChange).toHaveBeenCalledExactlyOnceWith(virtualizer, false)
        expect(subscriber).toHaveBeenCalledExactlyOnceWith(virtualizer)
      }
    } finally {
      unsubscribe()
    }
  })

  test('replaces onChange without retaining the previous wrapper', () => {
    const onChange = vi.fn()
    const nextOnChange = vi.fn()
    const store = create({
      count: 100,
      estimateSize: () => 40,
      getScrollElement: () => null,
      onChange,
    })
    const unsubscribe = store.subscribe(() => {})
    const virtualizer = get<TestVirtualizer>(store)

    try {
      virtualizer.setOptions({ onChange: nextOnChange })
      virtualizer.setOptions({ count: 110 })
      onChange.mockClear()
      nextOnChange.mockClear()
      virtualizer.measure()

      expect(onChange).not.toHaveBeenCalled()
      expect(nextOnChange).toHaveBeenCalledExactlyOnceWith(virtualizer, false)
    } finally {
      unsubscribe()
    }
  })

  test('can clear onChange without stopping store updates', () => {
    const onChange = vi.fn()
    const subscriber = vi.fn()
    const store = create({
      count: 100,
      estimateSize: () => 40,
      getScrollElement: () => null,
      onChange,
    })
    const unsubscribe = store.subscribe(subscriber)
    const virtualizer = get<TestVirtualizer>(store)

    try {
      virtualizer.setOptions({ onChange: undefined })
      virtualizer.setOptions({ count: 110 })
      onChange.mockClear()
      subscriber.mockClear()
      virtualizer.measure()

      expect(onChange).not.toHaveBeenCalled()
      expect(subscriber).toHaveBeenCalledExactlyOnceWith(virtualizer)
    } finally {
      unsubscribe()
    }
  })

  test('preserves updated options when the store is resubscribed', () => {
    const onChange = vi.fn()
    const nextOnChange = vi.fn()
    const store = create({
      count: 100,
      estimateSize: () => 40,
      getScrollElement: () => null,
      onChange,
    })
    const unsubscribe = store.subscribe(() => {})
    const virtualizer = get<TestVirtualizer>(store)
    virtualizer.setOptions({ count: 110, onChange: nextOnChange })
    unsubscribe()

    const subscriber = vi.fn()
    const resubscribe = store.subscribe(subscriber)

    try {
      expect(virtualizer.options.count).toBe(110)
      expect(virtualizer.getTotalSize()).toBe(4400)
      onChange.mockClear()
      nextOnChange.mockClear()
      subscriber.mockClear()
      virtualizer.measure()

      expect(onChange).not.toHaveBeenCalled()
      expect(nextOnChange).toHaveBeenCalledExactlyOnceWith(virtualizer, false)
      expect(subscriber).toHaveBeenCalledExactlyOnceWith(virtualizer)
    } finally {
      resubscribe()
    }
  })

  test('updates the store when no onChange was supplied', () => {
    const subscriber = vi.fn()
    const store = create({
      count: 100,
      estimateSize: () => 40,
      getScrollElement: () => null,
    })
    const unsubscribe = store.subscribe(subscriber)
    const virtualizer = get<TestVirtualizer>(store)

    try {
      virtualizer.setOptions({ count: 110 })
      subscriber.mockClear()
      virtualizer.measure()

      expect(subscriber).toHaveBeenCalledExactlyOnceWith(virtualizer)
    } finally {
      unsubscribe()
    }
  })
})
