import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { effectScope, nextTick, shallowRef } from 'vue'
import { useVirtualizer, useWindowVirtualizer } from '../src'
import type { EffectScope } from 'vue'

describe('scroll element lifecycle', () => {
  let scope: EffectScope

  beforeEach(() => {
    scope = effectScope()
  })

  afterEach(() => {
    scope.stop()
  })

  function setup<T extends HTMLElement | Window>(initialElement: T | null) {
    const scrollElement = shallowRef(initialElement)
    const cleanupRect = vi.fn()
    const cleanupOffset = vi.fn()
    const options = {
      count: 10,
      estimateSize: () => 50,
      getScrollElement: () => scrollElement.value,
      observeElementRect: vi.fn(() => cleanupRect),
      observeElementOffset: vi.fn(() => cleanupOffset),
      scrollToFn: vi.fn(),
    }

    return { scrollElement, cleanupRect, cleanupOffset, options }
  }

  test('attaches observers when an initially null element becomes available', async () => {
    const { scrollElement, options } = setup<HTMLElement>(null)
    const virtualizer = scope.run(() => useVirtualizer(options))!

    expect(virtualizer.value.scrollElement).toBeNull()
    expect(options.observeElementRect).not.toHaveBeenCalled()
    expect(options.observeElementOffset).not.toHaveBeenCalled()

    scrollElement.value = document.createElement('div')
    await nextTick()

    expect(virtualizer.value.scrollElement).toBe(scrollElement.value)
    expect(options.observeElementRect).toHaveBeenCalledTimes(1)
    expect(options.observeElementOffset).toHaveBeenCalledTimes(1)
  })

  test('cleans up observers when the element becomes null and reattaches later', async () => {
    const element = document.createElement('div')
    const { scrollElement, cleanupRect, cleanupOffset, options } =
      setup(element)
    const virtualizer = scope.run(() => useVirtualizer(options))!

    expect(virtualizer.value.scrollElement).toBe(element)

    scrollElement.value = null
    await nextTick()

    expect(cleanupRect).toHaveBeenCalledTimes(1)
    expect(cleanupOffset).toHaveBeenCalledTimes(1)
    expect(virtualizer.value.scrollElement).toBeNull()
    expect(virtualizer.value.targetWindow).toBeNull()

    scrollElement.value = element
    await nextTick()

    expect(virtualizer.value.scrollElement).toBe(element)
    expect(options.observeElementRect).toHaveBeenCalledTimes(2)
    expect(options.observeElementOffset).toHaveBeenCalledTimes(2)

    scope.stop()
    expect(cleanupRect).toHaveBeenCalledTimes(2)
    expect(cleanupOffset).toHaveBeenCalledTimes(2)
    expect(virtualizer.value.scrollElement).toBeNull()
  })

  test('cleans up observers on element replacement and scope disposal', async () => {
    const { scrollElement, cleanupRect, cleanupOffset, options } = setup(
      document.createElement('div'),
    )
    const virtualizer = scope.run(() => useVirtualizer(options))!

    scrollElement.value = document.createElement('div')
    await nextTick()

    expect(cleanupRect).toHaveBeenCalledTimes(1)
    expect(cleanupOffset).toHaveBeenCalledTimes(1)
    expect(virtualizer.value.scrollElement).toBe(scrollElement.value)
    expect(options.observeElementRect).toHaveBeenCalledTimes(2)
    expect(options.observeElementOffset).toHaveBeenCalledTimes(2)

    scope.stop()
    expect(cleanupRect).toHaveBeenCalledTimes(2)
    expect(cleanupOffset).toHaveBeenCalledTimes(2)
    expect(virtualizer.value.scrollElement).toBeNull()
  })

  test('cleans up window observers when the window getter becomes null', async () => {
    const { scrollElement, cleanupRect, cleanupOffset, options } =
      setup<Window>(window)
    const virtualizer = scope.run(() => useWindowVirtualizer(options))!

    expect(virtualizer.value.scrollElement).toBe(window)

    scrollElement.value = null
    await nextTick()

    expect(cleanupRect).toHaveBeenCalledTimes(1)
    expect(cleanupOffset).toHaveBeenCalledTimes(1)
    expect(virtualizer.value.scrollElement).toBeNull()

    scope.stop()
    expect(cleanupRect).toHaveBeenCalledTimes(1)
    expect(cleanupOffset).toHaveBeenCalledTimes(1)
  })
})
