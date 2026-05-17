import { expect, test, vi } from 'vitest'
import { Virtualizer } from '../src/index'

test('should export the Virtualizer class', () => {
  expect(Virtualizer).toBeDefined()
})

test('should return empty items for empty scroll element', () => {
  const virtualizer = new Virtualizer({
    count: 100,
    getScrollElement: () => null,
    estimateSize: () => 50,
    scrollToFn: vi.fn(),
    observeElementRect: vi.fn(),
    observeElementOffset: vi.fn(),
  })
  expect(virtualizer.getVirtualItems()).toEqual([])
})

test('should return correct total size with one item and multiple lanes', () => {
  const virtualizer = new Virtualizer({
    count: 1,
    lanes: 2,
    estimateSize: () => 50,
    getScrollElement: () => null,
    scrollToFn: vi.fn(),
    observeElementRect: vi.fn(),
    observeElementOffset: vi.fn(),
  })
  expect(virtualizer.getTotalSize()).toBe(50)
})

test('should correctly recalculate lane assignments when lane count changes', () => {
  // Create a mock scroll element
  const mockScrollElement = {
    scrollTop: 0,
    scrollLeft: 0,
    offsetWidth: 400,
    offsetHeight: 600,
  } as unknown as HTMLDivElement

  // Mock ResizeObserver
  let resizeCallback: ((entries: any[]) => void) | null = null
  const mockResizeObserver = vi.fn((callback) => {
    resizeCallback = callback
    return {
      observe: vi.fn(),
      unobserve: vi.fn(),
      disconnect: vi.fn(),
    }
  })
  global.ResizeObserver = mockResizeObserver as any

  // Create virtualizer with 3 lanes initially
  const virtualizer = new Virtualizer({
    count: 10,
    lanes: 3,
    estimateSize: () => 100,
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

  virtualizer._willUpdate()

  // Get initial measurements with 3 lanes
  let measurements = virtualizer['getMeasurements']()
  expect(measurements.length).toBe(10)

  // All lane assignments should be 0, 1, or 2 (3 lanes)
  measurements.forEach((item) => {
    expect(item.lane).toBeGreaterThanOrEqual(0)
    expect(item.lane).toBeLessThan(3)
  })

  // Change to 2 lanes
  virtualizer.setOptions({
    count: 10,
    lanes: 2,
    estimateSize: () => 100,
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

  virtualizer._willUpdate()

  // Get new measurements with 2 lanes
  measurements = virtualizer['getMeasurements']()
  expect(measurements.length).toBe(10)

  // All lane assignments should now be 0 or 1 (2 lanes)
  // This is the bug fix - previously some items could still have lane: 2
  measurements.forEach((item, index) => {
    expect(item.lane).toBeGreaterThanOrEqual(0)
    expect(item.lane).toBeLessThan(2)
  })

  // Verify no out of bounds access would occur
  const lanes = 2
  const columns = Array.from({ length: lanes }, () => [] as typeof measurements)
  measurements.forEach((item) => {
    // This should not throw
    expect(() => {
      columns[item.lane].push(item)
    }).not.toThrow()
  })
})

test('should update getTotalSize() when count option changes (filtering/search)', () => {
  const virtualizer = new Virtualizer({
    count: 100,
    estimateSize: () => 50,
    getScrollElement: () => null,
    scrollToFn: vi.fn(),
    observeElementRect: vi.fn(),
    observeElementOffset: vi.fn(),
  })

  expect(virtualizer.getTotalSize()).toBe(5000) // 100 × 50

  // Simulate filtering - reduce count to 20
  virtualizer.setOptions({
    count: 20,
    estimateSize: () => 50,
    getScrollElement: () => null,
    scrollToFn: vi.fn(),
    observeElementRect: vi.fn(),
    observeElementOffset: vi.fn(),
  })

  // getTotalSize() should immediately return updated value (not stale)
  expect(virtualizer.getTotalSize()).toBe(1000) // 20 × 50

  // Restore full count
  virtualizer.setOptions({
    count: 100,
    estimateSize: () => 50,
    getScrollElement: () => null,
    scrollToFn: vi.fn(),
    observeElementRect: vi.fn(),
    observeElementOffset: vi.fn(),
  })

  expect(virtualizer.getTotalSize()).toBe(5000) // 100 × 50
})

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

test("should defer lane caching until measurement when laneAssignmentMode is 'measured'", () => {
  const virtualizer = new Virtualizer({
    count: 4,
    lanes: 2,
    estimateSize: () => 100,
    laneAssignmentMode: 'measured',
    getScrollElement: () => null,
    scrollToFn: vi.fn(),
    observeElementRect: vi.fn(),
    observeElementOffset: vi.fn(),
  })

  virtualizer['getMeasurements']()

  // No laneAssignments cached yet
  expect(virtualizer['laneAssignments'].size).toBe(0)

  // Simulate measurements
  virtualizer.resizeItem(0, 200)
  virtualizer.resizeItem(1, 50)
  virtualizer.resizeItem(2, 80)
  virtualizer.resizeItem(3, 120)

  const measurements = virtualizer['getMeasurements']()

  // After measurement: lane assignments based on actual sizes + cached
  expect(virtualizer['laneAssignments'].size).toBe(4)
  expect(measurements[2].lane).toBe(1) // lane 1 is shorter, so assigned there

  // Lane assignments remain stable after size changes
  const lanesBeforeResize = measurements.map((m) => m.lane)
  virtualizer.resizeItem(0, 50)
  virtualizer.resizeItem(1, 200)
  const lanesAfterResize = virtualizer['getMeasurements']().map((m) => m.lane)
  expect(lanesBeforeResize).toEqual(lanesAfterResize)
})

test("should cache lanes incrementally as items are measured when laneAssignmentMode is 'measured'", () => {
  const virtualizer = new Virtualizer({
    count: 4,
    lanes: 2,
    estimateSize: () => 100,
    laneAssignmentMode: 'measured',
    getScrollElement: () => null,
    scrollToFn: vi.fn(),
    observeElementRect: vi.fn(),
    observeElementOffset: vi.fn(),
  })

  virtualizer['getMeasurements']()
  expect(virtualizer['laneAssignments'].size).toBe(0)

  // Measure only the first 2 items (simulating viewport-visible items)
  virtualizer.resizeItem(0, 200)
  virtualizer.resizeItem(1, 50)

  const m1 = virtualizer['getMeasurements']()
  expect(virtualizer['laneAssignments'].size).toBe(2)

  const lane0 = m1[0].lane
  const lane1 = m1[1].lane

  // Measure the remaining items
  virtualizer.resizeItem(2, 80)
  virtualizer.resizeItem(3, 120)

  const m2 = virtualizer['getMeasurements']()
  expect(virtualizer['laneAssignments'].size).toBe(4)

  // Previously cached lanes must remain stable
  expect(m2[0].lane).toBe(lane0)
  expect(m2[1].lane).toBe(lane1)
})

test("should cache lanes immediately when laneAssignmentMode is 'estimate' (default)", () => {
  const virtualizer = new Virtualizer({
    count: 4,
    lanes: 2,
    estimateSize: () => 100,
    laneAssignmentMode: 'estimate',
    getScrollElement: () => null,
    scrollToFn: vi.fn(),
    observeElementRect: vi.fn(),
    observeElementOffset: vi.fn(),
  })

  virtualizer['getMeasurements']()

  expect(virtualizer['laneAssignments'].size).toBe(4)
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

  // Flush rAF — reconcileScroll should run and not bail
  // It should eventually clear scrollState (settle)
  rafCallbacks.forEach((cb) => cb(0))

  // scrollState should be cleared after settling
  expect(virtualizer['scrollState']).toBeNull()
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

// ─── resizeItem / measurement cache invalidation ─────────────────────────────
// These tests pin down the contract that resizeItem invalidates the
// getMeasurements memo so subsequent reads reflect the new sizes.
// They guard against regressions when changing the invalidation mechanism
// (e.g. Map clone → version counter).

test('resizeItem should persist size for a single index', () => {
  const virtualizer = new Virtualizer({
    count: 5,
    estimateSize: () => 50,
    getScrollElement: () => null,
    scrollToFn: vi.fn(),
    observeElementRect: vi.fn(),
    observeElementOffset: vi.fn(),
  })

  // Seed measurementsCache
  virtualizer['getMeasurements']()

  virtualizer.resizeItem(2, 130)

  const measurements = virtualizer['getMeasurements']()
  expect(measurements[2]!.size).toBe(130)
  // Items after should be shifted by the delta (130 - 50 = 80)
  expect(measurements[3]!.start).toBe(50 + 50 + 130)
  expect(measurements[4]!.start).toBe(50 + 50 + 130 + 50)
})

test('resizeItem should persist sizes across many sequential calls', () => {
  const N = 50
  const virtualizer = new Virtualizer({
    count: N,
    estimateSize: () => 10,
    getScrollElement: () => null,
    scrollToFn: vi.fn(),
    observeElementRect: vi.fn(),
    observeElementOffset: vi.fn(),
  })

  virtualizer['getMeasurements']()

  // Resize every item to a unique size
  for (let i = 0; i < N; i++) {
    virtualizer.resizeItem(i, 100 + i)
  }

  const measurements = virtualizer['getMeasurements']()
  let runningStart = 0
  for (let i = 0; i < N; i++) {
    expect(measurements[i]!.size).toBe(100 + i)
    expect(measurements[i]!.start).toBe(runningStart)
    runningStart += 100 + i
  }
})

test('resizeItem should invalidate getMeasurements memo even when same key resized twice', () => {
  const virtualizer = new Virtualizer({
    count: 3,
    estimateSize: () => 50,
    getScrollElement: () => null,
    scrollToFn: vi.fn(),
    observeElementRect: vi.fn(),
    observeElementOffset: vi.fn(),
  })

  virtualizer['getMeasurements']()

  virtualizer.resizeItem(1, 100)
  expect(virtualizer['getMeasurements']()[1]!.size).toBe(100)

  virtualizer.resizeItem(1, 200)
  expect(virtualizer['getMeasurements']()[1]!.size).toBe(200)

  virtualizer.resizeItem(1, 75)
  expect(virtualizer['getMeasurements']()[1]!.size).toBe(75)
})

test('resizeItem with same size as cached should be a no-op (no invalidation)', () => {
  const virtualizer = new Virtualizer({
    count: 3,
    estimateSize: () => 50,
    getScrollElement: () => null,
    scrollToFn: vi.fn(),
    observeElementRect: vi.fn(),
    observeElementOffset: vi.fn(),
  })

  virtualizer['getMeasurements']()
  virtualizer.resizeItem(0, 80)
  const before = virtualizer['getMeasurements']()
  const beforeRef = before
  // Same value, should short-circuit (delta === 0)
  virtualizer.resizeItem(0, 80)
  const after = virtualizer['getMeasurements']()
  // Memo should return the same array reference
  expect(after).toBe(beforeRef)
})

test('measure() should clear size cache and lane assignments', () => {
  const virtualizer = new Virtualizer({
    count: 4,
    lanes: 2,
    estimateSize: () => 50,
    getScrollElement: () => null,
    scrollToFn: vi.fn(),
    observeElementRect: vi.fn(),
    observeElementOffset: vi.fn(),
  })

  virtualizer['getMeasurements']()
  virtualizer.resizeItem(0, 200)
  virtualizer.resizeItem(1, 100)

  expect(virtualizer['itemSizeCache'].size).toBe(2)
  expect(virtualizer['laneAssignments'].size).toBeGreaterThan(0)

  virtualizer.measure()

  expect(virtualizer['itemSizeCache'].size).toBe(0)
  expect(virtualizer['laneAssignments'].size).toBe(0)

  // After measure(), sizes should fall back to estimateSize
  const measurements = virtualizer['getMeasurements']()
  expect(measurements[0]!.size).toBe(50)
  expect(measurements[1]!.size).toBe(50)
})

test('measure() should trigger a re-measurement on subsequent getMeasurements', () => {
  let sizeFn = (i: number) => 50
  const virtualizer = new Virtualizer({
    count: 3,
    estimateSize: (i) => sizeFn(i),
    getScrollElement: () => null,
    scrollToFn: vi.fn(),
    observeElementRect: vi.fn(),
    observeElementOffset: vi.fn(),
  })

  const before = virtualizer['getMeasurements']()
  expect(before[0]!.size).toBe(50)

  // Change the estimateSize function via setOptions
  sizeFn = () => 100
  virtualizer.measure()

  const after = virtualizer['getMeasurements']()
  expect(after[0]!.size).toBe(100)
})

test('resizeItem on unknown index is a no-op', () => {
  const virtualizer = new Virtualizer({
    count: 3,
    estimateSize: () => 50,
    getScrollElement: () => null,
    scrollToFn: vi.fn(),
    observeElementRect: vi.fn(),
    observeElementOffset: vi.fn(),
  })

  virtualizer['getMeasurements']()
  // Index out of bounds — should not crash
  expect(() => virtualizer.resizeItem(99, 100)).not.toThrow()

  // Cache should be untouched
  expect(virtualizer['itemSizeCache'].size).toBe(0)
})

test('resizeItem out-of-order should produce correct positions regardless of measurement order', () => {
  const N = 10
  const virtualizer = new Virtualizer({
    count: N,
    estimateSize: () => 20,
    getScrollElement: () => null,
    scrollToFn: vi.fn(),
    observeElementRect: vi.fn(),
    observeElementOffset: vi.fn(),
  })

  virtualizer['getMeasurements']()

  // Resize in reverse order — should still produce a valid prefix-sum
  for (let i = N - 1; i >= 0; i--) {
    virtualizer.resizeItem(i, 30 + i)
  }

  const measurements = virtualizer['getMeasurements']()
  let runningStart = 0
  for (let i = 0; i < N; i++) {
    expect(measurements[i]!.size).toBe(30 + i)
    expect(measurements[i]!.start).toBe(runningStart)
    runningStart += 30 + i
  }
})

test('getMeasurements memo should return same array reference when nothing changed', () => {
  const virtualizer = new Virtualizer({
    count: 5,
    estimateSize: () => 50,
    getScrollElement: () => null,
    scrollToFn: vi.fn(),
    observeElementRect: vi.fn(),
    observeElementOffset: vi.fn(),
  })

  const a = virtualizer['getMeasurements']()
  const b = virtualizer['getMeasurements']()
  expect(a).toBe(b)
})

test('getMeasurements memo should return new array reference after resizeItem', () => {
  const virtualizer = new Virtualizer({
    count: 5,
    estimateSize: () => 50,
    getScrollElement: () => null,
    scrollToFn: vi.fn(),
    observeElementRect: vi.fn(),
    observeElementOffset: vi.fn(),
  })

  const a = virtualizer['getMeasurements']()
  virtualizer.resizeItem(0, 100)
  const b = virtualizer['getMeasurements']()
  expect(a).not.toBe(b)
  expect(b[0]!.size).toBe(100)
})

// ─── setOptions behavioral contract ──────────────────────────────────────────
// These tests pin down how setOptions merges defaults with user-supplied opts.
// They guard against regressions when changing the merge mechanism
// (currently: mutate opts + spread with defaults; will become: copy-without-undefined).

test('setOptions: undefined values should fall back to defaults', () => {
  const virtualizer = new Virtualizer({
    count: 10,
    estimateSize: () => 50,
    getScrollElement: () => null,
    scrollToFn: vi.fn(),
    observeElementRect: vi.fn(),
    observeElementOffset: vi.fn(),
    paddingStart: 100,
  })

  // First confirm explicit value sticks
  expect(virtualizer.options.paddingStart).toBe(100)

  // Now setOptions with paddingStart: undefined → should fall back to default (0)
  virtualizer.setOptions({
    count: 10,
    estimateSize: () => 50,
    getScrollElement: () => null,
    scrollToFn: vi.fn(),
    observeElementRect: vi.fn(),
    observeElementOffset: vi.fn(),
    paddingStart: undefined as any,
  })

  expect(virtualizer.options.paddingStart).toBe(0)
})

test('setOptions: missing keys should fall back to defaults', () => {
  const virtualizer = new Virtualizer({
    count: 10,
    estimateSize: () => 50,
    getScrollElement: () => null,
    scrollToFn: vi.fn(),
    observeElementRect: vi.fn(),
    observeElementOffset: vi.fn(),
  })

  // Defaults should apply for all unset options
  expect(virtualizer.options.paddingStart).toBe(0)
  expect(virtualizer.options.paddingEnd).toBe(0)
  expect(virtualizer.options.overscan).toBe(1)
  expect(virtualizer.options.horizontal).toBe(false)
  expect(virtualizer.options.gap).toBe(0)
  expect(virtualizer.options.lanes).toBe(1)
  expect(virtualizer.options.enabled).toBe(true)
})

test('setOptions: explicit falsy values (0, false) should NOT fall back to defaults', () => {
  const virtualizer = new Virtualizer({
    count: 10,
    estimateSize: () => 50,
    getScrollElement: () => null,
    scrollToFn: vi.fn(),
    observeElementRect: vi.fn(),
    observeElementOffset: vi.fn(),
    paddingStart: 50,
    overscan: 3,
    enabled: true,
  })

  // Now set them all to explicit falsy values
  virtualizer.setOptions({
    count: 10,
    estimateSize: () => 50,
    getScrollElement: () => null,
    scrollToFn: vi.fn(),
    observeElementRect: vi.fn(),
    observeElementOffset: vi.fn(),
    paddingStart: 0,
    overscan: 0,
    enabled: false,
  })

  expect(virtualizer.options.paddingStart).toBe(0)
  expect(virtualizer.options.overscan).toBe(0)
  expect(virtualizer.options.enabled).toBe(false)
})

test('setOptions: subsequent calls do not accumulate stale options', () => {
  const virtualizer = new Virtualizer({
    count: 10,
    estimateSize: () => 50,
    getScrollElement: () => null,
    scrollToFn: vi.fn(),
    observeElementRect: vi.fn(),
    observeElementOffset: vi.fn(),
    paddingStart: 100,
    overscan: 5,
  })

  // Now call again with only count — paddingStart and overscan should reset to defaults
  virtualizer.setOptions({
    count: 20,
    estimateSize: () => 50,
    getScrollElement: () => null,
    scrollToFn: vi.fn(),
    observeElementRect: vi.fn(),
    observeElementOffset: vi.fn(),
  })

  expect(virtualizer.options.count).toBe(20)
  expect(virtualizer.options.paddingStart).toBe(0)
  expect(virtualizer.options.overscan).toBe(1)
})

test('setOptions: does not mutate the caller-supplied opts object', () => {
  const virtualizer = new Virtualizer({
    count: 10,
    estimateSize: () => 50,
    getScrollElement: () => null,
    scrollToFn: vi.fn(),
    observeElementRect: vi.fn(),
    observeElementOffset: vi.fn(),
  })

  const userOpts = {
    count: 10,
    estimateSize: () => 50,
    getScrollElement: () => null,
    scrollToFn: vi.fn(),
    observeElementRect: vi.fn(),
    observeElementOffset: vi.fn(),
    paddingStart: undefined as any,
    overscan: undefined as any,
  }
  const beforeKeys = Object.keys(userOpts).sort()

  virtualizer.setOptions(userOpts)

  const afterKeys = Object.keys(userOpts).sort()
  expect(afterKeys).toEqual(beforeKeys)
  // Specifically: undefined-valued keys should still exist on the user's object
  expect('paddingStart' in userOpts).toBe(true)
  expect('overscan' in userOpts).toBe(true)
})

test('setOptions: explicit value overrides default', () => {
  const virtualizer = new Virtualizer({
    count: 10,
    estimateSize: () => 50,
    getScrollElement: () => null,
    scrollToFn: vi.fn(),
    observeElementRect: vi.fn(),
    observeElementOffset: vi.fn(),
    overscan: 7,
    gap: 12,
    lanes: 3,
  })

  expect(virtualizer.options.overscan).toBe(7)
  expect(virtualizer.options.gap).toBe(12)
  expect(virtualizer.options.lanes).toBe(3)
})
