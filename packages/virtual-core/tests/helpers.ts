import {
  Virtualizer,
  _resetIOSDetectionForTests,
  observeElementOffset,
  observeElementRect,
} from '../src/index'

export function withFakeIOSUserAgent<T>(fn: () => T, ios27 = false): T {
  // jsdom navigator.userAgent lives on the prototype; we set an own property
  // to shadow it, then remove the own property in finally so the prototype
  // value is visible again for subsequent tests.
  Object.defineProperty(navigator, 'userAgent', {
    value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)',
    configurable: true,
  })
  // iOS 27 is told apart by `overflow-anchor` support; jsdom has no `CSS`.
  if (ios27) {
    ;(globalThis as any).CSS = {
      supports: (query: string) => query === 'overflow-anchor: auto',
    }
  }
  _resetIOSDetectionForTests()
  try {
    return fn()
  } finally {
    delete (navigator as any).userAgent
    delete (globalThis as any).CSS
    _resetIOSDetectionForTests()
  }
}

export function makeDeferralHarness({
  ios = true,
  ios27 = false,
  start = 0,
}: { ios?: boolean; ios27?: boolean; start?: number } = {}) {
  const rafCallbacks: Array<FrameRequestCallback> = []
  let now = 0
  const timers = new Map<number, () => void>()
  let timerId = 0
  const mockWindow = {
    requestAnimationFrame: (cb: FrameRequestCallback) => rafCallbacks.push(cb),
    cancelAnimationFrame: () => {
      rafCallbacks.length = 0
    },
    setTimeout: (fn: () => void) => {
      timers.set(++timerId, fn)
      return timerId
    },
    clearTimeout: (id: number) => timers.delete(id),
    performance: { now: () => now },
  }
  const el = makeMockScrollElement({
    scrollTop: start,
    scrollLeft: 0,
    scrollHeight: 5000,
    clientHeight: 200,
    offsetHeight: 200,
    ownerDocument: { defaultView: mockWindow },
  })
  let scrollCallback: ((offset: number, isScrolling: boolean) => void) | null =
    null
  const run = <T>(fn: () => T) => (ios ? withFakeIOSUserAgent(fn, ios27) : fn())
  const writes: Array<number> = []
  // Like iOS under a dragging finger: drop programmatic writes on the floor.
  const browser = { ignoreWrites: false }
  const v = run(() => {
    const instance = new Virtualizer({
      count: 100,
      estimateSize: () => 50,
      initialOffset: start,
      getScrollElement: () => el as any,
      scrollToFn: (offset, { adjustments = 0 }) => {
        writes.push(offset + adjustments)
        if (browser.ignoreWrites) return
        el.scrollTop = offset + adjustments
      },
      observeElementRect: (_inst, cb) => {
        cb({ width: 400, height: 200 })
        return () => {}
      },
      observeElementOffset: (_inst, cb) => {
        scrollCallback = cb
        cb(start, false)
        return () => {}
      },
    })
    instance._willUpdate()
    instance['getMeasurements']()
    return instance
  })
  return {
    v,
    el,
    run,
    writes,
    browser,
    // A scroll event; moves the element first when `offset` is given.
    scroll: (isScrolling: boolean, offset = el.scrollTop) => {
      el.scrollTop = offset
      scrollCallback!(offset, isScrolling)
    },
    frame: () => rafCallbacks.splice(0).forEach((cb) => cb(0)),
    advance: (ms: number) => {
      now += ms
    },
    touch: (type: 'touchstart' | 'touchend') => run(() => el._dispatch(type)),
    // The post-touchend tail times out: the gesture has settled.
    expireTail: () =>
      run(() => {
        const fns = [...timers.values()]
        timers.clear()
        fns.forEach((fn) => fn())
      }),
    // Where a row sits relative to the top of the viewport.
    rowTop: (index: number) =>
      v['getMeasurements']()[index]!.start - el.scrollTop,
  }
}

// Mock EventTarget that records listeners so tests can dispatch events
// without requiring a real DOM. Works in any environment, jsdom or not.
export function makeMockScrollElement(props: Record<string, any>) {
  const listeners = new Map<string, Set<(e: Event) => void>>()
  return {
    ...props,
    addEventListener(name: string, fn: (e: Event) => void) {
      let s = listeners.get(name)
      if (!s) listeners.set(name, (s = new Set()))
      s.add(fn)
    },
    removeEventListener(name: string, fn: (e: Event) => void) {
      listeners.get(name)?.delete(fn)
    },
    _dispatch(name: string) {
      listeners.get(name)?.forEach((fn) => fn({} as Event))
    },
    _hasListener(name: string) {
      return (listeners.get(name)?.size ?? 0) > 0
    },
  } as any
}
