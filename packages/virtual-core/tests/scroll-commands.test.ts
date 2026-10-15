import { expect, test, vi } from 'vitest'
import {
  Virtualizer,
  observeElementOffset,
  observeElementRect,
} from '../src/index'
import type { VirtualizerOptions } from '../src/index'

test('should not throw when component unmounts during scrollToIndex rAF loop', () => {
  // Collect rAF callbacks so we can flush them manually
  const rafCallbacks: Array<FrameRequestCallback> = []
  const mockRaf = vi.fn((cb: FrameRequestCallback) => {
    rafCallbacks.push(cb)
    return rafCallbacks.length
  })

  const MockResizeObserver = vi.fn(function () {
    return {
      observe: vi.fn(),
      unobserve: vi.fn(),
      disconnect: vi.fn(),
    }
  })

  const mockWindow = {
    requestAnimationFrame: mockRaf,
    cancelAnimationFrame: vi.fn(),
    ResizeObserver: MockResizeObserver,
  }

  const mockScrollElement = {
    scrollTop: 0,
    scrollLeft: 0,
    scrollWidth: 1000,
    scrollHeight: 5000,
    offsetWidth: 400,
    offsetHeight: 600,
    ownerDocument: {
      defaultView: mockWindow,
    },
  } as unknown as HTMLDivElement

  const virtualizer = new Virtualizer({
    count: 100,
    estimateSize: () => 50,
    measureElement: (el) => el.getBoundingClientRect().height,
    getScrollElement: () => mockScrollElement,
    scrollToFn: vi.fn(),
    observeElementRect: (instance, cb) => {
      cb({ width: 400, height: 600 })
      return () => {}
    },
    observeElementOffset: (instance, cb) => {
      cb(0, false)
      return () => {}
    },
  })

  // Initialize the virtualizer so targetWindow is set
  virtualizer._willUpdate()

  // Populate elementsCache so isDynamicMode() returns true.
  // This triggers the code path where the rAF callback calls
  // this.targetWindow!.requestAnimationFrame(verify)
  const mockElement = {
    getBoundingClientRect: () => ({ height: 50 }),
    isConnected: true,
    setAttribute: vi.fn(),
  } as unknown as HTMLElement
  virtualizer.elementsCache.set(0, mockElement)

  // Trigger scrollToIndex which schedules a rAF callback
  virtualizer.scrollToIndex(50)

  // Simulate component unmount — cleanup sets targetWindow to null
  const unmount = virtualizer._didMount()
  unmount()

  // Flush all pending rAF callbacks — this should not throw
  // Without the fix, this crashes with:
  // "Cannot read properties of null (reading 'requestAnimationFrame')"
  expect(() => {
    rafCallbacks.forEach((cb) => cb(0))
  }).not.toThrow()
})

function createMockEnvironment() {
  const rafCallbacks: Array<FrameRequestCallback> = []
  let rafIdCounter = 0
  const mockRaf = vi.fn((cb: FrameRequestCallback) => {
    rafCallbacks.push(cb)
    return ++rafIdCounter
  })
  const mockCancelRaf = vi.fn()

  const MockResizeObserver = vi.fn(function () {
    return {
      observe: vi.fn(),
      unobserve: vi.fn(),
      disconnect: vi.fn(),
    }
  })

  const mockWindow = {
    requestAnimationFrame: mockRaf,
    cancelAnimationFrame: mockCancelRaf,
    performance: { now: () => Date.now() },
    ResizeObserver: MockResizeObserver,
  }

  const mockScrollElement = {
    scrollTop: 0,
    scrollLeft: 0,
    scrollWidth: 1000,
    scrollHeight: 5000,
    clientWidth: 400,
    clientHeight: 600,
    offsetWidth: 400,
    offsetHeight: 600,
    ownerDocument: {
      defaultView: mockWindow,
    },
    scrollTo: vi.fn(),
  } as unknown as HTMLDivElement

  const scrollToFn = vi.fn()

  return { rafCallbacks, mockWindow, mockScrollElement, scrollToFn }
}

function createVirtualizer(
  mockScrollElement: HTMLDivElement,
  scrollToFn: ReturnType<typeof vi.fn>,
) {
  return new Virtualizer({
    count: 100,
    estimateSize: () => 50,
    getScrollElement: () => mockScrollElement,
    scrollToFn,
    observeElementRect: (_instance, cb) => {
      cb({ width: 400, height: 600 })
      return () => {}
    },
    observeElementOffset: (_instance, cb) => {
      cb(0, false)
      return () => {}
    },
  })
}

test('scrollToIndex(0) should reconcile correctly', () => {
  const { rafCallbacks, mockScrollElement, scrollToFn } =
    createMockEnvironment()
  const virtualizer = createVirtualizer(mockScrollElement, scrollToFn)

  virtualizer._willUpdate()
  scrollToFn.mockClear()

  virtualizer.scrollToIndex(0)

  // scrollToFn should have been called with offset for index 0
  expect(scrollToFn).toHaveBeenCalled()
  const calledOffset = scrollToFn.mock.calls[0]![0]
  expect(calledOffset).toBe(0)

  // The first frame leaves room for pending ResizeObserver measurements.
  rafCallbacks.shift()!(0)
  expect(virtualizer['scrollState']).not.toBeNull()
  rafCallbacks.shift()!(0)

  // scrollState should be cleared after settling
  expect(virtualizer['scrollState']).toBeNull()
})

test.each([false, true])(
  'scrollToIndex waits for pending measurements (deferred observer: %s)',
  (useAnimationFrameWithResizeObserver) => {
    const { rafCallbacks, mockScrollElement, scrollToFn } =
      createMockEnvironment()
    const virtualizer = createVirtualizer(mockScrollElement, scrollToFn)
    virtualizer.setOptions({
      ...virtualizer.options,
      useAnimationFrameWithResizeObserver,
    })
    virtualizer._willUpdate()
    virtualizer.getVirtualItems()
    virtualizer.resizeItem(98, 60)
    virtualizer.getVirtualItems()
    virtualizer.scrollOffset = 4400
    scrollToFn.mockClear()

    virtualizer.scrollToIndex(99, { align: 'end' })
    expect(scrollToFn).toHaveBeenLastCalledWith(
      4400,
      expect.anything(),
      virtualizer,
    )

    // rAF runs before ResizeObserver. An optional rAF wrapper defers the
    // measurement until after the next reconciliation callback as well.
    rafCallbacks.shift()!(0)
    if (useAnimationFrameWithResizeObserver) {
      rafCallbacks.shift()?.(0)
    }
    virtualizer.resizeItem(98, 90)
    Object.defineProperty(mockScrollElement, 'scrollHeight', { value: 5030 })
    virtualizer.getVirtualItems()
    rafCallbacks.shift()?.(0)

    expect(scrollToFn).toHaveBeenLastCalledWith(
      4430,
      expect.anything(),
      virtualizer,
    )

    virtualizer.scrollOffset = 4430
    // Reconciliation must still retire once the new target is stable.
    for (let frame = 0; frame < 3; frame++) {
      rafCallbacks.shift()?.(0)
    }
    expect(virtualizer['scrollState']).toBeNull()
    expect(rafCallbacks).toHaveLength(0)
  },
)

test.each([false, true])(
  'a new scroll away from a reached index target cancels reconciliation (retargeted: %s)',
  (retargeted) => {
    const { rafCallbacks, mockScrollElement, scrollToFn } =
      createMockEnvironment()
    const virtualizer = createVirtualizer(mockScrollElement, scrollToFn)
    let onScroll!: (offset: number, isScrolling: boolean) => void
    virtualizer.setOptions({
      ...virtualizer.options,
      observeElementOffset: (_instance, callback) => {
        onScroll = callback
        callback(0, false)
        return () => {}
      },
    })
    virtualizer._willUpdate()
    virtualizer.getVirtualItems()
    virtualizer.scrollOffset = 4400
    scrollToFn.mockClear()

    virtualizer.scrollToIndex(99, { align: 'end' })
    rafCallbacks.shift()!(0)
    if (retargeted) {
      virtualizer.resizeItem(97, 80)
      Object.defineProperty(mockScrollElement, 'scrollHeight', {
        value: 5030,
        configurable: true,
      })
      virtualizer.getVirtualItems()
      rafCallbacks.shift()!(0)
      // The target changed before its write produced a scroll event. Arrival
      // at the previous target must still let an external scroll cancel it.
    }
    const writes = scrollToFn.mock.calls.length
    onScroll(2000, true)

    // Measurements must not pull a reader back to the old target after they leave it.
    virtualizer.resizeItem(98, 80)
    Object.defineProperty(mockScrollElement, 'scrollHeight', {
      value: retargeted ? 5060 : 5030,
    })
    virtualizer.getVirtualItems()
    rafCallbacks.shift()!(0)

    expect(virtualizer['scrollState']).toBeNull()
    expect(virtualizer.scrollOffset).toBe(2000)
    expect(scrollToFn).toHaveBeenCalledTimes(writes)
  },
)

test.each(['auto', 'smooth'] as const)(
  'keeps an index scroll active before reaching its target (%s)',
  (behavior) => {
    const { mockScrollElement, scrollToFn } = createMockEnvironment()
    const virtualizer = createVirtualizer(mockScrollElement, scrollToFn)
    let onScroll!: (offset: number, isScrolling: boolean) => void
    virtualizer.setOptions({
      ...virtualizer.options,
      observeElementOffset: (_instance, callback) => {
        onScroll = callback
        callback(0, false)
        return () => {}
      },
    })
    virtualizer._willUpdate()
    virtualizer.getVirtualItems()
    virtualizer.scrollToIndex(99, { align: 'end', behavior })
    // The scroll max shrinks to 2000 before the read-back, so the browser
    // reports 2000 instead of the 4400 we wrote. That is where the fresh
    // target clamps too, so it isn't mistaken for the user scrolling away.
    Object.defineProperty(mockScrollElement, 'scrollHeight', {
      value: 2600,
      configurable: true,
    })
    onScroll(2000, true)

    expect(virtualizer['scrollState']).not.toBeNull()
  },
)

test.each([30, 3000])(
  'measurement compensation does not cancel a reached index target (growth: %s)',
  (growth) => {
    const { rafCallbacks, mockScrollElement, scrollToFn } =
      createMockEnvironment()
    scrollToFn.mockImplementation((offset, { adjustments }) => {
      mockScrollElement.scrollTop = Math.min(4400, offset + (adjustments ?? 0))
    })
    const virtualizer = createVirtualizer(mockScrollElement, scrollToFn)
    let onScroll!: (offset: number, isScrolling: boolean) => void
    virtualizer.setOptions({
      ...virtualizer.options,
      observeElementOffset: (_instance, callback) => {
        onScroll = callback
        callback(0, false)
        return () => {}
      },
    })
    virtualizer._willUpdate()
    virtualizer.getVirtualItems()
    virtualizer.scrollOffset = 2500
    virtualizer.scrollToIndex(50, { align: 'start' })
    rafCallbacks.shift()!(0)

    // The browser may clamp this adjustment until the consumer grows the sizer.
    virtualizer.resizeItem(0, 50 + growth)
    onScroll(mockScrollElement.scrollTop, true)

    expect(virtualizer['scrollState']).not.toBeNull()
  },
)

test('a browser clamp to the new max does not cancel a reached scrollToEnd', () => {
  const { rafCallbacks, mockScrollElement, scrollToFn } =
    createMockEnvironment()
  const virtualizer = createVirtualizer(mockScrollElement, scrollToFn)
  let onScroll!: (offset: number, isScrolling: boolean) => void
  virtualizer.setOptions({
    ...virtualizer.options,
    paddingEnd: 40,
    observeElementOffset: (_instance, callback) => {
      onScroll = callback
      callback(0, false)
      return () => {}
    },
  })
  Object.defineProperty(mockScrollElement, 'scrollHeight', {
    value: 5040,
    configurable: true,
  })
  virtualizer._willUpdate()
  virtualizer.getVirtualItems()
  virtualizer.scrollOffset = 4440

  // Already at the end, so the target counts as reached straight away.
  virtualizer.scrollToEnd()
  onScroll(4440, false)

  // The last row shrinks and the browser clamps scrollTop to the new max.
  // That is the scrollToEnd target (paddingEnd included), not a scroll away.
  virtualizer.resizeItem(99, 20)
  Object.defineProperty(mockScrollElement, 'scrollHeight', { value: 5010 })
  onScroll(4410, false)

  expect(virtualizer['scrollState']).not.toBeNull()
  rafCallbacks.shift()!(0)
  expect(virtualizer['scrollState']?.lastTargetOffset).toBe(4410)
})

test('a clamp the sizer grew back from does not cancel an instant scrollToEnd', () => {
  const { rafCallbacks, mockScrollElement, scrollToFn } =
    createMockEnvironment()
  const virtualizer = createVirtualizer(mockScrollElement, scrollToFn)
  let onScroll!: (offset: number, isScrolling: boolean) => void
  virtualizer.setOptions({
    ...virtualizer.options,
    // The container is sized in `onChange`, as with `directDomUpdates`.
    onChange: (instance) => {
      Object.defineProperty(mockScrollElement, 'scrollHeight', {
        value: instance.getTotalSize(),
        configurable: true,
      })
    },
    observeElementOffset: (_instance, callback) => {
      onScroll = callback
      callback(0, false)
      return () => {}
    },
  })
  Object.defineProperty(mockScrollElement, 'scrollHeight', {
    value: 5000,
    configurable: true,
  })
  virtualizer._willUpdate()
  virtualizer.getVirtualItems()

  virtualizer.scrollToEnd()
  expect(scrollToFn).toHaveBeenLastCalledWith(
    4400,
    expect.anything(),
    virtualizer,
  )

  // Before the read-back, rows measure in one task: one smaller than its
  // estimate, so the sizer shrinks and the browser clamps scrollTop to the
  // max of that moment (4370), then one larger, so the sizer grows past the
  // target again. The event reports the clamped position.
  virtualizer.resizeItem(90, 20)
  virtualizer.resizeItem(91, 150)
  onScroll(4370, true)

  expect(virtualizer['scrollState']).not.toBeNull()
  rafCallbacks.shift()!(0)
  expect(scrollToFn).toHaveBeenLastCalledWith(
    4470,
    expect.anything(),
    virtualizer,
  )
})

test('a sizer that shrank before the first resize after an instant scrollToEnd does not cancel it', () => {
  const { rafCallbacks, mockScrollElement, scrollToFn } =
    createMockEnvironment()
  const virtualizer = createVirtualizer(mockScrollElement, scrollToFn)
  let onScroll!: (offset: number, isScrolling: boolean) => void
  virtualizer.setOptions({
    ...virtualizer.options,
    observeElementOffset: (_instance, callback) => {
      onScroll = callback
      callback(0, false)
      return () => {}
    },
  })
  Object.defineProperty(mockScrollElement, 'scrollHeight', {
    value: 5000,
    configurable: true,
  })
  virtualizer._willUpdate()
  virtualizer.getVirtualItems()

  // A row measured smaller before the command; the sizer has not shrunk yet.
  virtualizer.resizeItem(90, 20)
  virtualizer.scrollToEnd()
  expect(scrollToFn).toHaveBeenLastCalledWith(
    4400,
    expect.anything(),
    virtualizer,
  )

  // The sizer commits smaller (the browser clamps to 4370) before the next
  // row measures larger and grows it past the target again.
  Object.defineProperty(mockScrollElement, 'scrollHeight', { value: 4970 })
  virtualizer._willUpdate()
  virtualizer.resizeItem(91, 150)
  Object.defineProperty(mockScrollElement, 'scrollHeight', { value: 5070 })
  virtualizer._willUpdate()
  onScroll(4370, true)

  expect(virtualizer['scrollState']).not.toBeNull()
  rafCallbacks.shift()!(0)
  expect(scrollToFn).toHaveBeenLastCalledWith(
    4470,
    expect.anything(),
    virtualizer,
  )
})

test('an instant scrollToEnd clamped by a shrink that grew back to the same total writes the end again', () => {
  const { rafCallbacks, mockScrollElement, scrollToFn } =
    createMockEnvironment()
  const virtualizer = createVirtualizer(mockScrollElement, scrollToFn)
  let onScroll!: (offset: number, isScrolling: boolean) => void
  virtualizer.setOptions({
    ...virtualizer.options,
    // The container is sized in `onChange`, as with `directDomUpdates`.
    onChange: (instance) => {
      Object.defineProperty(mockScrollElement, 'scrollHeight', {
        value: instance.getTotalSize(),
        configurable: true,
      })
    },
    observeElementOffset: (_instance, callback) => {
      onScroll = callback
      callback(0, false)
      return () => {}
    },
  })
  Object.defineProperty(mockScrollElement, 'scrollHeight', {
    value: 5000,
    configurable: true,
  })
  virtualizer._willUpdate()
  virtualizer.getVirtualItems()

  virtualizer.scrollToEnd()
  // -30 then +30: the end is where it was, but the browser clamped to 4370.
  virtualizer.resizeItem(90, 20)
  virtualizer.resizeItem(91, 80)
  onScroll(4370, true)
  scrollToFn.mockClear()

  rafCallbacks.shift()!(0)
  expect(scrollToFn).toHaveBeenLastCalledWith(
    4400,
    expect.anything(),
    virtualizer,
  )
})

test('a transient max below zero clamps an instant scrollToEnd at 0 without cancelling it', () => {
  const { rafCallbacks, mockScrollElement, scrollToFn } =
    createMockEnvironment()
  const virtualizer = createVirtualizer(mockScrollElement, scrollToFn)
  let onScroll!: (offset: number, isScrolling: boolean) => void
  virtualizer.setOptions({
    ...virtualizer.options,
    count: 13,
    observeElementOffset: (_instance, callback) => {
      onScroll = callback
      callback(0, false)
      return () => {}
    },
  })
  Object.defineProperty(mockScrollElement, 'scrollHeight', {
    value: 630,
    configurable: true,
  })
  virtualizer._willUpdate()
  virtualizer.getVirtualItems()

  virtualizer.scrollToEnd()
  expect(scrollToFn).toHaveBeenLastCalledWith(
    30,
    expect.anything(),
    virtualizer,
  )

  // A row shrinks by 50: the max would be -20, so the browser clamps to 0.
  // Then a row grows and the sizer passes the target again.
  virtualizer.resizeItem(10, 0)
  Object.defineProperty(mockScrollElement, 'scrollHeight', { value: 580 })
  virtualizer._willUpdate()
  virtualizer.resizeItem(11, 150)
  Object.defineProperty(mockScrollElement, 'scrollHeight', { value: 680 })
  virtualizer._willUpdate()
  onScroll(0, true)

  expect(virtualizer['scrollState']).not.toBeNull()
  rafCallbacks.shift()!(0)
  expect(scrollToFn).toHaveBeenLastCalledWith(
    80,
    expect.anything(),
    virtualizer,
  )
})

// A virtualizer whose scroll events the test reports, over a sizer the test
// commits: `commit` sets the element's scroll height and runs the adapter's
// commit hook, as a re-render does.
function createCommittedSizer() {
  const env = createMockEnvironment()
  const virtualizer = createVirtualizer(env.mockScrollElement, env.scrollToFn)
  let onScroll!: (offset: number, isScrolling: boolean) => void
  virtualizer.setOptions({
    ...virtualizer.options,
    observeElementOffset: (_instance, callback) => {
      onScroll = callback
      callback(0, false)
      return () => {}
    },
  })
  const commit = (scrollHeight: number) => {
    Object.defineProperty(env.mockScrollElement, 'scrollHeight', {
      value: scrollHeight,
      configurable: true,
    })
    virtualizer._willUpdate()
  }
  commit(5000)
  virtualizer.getVirtualItems()
  return {
    ...env,
    virtualizer,
    commit,
    scroll: (offset: number, isScrolling = true) =>
      onScroll(offset, isScrolling),
  }
}

test('a clamp at a max an append committed does not cancel an instant scrollToEnd', () => {
  const { rafCallbacks, scrollToFn, virtualizer, commit, scroll } =
    createCommittedSizer()

  virtualizer.scrollToEnd()
  expect(scrollToFn).toHaveBeenLastCalledWith(
    4400,
    expect.anything(),
    virtualizer,
  )

  // A row shrinks, a row is appended, a second row shrinks: the sizer
  // commits at a max of 4390, which no row's delta alone leads to. The
  // browser clamps there before a row grows the sizer past the target.
  virtualizer.resizeItem(90, 20)
  commit(4970)
  virtualizer.setOptions({ ...virtualizer.options, count: 101 })
  commit(5020)
  virtualizer.resizeItem(91, 20)
  commit(4990)
  virtualizer.resizeItem(92, 150)
  commit(5120)
  scroll(4390)

  expect(virtualizer['scrollState']).not.toBeNull()
  rafCallbacks.shift()!(0)
  expect(scrollToFn).toHaveBeenLastCalledWith(
    4520,
    expect.anything(),
    virtualizer,
  )
})

test('a clamp below a max read before the sizer committed does not cancel an instant scrollToEnd', () => {
  const { rafCallbacks, scrollToFn, virtualizer, commit, scroll } =
    createCommittedSizer()

  // A row measured smaller before the command; the sizer has not committed
  // it, so the command and its first resize read a max 30px too large.
  virtualizer.resizeItem(90, 20)
  virtualizer.scrollToEnd()
  expect(scrollToFn).toHaveBeenLastCalledWith(
    4400,
    expect.anything(),
    virtualizer,
  )

  virtualizer.resizeItem(91, 10)
  commit(4930)
  virtualizer.resizeItem(92, 150)
  commit(5070)
  scroll(4330)

  expect(virtualizer['scrollState']).not.toBeNull()
  rafCallbacks.shift()!(0)
  expect(scrollToFn).toHaveBeenLastCalledWith(
    4470,
    expect.anything(),
    virtualizer,
  )
})

test('a clamp at a max an append committed does not cancel an instant scrollToIndex', () => {
  const { rafCallbacks, scrollToFn, virtualizer, commit, scroll } =
    createCommittedSizer()

  virtualizer.scrollToIndex(99, { align: 'end' })
  expect(scrollToFn).toHaveBeenLastCalledWith(
    4400,
    expect.anything(),
    virtualizer,
  )

  virtualizer.resizeItem(90, 20)
  commit(4970)
  virtualizer.setOptions({ ...virtualizer.options, count: 101 })
  commit(5020)
  virtualizer.resizeItem(91, 20)
  commit(4990)
  virtualizer.resizeItem(92, 150)
  commit(5120)
  scroll(4390)

  expect(virtualizer['scrollState']).not.toBeNull()
  rafCallbacks.splice(0).forEach((cb) => cb(0))
  // Row 99 ends at 5040 after -30, -30 and +100.
  expect(scrollToFn).toHaveBeenLastCalledWith(
    4440,
    expect.anything(),
    virtualizer,
  )
})

test('a committed max is read in layout coordinates while a correction is held', () => {
  const { rafCallbacks, scrollToFn, virtualizer, commit, scroll } =
    createCommittedSizer()

  // A held correction of 100px: the sizer is 100px short of the layout, and
  // an overscroll report keeps the hold from being written.
  virtualizer['_holdOffset'] = 100
  virtualizer['_reportedOverscroll'] = true
  commit(4900)

  virtualizer.resizeItem(90, 20)
  virtualizer.scrollToEnd()
  // The element's max (4300) plus the hold, written 100px short.
  expect(scrollToFn).toHaveBeenLastCalledWith(
    4300,
    expect.anything(),
    virtualizer,
  )

  virtualizer.resizeItem(91, 10)
  commit(4830)
  virtualizer.resizeItem(92, 150)
  commit(4970)
  scroll(4230)

  expect(virtualizer['scrollState']).not.toBeNull()
  scrollToFn.mockClear()
  rafCallbacks.splice(0).forEach((cb) => cb(0))
  expect(scrollToFn).toHaveBeenCalled()
})

test('a clamp at the lowest of several committed maxima does not cancel an instant scrollToEnd', () => {
  const { rafCallbacks, scrollToFn, virtualizer, commit, scroll } =
    createCommittedSizer()

  // Not committed before the command, so every max that follows from the
  // first resize's read is 30px too large.
  virtualizer.resizeItem(80, 20)
  virtualizer.scrollToEnd()

  // Three shrinks commit one by one; the browser clamps at each, last at
  // 4280.
  virtualizer.resizeItem(90, 20)
  commit(4940)
  virtualizer.resizeItem(91, 20)
  commit(4910)
  virtualizer.resizeItem(92, 20)
  commit(4880)
  virtualizer.resizeItem(93, 200)
  commit(5030)
  scroll(4280)

  expect(virtualizer['scrollState']).not.toBeNull()
  rafCallbacks.shift()!(0)
  expect(scrollToFn).toHaveBeenLastCalledWith(
    4430,
    expect.anything(),
    virtualizer,
  )
})

test('a scroll to a position no committed max reached still cancels an instant scrollToEnd', () => {
  const { virtualizer, commit, scroll } = createCommittedSizer()

  virtualizer.resizeItem(80, 20)
  virtualizer.scrollToEnd()
  virtualizer.resizeItem(90, 20)
  commit(4940)
  virtualizer.resizeItem(91, 150)
  commit(5070)
  // The user, between the committed max (4340) and the target.
  scroll(4355)

  expect(virtualizer['scrollState']).toBeNull()
})

test('a clamp reported at rest still writes the end again', () => {
  const { rafCallbacks, scrollToFn, virtualizer, commit, scroll } =
    createCommittedSizer()

  // As in the net-zero case above, from an adapter that reports its
  // read-back with `isScrolling` false.
  virtualizer.scrollToEnd()
  virtualizer.resizeItem(90, 20)
  commit(4970)
  virtualizer.resizeItem(91, 80)
  commit(5000)
  scroll(4370, false)
  scrollToFn.mockClear()

  rafCallbacks.shift()!(0)
  expect(scrollToFn).toHaveBeenLastCalledWith(
    4400,
    expect.anything(),
    virtualizer,
  )
})

test('a smooth retarget is not cancelled by its own intermediate scroll events', () => {
  const { rafCallbacks, mockScrollElement, scrollToFn } =
    createMockEnvironment()
  const virtualizer = createVirtualizer(mockScrollElement, scrollToFn)
  let onScroll!: (offset: number, isScrolling: boolean) => void
  virtualizer.setOptions({
    ...virtualizer.options,
    observeElementOffset: (_instance, callback) => {
      onScroll = callback
      callback(0, false)
      return () => {}
    },
  })
  virtualizer._willUpdate()
  virtualizer.getVirtualItems()
  virtualizer.scrollOffset = 4400

  // Already at the end, so the target counts as reached straight away.
  virtualizer.scrollToIndex(99, { align: 'end', behavior: 'smooth' })
  rafCallbacks.shift()!(0)

  // A visible row grows by more than a viewport, so the retarget stays smooth.
  virtualizer.resizeItem(98, 1050)
  Object.defineProperty(mockScrollElement, 'scrollHeight', { value: 6000 })
  virtualizer.getVirtualItems()
  rafCallbacks.shift()!(0)
  expect(scrollToFn).toHaveBeenLastCalledWith(
    5400,
    { adjustments: undefined, behavior: 'smooth' },
    virtualizer,
  )

  // The smooth scroll reports a position on its way to the new target.
  onScroll(4800, true)

  expect(virtualizer['scrollState']).not.toBeNull()
})

test('scrollToOffset should reconcile and clear scrollState', () => {
  const { rafCallbacks, mockScrollElement, scrollToFn } =
    createMockEnvironment()
  const virtualizer = createVirtualizer(mockScrollElement, scrollToFn)

  virtualizer._willUpdate()
  scrollToFn.mockClear()

  virtualizer.scrollToOffset(200)

  expect(scrollToFn).toHaveBeenCalled()

  // scrollState should be set with index: null
  expect(virtualizer['scrollState']).not.toBeNull()
  expect(virtualizer['scrollState']!.index).toBeNull()

  // Simulate the scroll offset reaching the target
  virtualizer.scrollOffset = 200

  // Flush rAF — reconciliation should settle and clear scrollState
  rafCallbacks.forEach((cb) => cb(0))

  expect(virtualizer['scrollState']).toBeNull()
})

test('scrollBy should reconcile and clear scrollState', () => {
  const { rafCallbacks, mockScrollElement, scrollToFn } =
    createMockEnvironment()
  const virtualizer = createVirtualizer(mockScrollElement, scrollToFn)

  virtualizer._willUpdate()
  scrollToFn.mockClear()

  virtualizer.scrollBy(100)

  expect(virtualizer['scrollState']).not.toBeNull()
  expect(virtualizer['scrollState']!.index).toBeNull()

  // Simulate scroll offset reaching the target
  virtualizer.scrollOffset = 100

  rafCallbacks.forEach((cb) => cb(0))

  expect(virtualizer['scrollState']).toBeNull()
})

test('reconcileScroll should bail out after timeout', () => {
  const { rafCallbacks, mockWindow, mockScrollElement, scrollToFn } =
    createMockEnvironment()

  // Make performance.now() return a controllable value
  let fakeTime = 1000
  mockWindow.performance.now = () => fakeTime

  const virtualizer = createVirtualizer(mockScrollElement, scrollToFn)
  virtualizer._willUpdate()

  virtualizer.scrollToIndex(50)

  expect(virtualizer['scrollState']).not.toBeNull()

  // Advance time past the 5s safety valve
  fakeTime = 7000

  // Flush rAF — should trigger timeout bailout
  rafCallbacks.forEach((cb) => cb(0))

  expect(virtualizer['scrollState']).toBeNull()
})

test('cleanup should cancel pending RAF and clear scrollState', () => {
  const { mockWindow, mockScrollElement, scrollToFn } = createMockEnvironment()
  const virtualizer = createVirtualizer(mockScrollElement, scrollToFn)

  virtualizer._willUpdate()
  virtualizer.scrollToIndex(50)

  expect(virtualizer['scrollState']).not.toBeNull()
  expect(virtualizer['rafId']).not.toBeNull()

  const unmount = virtualizer._didMount()
  unmount()

  expect(virtualizer['scrollState']).toBeNull()
  expect(virtualizer['rafId']).toBeNull()
  expect(mockWindow.cancelAnimationFrame).toHaveBeenCalled()
})

test('cancelScroll stops reconciling toward the old target (#1285)', () => {
  const { rafCallbacks, mockWindow, mockScrollElement, scrollToFn } =
    createMockEnvironment()
  const virtualizer = createVirtualizer(mockScrollElement, scrollToFn)

  virtualizer._willUpdate()
  virtualizer.scrollToIndex(50, { align: 'start' })

  expect(virtualizer['scrollState']).not.toBeNull()
  expect(virtualizer['rafId']).not.toBeNull()

  // The user takes over mid-travel.
  virtualizer.cancelScroll()

  expect(virtualizer['scrollState']).toBeNull()
  expect(virtualizer['rafId']).toBeNull()
  expect(mockWindow.cancelAnimationFrame).toHaveBeenCalled()

  // A measurement above the old target would move it; without the cancel,
  // reconcile chases the new target and yanks the viewport back.
  scrollToFn.mockClear()
  virtualizer.resizeItem(10, 200)
  rafCallbacks.forEach((cb) => cb(0))

  expect(scrollToFn).not.toHaveBeenCalled()
})

test('cancelScroll restores size-change compensation after a smooth scroll', () => {
  const { mockScrollElement, scrollToFn } = createMockEnvironment()
  const virtualizer = createVirtualizer(mockScrollElement, scrollToFn)

  virtualizer._willUpdate()
  virtualizer.scrollOffset = 1000
  virtualizer.scrollToIndex(50, { behavior: 'smooth' })
  virtualizer.cancelScroll()
  scrollToFn.mockClear()

  // First measurement of an item above the fold is compensated again; while
  // the smooth scrollState was active it would have been skipped.
  virtualizer.resizeItem(0, 80)

  expect(scrollToFn).toHaveBeenCalledWith(
    1000,
    expect.objectContaining({ adjustments: 30 }),
    virtualizer,
  )
})

test('cancelScroll is a no-op when no scroll is in flight', () => {
  const { rafCallbacks, mockScrollElement, scrollToFn } =
    createMockEnvironment()
  const virtualizer = createVirtualizer(mockScrollElement, scrollToFn)

  virtualizer._willUpdate()
  scrollToFn.mockClear()

  expect(() => virtualizer.cancelScroll()).not.toThrow()
  expect(scrollToFn).not.toHaveBeenCalled()

  // A later scroll command still works normally.
  virtualizer.scrollToOffset(200)
  expect(virtualizer['scrollState']).not.toBeNull()
  virtualizer.scrollOffset = 200
  rafCallbacks.forEach((cb) => cb(0))
  expect(virtualizer['scrollState']).toBeNull()
})

test('reconcileScroll: smooth scroll retargets remain smooth while distance > viewport', () => {
  // When target drifts during a smooth scroll (because newly visible items
  // measured in and shifted positions), the prior behavior snapped to
  // behavior:'auto' on the first retarget. New behavior: keep smooth while
  // we're still more than a viewport away, snap only on final approach.
  const { rafCallbacks, mockScrollElement, scrollToFn } =
    createMockEnvironment()
  const virtualizer = new Virtualizer({
    count: 10000,
    estimateSize: () => 50,
    getScrollElement: () => mockScrollElement,
    scrollToFn,
    observeElementRect: (_inst, cb) => {
      cb({ width: 400, height: 600 })
      return () => {}
    },
    observeElementOffset: (_inst, cb) => {
      cb(0, false)
      return () => {}
    },
  })
  virtualizer._willUpdate()
  scrollToFn.mockClear()

  virtualizer.scrollToIndex(5000, { behavior: 'smooth' })
  // First call: smooth, with our best estimate target
  const firstCall = scrollToFn.mock.calls[0]
  expect(firstCall![1].behavior).toBe('smooth')

  // Simulate a measurement that moved the target. Force resizeItem at a
  // visible-enough position so getOffsetForIndex(5000) returns a different
  // value than what scrollState.lastTargetOffset has.
  virtualizer.resizeItem(0, 80)

  // Now trigger the reconcile RAF
  rafCallbacks.forEach((cb) => cb(0))

  // The reconcile retarget should be smooth (we're far from target).
  const lastCall = scrollToFn.mock.calls[scrollToFn.mock.calls.length - 1]
  expect(lastCall![1].behavior).toBe('smooth')
})

// ─── a prepend must not strand a travelling smooth scroll ────────────────────
// The end-anchor prepend sync in _willUpdate writes scrollTop instantly. That
// cancels a smooth scrollToIndex the browser is still animating, and Chromium
// drops a smooth request re-issued in the frame right after that cancel, so
// re-driving from reconcileScroll cannot recover it. While a smooth
// programmatic scroll is travelling, the sync is skipped: its target is
// index-based and recomputes against the new layout, so the animation simply
// continues. Browser coverage: react-virtual e2e/app/test/smooth-prepend.spec.ts.

function createSmoothPrependVirtualizer() {
  const mockWindow = {
    requestAnimationFrame: vi.fn(() => 1),
    cancelAnimationFrame: vi.fn(),
    performance: { now: () => Date.now() },
    ResizeObserver: vi.fn(function () {
      return { observe: vi.fn(), unobserve: vi.fn(), disconnect: vi.fn() }
    }),
  }
  const el = {
    scrollTop: 0,
    scrollLeft: 0,
    scrollWidth: 400,
    scrollHeight: 10000, // 200 x 50
    clientWidth: 400,
    clientHeight: 300,
    offsetWidth: 400,
    offsetHeight: 300,
    ownerDocument: { defaultView: mockWindow },
    scrollTo: vi.fn(),
  } as unknown as HTMLDivElement

  const scrollToFn = vi.fn()
  let scrollCallback: ((offset: number, isScrolling: boolean) => void) | null =
    null
  const messages = Array.from({ length: 200 }, (_, i) => `m-${i}`)
  const v = new Virtualizer<HTMLDivElement, any>({
    count: messages.length,
    estimateSize: () => 50,
    anchorTo: 'end',
    getItemKey: (i) => messages[i]!,
    getScrollElement: () => el,
    scrollToFn,
    observeElementRect: (_inst, cb) => {
      cb({ width: 400, height: 300 })
      return () => {}
    },
    observeElementOffset: (_inst, cb) => {
      scrollCallback = cb
      cb(9700, false)
      return () => {}
    },
  })
  v._willUpdate()
  v.getVirtualItems()
  scrollToFn.mockClear() // drop the mount sync write

  return {
    v,
    scrollToFn,
    scroll: (offset: number, isScrolling = true) => {
      scrollCallback!(offset, isScrolling)
      v.getVirtualItems()
    },
    // 5 messages x 50px land above the reader.
    prepend: () => {
      messages.unshift('m--5', 'm--4', 'm--3', 'm--2', 'm--1')
      ;(el as any).scrollHeight = 10250
      v.setOptions({
        ...v.options,
        count: messages.length,
        getItemKey: (i: number) => messages[i]!,
      })
      v._willUpdate()
    },
  }
}

test('a prepend mid-flight leaves a travelling smooth scrollToIndex alone', () => {
  const { v, scrollToFn, scroll, prepend } = createSmoothPrependVirtualizer()

  v.scrollToIndex(0, { behavior: 'smooth' })
  expect(scrollToFn.mock.calls[0]![0]).toBe(0)
  scroll(3500) // the browser is mid-animation
  scrollToFn.mockClear()

  prepend()

  // No instant scrollTop write that would cancel the animation...
  expect(scrollToFn).not.toHaveBeenCalled()
  // ...and the journey is still live.
  expect(v['scrollState']).toMatchObject({ index: 0, phase: 'smooth' })
})

test('a prepend right after a smooth scroll landed still syncs the anchor', () => {
  const { v, scrollToFn, scroll, prepend } = createSmoothPrependVirtualizer()

  v.scrollToIndex(100, { behavior: 'smooth' })
  const target = scrollToFn.mock.calls[0]![0] as number
  expect(target).toBe(5000)
  // Arrived; reconcileScroll has not retired scrollState yet.
  scroll(target, false)
  scrollToFn.mockClear()

  prepend()

  // The reader's position is preserved: the DOM is synced to the shifted offset.
  expect(scrollToFn.mock.calls.at(-1)?.[0]).toBe(target + 250)
})

// ─── #1257: paddingEnd must not make scrollToIndex(last) overshoot the last item ─────────────
// When paddingEnd > 0, getOffsetForIndex(last, 'end') was returning the raw
// DOM max scroll offset (scrollHeight - clientHeight), which equals
// (content + paddingEnd - clientHeight). This caused scrollToIndex(last) to
// scroll past the rendered end of the last item. The fix uses
// getMaxScrollOffset() - paddingEnd + scrollPaddingEnd (clamped to
// [0, getMaxScrollOffset()]), which with scrollPaddingEnd = 0 equals
// (content - clientHeight) — the offset that keeps the last item flush with
// the bottom of the viewport.

test('#1257: scrollToIndex(last) with paddingEnd keeps the last item flush with the viewport bottom', () => {
  // 5 items × 50px = 250px content, paddingEnd = 80, scrollMargin = 0
  // viewport = 200px → total scrollHeight = 330px (250 + 80)
  // Expected virtual max scroll offset:
  //   getMaxScrollOffset() - paddingEnd = (330 - 200) - 80 = 50
  // Without the fix (using raw scrollHeight - clientHeight):
  //   330 - 200 = 130 → overshoots by 80px (exactly the paddingEnd)
  const mockScrollElement = {
    scrollTop: 0,
    scrollLeft: 0,
    scrollWidth: 200,
    scrollHeight: 330, // 250 (content) + 80 (paddingEnd)
    clientWidth: 200,
    clientHeight: 200,
    offsetWidth: 200,
    offsetHeight: 200,
    ownerDocument: { defaultView: globalThis },
    scrollTo: vi.fn(),
  } as unknown as HTMLDivElement

  const scrollToFn = vi.fn()
  const virtualizer = new Virtualizer({
    count: 5,
    estimateSize: () => 50,
    paddingEnd: 80,
    getScrollElement: () => mockScrollElement,
    scrollToFn,
    observeElementRect: (_instance, cb) => {
      cb({ width: 200, height: 200 })
      return () => {}
    },
    observeElementOffset: (_instance, cb) => {
      cb(0, false)
      return () => {}
    },
  })

  virtualizer._willUpdate()
  scrollToFn.mockClear()

  // Scroll to last item with 'end' alignment
  virtualizer.scrollToIndex(4, { align: 'end' })

  // getMaxScrollOffset() = 330 - 200 = 130; minus paddingEnd(80) = 50
  expect(scrollToFn).toHaveBeenCalledWith(
    50,
    expect.any(Object),
    expect.any(Object),
  )
})

// ─── #1001: getMaxScrollOffset() preserves lane-max for multi-lane layouts ─────────────
// The fix uses getMaxScrollOffset() directly (rather than getTotalSize()), which
// preserves the lane-max behavior added in #1105 (#1001 fix). In multi-lane layouts
// where the last item lives in a shorter lane, getMaxScrollOffset() still absorbs
// DOM extras that aren't in our measurements.

test('#1001: scrollToIndex(last) in a shorter lane uses getMaxScrollOffset() lane-max', () => {
  // 2 lanes: lane 0 = [0] @300px (ends at 300), lane 1 = [1..3] @50px
  // (last item ends at 150). getTotalSize() = 300 (lane-max),
  // getMaxScrollOffset() = 300 - 200 = 100.
  // The fix uses getMaxScrollOffset() - paddingEnd + scrollPaddingEnd = 100 - 0 + 0 = 100.
  // Aligning to the last item's own end would give max(150 - 200, 0) = 0.
  const mockScrollElement = {
    scrollTop: 0,
    scrollLeft: 0,
    scrollWidth: 200,
    scrollHeight: 300,
    clientWidth: 200,
    clientHeight: 200,
    offsetWidth: 200,
    offsetHeight: 200,
    ownerDocument: { defaultView: globalThis },
    scrollTo: vi.fn(),
  } as unknown as HTMLDivElement

  const scrollToFn = vi.fn()
  const virtualizer = new Virtualizer({
    count: 4,
    estimateSize: (index) => (index === 0 ? 300 : 50),
    lanes: 2,
    getScrollElement: () => mockScrollElement,
    scrollToFn,
    observeElementRect: (_instance, cb) => {
      cb({ width: 200, height: 200 })
      return () => {}
    },
    observeElementOffset: (_instance, cb) => {
      cb(0, false)
      return () => {}
    },
  })

  virtualizer._willUpdate()
  scrollToFn.mockClear()

  expect(virtualizer.measurementsCache[3]).toMatchObject({ lane: 1, end: 150 })

  virtualizer.scrollToIndex(3, { align: 'end' })

  // getMaxScrollOffset() = 100; minus paddingEnd(0) = 100
  expect(scrollToFn).toHaveBeenCalledWith(
    100,
    expect.any(Object),
    expect.any(Object),
  )
})

// ─── #1257: paddingEnd=0 is a no-op ─────────────
test('#1257: scrollToIndex(last) with paddingEnd=0 uses getMaxScrollOffset() unchanged', () => {
  const mockScrollElement = {
    scrollTop: 0,
    scrollLeft: 0,
    scrollWidth: 200,
    scrollHeight: 250, // 5 × 50px content, no paddingEnd
    clientWidth: 200,
    clientHeight: 200,
    offsetWidth: 200,
    offsetHeight: 200,
    ownerDocument: { defaultView: globalThis },
    scrollTo: vi.fn(),
  } as unknown as HTMLDivElement

  const scrollToFn = vi.fn()
  const virtualizer = new Virtualizer({
    count: 5,
    estimateSize: () => 50,
    paddingEnd: 0,
    getScrollElement: () => mockScrollElement,
    scrollToFn,
    observeElementRect: (_instance, cb) => {
      cb({ width: 200, height: 200 })
      return () => {}
    },
    observeElementOffset: (_instance, cb) => {
      cb(0, false)
      return () => {}
    },
  })

  virtualizer._willUpdate()
  scrollToFn.mockClear()

  virtualizer.scrollToIndex(4, { align: 'end' })

  // getMaxScrollOffset() = 250 - 200 = 50; minus paddingEnd(0) = 50
  expect(scrollToFn).toHaveBeenCalledWith(
    50,
    expect.any(Object),
    expect.any(Object),
  )
})

// ─── #1257: scrollPaddingEnd still applies to the last item ─────────────
// A sticky footer is usually reserved with paddingEnd and kept clear with
// scrollPaddingEnd. The last item must end above the footer, like any other
// end-aligned item.
test('#1257: scrollToIndex(last) with paddingEnd and scrollPaddingEnd keeps the last item above the footer', () => {
  const mockScrollElement = {
    scrollTop: 0,
    scrollLeft: 0,
    scrollWidth: 200,
    scrollHeight: 310, // 250 (content) + 60 (paddingEnd)
    clientWidth: 200,
    clientHeight: 200,
    offsetWidth: 200,
    offsetHeight: 200,
    ownerDocument: { defaultView: globalThis },
    scrollTo: vi.fn(),
  } as unknown as HTMLDivElement

  const scrollToFn = vi.fn()
  const virtualizer = new Virtualizer({
    count: 5,
    estimateSize: () => 50,
    paddingEnd: 60,
    scrollPaddingEnd: 40,
    getScrollElement: () => mockScrollElement,
    scrollToFn,
    observeElementRect: (_instance, cb) => {
      cb({ width: 200, height: 200 })
      return () => {}
    },
    observeElementOffset: (_instance, cb) => {
      cb(0, false)
      return () => {}
    },
  })

  virtualizer._willUpdate()
  scrollToFn.mockClear()

  virtualizer.scrollToIndex(4, { align: 'end' })

  // item.end(250) + scrollPaddingEnd(40) - viewport(200) = 90, below
  // getMaxScrollOffset() = 110 (main used 110, paddingEnd alone gives 50)
  expect(scrollToFn).toHaveBeenCalledWith(
    90,
    expect.any(Object),
    expect.any(Object),
  )

  scrollToFn.mockClear()
  virtualizer.scrollToIndex(3, { align: 'end' })

  // The item before it lands the same way: 200 + 40 - 200 = 40
  expect(scrollToFn).toHaveBeenCalledWith(
    40,
    expect.any(Object),
    expect.any(Object),
  )
})

// ─── #1257: scrollToEnd() still reaches the DOM bottom ─────────────
// scrollToEnd() must include paddingEnd so isAtEnd() holds afterwards
// (followOnAppend and "jump to latest" UI rely on it), even though
// scrollToIndex(last, 'end') now stops at the last item.
test('#1257: scrollToEnd() with paddingEnd scrolls to getMaxScrollOffset()', () => {
  const mockScrollElement = {
    scrollTop: 0,
    scrollLeft: 0,
    scrollWidth: 200,
    scrollHeight: 310, // 250 (content) + 60 (paddingEnd)
    clientWidth: 200,
    clientHeight: 200,
    offsetWidth: 200,
    offsetHeight: 200,
    ownerDocument: { defaultView: globalThis },
    scrollTo: vi.fn(),
  } as unknown as HTMLDivElement

  const scrollToFn = vi.fn()
  const virtualizer = new Virtualizer({
    count: 5,
    estimateSize: () => 50,
    paddingEnd: 60,
    getScrollElement: () => mockScrollElement,
    scrollToFn,
    observeElementRect: (_instance, cb) => {
      cb({ width: 200, height: 200 })
      return () => {}
    },
    observeElementOffset: (_instance, cb) => {
      cb(0, false)
      return () => {}
    },
  })

  virtualizer._willUpdate()
  scrollToFn.mockClear()

  virtualizer.scrollToEnd()

  // getMaxScrollOffset() = 310 - 200 = 110, paddingEnd included
  expect(scrollToFn).toHaveBeenCalledWith(
    110,
    expect.any(Object),
    expect.any(Object),
  )
})

// 100 rows estimated at 50px in a 200px viewport. scrollToFn writes the
// element and clamps like a browser; scroll events are delivered by hand, so a
// test can resize between a programmatic write and its read-back.
function setupHandDrivenScroll(
  extra: Partial<VirtualizerOptions<any, any>> = {},
) {
  const rafCallbacks: Array<FrameRequestCallback> = []
  const mockWindow = {
    requestAnimationFrame: (cb: FrameRequestCallback) => rafCallbacks.push(cb),
    cancelAnimationFrame: () => {},
  }
  const el = {
    scrollTop: 0,
    scrollLeft: 0,
    scrollHeight: 5000,
    clientHeight: 200,
    offsetHeight: 200,
    ownerDocument: { defaultView: mockWindow },
  }
  let scrollCallback: ((offset: number, isScrolling: boolean) => void) | null =
    null
  // Like iOS during a touch: drop programmatic writes on the floor.
  const browser = { ignoreWrites: false }
  const v = new Virtualizer({
    count: 100,
    estimateSize: () => 50,
    getScrollElement: () => el as any,
    scrollToFn: (offset, { adjustments = 0 }) => {
      if (browser.ignoreWrites) return
      el.scrollTop = Math.max(
        0,
        Math.min(offset + adjustments, el.scrollHeight - el.clientHeight),
      )
    },
    observeElementRect: (_inst, cb) => {
      cb({ width: 400, height: 200 })
      return () => {}
    },
    observeElementOffset: (_inst, cb) => {
      scrollCallback = cb
      cb(0, false)
      return () => {}
    },
    ...extra,
  })
  v._willUpdate()
  v['getMeasurements']()
  const scroll = (offset: number, isScrolling: boolean) =>
    scrollCallback!(offset, isScrolling)
  const frame = () => rafCallbacks.splice(0).forEach((cb) => cb(0))
  const settle = () => {
    for (let i = 0; i < 10 && rafCallbacks.length > 0; i++) {
      frame()
      scroll(el.scrollTop, true)
    }
    scroll(el.scrollTop, false)
  }
  // Runs frames without scroll events, as a browser does when a write leaves
  // the element where it was.
  const frames = (n = 10) => {
    for (let i = 0; i < n && rafCallbacks.length > 0; i++) {
      rafCallbacks.splice(0).forEach((cb) => cb(0))
    }
  }
  return { v, el, scroll, frame, settle, frames, browser }
}

test('a resize before the read-back of a scrollToIndex write is left to reconcile', () => {
  // Scrolling up from 2000 to row 20 (1000), row 30 grows before the scroll
  // event reports 1000. Compensating it against the stale 2000 used to write
  // 2050, and reconcile (target unchanged) never rewrote it until the 5s
  // safety valve.
  const { v, el, scroll, settle } = setupHandDrivenScroll()
  el.scrollTop = 2000
  scroll(2000, false)

  v.scrollToIndex(20, { align: 'start' })
  expect(el.scrollTop).toBe(1000)
  v.resizeItem(30, 100)
  expect(el.scrollTop).toBe(1000)
  settle()

  expect(el.scrollTop).toBe(1000)
  expect(v.scrollState).toBeNull()
})

test('a resize above the target before the read-back is picked up by reconcile', () => {
  const { v, el, scroll, settle } = setupHandDrivenScroll()
  el.scrollTop = 2000
  scroll(2000, false)

  v.scrollToIndex(20, { align: 'start' })
  v.resizeItem(10, 100)
  // No compensation write before the read-back...
  expect(el.scrollTop).toBe(1000)
  settle()
  // ...reconcile retargets to the row's new start.
  expect(el.scrollTop).toBe(1050)
  expect(v.scrollState).toBeNull()
})

test('rows at the old position measured during scrollToEnd do not push it off the end', () => {
  // scrollToEnd writes 4800, but until the read-back the rendered rows are
  // the ones at the top. They measure 20px smaller each; compensating them
  // against the written offset would walk the view up from the end while
  // the end target (the DOM max, sizer not re-rendered) stays put.
  const { v, el, settle } = setupHandDrivenScroll()

  v.scrollToEnd()
  expect(el.scrollTop).toBe(4800)
  for (let i = 0; i < 5; i++) v.resizeItem(i, 30)
  expect(el.scrollTop).toBe(4800)
  settle()

  expect(el.scrollTop).toBe(4800)
  expect(v.scrollState).toBeNull()
})

test('scrollBy right after a scrollToIndex builds on the written offset', () => {
  const { v, el, settle } = setupHandDrivenScroll()

  v.scrollToIndex(20, { align: 'start' })
  v.scrollBy(100)
  settle()

  expect(el.scrollTop).toBe(1100)
})

test('scrollBy after the user scrolled builds on the user position, not an old write', () => {
  const { v, el, scroll, settle } = setupHandDrivenScroll()

  v.scrollToIndex(20, { align: 'start' })
  scroll(el.scrollTop, false) // read-back of 1000
  el.scrollTop = 1300
  scroll(1300, false) // the user moved on
  v.scrollBy(100)
  settle()

  expect(el.scrollTop).toBe(1400)
})

test('scrollBy during a smooth scroll builds on the current position', () => {
  // The element is still travelling, so the destination isn't where it is.
  const { v, el, settle } = setupHandDrivenScroll()

  v.scrollToIndex(20, { align: 'start', behavior: 'smooth' })
  v.scrollBy(100)
  settle()

  expect(el.scrollTop).toBe(100)
})

test('an anchorTo end list scrolled up by scrollToIndex is not pinned back by a resize before the read-back', () => {
  // At the end, scrollToIndex(20) writes 1000. The last row grows before the
  // read-back; against the stale offset the list still looks pinned, and the
  // end-anchoring compensation used to write 4850 over the index scroll.
  const { v, el, scroll, settle } = setupHandDrivenScroll({ anchorTo: 'end' })
  el.scrollTop = 4800
  scroll(4800, false)

  v.scrollToIndex(20, { align: 'start' })
  v.resizeItem(99, 100)
  settle()

  expect(el.scrollTop).toBe(1000)
  expect(v.scrollState).toBeNull()
})

test('scrollBy past the end does not leave the next scrollBy building on an unreachable offset', () => {
  // A write the browser clamps to where the element already is fires no
  // scroll event, so nothing reads it back.
  const { v, el, scroll, frames } = setupHandDrivenScroll()
  el.scrollTop = 4800
  scroll(4800, false)

  v.scrollBy(100)
  frames()
  expect(el.scrollTop).toBe(4800)
  v.scrollBy(-100)

  expect(el.scrollTop).toBe(4700)
})

// ─── #1307 step 5: an offset target follows the corrections made after its
// read-back, and a prepend before a command's read-back is left to reconcile

test('scrollToOffset: a row above growing after the read-back moves the target with it, and the command retires', () => {
  // The compensation moved the element to 2050 while the target stayed 2000:
  // reconcile saw neither a moved target nor a reached one and kept running
  // until the 5s safety valve.
  const { v, el, scroll, settle } = setupHandDrivenScroll()

  v.scrollToOffset(2000)
  scroll(2000, true)
  v.resizeItem(10, 100)
  expect(el.scrollTop).toBe(2050)
  settle()

  expect(el.scrollTop).toBe(2050)
  expect(v.scrollState).toBeNull()
})

test('scrollBy: a row above growing after the read-back moves the target with it, and the command retires', () => {
  const { v, el, scroll, settle } = setupHandDrivenScroll()
  el.scrollTop = 1500
  scroll(1500, false)

  v.scrollBy(500)
  scroll(2000, true)
  v.resizeItem(10, 100)
  expect(el.scrollTop).toBe(2050)
  settle()

  expect(el.scrollTop).toBe(2050)
  expect(v.scrollState).toBeNull()
})

test('scrollToOffset: a prepend after the read-back moves the target with the anchor sync, and the command retires', () => {
  const { v, el, scroll, settle } = setupHandDrivenScroll({
    anchorTo: 'end',
    getItemKey: (i) => i,
  })

  v.scrollToOffset(2000)
  scroll(2000, true)
  v.setOptions({ ...v.options, count: 112, getItemKey: (i) => i - 12 })
  v._willUpdate()
  expect(el.scrollTop).toBe(2600)
  settle()

  expect(el.scrollTop).toBe(2600)
  expect(v.scrollState).toBeNull()
})

test('scrollToOffset: a prepend held by a bounce before the commit moves the target with it', () => {
  // At the max (4800). The options change finds the element writable, a
  // bounce past the max lands before the commit, and `_willUpdate` holds
  // the prepend instead; the target follows there too, so the command
  // retires once the hold lands.
  const { v, el, scroll, settle } = setupHandDrivenScroll({
    anchorTo: 'end',
    getItemKey: (i) => i,
  })

  v.scrollToOffset(4800)
  scroll(4800, true)
  v.setOptions({ ...v.options, count: 112, getItemKey: (i) => i - 12 })
  el.scrollTop = 4810
  scroll(4810, true)
  v._willUpdate()
  expect(el.scrollTop).toBe(4810)
  // The bounce returns; the sizer has grown by the prepend.
  el.scrollHeight = 5600
  el.scrollTop = 4800
  scroll(4800, true)
  expect(el.scrollTop).toBe(5400)
  settle()

  expect(el.scrollTop).toBe(5400)
  expect(v.scrollState).toBeNull()
})

test('scrollToOffset: a prepend held by a bounce before the options change moves the target with it', () => {
  // As above, but the bounce lands first, so `setOptions` itself holds the
  // prepend. The target stayed 4800 and reconcile ran until the safety valve.
  const { v, el, scroll, settle } = setupHandDrivenScroll({
    anchorTo: 'end',
    getItemKey: (i) => i,
  })

  v.scrollToOffset(4800)
  scroll(4800, true)
  el.scrollTop = 4810
  scroll(4810, true)
  v.setOptions({ ...v.options, count: 112, getItemKey: (i) => i - 12 })
  v._willUpdate()
  expect(el.scrollTop).toBe(4810)
  el.scrollHeight = 5600
  el.scrollTop = 4800
  scroll(4800, true)
  expect(el.scrollTop).toBe(5400)
  settle()

  expect(el.scrollTop).toBe(5400)
  expect(v.scrollState).toBeNull()
})

test('a prepend before the read-back of a scrollToIndex write is left to reconcile', () => {
  // scrollToIndex(20) wrote 1000 while `scrollOffset` still holds 2000. The
  // anchor sync used to write the stale offset plus the prepend (2600) over
  // the command, and reconcile (index target unchanged at 1000) never wrote
  // again until the safety valve.
  const { v, el, scroll, settle } = setupHandDrivenScroll({
    anchorTo: 'end',
    getItemKey: (i) => i,
  })
  el.scrollTop = 2000
  scroll(2000, false)

  v.scrollToIndex(20, { align: 'start' })
  expect(el.scrollTop).toBe(1000)
  v.setOptions({ ...v.options, count: 112, getItemKey: (i) => i - 12 })
  v._willUpdate()
  // No anchor write before the read-back...
  expect(el.scrollTop).toBe(1000)
  scroll(1000, true)
  settle()
  // ...the index scroll lands on index 20 of the new list.
  expect(el.scrollTop).toBe(1000)
  expect(v.scrollState).toBeNull()
})

test('a prepend before the read-back of a scrollToOffset write is left to reconcile', () => {
  const { v, el, scroll, settle } = setupHandDrivenScroll({
    anchorTo: 'end',
    getItemKey: (i) => i,
  })
  el.scrollTop = 2000
  scroll(2000, false)

  v.scrollToOffset(1000)
  v.setOptions({ ...v.options, count: 112, getItemKey: (i) => i - 12 })
  v._willUpdate()
  expect(el.scrollTop).toBe(1000)
  scroll(1000, true)
  settle()

  expect(el.scrollTop).toBe(1000)
  expect(v.scrollState).toBeNull()
})

test('scrollBy past the start does not leave the next scrollBy building on an unreachable offset', () => {
  const { v, el, frames } = setupHandDrivenScroll()

  v.scrollBy(-100)
  frames()
  expect(el.scrollTop).toBe(0)
  v.scrollBy(100)

  expect(el.scrollTop).toBe(100)
})

test('scrollBy after the safety valve dropped an ignored write builds on the real position', () => {
  const { v, el, scroll, frames, browser } = setupHandDrivenScroll()
  el.scrollTop = 2000
  scroll(2000, false)
  let now = 0
  v['now'] = () => now

  browser.ignoreWrites = true
  v.scrollToIndex(20, { align: 'start' })
  now = 6000
  frames()
  expect(v.scrollState).toBeNull()
  browser.ignoreWrites = false
  v.scrollBy(100)

  expect(el.scrollTop).toBe(2100)
})

test('scrollBy after cancelScroll dropped an ignored write builds on the real position', () => {
  const { v, el, scroll, browser } = setupHandDrivenScroll()
  el.scrollTop = 2000
  scroll(2000, false)

  browser.ignoreWrites = true
  v.scrollToIndex(20, { align: 'start' })
  v.cancelScroll()
  browser.ignoreWrites = false
  v.scrollBy(100)

  expect(el.scrollTop).toBe(2100)
})

test('a smooth scrollToIndex switched to auto near the end is not cancelled by a late animation event', () => {
  // Reconcile switches a smooth scroll to 'auto' for the final approach when
  // the target moves within a viewport. WebKit can still deliver a scroll
  // event from the smooth animation after that instant write; it is not the
  // user and must not end the scroll.
  const { v, el, scroll, frame, settle } = setupHandDrivenScroll()

  v.scrollToIndex(50, { align: 'start', behavior: 'smooth' })
  el.scrollTop = 2450 // the animation is almost there
  scroll(2450, true)
  v.resizeItem(10, 100) // the target moves to 2550, within a viewport
  frame() // reconcile switches to 'auto' and writes 2550
  expect(el.scrollTop).toBe(2550)

  el.scrollTop = 2470 // a late event from the smooth animation
  scroll(2470, true)
  expect(v.scrollState).not.toBeNull()

  el.scrollTop = 2550
  scroll(2550, true)
  settle()
  expect(el.scrollTop).toBe(2550)
  expect(v.scrollState).toBeNull()
})

test('a scrollToIndex write clamped by a sizer that shrank below it still reaches the fresh target', () => {
  // The sizer re-renders before the scroll event reports the write (a
  // same-task render after the command). Rows above the target shrink by
  // 600px, so the max drops from 4800 to 4200 and the target from 4500 to
  // 3900. The read-back at the new max is our write, clamped: it used to
  // read as a user scroll and the index scroll stopped at 4200.
  const { v, el, scroll, settle } = setupHandDrivenScroll()

  v.scrollToIndex(90, { align: 'start' })
  expect(el.scrollTop).toBe(4500)
  for (let i = 0; i < 20; i++) v.resizeItem(i, 20)
  // The re-render that shrinks the sizer also rebuilds the measurements.
  v.getVirtualItems()
  el.scrollHeight = 4400
  el.scrollTop = 4200
  scroll(4200, true)
  settle()

  expect(el.scrollTop).toBe(3900)
  expect(v.scrollState).toBeNull()
})

test('a user scroll to the max while a write above it is pending is still the user', () => {
  // The clamped read-back is only a read-back when the pending write sits
  // past the max. A write within the range that the user overtakes to the
  // bottom reads as the user's and retires the command.
  const { v, el, scroll, frame, settle } = setupHandDrivenScroll()

  v.scrollToIndex(20, { align: 'start' })
  expect(el.scrollTop).toBe(1000)
  el.scrollTop = 4800
  scroll(4800, true)
  // A row above grows while the user is still scrolling: a command still
  // alive would retarget to 1050 and pull the user back.
  v.resizeItem(5, 100)
  frame()
  expect(el.scrollTop).toBe(4800)
  settle()

  expect(el.scrollTop).toBe(4800)
  expect(v.scrollState).toBeNull()
})

test('a write to a scroll element that went away is not adopted by the next one', () => {
  // A write is matched to its read-back within 1.5px. After the element is
  // swapped (or the virtualizer disabled), the old write is never read back,
  // so the new element's first report is taken as it is.
  const mk = (top: number) => ({
    scrollTop: top,
    scrollLeft: 0,
    scrollHeight: 5000,
    clientHeight: 200,
    offsetHeight: 200,
  })
  let el = mk(0)
  const v = new Virtualizer({
    count: 100,
    estimateSize: () => 50,
    getScrollElement: () => el as any,
    scrollToFn: () => {},
    observeElementRect: (_inst, cb) => {
      cb({ width: 400, height: 200 })
      return () => {}
    },
    observeElementOffset: (_inst, cb) => {
      cb(el.scrollTop, false)
      return () => {}
    },
  })
  v._willUpdate()
  v['getMeasurements']()

  v.scrollToOffset(1000.5) // written, never read back on the old element
  el = mk(1001)
  v._willUpdate()

  expect(v.scrollOffset).toBe(1001)
})
