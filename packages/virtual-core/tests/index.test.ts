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

test('should defer lane caching until measurement when deferLaneAssignment is true', () => {
  const virtualizer = new Virtualizer({
    count: 4,
    lanes: 2,
    estimateSize: () => 100,
    deferLaneAssignment: true,
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

test('should cache lanes immediately when deferLaneAssignment is false (default)', () => {
  const virtualizer = new Virtualizer({
    count: 4,
    lanes: 2,
    estimateSize: () => 100,
    getScrollElement: () => null,
    scrollToFn: vi.fn(),
    observeElementRect: vi.fn(),
    observeElementOffset: vi.fn(),
  })

  virtualizer['getMeasurements']()

  expect(virtualizer['laneAssignments'].size).toBe(4)
})
