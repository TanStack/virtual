import { expect, test, vi } from 'vitest'
import {
  Virtualizer,
  observeElementOffset,
  observeElementRect,
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

test('takeSnapshot: returns measured items only, restorable via initialMeasurementsCache', () => {
  const v1 = new Virtualizer({
    count: 20,
    estimateSize: () => 50,
    getScrollElement: () => null,
    scrollToFn: vi.fn(),
    observeElementRect: vi.fn(),
    observeElementOffset: vi.fn(),
  })
  v1['getMeasurements']()

  // No measurements yet → empty snapshot
  expect(v1.takeSnapshot()).toEqual([])

  // Measure a few items
  v1.resizeItem(0, 80)
  v1.resizeItem(1, 60)
  v1.resizeItem(2, 100)

  const snapshot = v1.takeSnapshot()
  expect(snapshot.length).toBe(3)
  expect(snapshot[0]!.size).toBe(80)
  expect(snapshot[1]!.size).toBe(60)
  expect(snapshot[2]!.size).toBe(100)
  // snapshot entries are plain objects (not Proxy refs)
  expect(Object.keys(snapshot[0]!).sort()).toEqual([
    'end',
    'index',
    'key',
    'lane',
    'size',
    'start',
  ])

  // Restore: pass snapshot to a fresh virtualizer
  const v2 = new Virtualizer({
    count: 20,
    estimateSize: () => 50,
    initialMeasurementsCache: snapshot,
    getScrollElement: () => null,
    scrollToFn: vi.fn(),
    observeElementRect: vi.fn(),
    observeElementOffset: vi.fn(),
  })
  const m2 = v2['getMeasurements']()
  // Restored sizes match the snapshot
  expect(m2[0]!.size).toBe(80)
  expect(m2[1]!.size).toBe(60)
  expect(m2[2]!.size).toBe(100)
  // Unmeasured items fall back to estimateSize
  expect(m2[5]!.size).toBe(50)
})

test('takeSnapshot: works with lanes>1 too', () => {
  const v = new Virtualizer({
    count: 6,
    lanes: 2,
    estimateSize: () => 50,
    getScrollElement: () => null,
    scrollToFn: vi.fn(),
    observeElementRect: vi.fn(),
    observeElementOffset: vi.fn(),
  })
  v['getMeasurements']()
  v.resizeItem(0, 80)
  v.resizeItem(1, 90)
  const snap = v.takeSnapshot()
  expect(snap.length).toBe(2)
  expect(snap[0]!.size).toBe(80)
  expect(snap[1]!.size).toBe(90)
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

// ─── Public-exports lockdown ─────────────────────────────────────────────────
// If any of these go missing the next minor bump silently breaks consumers.

test('public runtime exports from @tanstack/virtual-core', async () => {
  const mod = await import('../src/index')
  // Class + helpers
  expect(typeof mod.Virtualizer).toBe('function')
  expect(typeof mod.defaultKeyExtractor).toBe('function')
  expect(typeof mod.defaultRangeExtractor).toBe('function')
  // Observers
  expect(typeof mod.observeElementRect).toBe('function')
  expect(typeof mod.observeWindowRect).toBe('function')
  expect(typeof mod.observeElementOffset).toBe('function')
  expect(typeof mod.observeWindowOffset).toBe('function')
  // Scrollers
  expect(typeof mod.elementScroll).toBe('function')
  expect(typeof mod.windowScroll).toBe('function')
  // Measurement
  expect(typeof mod.measureElement).toBe('function')
  // Utilities (historically re-exported from utils)
  expect(typeof mod.memo).toBe('function')
  expect(typeof mod.debounce).toBe('function')
  expect(typeof mod.notUndefined).toBe('function')
  expect(typeof mod.approxEqual).toBe('function')
})
