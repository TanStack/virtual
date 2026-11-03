import { describe, expect, test, vi } from 'vitest'
import {
  Virtualizer,
  elementScroll,
  observeElementOffset,
  observeElementRect,
} from '../src/index'

test('scroll-up jank: backward-scroll skips adjustment on re-measurement by default', () => {
  // Default behavior: when an already-measured above-viewport item resizes
  // AGAIN while the user is scrolling BACKWARD, we no longer write to
  // scrollTop. This avoids the well-known "items jump while scrolling up" jank.
  const scrollToFn = vi.fn()
  let scrollCb: ((o: number, s: boolean) => void) | null = null
  const v = new Virtualizer({
    count: 10,
    estimateSize: () => 50,
    getScrollElement: () =>
      ({
        scrollTop: 200,
        scrollLeft: 0,
        scrollHeight: 500,
        clientHeight: 200,
        offsetHeight: 200,
      }) as any,
    scrollToFn,
    observeElementRect: () => {},
    observeElementOffset: (_inst, cb) => {
      scrollCb = cb
      // Simulate user starting at scrollTop=200, then scrolling up to 100.
      cb(200, false)
      return () => {}
    },
  })
  v._willUpdate()
  v['getMeasurements']()
  // Seed item 0's size so the backward resize below is a RE-measurement.
  v.resizeItem(0, 80)
  // Now simulate backward scroll: from 200 to 100 (offset decreases).
  scrollCb!(100, true)
  expect(v.scrollDirection).toBe('backward')
  scrollToFn.mockClear()

  // Re-measure an above-viewport item while scrolling backward.
  v.resizeItem(0, 100) // item 0 grows by 20px

  // Default behavior: no scroll-position adjustment fires for re-measurements.
  expect(scrollToFn).not.toHaveBeenCalled()
})

test('scroll-up jank: backward-scroll still applies adjustment on first measurement', () => {
  // First measurement is special: the item was rendered at its estimate and is
  // now reporting its actual size. That estimate→actual delta lives above the
  // viewport and MUST be compensated, or the anchored content jumps when
  // scrolling up into never-measured rows.
  const scrollToFn = vi.fn()
  let scrollCb: ((o: number, s: boolean) => void) | null = null
  const v = new Virtualizer({
    count: 10,
    estimateSize: () => 50,
    getScrollElement: () =>
      ({
        scrollTop: 200,
        scrollLeft: 0,
        scrollHeight: 500,
        clientHeight: 200,
        offsetHeight: 200,
      }) as any,
    scrollToFn,
    observeElementRect: () => {},
    observeElementOffset: (_inst, cb) => {
      scrollCb = cb
      cb(200, false)
      return () => {}
    },
  })
  v._willUpdate()
  v['getMeasurements']()
  // Backward scroll: 200 → 100.
  scrollCb!(100, true)
  expect(v.scrollDirection).toBe('backward')
  scrollToFn.mockClear()

  // First measurement of an above-viewport item while scrolling backward.
  v.resizeItem(0, 100) // never measured before → estimate(50)→actual(100)

  // Adjustment still fires for the first measurement.
  expect(scrollToFn).toHaveBeenCalled()
})

test('scroll-up jank: forward-scroll still applies adjustment (no regression)', () => {
  const scrollToFn = vi.fn()
  let scrollCb: ((o: number, s: boolean) => void) | null = null
  const v = new Virtualizer({
    count: 10,
    estimateSize: () => 50,
    getScrollElement: () =>
      ({
        scrollTop: 100,
        scrollLeft: 0,
        scrollHeight: 500,
        clientHeight: 200,
        offsetHeight: 200,
      }) as any,
    scrollToFn,
    observeElementRect: () => {},
    observeElementOffset: (_inst, cb) => {
      scrollCb = cb
      cb(100, false)
      return () => {}
    },
  })
  v._willUpdate()
  v['getMeasurements']()
  // Forward scroll: 100 → 200
  scrollCb!(200, true)
  expect(v.scrollDirection).toBe('forward')
  scrollToFn.mockClear()

  v.resizeItem(0, 100)

  // Forward scroll: adjustment still fires.
  expect(scrollToFn).toHaveBeenCalled()
})

test('scroll-up jank: idle (scrollDirection=null) still applies adjustment', () => {
  // When not actively scrolling, adjustment still fires — needed for the
  // mount-time measurement storm where items measure before any scroll.
  const scrollToFn = vi.fn()
  const v = new Virtualizer({
    count: 10,
    estimateSize: () => 50,
    getScrollElement: () =>
      ({
        scrollTop: 100,
        scrollLeft: 0,
        scrollHeight: 500,
        clientHeight: 200,
        offsetHeight: 200,
      }) as any,
    scrollToFn,
    observeElementRect: () => {},
    observeElementOffset: (_inst, cb) => {
      cb(100, false) // not scrolling
      return () => {}
    },
  })
  v._willUpdate()
  v['getMeasurements']()
  expect(v.scrollDirection).toBeNull()
  scrollToFn.mockClear()

  v.resizeItem(0, 100)
  expect(scrollToFn).toHaveBeenCalled()
})

// ─── scroll direction vs. self-write read-backs ─────────────────────────────
//
// `applyScrollAdjustment` folds the pending adjustment into `scrollOffset`
// eagerly, so the browser's scroll event for our own `scrollTop` write
// arrives at exactly the offset we already hold (directly, or snapped there
// by the `pendingWrite` sub-pixel reconciliation). That equality
// carries no directional information — it must not be classified as a
// `'backward'` gesture, or the default
// `shouldAdjustScrollPositionOnItemSizeChange` skips above-viewport
// compensation for the whole `isScrollingResetDelay` window (see the
// multi-frame reflow test below).

function createAdjustmentVirtualizer({
  count = 30,
  offset,
  onChange,
}: {
  count?: number
  offset: number
  onChange?: (instance: any, sync: boolean) => void
}) {
  const scrollToFn = vi.fn()
  let scrollCb: ((o: number, s: boolean) => void) | null = null
  const v = new Virtualizer({
    count,
    estimateSize: () => 50,
    getScrollElement: () =>
      ({
        scrollTop: offset,
        scrollLeft: 0,
        scrollHeight: count * 50,
        clientHeight: 200,
        offsetHeight: 200,
      }) as any,
    scrollToFn,
    onChange,
    observeElementRect: (_inst: any, cb: any) => {
      cb({ width: 400, height: 200 })
      return () => {}
    },
    observeElementOffset: (_inst: any, cb: any) => {
      scrollCb = cb
      cb(offset, false)
      return () => {}
    },
  })
  v._didMount()
  v._willUpdate()
  v['getMeasurements']()
  scrollToFn.mockClear()
  return {
    v,
    scrollToFn,
    emitScroll: (o: number, isScrolling: boolean) => scrollCb!(o, isScrolling),
  }
}

test('self-write read-back of a positive adjustment does not latch a scroll direction', () => {
  const { v, scrollToFn, emitScroll } = createAdjustmentVirtualizer({
    offset: 600,
  })

  v['applyScrollAdjustment'](40)
  expect(scrollToFn).toHaveBeenCalledTimes(1)
  // The adjustment is already folded into `scrollOffset`.
  expect(v.scrollOffset).toBe(640)

  // Browser read-back of our own write: a scroll event at exactly the
  // offset we already hold.
  emitScroll(640, true)

  // The event traversed the listener (not swallowed by a no-op guard)...
  expect(v.isScrolling).toBe(true)
  // ...but an echo of our own write carries no direction information.
  expect(v.scrollDirection).toBeNull()
})

test('self-write read-back of a negative adjustment does not latch a scroll direction', () => {
  const { v, emitScroll } = createAdjustmentVirtualizer({ offset: 600 })

  v['applyScrollAdjustment'](-40)
  expect(v.scrollOffset).toBe(560)

  emitScroll(560, true)

  expect(v.isScrolling).toBe(true)
  expect(v.scrollDirection).toBeNull()
})

test('self-write read-back rounded by the browser still does not latch a direction', () => {
  const { v, emitScroll } = createAdjustmentVirtualizer({ offset: 600 })

  v['applyScrollAdjustment'](40.5)
  expect(v.scrollOffset).toBe(640.5)

  // The browser rounds the write to an integer; the `pendingWrite`
  // reconciliation snaps the read-back to the held value.
  emitScroll(640, true)

  expect(v.isScrolling).toBe(true)
  expect(v.scrollDirection).toBeNull()
  expect(v.scrollOffset).toBe(640.5)
})

describe('a scrollToFn that reports its write back synchronously', () => {
  // The read-back runs inside `applyScrollAdjustment`, before it folds the
  // delta into `scrollOffset`; the read-back has already put `scrollOffset`
  // at the target, so the delta must not be added a second time.
  const setup = (offset: number) => {
    const harness = createAdjustmentVirtualizer({ offset })
    harness.scrollToFn.mockImplementation(
      (to: number, { adjustments }: { adjustments?: number }) =>
        harness.emitScroll(to + (adjustments ?? 0), true),
    )
    return harness
  }

  test('a positive adjustment lands on its target once', () => {
    const { v, scrollToFn } = setup(600)
    v['applyScrollAdjustment'](40)
    expect(scrollToFn).toHaveBeenCalledTimes(1)
    expect(v.scrollOffset).toBe(640)
    expect(v['pendingWrite']).toBeNull()
  })

  test('a negative adjustment lands on its target once', () => {
    const { v } = setup(600)
    v['applyScrollAdjustment'](-40)
    expect(v.scrollOffset).toBe(560)
  })

  test('a read-back above the top is still clamped to 0', () => {
    const { v } = setup(20)
    v['applyScrollAdjustment'](-50)
    expect(v.scrollOffset).toBe(0)
  })
})

test('real scroll gestures still latch forward/backward and reset to null', () => {
  const { v, emitScroll } = createAdjustmentVirtualizer({ offset: 600 })

  emitScroll(650, true)
  expect(v.scrollDirection).toBe('forward')
  emitScroll(700, true)
  expect(v.scrollDirection).toBe('forward')

  emitScroll(620, true)
  expect(v.scrollDirection).toBe('backward')
  emitScroll(540, true)
  expect(v.scrollDirection).toBe('backward')

  // Debounced reset emission after the gesture ends.
  emitScroll(540, false)
  expect(v.scrollDirection).toBeNull()
  expect(v.isScrolling).toBe(false)
})

test('adjustment read-back during a real backward gesture preserves the direction', () => {
  const { v, emitScroll } = createAdjustmentVirtualizer({ offset: 600 })

  // Real backward gesture: the user is scrolling up.
  emitScroll(500, true)
  expect(v.scrollDirection).toBe('backward')

  // A compensation write lands mid-gesture; its read-back arrives at
  // exactly the held offset. The user is still scrolling up, so the
  // direction must survive, not be erased.
  v['applyScrollAdjustment'](30)
  expect(v.scrollOffset).toBe(530)
  emitScroll(530, true)

  expect(v.isScrolling).toBe(true)
  expect(v.scrollDirection).toBe('backward')

  // After the reset emission, a fresh adjustment read-back must yield
  // null — not a stale 'backward' from before the reset.
  emitScroll(530, false)
  expect(v.scrollDirection).toBeNull()

  v['applyScrollAdjustment'](30)
  expect(v.scrollOffset).toBe(560)
  emitScroll(560, true)
  expect(v.isScrolling).toBe(true)
  expect(v.scrollDirection).toBeNull()
})

test('multi-frame reflow: above-viewport re-measure compensation is never skipped by self-write read-backs', () => {
  // The end-to-end shape of the bug, with the DEFAULT
  // shouldAdjustScrollPositionOnItemSizeChange: a side pane opens and its
  // width animation re-wraps rows for several frames while the user sits
  // scrolled up. Each frame re-measures above-viewport rows; the browser
  // echoes the compensation write back as a scroll event before the next
  // frame's ResizeObserver callbacks (scroll fires before RO in the
  // rendering steps). If that echo latches 'backward', every later frame's
  // re-measure is skipped until the isScrollingResetDelay reset and the
  // viewport drifts.
  const { v, scrollToFn, emitScroll } = createAdjustmentVirtualizer({
    offset: 600,
  })

  // Pre-measure the rows we'll re-wrap so they're in itemSizeCache — the
  // backward-skip leg of the default predicate only applies to re-measures.
  for (let i = 0; i < 5; i++) {
    v.resizeItem(i, 55)
    v['getMeasurements']()
  }
  // 5 first measurements × +5 each were compensated and folded.
  expect(v.scrollOffset).toBe(625)
  // Settle: the browser caught up and the scrolling window expired.
  emitScroll(625, false)
  expect(v.isScrolling).toBe(false)
  expect(v.scrollDirection).toBeNull()
  scrollToFn.mockClear()

  // The reflow: 5 frames, each re-measures one above-viewport row +20px,
  // then the browser delivers the scroll event for the compensation write
  // the way it would between frames.
  for (let i = 0; i < 5; i++) {
    const before = v.scrollOffset!
    v.resizeItem(i, 75)
    v['getMeasurements']()
    if (v.scrollOffset! !== before) {
      // A compensation write happened — deliver its read-back.
      emitScroll(v.scrollOffset!, true)
    }
  }

  // Every frame's above-viewport delta must have been compensated:
  // 625 + 5 × 20 = 725. If the first frame's read-back latched 'backward',
  // frames 2-5 were skipped and the offset is stuck at 645.
  expect(scrollToFn).toHaveBeenCalledTimes(5)
  expect(v.scrollOffset).toBe(725)
})

test('above-viewport compensation notifies synchronously so the scroll write and transforms commit in one paint (#1227)', () => {
  // applyScrollAdjustment writes scrollTop synchronously inside the resize
  // (ResizeObserver) callback. If the follow-up notify were async, the
  // browser could paint one frame with the new scrollTop but the old item
  // transforms — the viewport visibly jumps by `delta` and snaps back. The
  // compensating resize must notify synchronously (sync=true) so the render
  // flushes in the same callback.
  const onChange = vi.fn()
  const { v, scrollToFn } = createAdjustmentVirtualizer({
    offset: 600,
    onChange,
  })
  v['getMeasurements']()
  onChange.mockClear()
  scrollToFn.mockClear()

  // Item 0 sits entirely above the fold (offset 600) — a first measurement
  // there compensates regardless of scroll direction, moving scrollTop.
  v.resizeItem(0, 90)

  // The compensation write happened...
  expect(scrollToFn).toHaveBeenCalledTimes(1)
  // ...and its notify was synchronous so transforms flush in this same frame.
  expect(onChange).toHaveBeenCalled()
  expect(onChange.mock.calls.at(-1)![1]).toBe(true)
})

test('a resize that moves no scroll position keeps the cheaper async notify (#1227)', () => {
  // No scroll write → no same-frame constraint → the notify stays async so we
  // don't force a synchronous render on every below-fold measurement.
  const onChange = vi.fn()
  const { v, scrollToFn } = createAdjustmentVirtualizer({
    offset: 0,
    onChange,
  })
  v['getMeasurements']()
  onChange.mockClear()
  scrollToFn.mockClear()

  // Item 10 (start 500) sits below the fold at offset 0 — measuring it does
  // not compensate, so scrollTop is untouched.
  v.resizeItem(10, 90)

  expect(scrollToFn).not.toHaveBeenCalled()
  expect(onChange).toHaveBeenCalled()
  expect(onChange.mock.calls.at(-1)![1]).toBe(false)
})

// ─── #1218: viewport-spanning item growth must not drift the viewport ─────────
// A streaming chat message whose top is scrolled above the fold but whose
// bottom extends below it grows at its bottom. That growth happens *below* the
// anchor point (the fold), so scrollTop must stay put. Only an item that is
// ENTIRELY above the fold should shift scrollTop on re-measure.
function makeAdjustmentVirtualizer(scrollTop: number) {
  const scrollToFn = vi.fn(elementScroll)
  let scrollCallback: ((offset: number, isScrolling: boolean) => void) | null =
    null
  const el = {
    scrollTop,
    scrollLeft: 0,
    scrollHeight: 100000,
    clientHeight: 200,
    offsetHeight: 200,
    scrollTo: vi.fn(({ top }: { top: number }) => {
      el.scrollTop = top
    }),
    addEventListener: () => {},
    removeEventListener: () => {},
  }
  const v = new Virtualizer<any, any>({
    count: 50,
    estimateSize: () => 50,
    getScrollElement: () => el as any,
    scrollToFn,
    observeElementRect: (_i, cb) => {
      cb({ width: 300, height: 200 })
    },
    observeElementOffset: (_i, cb) => {
      scrollCallback = cb
      cb(scrollTop, false) // settled, not scrolling
      return () => {}
    },
  })
  v._willUpdate()
  v['getMeasurements']()
  return { v, scrollToFn }
}

test('#1218: re-measuring a viewport-spanning item does not drift scroll', () => {
  // Viewport 175..375, items 50px by estimate. Item 3: start=150, end=200 —
  // spans the fold at 175.
  const { v, scrollToFn } = makeAdjustmentVirtualizer(175)
  v.resizeItem(3, 60) // seed the size cache (item still spans the fold)
  scrollToFn.mockClear()

  const before = v.scrollOffset
  v.resizeItem(3, 160) // stream: grow at the bottom by 100 (below the fold)

  expect(v.scrollOffset).toBe(before)
  expect(scrollToFn).not.toHaveBeenCalled()
})

test('#1218: re-measuring an entirely-above item still anchors (no regression)', () => {
  // Item 1: start=50, end=100 — fully above the fold at 175.
  const { v } = makeAdjustmentVirtualizer(175)
  v.resizeItem(1, 60)
  const before = v.scrollOffset!

  v.resizeItem(1, 160) // grows by 100 entirely above the fold

  // scrollTop shifts by the delta so content below the fold stays put.
  expect(v.scrollOffset).toBe(before + 100)
})

test('#1218: first measurement of a spanning item still compensates', () => {
  // First measurement (estimate→actual) always compensates an above-fold top,
  // regardless of spanning — the estimated block sat above the fold. Item 3
  // starts at 150 (above fold 175) and has never been measured.
  const { v } = makeAdjustmentVirtualizer(175)
  const before = v.scrollOffset!

  v.resizeItem(3, 120) // first measure: 50 -> 120, delta +70

  expect(v.scrollOffset).toBe(before + 70)
})
