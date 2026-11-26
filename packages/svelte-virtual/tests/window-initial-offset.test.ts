// @vitest-environment jsdom
import { get } from 'svelte/store'
import { afterEach, expect, test } from 'vitest'
import { createWindowVirtualizer } from '../src'

function setWindowScroll(x: number, y: number) {
  Object.defineProperties(window, {
    scrollX: { configurable: true, value: x },
    scrollY: { configurable: true, value: y },
  })
}

afterEach(() => {
  setWindowScroll(0, 0)
})

test('seeds from the current axis after re-enabling', () => {
  setWindowScroll(300, 1000)
  const store = createWindowVirtualizer<Element>({
    count: 100,
    estimateSize: () => 50,
  })
  const unsubscribe = store.subscribe(() => {})
  const virtualizer = get(store)

  try {
    expect(virtualizer.scrollOffset).toBe(1000)

    virtualizer.setOptions({ enabled: false })
    virtualizer.setOptions({ horizontal: true })
    virtualizer.setOptions({ enabled: true })

    expect(virtualizer.getVirtualItems()[0]?.index).toBe(5)
    expect(virtualizer.scrollOffset).toBe(300)
  } finally {
    unsubscribe()
  }
})

test('keeps an explicit initialOffset', () => {
  setWindowScroll(300, 1000)
  const store = createWindowVirtualizer<Element>({
    count: 100,
    estimateSize: () => 50,
    initialOffset: () => 150,
  })
  const unsubscribe = store.subscribe(() => {})
  const virtualizer = get(store)

  try {
    virtualizer.setOptions({ enabled: false })
    virtualizer.setOptions({ horizontal: true })
    virtualizer.setOptions({ enabled: true })

    expect(virtualizer.scrollOffset).toBe(150)
  } finally {
    unsubscribe()
  }
})
