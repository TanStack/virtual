import { expect, test, vi } from 'vitest'
import {
  Virtualizer,
  defaultRangeExtractor,
  elementScroll,
  observeElementOffset,
  observeWindowOffset,
  windowScroll,
} from '../src/index'

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

// ─── elementsCache leak: disconnected node cleanup ───────────────────────────

test('RO callback should remove disconnected node from elementsCache', () => {
  // Pins down that when the ResizeObserver fires for a node that has been
  // disconnected from the DOM, that node is removed from elementsCache.
  // Without the fix, elementsCache accumulates stale entries.
  let roCallback: ResizeObserverCallback | null = null
  const MockResizeObserver = vi.fn(function (cb: ResizeObserverCallback) {
    roCallback = cb
    return {
      observe: vi.fn(),
      unobserve: vi.fn(),
      disconnect: vi.fn(),
    }
  })

  const mockWindow = {
    requestAnimationFrame: vi.fn(),
    cancelAnimationFrame: vi.fn(),
    performance: { now: () => Date.now() },
    ResizeObserver: MockResizeObserver,
  }

  const mockScrollElement = {
    scrollTop: 0,
    scrollLeft: 0,
    scrollWidth: 1000,
    scrollHeight: 5000,
    offsetWidth: 400,
    offsetHeight: 600,
    ownerDocument: { defaultView: mockWindow },
  } as unknown as HTMLDivElement

  const virtualizer = new Virtualizer({
    count: 10,
    estimateSize: () => 50,
    getScrollElement: () => mockScrollElement,
    scrollToFn: vi.fn(),
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

  // Simulate React mounting an element by calling measureElement ref callback
  const node = {
    getAttribute: (name: string) => (name === 'data-index' ? '3' : null),
    getBoundingClientRect: () => ({ height: 50, width: 400 }),
    isConnected: true,
    setAttribute: vi.fn(),
  } as unknown as HTMLElement

  virtualizer.measureElement(node)
  expect(virtualizer.elementsCache.get(3)).toBe(node)

  // Now simulate the node being disconnected from DOM
  ;(node as any).isConnected = false

  // Fire the RO callback for this node — pretending it just resized
  expect(roCallback).not.toBeNull()
  roCallback!(
    [
      {
        target: node,
        contentRect: { height: 50, width: 400 } as DOMRectReadOnly,
        borderBoxSize: [{ blockSize: 50, inlineSize: 400 }],
        contentBoxSize: [{ blockSize: 50, inlineSize: 400 }],
        devicePixelContentBoxSize: [{ blockSize: 50, inlineSize: 400 }],
      } as ResizeObserverEntry,
    ],
    {} as ResizeObserver,
  )

  // elementsCache should no longer contain the disconnected node
  expect(virtualizer.elementsCache.has(3)).toBe(false)
})

test('RO callback should not delete cache entry if node was replaced by React', () => {
  // Edge case: if React unmounts node A and mounts node B for the same key,
  // a delayed RO callback for the now-disconnected node A must not delete
  // the entry that now points to node B.
  let roCallback: ResizeObserverCallback | null = null
  const MockResizeObserver = vi.fn(function (cb: ResizeObserverCallback) {
    roCallback = cb
    return {
      observe: vi.fn(),
      unobserve: vi.fn(),
      disconnect: vi.fn(),
    }
  })

  const mockWindow = {
    requestAnimationFrame: vi.fn(),
    cancelAnimationFrame: vi.fn(),
    performance: { now: () => Date.now() },
    ResizeObserver: MockResizeObserver,
  }

  const mockScrollElement = {
    scrollTop: 0,
    scrollLeft: 0,
    scrollWidth: 1000,
    scrollHeight: 5000,
    offsetWidth: 400,
    offsetHeight: 600,
    ownerDocument: { defaultView: mockWindow },
  } as unknown as HTMLDivElement

  const virtualizer = new Virtualizer({
    count: 10,
    estimateSize: () => 50,
    getScrollElement: () => mockScrollElement,
    scrollToFn: vi.fn(),
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

  // Mount nodeA at index 3
  const nodeA = {
    getAttribute: () => '3',
    getBoundingClientRect: () => ({ height: 50, width: 400 }),
    isConnected: true,
    setAttribute: vi.fn(),
  } as unknown as HTMLElement
  virtualizer.measureElement(nodeA)
  expect(virtualizer.elementsCache.get(3)).toBe(nodeA)

  // Mount nodeB for the same index — replaces nodeA in elementsCache
  const nodeB = {
    getAttribute: () => '3',
    getBoundingClientRect: () => ({ height: 50, width: 400 }),
    isConnected: true,
    setAttribute: vi.fn(),
  } as unknown as HTMLElement
  virtualizer.measureElement(nodeB)
  expect(virtualizer.elementsCache.get(3)).toBe(nodeB)

  // Now fire a delayed RO callback for the now-disconnected nodeA.
  // This must NOT delete elementsCache[3] (which points to nodeB).
  ;(nodeA as any).isConnected = false
  roCallback!(
    [
      {
        target: nodeA,
        contentRect: { height: 50, width: 400 } as DOMRectReadOnly,
        borderBoxSize: [{ blockSize: 50, inlineSize: 400 }],
        contentBoxSize: [{ blockSize: 50, inlineSize: 400 }],
        devicePixelContentBoxSize: [{ blockSize: 50, inlineSize: 400 }],
      } as ResizeObserverEntry,
    ],
    {} as ResizeObserver,
  )

  expect(virtualizer.elementsCache.get(3)).toBe(nodeB)
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

// ─── pending min pointer for measure storms ──────────────────────────────────

test('resizeItem random order should rebuild from earliest dirty index', () => {
  // This pins down the min-of-pending-indices behavior. If indices 5, 0, 8 are
  // dirtied in that order, getMeasurements must rebuild from index 0 onward so
  // all later items have correct offsets.
  const N = 20
  const virtualizer = new Virtualizer({
    count: N,
    estimateSize: () => 10,
    getScrollElement: () => null,
    scrollToFn: vi.fn(),
    observeElementRect: vi.fn(),
    observeElementOffset: vi.fn(),
  })

  virtualizer['getMeasurements']()

  virtualizer.resizeItem(5, 50)
  virtualizer.resizeItem(0, 30)
  virtualizer.resizeItem(8, 70)
  virtualizer.resizeItem(15, 100)
  virtualizer.resizeItem(3, 40)

  const measurements = virtualizer['getMeasurements']()
  // Sizes
  expect(measurements[0]!.size).toBe(30)
  expect(measurements[3]!.size).toBe(40)
  expect(measurements[5]!.size).toBe(50)
  expect(measurements[8]!.size).toBe(70)
  expect(measurements[15]!.size).toBe(100)

  // Verify start/end are correct (prefix-sum invariant) for ALL items,
  // even those that were not resized — they must have absorbed the shifts
  // from earlier resized items.
  let runningStart = 0
  for (let i = 0; i < N; i++) {
    expect(measurements[i]!.start).toBe(runningStart)
    runningStart += measurements[i]!.size
  }
})

test('resizeItem in massive storm (10k items) does not crash on min lookup', () => {
  // Regression: Math.min(...arr) spreads the array onto the call stack.
  // V8's argument-list limit is around 125k. With many pending indices,
  // this can throw RangeError. We test 10k to be well within range but
  // catch any regression in the running-min mechanism.
  const N = 10_000
  const virtualizer = new Virtualizer({
    count: N,
    estimateSize: () => 10,
    getScrollElement: () => null,
    scrollToFn: vi.fn(),
    observeElementRect: vi.fn(),
    observeElementOffset: vi.fn(),
  })

  virtualizer['getMeasurements']()

  // Resize every item before reading measurements — accumulates N pending indices
  for (let i = 0; i < N; i++) {
    virtualizer.resizeItem(i, 20 + (i % 13))
  }

  expect(() => virtualizer['getMeasurements']()).not.toThrow()
  const measurements = virtualizer['getMeasurements']()
  expect(measurements.length).toBe(N)
  // Verify last item has correct prefix-sum
  let expected = 0
  for (let i = 0; i < N; i++) expected += 20 + (i % 13)
  expect(measurements[N - 1]!.start + measurements[N - 1]!.size).toBe(expected)
})

// ─── defaultRangeExtractor ───────────────────────────────────────────────────

test('defaultRangeExtractor: simple range with no overscan', () => {
  const result = defaultRangeExtractor({
    startIndex: 5,
    endIndex: 10,
    overscan: 0,
    count: 100,
  })
  expect(result).toEqual([5, 6, 7, 8, 9, 10])
})

test('defaultRangeExtractor: range with overscan', () => {
  const result = defaultRangeExtractor({
    startIndex: 5,
    endIndex: 10,
    overscan: 2,
    count: 100,
  })
  expect(result).toEqual([3, 4, 5, 6, 7, 8, 9, 10, 11, 12])
})

test('defaultRangeExtractor: clamps start to 0 when overscan would go negative', () => {
  const result = defaultRangeExtractor({
    startIndex: 1,
    endIndex: 5,
    overscan: 5,
    count: 100,
  })
  expect(result).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
  expect(result[0]).toBe(0)
})

test('defaultRangeExtractor: clamps end to count-1 when overscan would go past', () => {
  const result = defaultRangeExtractor({
    startIndex: 95,
    endIndex: 99,
    overscan: 5,
    count: 100,
  })
  expect(result).toEqual([90, 91, 92, 93, 94, 95, 96, 97, 98, 99])
  expect(result[result.length - 1]).toBe(99)
})

test('defaultRangeExtractor: single item range', () => {
  const result = defaultRangeExtractor({
    startIndex: 5,
    endIndex: 5,
    overscan: 0,
    count: 100,
  })
  expect(result).toEqual([5])
})

test('defaultRangeExtractor: returns a plain Array (not iterable proxy)', () => {
  const result = defaultRangeExtractor({
    startIndex: 0,
    endIndex: 3,
    overscan: 0,
    count: 100,
  })
  expect(Array.isArray(result)).toBe(true)
  expect(result.length).toBe(4)
})

test('defaultRangeExtractor: large range produces correct length', () => {
  const result = defaultRangeExtractor({
    startIndex: 0,
    endIndex: 999,
    overscan: 0,
    count: 1000,
  })
  expect(result.length).toBe(1000)
  expect(result[0]).toBe(0)
  expect(result[999]).toBe(999)
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
  elementScroll(
    100,
    { behavior: 'smooth' },
    makeBaseInstance(scrollEl) as any,
  )
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
  windowScroll(
    250,
    { behavior: 'smooth' },
    makeBaseInstance(win) as any,
  )
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
  opts: { horizontal?: boolean; isRtl?: boolean; useScrollendEvent?: boolean; isScrollingResetDelay?: number } = {},
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
  expect(observeElementOffset(makeObserveInstance(null) as any, cb)).toBeUndefined()
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
  expect(observeWindowOffset(makeObserveInstance(null) as any, cb)).toBeUndefined()
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
  observeWindowOffset(
    makeObserveInstance(win, { horizontal: true }) as any,
    cb,
  )
  listeners.get('scroll')!({} as Event)
  expect(cb).toHaveBeenCalledWith(75, true)
})
