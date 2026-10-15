import { expect, test, vi } from 'vitest'
import {
  Virtualizer,
  elementScroll,
  observeElementOffset,
  observeElementRect,
  observeWindowOffset,
  windowScroll,
} from '../src/index'

// ─── elementScroll / windowScroll public exports ─────────────────────────────

function makeBaseInstance(scrollEl: any, opts: any = {}) {
  return {
    scrollElement: scrollEl,
    options: {
      horizontal: false,
      ...opts,
    },
  } as any
}

test('elementScroll: calls scrollTo with top + behavior on the scroll element', () => {
  const scrollTo = vi.fn()
  const scrollEl = { scrollTo }
  elementScroll(100, { behavior: 'smooth' }, makeBaseInstance(scrollEl) as any)
  expect(scrollTo).toHaveBeenCalledWith({ top: 100, behavior: 'smooth' })
})

test('elementScroll: applies adjustments offset', () => {
  const scrollTo = vi.fn()
  const scrollEl = { scrollTo }
  elementScroll(
    100,
    { adjustments: 50, behavior: 'auto' },
    makeBaseInstance(scrollEl) as any,
  )
  expect(scrollTo).toHaveBeenCalledWith({ top: 150, behavior: 'auto' })
})

test('elementScroll: uses left when horizontal is true', () => {
  const scrollTo = vi.fn()
  const scrollEl = { scrollTo }
  elementScroll(
    100,
    { behavior: 'auto' },
    makeBaseInstance(scrollEl, { horizontal: true }) as any,
  )
  expect(scrollTo).toHaveBeenCalledWith({ left: 100, behavior: 'auto' })
})

test('windowScroll: calls scrollTo with top + behavior on the window', () => {
  const scrollTo = vi.fn()
  const win = { scrollTo }
  windowScroll(250, { behavior: 'smooth' }, makeBaseInstance(win) as any)
  expect(scrollTo).toHaveBeenCalledWith({ top: 250, behavior: 'smooth' })
})

test('windowScroll: applies adjustments + horizontal', () => {
  const scrollTo = vi.fn()
  const win = { scrollTo }
  windowScroll(
    250,
    { adjustments: -10, behavior: 'auto' },
    makeBaseInstance(win, { horizontal: true }) as any,
  )
  expect(scrollTo).toHaveBeenCalledWith({ left: 240, behavior: 'auto' })
})

test('elementScroll / windowScroll: no-op when scrollElement is null', () => {
  expect(() =>
    elementScroll(100, {}, makeBaseInstance(null) as any),
  ).not.toThrow()
  expect(() =>
    windowScroll(100, {}, makeBaseInstance(null) as any),
  ).not.toThrow()
})

// ─── observeElementOffset / observeWindowOffset ──────────────────────────────

function makeObserveInstance(
  element: any,
  opts: {
    horizontal?: boolean
    isRtl?: boolean
    useScrollendEvent?: boolean
    isScrollingResetDelay?: number
  } = {},
  targetWindow: any = {
    setTimeout: globalThis.setTimeout.bind(globalThis),
    clearTimeout: globalThis.clearTimeout.bind(globalThis),
  },
) {
  return {
    scrollElement: element,
    targetWindow,
    options: {
      horizontal: false,
      isRtl: false,
      useScrollendEvent: false,
      isScrollingResetDelay: 150,
      ...opts,
    },
  } as any
}

test('observeElementOffset: returns undefined when scrollElement is null', () => {
  const cb = vi.fn()
  expect(
    observeElementOffset(makeObserveInstance(null) as any, cb),
  ).toBeUndefined()
  expect(cb).not.toHaveBeenCalled()
})

test('observeElementOffset: attaches scroll listener and fires callback with scrollTop', () => {
  const cb = vi.fn()
  const listeners = new Map<string, EventListener>()
  const el: any = {
    scrollTop: 50,
    scrollLeft: 0,
    addEventListener: (name: string, fn: any) => listeners.set(name, fn),
    removeEventListener: (name: string) => listeners.delete(name),
  }
  const cleanup = observeElementOffset(makeObserveInstance(el) as any, cb)
  expect(listeners.has('scroll')).toBe(true)
  // No scrollend listener by default
  expect(listeners.has('scrollend')).toBe(false)
  // Trigger scroll
  listeners.get('scroll')!({} as Event)
  expect(cb).toHaveBeenCalledWith(50, true)
  cleanup?.()
  expect(listeners.has('scroll')).toBe(false)
})

test('observeElementOffset: fallback reads offset after programmatic changes', () => {
  vi.useFakeTimers()
  try {
    const cb = vi.fn()
    const listeners = new Map<string, EventListener>()
    const el: any = {
      scrollTop: 50,
      scrollLeft: 0,
      addEventListener: (name: string, fn: any) => listeners.set(name, fn),
      removeEventListener: (name: string) => listeners.delete(name),
    }
    observeElementOffset(makeObserveInstance(el) as any, cb)

    listeners.get('scroll')!({} as Event)
    el.scrollTop = 125
    vi.advanceTimersByTime(150)

    expect(cb).toHaveBeenLastCalledWith(125, false)
  } finally {
    vi.useRealTimers()
  }
})

// ─── cleanup resets the scroll flags ─────────────────────────────────────────
// The cancelled debounce is the only writer of `isScrolling = false`, and
// `cleanup()` also runs while the instance stays alive (element swap,
// `enabled: false`), so it has to reset the flags itself.

const makeScrollFlagsVirtualizer = () => {
  const MockResizeObserver = vi.fn(function () {
    return { observe: vi.fn(), unobserve: vi.fn(), disconnect: vi.fn() }
  })
  const mockWindow = {
    requestAnimationFrame: vi.fn(),
    cancelAnimationFrame: vi.fn(),
    ResizeObserver: MockResizeObserver,
  }
  const makeElement = () =>
    ({
      scrollTop: 0,
      scrollLeft: 0,
      scrollWidth: 1000,
      scrollHeight: 5000,
      offsetWidth: 400,
      offsetHeight: 600,
      ownerDocument: { defaultView: mockWindow },
    }) as unknown as HTMLDivElement

  const first = makeElement()
  const second = makeElement()
  let element: HTMLDivElement | null = first
  let emit: ((offset: number, isScrolling: boolean) => void) | null = null

  const virtualizer = new Virtualizer({
    count: 100,
    estimateSize: () => 50,
    getScrollElement: () => element,
    scrollToFn: vi.fn(),
    observeElementRect: (_instance, cb) => {
      cb({ width: 400, height: 600 })
      return () => {}
    },
    observeElementOffset: (_instance, cb) => {
      emit = cb
      return () => {}
    },
  })

  virtualizer._willUpdate()

  // Mid-scroll: this is the state the debounce used to clear on its own.
  emit!(500, true)

  return {
    virtualizer,
    swapElement: () => {
      element = second
      virtualizer._willUpdate()
    },
    disable: () => {
      element = null
      virtualizer._willUpdate()
    },
  }
}

test('cleanup resets the scroll flags when the scroll element is swapped', () => {
  const { virtualizer, swapElement } = makeScrollFlagsVirtualizer()

  expect(virtualizer.isScrolling).toBe(true)

  swapElement()

  expect(virtualizer.isScrolling).toBe(false)
  expect(virtualizer.scrollDirection).toBe(null)
})

test('cleanup resets the scroll flags when the scroll element goes away', () => {
  const { virtualizer, disable } = makeScrollFlagsVirtualizer()

  expect(virtualizer.isScrolling).toBe(true)

  disable()

  expect(virtualizer.isScrolling).toBe(false)
  expect(virtualizer.scrollDirection).toBe(null)
})

test('cleanup resets the scroll flags on unmount', () => {
  const { virtualizer } = makeScrollFlagsVirtualizer()

  expect(virtualizer.isScrolling).toBe(true)

  virtualizer._didMount()()

  expect(virtualizer.isScrolling).toBe(false)
  expect(virtualizer.scrollDirection).toBe(null)
})

test('observeElementOffset: cleanup drops the queued isScrolling reset', () => {
  vi.useFakeTimers()
  try {
    const cb = vi.fn()
    const listeners = new Map<string, EventListener>()
    const el: any = {
      scrollTop: 50,
      scrollLeft: 0,
      addEventListener: (name: string, fn: any) => listeners.set(name, fn),
      removeEventListener: (name: string) => listeners.delete(name),
    }
    const cleanup = observeElementOffset(makeObserveInstance(el) as any, cb)

    // Each scroll arms a debounce that resets isScrolling to false.
    listeners.get('scroll')!({} as Event)
    expect(cb).toHaveBeenCalledWith(50, true)
    cb.mockClear()

    // Tearing down inside that window must not leave the reset queued —
    // it would arrive after the consumer stopped listening.
    cleanup?.()
    vi.advanceTimersByTime(1000)

    expect(cb).not.toHaveBeenCalled()
  } finally {
    vi.useRealTimers()
  }
})

test('observeElementOffset: reads scrollLeft + applies isRtl when horizontal', () => {
  const cb = vi.fn()
  const listeners = new Map<string, EventListener>()
  const el: any = {
    scrollTop: 0,
    scrollLeft: 80,
    addEventListener: (name: string, fn: any) => listeners.set(name, fn),
    removeEventListener: (name: string) => listeners.delete(name),
  }
  observeElementOffset(
    makeObserveInstance(el, { horizontal: true, isRtl: true }) as any,
    cb,
  )
  listeners.get('scroll')!({} as Event)
  // isRtl flips sign
  expect(cb).toHaveBeenCalledWith(-80, true)
})

test('observeWindowOffset: returns undefined when scrollElement is null', () => {
  const cb = vi.fn()
  expect(
    observeWindowOffset(makeObserveInstance(null) as any, cb),
  ).toBeUndefined()
})

test('observeWindowOffset: attaches scroll listener and fires callback with scrollY', () => {
  const cb = vi.fn()
  const listeners = new Map<string, EventListener>()
  const win: any = {
    scrollX: 0,
    scrollY: 120,
    addEventListener: (name: string, fn: any) => listeners.set(name, fn),
    removeEventListener: (name: string) => listeners.delete(name),
  }
  const cleanup = observeWindowOffset(makeObserveInstance(win) as any, cb)
  expect(listeners.has('scroll')).toBe(true)
  listeners.get('scroll')!({} as Event)
  expect(cb).toHaveBeenCalledWith(120, true)
  cleanup?.()
  expect(listeners.has('scroll')).toBe(false)
})

test('observeWindowOffset: reads scrollX when horizontal', () => {
  const cb = vi.fn()
  const listeners = new Map<string, EventListener>()
  const win: any = {
    scrollX: 75,
    scrollY: 0,
    addEventListener: (name: string, fn: any) => listeners.set(name, fn),
    removeEventListener: (name: string) => listeners.delete(name),
  }
  observeWindowOffset(makeObserveInstance(win, { horizontal: true }) as any, cb)
  listeners.get('scroll')!({} as Event)
  expect(cb).toHaveBeenCalledWith(75, true)
})
