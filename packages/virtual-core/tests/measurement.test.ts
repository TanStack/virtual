import { expect, test, vi } from 'vitest'
import {
  Virtualizer,
  observeElementOffset,
  observeElementRect,
} from '../src/index'

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

test('measure() should fully invalidate when a later index was dirtied without an intervening getMeasurements()', () => {
  // Regression: measure() used to clear itemSizeCache but not pendingMin.
  // If resizeItem() had been called without a subsequent getMeasurements()
  // to flush pendingMin, the next rebuild would preserve measurementsCache
  // entries before that index — even though measure() is supposed to wipe
  // everything.
  const virtualizer = new Virtualizer({
    count: 6,
    estimateSize: () => 50,
    getScrollElement: () => null,
    scrollToFn: vi.fn(),
    observeElementRect: vi.fn(),
    observeElementOffset: vi.fn(),
  })

  // Seed item 0 with a non-estimate size, then flush so it's in measurementsCache.
  virtualizer.resizeItem(0, 999)
  virtualizer['getMeasurements']()
  // Now dirty a later index without flushing — pendingMin will be 2.
  virtualizer.resizeItem(2, 888)
  expect(virtualizer['pendingMin']).toBe(2)

  virtualizer.measure()

  // After measure(), pendingMin must be null so the rebuild starts at 0
  // and discards the stale item-0 entry.
  expect(virtualizer['pendingMin']).toBe(null)

  const m = virtualizer['getMeasurements']()
  expect(m[0]!.size).toBe(50)
  expect(m[2]!.size).toBe(50)
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

test('measureElement should not cache a 0 size for a node that is not connected yet', () => {
  // Vue calls function refs during patch, before the parent is inserted,
  // so measureElement can receive a node whose offsetHeight is still 0.
  let roCallback: ResizeObserverCallback | null = null
  const observe = vi.fn()
  const MockResizeObserver = vi.fn(function (cb: ResizeObserverCallback) {
    roCallback = cb
    return {
      observe,
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

  const nodes = [0, 1, 2].map(
    (index) =>
      ({
        getAttribute: (name: string) =>
          name === 'data-index' ? String(index) : null,
        isConnected: false,
        offsetHeight: 0,
        offsetWidth: 0,
        setAttribute: vi.fn(),
      }) as unknown as HTMLElement,
  )

  nodes.forEach((node) => virtualizer.measureElement(node))

  // Observed, but the 0 isn't cached: items keep their estimated positions.
  expect(observe).toHaveBeenCalledTimes(3)
  expect(virtualizer.elementsCache.get(1)).toBe(nodes[1])
  expect(
    virtualizer
      .getVirtualItems()
      .slice(0, 3)
      .map((item) => item.start),
  ).toEqual([0, 50, 100])

  nodes.forEach((node) => {
    ;(node as any).isConnected = true
  })
  roCallback!(
    nodes.map(
      (node) =>
        ({
          target: node,
          contentRect: { height: 60, width: 400 } as DOMRectReadOnly,
          borderBoxSize: [{ blockSize: 60, inlineSize: 400 }],
          contentBoxSize: [{ blockSize: 60, inlineSize: 400 }],
          devicePixelContentBoxSize: [{ blockSize: 60, inlineSize: 400 }],
        }) as ResizeObserverEntry,
    ),
    {} as ResizeObserver,
  )

  expect(
    virtualizer
      .getVirtualItems()
      .slice(0, 3)
      .map((item) => item.start),
  ).toEqual([0, 60, 120])
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

test('ignores connected stale ref and ResizeObserver measurements after count shrinks', () => {
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

  let virtualizer: Virtualizer<HTMLDivElement, HTMLElement>
  const getItemKey = vi.fn((index: number) => {
    if (index < 0 || index >= virtualizer.options.count) {
      throw new Error(`getItemKey received stale index ${index}`)
    }
    return index
  })
  virtualizer = new Virtualizer({
    count: 22,
    estimateSize: () => 50,
    getItemKey,
    useCachedMeasurements: true,
    getScrollElement: () => mockScrollElement,
    scrollToFn: vi.fn(),
    observeElementRect: (_instance, cb) => {
      cb({ width: 400, height: 600 })
      return () => {}
    },
    observeElementOffset: (_instance, cb) => {
      cb(0, false)
      return () => {}
    },
  })
  virtualizer._willUpdate()

  const staleNode = {
    getAttribute: () => '21',
    getBoundingClientRect: () => ({ height: 50, width: 400 }),
    isConnected: true,
    setAttribute: vi.fn(),
  } as unknown as HTMLElement
  virtualizer.measureElement(staleNode)

  virtualizer.setOptions({ ...virtualizer.options, count: 1 })
  getItemKey.mockClear()

  expect(() => virtualizer.measureElement(staleNode)).not.toThrow()
  expect(getItemKey).not.toHaveBeenCalled()

  getItemKey.mockClear()
  expect(roCallback).not.toBeNull()
  expect(() => {
    roCallback!(
      [
        {
          target: staleNode,
          contentRect: { height: 50, width: 400 } as DOMRectReadOnly,
          borderBoxSize: [{ blockSize: 50, inlineSize: 400 }],
          contentBoxSize: [{ blockSize: 50, inlineSize: 400 }],
          devicePixelContentBoxSize: [{ blockSize: 50, inlineSize: 400 }],
        } as ResizeObserverEntry,
      ],
      {} as ResizeObserver,
    )
  }).not.toThrow()
  expect(getItemKey).not.toHaveBeenCalled()
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

test('changing gap invalidates cached measurements', () => {
  const baseOptions = {
    count: 5,
    estimateSize: () => 50,
    getScrollElement: () => null,
    scrollToFn: vi.fn(),
    observeElementRect: vi.fn(),
    observeElementOffset: vi.fn(),
  }
  const v = new Virtualizer({ ...baseOptions, gap: 0 })
  let m = v['getMeasurements']()
  expect(m[1]!.start).toBe(50)
  expect(v.getTotalSize()).toBe(250)

  v.setOptions({ ...baseOptions, gap: 40 })
  m = v['getMeasurements']()
  // start(i) = i * (size + gap); previously stale starts survived a gap-only
  // change because gap was missing from the measurement memo dependencies
  expect(m[1]!.start).toBe(90)
  expect(m[2]!.start).toBe(180)
  expect(v.getTotalSize()).toBe(410)
})

test('changing gap invalidates cached measurements (multi-lane)', () => {
  const baseOptions = {
    count: 4,
    lanes: 2,
    estimateSize: () => 50,
    getScrollElement: () => null,
    scrollToFn: vi.fn(),
    observeElementRect: vi.fn(),
    observeElementOffset: vi.fn(),
  }
  const v = new Virtualizer({ ...baseOptions, gap: 0 })
  let m = v['getMeasurements']()
  expect(m[2]!.start).toBe(50)

  v.setOptions({ ...baseOptions, gap: 40 })
  m = v['getMeasurements']()
  // second row in each lane starts at prevInLane.end + gap
  expect(m[2]!.start).toBe(90)
  expect(m[3]!.start).toBe(90)
})

// ─── ResizeObserver batching ─────────────────────────────────────────────────

function setupResizeBatch(onChange: (instance: any, sync: boolean) => void) {
  let roCallback: ResizeObserverCallback | null = null
  const observe = vi.fn()
  const unobserve = vi.fn()
  const frames = new Map<number, FrameRequestCallback>()
  let frameId = 0
  const mockWindow = {
    requestAnimationFrame: vi.fn((callback: FrameRequestCallback) => {
      frames.set(++frameId, callback)
      return frameId
    }),
    cancelAnimationFrame: vi.fn((id: number) => frames.delete(id)),
    performance: { now: () => Date.now() },
    ResizeObserver: vi.fn(function (cb: ResizeObserverCallback) {
      roCallback = cb
      return { observe, unobserve, disconnect: vi.fn() }
    }),
  }
  const el = {
    scrollTop: 0,
    scrollLeft: 0,
    scrollWidth: 400,
    scrollHeight: 100000,
    offsetWidth: 400,
    offsetHeight: 300,
    clientHeight: 300,
    ownerDocument: { defaultView: mockWindow },
  } as unknown as HTMLDivElement
  const sizes = new Map<number, number>()
  let setOffset: (offset: number, isScrolling: boolean) => void = () => {}
  const virtualizer = new Virtualizer({
    count: 20,
    estimateSize: () => 90,
    overscan: 0,
    getScrollElement: () => el,
    scrollToFn: (offset, { adjustments }) => {
      el.scrollTop = offset + (adjustments ?? 0)
    },
    measureElement: (node) =>
      sizes.get(Number((node as any).getAttribute('data-index')))!,
    observeElementRect: (_instance, cb) => {
      cb({ width: 400, height: 300 })
      return () => {}
    },
    observeElementOffset: (_instance, cb) => {
      setOffset = cb
      cb(0, false)
      return () => {}
    },
    onChange,
  })
  virtualizer._willUpdate()
  virtualizer.getVirtualItems()

  const nodes = new Map<number, any>()
  const node = (i: number) => {
    if (!nodes.has(i)) {
      nodes.set(i, {
        getAttribute: (name: string) =>
          name === 'data-index' ? String(i) : null,
        isConnected: true,
      })
    }
    return nodes.get(i)
  }
  // Measure items 0..9 at 100px while at offset 0, then scroll to 450:
  // item 3 spans 300..400 (entirely above), item 4 spans 400..500 (across
  // the fold).
  for (let i = 0; i < 10; i++) {
    sizes.set(i, 100)
    virtualizer.measureElement(node(i))
  }
  el.scrollTop = 450
  setOffset(450, false)
  virtualizer._willUpdate()
  virtualizer.getVirtualItems()

  const deliver = (indexes: Array<number>) =>
    roCallback!(
      indexes.map(
        (i) => ({ target: node(i) }) as unknown as ResizeObserverEntry,
      ),
      {} as ResizeObserver,
    )
  const flush = () => {
    const queued = [...frames.values()]
    frames.clear()
    queued.forEach((callback) => callback(0))
  }
  return {
    virtualizer,
    sizes,
    node,
    deliver,
    observe,
    unobserve,
    frames,
    flush,
  }
}

test('ResizeObserver batch: later entries see starts updated by earlier ones (#1218)', () => {
  const { virtualizer, sizes, deliver } = setupResizeBatch((instance) => {
    instance.getVirtualItems()
  })
  expect(virtualizer.getMeasurements()[4]!.start).toBe(400)

  // Item 3 grows above the fold: compensated (+100). Item 4 spans the fold,
  // so its growth happens below the anchor point and must not move scroll.
  sizes.set(3, 200)
  sizes.set(4, 150)
  deliver([3, 4])

  expect(virtualizer.scrollOffset).toBe(550)
})

test('ResizeObserver batch: a sync re-render does not drop queued entries (#1036)', () => {
  const notifies: Array<boolean> = []
  const { virtualizer, sizes, node, deliver } = setupResizeBatch(
    (instance, sync) => {
      notifies.push(sync)
      // A synchronous render that moves the range unmounts item 5.
      if (sync) node(5).isConnected = false
      instance.getVirtualItems()
    },
  )

  notifies.length = 0
  sizes.set(3, 200)
  sizes.set(5, 140)
  deliver([3, 5])

  // Both entries are measured before the single (sync) notify.
  expect(virtualizer.getMeasurements()[5]!.size).toBe(140)
  expect(notifies).toEqual([true])
})

test('unobserves rows detached by a synchronous resize render before delivery ends', () => {
  const { virtualizer, sizes, node, deliver, unobserve } = setupResizeBatch(
    (instance, sync) => {
      if (!sync) return
      // React calls the ref with null before removing the host element.
      instance.measureElement(null)
      node(5).isConnected = false
    },
  )
  sizes.set(3, 200)
  deliver([3])
  expect(unobserve).toHaveBeenCalledWith(node(5))
  expect(virtualizer.elementsCache.has(5)).toBe(false)
})

test('measures new rows synchronously but observes them after resize delivery', () => {
  const { virtualizer, sizes, node, deliver, observe, frames, flush } =
    setupResizeBatch((instance, sync) => {
      if (sync) {
        instance.measureElement(node(10))
        instance.measureElement(node(11))
      }
    })
  sizes.set(10, 120)
  sizes.set(11, 130)
  sizes.set(3, 200)
  deliver([3])
  expect(virtualizer.getMeasurements()[10]!.size).toBe(120)
  expect(virtualizer.getMeasurements()[11]!.size).toBe(130)
  expect(observe.mock.calls.map(([target]) => target)).not.toContain(node(10))
  expect(observe.mock.calls.map(([target]) => target)).not.toContain(node(11))
  expect(frames.size).toBe(1)
  flush()
  expect(observe).toHaveBeenCalledWith(node(10), { box: 'border-box' })
  expect(observe).toHaveBeenCalledWith(node(11), { box: 'border-box' })
})

test.each(['removed', 'replaced', 'disconnected'] as const)(
  'does not register a deferred row after it is %s',
  (action) => {
    const { virtualizer, sizes, node, deliver, observe, flush } =
      setupResizeBatch((instance, sync) => {
        if (sync) instance.measureElement(node(10))
      })
    sizes.set(10, 120)
    sizes.set(3, 200)
    deliver([3])
    expect(observe.mock.calls.map(([target]) => target)).not.toContain(node(10))

    if (action === 'removed') {
      node(10).isConnected = false
      virtualizer.measureElement(null)
    } else if (action === 'replaced') {
      const replacement = { ...node(10) }
      virtualizer.measureElement(replacement)
      expect(observe).toHaveBeenCalledWith(replacement, { box: 'border-box' })
    } else {
      virtualizer._didMount()()
    }
    flush()
    expect(observe.mock.calls.map(([target]) => target)).not.toContain(node(10))
  },
)

// ─── useAnimationFrameWithResizeObserver: frames of the scroll element's window

// A window other than the global one, as for a list rendered into a
// `window.open` popup of the same realm. Its frames run only on `flush`.
function createOwnWindow() {
  const frames = new Map<number, FrameRequestCallback>()
  let nextId = 0
  let roCallback: ResizeObserverCallback | null = null
  const ownWindow = {
    requestAnimationFrame: vi.fn((cb: FrameRequestCallback) => {
      frames.set(++nextId, cb)
      return nextId
    }),
    cancelAnimationFrame: vi.fn((id: number) => {
      frames.delete(id)
    }),
    performance: { now: () => Date.now() },
    ResizeObserver: vi.fn(function (cb: ResizeObserverCallback) {
      roCallback = cb
      return { observe: vi.fn(), unobserve: vi.fn(), disconnect: vi.fn() }
    }),
  }
  const flush = () => {
    const queued = [...frames.values()]
    frames.clear()
    queued.forEach((cb) => cb(0))
  }
  const resize = (target: Element, blockSize: number) => {
    Object.assign(target, { clientHeight: blockSize })
    roCallback!(
      [
        {
          target,
          borderBoxSize: [{ blockSize, inlineSize: 400 }],
        } as unknown as ResizeObserverEntry,
      ],
      {} as ResizeObserver,
    )
  }
  const el = {
    clientWidth: 400,
    clientHeight: 600,
    scrollTop: 0,
    scrollLeft: 0,
    scrollWidth: 400,
    scrollHeight: 5000,
    offsetWidth: 400,
    offsetHeight: 600,
    ownerDocument: { defaultView: ownWindow },
  } as unknown as HTMLDivElement
  return { ownWindow, frames, flush, resize, el }
}

function withGlobalRaf(fn: (globalRaf: ReturnType<typeof vi.fn>) => void) {
  const globalRaf = vi.fn()
  vi.stubGlobal('requestAnimationFrame', globalRaf)
  try {
    fn(globalRaf)
  } finally {
    vi.unstubAllGlobals()
  }
}

function createDeferredVirtualizer(el: HTMLDivElement) {
  const virtualizer = new Virtualizer({
    count: 10,
    estimateSize: () => 50,
    getScrollElement: () => el,
    scrollToFn: vi.fn(),
    useAnimationFrameWithResizeObserver: true,
    observeElementRect: (_instance, cb) => {
      cb({ width: 400, height: 600 })
      return () => {}
    },
    observeElementOffset: (_instance, cb) => {
      cb(0, false)
      return () => {}
    },
  })
  virtualizer._willUpdate()
  virtualizer.getVirtualItems()
  const node = {
    getAttribute: (name: string) => (name === 'data-index' ? '3' : null),
    getBoundingClientRect: () => ({ height: 50, width: 400 }),
    isConnected: true,
  } as unknown as HTMLElement
  virtualizer.measureElement(node)
  return { virtualizer, node }
}

test('deferred item measurements wait for a frame of the scroll element window', () => {
  withGlobalRaf((globalRaf) => {
    const { ownWindow, flush, resize, el } = createOwnWindow()
    const { virtualizer, node } = createDeferredVirtualizer(el)
    expect(virtualizer.getTotalSize()).toBe(500)

    resize(node, 80)
    expect(ownWindow.requestAnimationFrame).toHaveBeenCalledTimes(1)
    expect(globalRaf).not.toHaveBeenCalled()
    expect(virtualizer.getTotalSize()).toBe(500)

    flush()
    expect(virtualizer.getTotalSize()).toBe(530)
  })
})

test('cleanup cancels a deferred item measurement still waiting for its frame', () => {
  const { ownWindow, frames, flush, resize, el } = createOwnWindow()
  const { virtualizer, node } = createDeferredVirtualizer(el)
  const unmount = virtualizer._didMount()

  resize(node, 80)
  expect(frames.size).toBe(1)

  unmount()
  expect(ownWindow.cancelAnimationFrame).toHaveBeenCalledTimes(1)
  expect(frames.size).toBe(0)
  flush()
  expect(virtualizer.getTotalSize()).toBe(500)
})

test('observeElementRect defers to a frame of the scroll element window and cancels it on unsubscribe', () => {
  withGlobalRaf((globalRaf) => {
    const { frames, flush, resize, el } = createOwnWindow()
    const instance = {
      scrollElement: el,
      targetWindow: el.ownerDocument.defaultView,
      options: { useAnimationFrameWithResizeObserver: true },
    } as unknown as Virtualizer<HTMLDivElement, Element>
    const cb = vi.fn()

    const unsubscribe = observeElementRect(instance, cb)!
    expect(cb).toHaveBeenLastCalledWith({ width: 400, height: 600 })

    resize(el, 700)
    expect(cb).toHaveBeenCalledTimes(1)
    flush()
    expect(cb).toHaveBeenCalledTimes(2)
    expect(cb).toHaveBeenLastCalledWith({ width: 400, height: 700 })

    resize(el, 800)
    unsubscribe()
    expect(frames.size).toBe(0)
    flush()
    expect(cb).toHaveBeenCalledTimes(2)
    expect(globalRaf).not.toHaveBeenCalled()
  })
})

test.each([false, true])(
  'viewport measurements exclude borders and scrollbars (horizontal: %s)',
  (horizontal) => {
    const { el, resize } = createOwnWindow()
    Object.assign(el, {
      clientWidth: 370,
      clientHeight: 570,
      scrollWidth: 5000,
    })
    const virtualizer = new Virtualizer({
      count: 100,
      horizontal,
      estimateSize: () => 50,
      getScrollElement: () => el,
      scrollToFn: vi.fn(),
      observeElementRect,
      observeElementOffset: (_instance, cb) => {
        cb(0, false)
      },
    })
    virtualizer._willUpdate()
    expect(virtualizer.scrollRect).toEqual({ width: 370, height: 570 })
    expect(virtualizer.getOffsetForIndex(10, 'end')?.[0]).toBe(
      horizontal ? 180 : 0,
    )
    resize(el, 470)
    expect(virtualizer.scrollRect).toEqual({ width: 370, height: 470 })
    expect(virtualizer.getOffsetForIndex(10, 'end')?.[0]).toBe(
      horizontal ? 180 : 80,
    )
    virtualizer._didMount()()
  },
)

test('refreshes horizontal end alignment when a scrollbar toggles', () => {
  const { el } = createOwnWindow()
  let deliverResize: ResizeObserverCallback
  let observedBox: ResizeObserverBoxOptions | undefined
  el.ownerDocument.defaultView!.ResizeObserver = vi.fn(function (cb) {
    deliverResize = cb
    return {
      observe: (_target: Element, options?: ResizeObserverOptions) => {
        observedBox = options?.box
      },
      unobserve: vi.fn(),
      disconnect: vi.fn(),
    }
  }) as unknown as typeof ResizeObserver
  Object.assign(el, { scrollWidth: 5000 })
  const virtualizer = new Virtualizer({
    count: 100,
    horizontal: true,
    estimateSize: () => 50,
    getScrollElement: () => el,
    scrollToFn: vi.fn(),
    observeElementRect,
    observeElementOffset: (_instance, cb) => {
      cb(0, false)
    },
  })
  virtualizer._willUpdate()
  expect(virtualizer.getOffsetForIndex(10, 'end')?.[0]).toBe(150)
  for (const width of [385, 400]) {
    // A classic scrollbar changes the content box, leaving the border box fixed.
    Object.assign(el, { clientWidth: width })
    if (observedBox !== 'border-box') {
      deliverResize!(
        [{ target: el } as ResizeObserverEntry],
        {} as ResizeObserver,
      )
    }
    expect(el.offsetWidth).toBe(400)
    expect(virtualizer.scrollRect?.width).toBe(width)
    expect(virtualizer.getOffsetForIndex(10, 'end')?.[0]).toBe(550 - width)
  }
  virtualizer._didMount()()
})
