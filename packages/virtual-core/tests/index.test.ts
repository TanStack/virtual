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

  const mockWindow = {
    requestAnimationFrame: mockRaf,
    cancelAnimationFrame: vi.fn(),
    ResizeObserver: vi.fn(() => ({
      observe: vi.fn(),
      unobserve: vi.fn(),
      disconnect: vi.fn(),
    })),
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

  const mockWindow = {
    requestAnimationFrame: mockRaf,
    cancelAnimationFrame: mockCancelRaf,
    performance: { now: () => Date.now() },
    ResizeObserver: vi.fn(() => ({
      observe: vi.fn(),
      unobserve: vi.fn(),
      disconnect: vi.fn(),
    })),
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
