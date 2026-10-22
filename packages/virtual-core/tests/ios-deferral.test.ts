import { expect, test, vi } from 'vitest'
import {
  Virtualizer,
  _resetIOSDetectionForTests,
  observeElementOffset,
  observeElementRect,
} from '../src/index'
import {
  withFakeIOSUserAgent,
  makeDeferralHarness,
  makeMockScrollElement,
} from './helpers'

// ─── iOS momentum-safe scroll adjustments ───────────────────────────────────

function makeIOSTouchVirtualizer(
  props: Record<string, any> = {},
  options: Record<string, any> = {},
) {
  const timers = new Map<number, () => void>()
  let timerId = 0
  const mockWindow = {
    setTimeout: (fn: () => void, _ms: number) => {
      const id = ++timerId
      timers.set(id, fn)
      return id
    },
    clearTimeout: (id: number) => timers.delete(id),
    requestAnimationFrame: () => 1,
    cancelAnimationFrame: () => {},
    performance: { now: () => Date.now() },
  }
  const el = makeMockScrollElement({
    scrollTop: 100,
    scrollLeft: 0,
    scrollHeight: 500,
    clientHeight: 200,
    offsetHeight: 200,
    ...props,
    ownerDocument: { defaultView: mockWindow },
  })
  const scrollToFn = vi.fn()
  let scrollCallback: ((offset: number, isScrolling: boolean) => void) | null =
    null
  const v = new Virtualizer({
    count: 10,
    estimateSize: () => 50,
    getScrollElement: () => el as any,
    scrollToFn,
    observeElementRect: () => {},
    observeElementOffset: (_inst, cb) => {
      scrollCallback = cb
      cb(el.scrollTop, false)
      return () => {}
    },
    ...options,
  })
  v._willUpdate()
  v['getMeasurements']()
  scrollToFn.mockClear()
  return {
    v,
    el,
    scrollToFn,
    // A scroll event; the element is where it reports.
    scroll: (offset: number, isScrolling: boolean) => {
      el.scrollTop = offset
      scrollCallback!(offset, isScrolling)
    },
    touch: (type: 'touchstart' | 'touchend' | 'touchcancel') =>
      el._dispatch(type),
    expireTouchTail: () => {
      const id =
        (v['_iosGesture'].touch as { timerId?: number } | null)?.timerId ?? null
      expect(id, 'a touch tail timer is armed').not.toBeNull()
      const fn = timers.get(id!)!
      fn()
    },
  }
}

test('iOS deferral: compensation is deferred during a touch-driven scroll and flushed once the gesture settles', () => {
  withFakeIOSUserAgent(() => {
    const { v, scrollToFn, scroll, touch, expireTouchTail } =
      makeIOSTouchVirtualizer()
    // Finger down, drag, release into momentum.
    touch('touchstart')
    scroll(120, true)
    touch('touchend')
    scroll(140, true) // momentum frame

    // Resize an item above the viewport mid-fling. The default predicate
    // (item.start < scrollOffset) would write scrollTop immediately, and on
    // iOS that cancels momentum (#884) — so it must defer.
    v.resizeItem(0, 100) // item 0 was at start=0; now 50→100 grows by 50
    expect(scrollToFn).not.toHaveBeenCalled()
    expect(v['_holdOffset']).toBe(50)

    // The tail armed by the last momentum frame expires: gesture settled.
    expireTouchTail()
    expect(scrollToFn).toHaveBeenCalledTimes(1)
    expect(v['_holdOffset']).toBe(0)
  })
})

test('iOS deferral: multiple resizes during a fling accumulate and flush as one', () => {
  withFakeIOSUserAgent(() => {
    const { v, scrollToFn, scroll, touch, expireTouchTail } =
      makeIOSTouchVirtualizer({ scrollTop: 200 })
    touch('touchstart')
    touch('touchend')
    scroll(200, true)

    // Three resizes during the fling: 10 + 15 + 20 = 45 total
    v.resizeItem(0, 60)
    v.resizeItem(1, 65)
    v.resizeItem(2, 70)

    expect(scrollToFn).not.toHaveBeenCalled()
    expect(v['_holdOffset']).toBe(45)

    expireTouchTail()
    // Single flush call
    expect(scrollToFn).toHaveBeenCalledTimes(1)
    expect(v['_holdOffset']).toBe(0)
  })
})

test('iOS deferral: scrollToIndex with no target keeps the held correction for the flush', () => {
  // A held correction is a shift between the layout and the element, not a
  // pending replay: `scrollOffset` already carries it. A command with no
  // target (an empty list) writes nothing and leaves it; the flush writes
  // the layout position once the list has refilled (cf. @phcorp's
  // differential run on #1316, which pinned the replay of the old model).
  withFakeIOSUserAgent(() => {
    const { v, scrollToFn, touch, expireTouchTail } = makeIOSTouchVirtualizer()

    touch('touchstart')
    v.resizeItem(0, 90) // above the fold under a finger: held
    expect(v['_holdOffset']).toBe(40)
    expect(v.scrollOffset).toBe(140)
    v.setOptions({ ...v.options, count: 0 })
    v['getMeasurements']() // the render for the empty list
    v.scrollToIndex(0) // no target, nothing to write
    expect(scrollToFn).not.toHaveBeenCalled()
    v.setOptions({ ...v.options, count: 10 })
    v['getMeasurements']()
    touch('touchend')
    expireTouchTail() // settles: the flush writes the layout position

    expect(scrollToFn).toHaveBeenCalledTimes(1)
    expect(scrollToFn.mock.calls[0]![0]).toBe(140)
    expect(v['_holdOffset']).toBe(0)
  })
})

test('iOS deferral: an absolute scroll command targets the layout and the hold moves the element short of it', () => {
  // (#1233 manifestation A in the old model: a deferred delta replayed on
  // top of a command's target.) A held correction is not dropped by a
  // command; the command's target is a layout offset, the element is
  // written the hold short of it under the shifted rows, and the flush
  // moves both to the target together once a write is possible.
  withFakeIOSUserAgent(() => {
    const { v, scrollToFn, scroll, touch, expireTouchTail } =
      makeIOSTouchVirtualizer({ scrollTop: 200 })
    touch('touchstart')
    scroll(190, true) // the finger drags: the user owns the scroll

    // Hold a correction during the drag.
    v.resizeItem(0, 100)
    expect(v['_holdOffset']).toBe(50)
    expect(v.scrollOffset).toBe(240)

    // The command writes the element 50 short of its layout target.
    v.scrollToOffset(300)
    expect(v['_holdOffset']).toBe(50)
    expect(scrollToFn.mock.calls.at(-1)![0]).toBe(250)

    v.resizeItem(1, 100) // held too (finger still down)
    expect(v['_holdOffset']).toBe(100)
    v.scrollToIndex(5)
    expect(scrollToFn.mock.calls.at(-1)![0]).toBe(250 - 100 + 50)
    scrollToFn.mockClear()

    // The finger lifts and the writes it ignored have no read-back, so the
    // last command still owns the target: the flush writes it (300, which
    // the command wrote 100 short of), not the pre-command offset (290).
    touch('touchend')
    expireTouchTail()
    expect(scrollToFn).toHaveBeenCalledTimes(1)
    expect(scrollToFn.mock.calls[0]![0]).toBe(300)
    expect(v['_holdOffset']).toBe(0)
    scroll(scrollToFn.mock.calls[0]![0], false)
    expect(v['_holdOffset']).toBe(0)
  })
})

test('iOS deferral: a resize during an in-flight scrollToIndex is not replayed after it lands', () => {
  // reconcileScroll retargets the index scroll from fresh measurements, so a
  // size correction deferred while it travels is already accounted for —
  // replaying it on the settle flush would push the list past the target.
  withFakeIOSUserAgent(() => {
    const rafCallbacks: Array<FrameRequestCallback> = []
    const mockWindow = {
      requestAnimationFrame: (cb: FrameRequestCallback) =>
        rafCallbacks.push(cb),
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
    let scrollCallback:
      | ((offset: number, isScrolling: boolean) => void)
      | null = null
    const v = new Virtualizer({
      count: 100,
      estimateSize: () => 50,
      getScrollElement: () => el as any,
      scrollToFn: (offset, { adjustments = 0 }) => {
        el.scrollTop = offset + adjustments
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
    })
    v._willUpdate()
    v['getMeasurements']()
    const flushFrames = () => {
      for (let i = 0; i < 10 && rafCallbacks.length > 0; i++) {
        rafCallbacks.splice(0).forEach((cb) => cb(0))
        scrollCallback!(el.scrollTop, true)
      }
    }

    v.scrollToIndex(20, { align: 'start' })
    scrollCallback!(el.scrollTop, true)
    expect(el.scrollTop).toBe(1000)

    // An item above the target measures 50px taller while the index scroll
    // is still settling.
    // No render runs in between (onChange is not set), so reconcile must
    // pick the resize up itself.
    v.resizeItem(10, 100)
    flushFrames()
    expect(el.scrollTop).toBe(1050)

    // The scroll settles: the landing must stay on the item.
    scrollCallback!(el.scrollTop, false)
    expect(el.scrollTop).toBe(v.getOffsetForIndex(20, 'start')![0])
    expect(el.scrollTop).toBe(1050)
  })
})

test('iOS deferral: a held correction is in scrollOffset, so back-to-back resizes stay consistent', () => {
  // (In the old model the flush wrote `adjustments: delta` and had to roll
  // it into `scrollAdjustments` for a resize landing before the read-back.)
  // A held correction is folded into `scrollOffset` at once, like a written
  // one, so the flush writes the plain layout position and a resize before
  // its read-back compares against the right offset.
  withFakeIOSUserAgent(() => {
    const { v, scrollToFn, scroll, touch, expireTouchTail } =
      makeIOSTouchVirtualizer({ scrollTop: 200 })
    touch('touchstart')
    touch('touchend')
    scroll(200, true)

    v.resizeItem(0, 100)
    expect(v['_holdOffset']).toBe(50)
    expect(v.scrollOffset).toBe(250)
    expect(v['scrollAdjustments']).toBe(0)

    expireTouchTail()

    expect(scrollToFn).toHaveBeenCalledTimes(1)
    const [offset, opts] = scrollToFn.mock.calls[0]!
    expect(offset).toBe(250)
    expect(opts.adjustments).toBeUndefined()
    expect(v['scrollAdjustments']).toBe(0)
    expect(v.scrollOffset).toBe(250)

    // Row 1 (layout 100..150, above the fold at 250) grows before the
    // read-back: compensated from the flushed offset.
    v.resizeItem(1, 80)
    expect(
      scrollToFn.mock.calls.at(-1)![0] +
        (scrollToFn.mock.calls.at(-1)![1].adjustments ?? 0),
    ).toBe(280)
    expect(v.scrollOffset).toBe(280)
  })
})

test('iOS deferral: a write before the flush is read back carries no adjustment', () => {
  // (Found by @phcorp's mutation run on #1316 in the old model, where the
  // flush's delta lived in `scrollAdjustments` until its read-back.) The
  // flush writes a plain offset, so nothing is pending afterwards.
  withFakeIOSUserAgent(() => {
    const { v, scroll, touch, expireTouchTail } = makeIOSTouchVirtualizer()

    touch('touchstart')
    v.resizeItem(0, 100) // held under the finger
    touch('touchend')
    expireTouchTail() // settles: the flush writes 150
    expect(v.scrollAdjustments).toBe(0)
    expect(v.scrollOffset).toBe(150)

    v.scrollToOffset(150) // a write with no adjustments of its own
    expect(v.scrollAdjustments).toBe(0)

    scroll(150, false) // its read-back
    expect(v.scrollAdjustments).toBe(0)
    expect(v.scrollOffset).toBe(150)
  })
})

test('iOS deferral: a shrink above the viewport at the end is held, and the sizer does not shrink under the element', () => {
  // (#1233 manifestation B in the old model: the sizer shrank under the
  // element, the browser clamped scrollTop onto the new bottom, and the
  // deferred negative delta had to be dropped at the flush.) With the
  // correction held, the exposed total stays what it was, so the element is
  // not clamped; the flush writes the layout position, 20 up, which is the
  // same rows under the viewport.
  withFakeIOSUserAgent(() => {
    const { v, scrollToFn, scroll, touch, expireTouchTail } =
      makeIOSTouchVirtualizer(
        { scrollTop: 300 }, // pinned at the bottom: scrollHeight - clientHeight
        { anchorTo: 'end' },
      )
    touch('touchstart')
    touch('touchend')
    scroll(300, true) // at the bottom, flinging
    const totalBefore = v.getTotalSize()

    // A row above the viewport re-measures smaller while at the end.
    v.resizeItem(0, 30) // 50 → 30: total shrinks by 20
    expect(scrollToFn).not.toHaveBeenCalled()
    expect(v['_holdOffset']).toBe(-20)
    expect(v.scrollOffset).toBe(280)
    expect(v.getTotalSize()).toBe(totalBefore)

    expireTouchTail()
    expect(v['_holdOffset']).toBe(0)
    expect(scrollToFn).toHaveBeenCalledTimes(1)
    expect(scrollToFn.mock.calls[0]![0]).toBe(280)
    expect(v.getTotalSize()).toBe(totalBefore - 20)
  })
})

test('iOS deferral: a positive delta at the end clamp still replays (growth above does not clamp)', () => {
  // Complement to manifestation B: content GROWING above the viewport does
  // not clamp (the browser cannot shrink to fit growth), and the consumer's
  // DOM sizer may not have grown yet, so a positive deferred delta must still
  // flush — the end-clamp drop is negative-only.
  withFakeIOSUserAgent(() => {
    const { v, scrollToFn, scroll, touch, expireTouchTail } =
      makeIOSTouchVirtualizer({ scrollTop: 300 }, { anchorTo: 'end' })
    touch('touchstart')
    touch('touchend')
    scroll(300, true)

    // A row above the viewport re-measures larger while at the end.
    v.resizeItem(0, 70) // 50 → 70: total grows by 20
    expect(scrollToFn).not.toHaveBeenCalled()
    expect(v['_holdOffset']).toBe(20)

    // Settle. Growth doesn't clamp, so the positive delta must replay.
    expireTouchTail()
    expect(v['_holdOffset']).toBe(0)
    expect(scrollToFn).toHaveBeenCalledTimes(1)
  })
})

// ─── #1307: orderings the hold has to get right, and ones to keep ───────────
//
// Each case asserts what the user sees (row positions, the element) through
// one ordering of touches, scroll events, resizes and commands; the plain
// tests pin behaviour a redesign must not change by accident. 100 rows ×
// 50px, 200px viewport, hand-driven rAF and scroll events.

// scrollToIndex(20) has landed on 1000 and reconcile has seen it once; row 10
// (above the target) then grows by 50 and reconcile has not run since.
function landedIndexScrollWithResizeAbove(ios = true) {
  const h = makeDeferralHarness({ ios })
  h.run(() => {
    h.v.scrollToIndex(20, { align: 'start' })
    h.scroll(true)
    h.frame()
    h.v.resizeItem(10, 100)
  })
  return h
}

test('iOS deferral (#1307): scrollToOffset, then a prepend during a tap tail moves the target with the held delta', () => {
  // The options change finds the tail open and holds the prepend. The
  // target used to stay 2000 while the flush wrote 2600, so reconcile ran
  // until the safety valve.
  const h = makeDeferralHarness()
  h.run(() => {
    h.v.setOptions({ ...h.v.options, anchorTo: 'end', getItemKey: (i) => i })
    h.v._willUpdate()
    h.v.scrollToOffset(2000)
    h.scroll(true)
  })
  h.touch('touchstart')
  h.touch('touchend')
  h.run(() => {
    h.v.setOptions({ ...h.v.options, count: 112, getItemKey: (i) => i - 12 })
    h.v._willUpdate()
  })
  expect(h.el.scrollTop).toBe(2000)
  h.expireTail()
  expect(h.el.scrollTop).toBe(2600)
  h.run(() => {
    h.scroll(true)
    for (let i = 0; i < 5; i++) h.frame()
    h.scroll(false)
  })

  expect(h.el.scrollTop).toBe(2600)
  expect(h.v.scrollState).toBeNull()
})

test('iOS deferral (#1307): a gesture before the index scroll retargets keeps the resize correction', () => {
  const h = landedIndexScrollWithResizeAbove()
  h.touch('touchstart')
  h.run(() => {
    h.scroll(true, h.el.scrollTop + 10)
    h.frame()
  })
  h.touch('touchend')
  h.run(() => h.scroll(false))
  h.expireTail()
  // The user dragged 10px, so row 20 belongs 10px above the viewport top.
  expect(h.rowTop(20)).toBe(-10)
})

test('non-iOS: a gesture before the index scroll retargets keeps the resize correction', () => {
  const h = landedIndexScrollWithResizeAbove(false)
  h.scroll(true, h.el.scrollTop + 10)
  h.frame()
  h.scroll(false)
  expect(h.rowTop(20)).toBe(-10)
})

test('iOS deferral (#1307): cancelScroll before the index scroll retargets keeps the resize correction', () => {
  const h = landedIndexScrollWithResizeAbove()
  h.run(() => {
    h.v.cancelScroll()
    h.frame()
    h.scroll(false)
    expect(h.rowTop(20)).toBe(0)
  })
})

test('iOS deferral (#1307): the reconcile safety valve keeps the resize correction', () => {
  const h = landedIndexScrollWithResizeAbove()
  h.run(() => {
    h.advance(6000)
    h.frame()
    h.scroll(false)
    expect(h.rowTop(20)).toBe(0)
  })
})

test('iOS deferral (#1307): scrollBy replacing an index scroll keeps the resize correction', () => {
  const h = landedIndexScrollWithResizeAbove()
  h.run(() => {
    h.v.scrollBy(100)
    h.scroll(true)
    h.frame()
    h.scroll(true)
    h.frame()
    h.scroll(false)
    expect(h.rowTop(20)).toBe(-100)
  })
})

// The reverse flick. Written against the old deferral (#1306), this asserted
// `rowTop(20) === 0` after the flush: the rows were rendered in layout
// coordinates through the deferral, so the write at the end (+50) moved the
// screen, and the fix was to skip it once the fling had carried the viewport
// above row 30 (#1307, step 4). The hold (#1319) changes what the user sees:
// from the resize on, the rows are exposed shifted back by the held delta, the
// fling runs over that layout, and the flush moves the element and the rows
// together, so the row at the top of the viewport when the fling ends is
// still there after the flush. Skipping the correction would move the screen
// by the 50px instead, and the final position would differ from non-iOS,
// where the same gesture over the same content ends at 1050. The assertion
// is now on the screen and on that parity; `rowTop(20)` is -50 on both.
test('iOS deferral (#1307): the flush after a reverse flick moves nothing on screen and lands where non-iOS does', () => {
  // The screen: the first rendered row and where the viewport cuts it.
  const screen = (h: ReturnType<typeof makeDeferralHarness>) => {
    const first = h.v.getVirtualItems()[0]!
    return { index: first.index, top: first.start - h.el.scrollTop }
  }

  const h = makeDeferralHarness({ start: 2000 })
  h.touch('touchstart')
  h.run(() => {
    h.scroll(true, 2010)
    h.v.resizeItem(30, 100)
  })
  h.touch('touchend')
  // The fling carries the viewport above row 30, then settles.
  h.run(() => {
    h.scroll(true, 1000)
    h.scroll(false)
  })
  const before = screen(h)
  h.expireTail()
  expect(screen(h)).toEqual(before)
  expect(h.el.scrollTop).toBe(1050)

  // Non-iOS: the correction is written at once and the same gesture (1010px
  // of content) lands at the same place.
  const web = makeDeferralHarness({ ios: false, start: 2000 })
  web.scroll(true, 2010)
  web.v.resizeItem(30, 100)
  expect(web.el.scrollTop).toBe(2060)
  web.scroll(true, 2060 - 1010)
  web.scroll(false)
  expect(web.el.scrollTop).toBe(1050)
  expect(screen(web)).toEqual(screen(h))
  expect(h.rowTop(20)).toBe(web.rowTop(20))
})

test('scrollToIndex (#1307): a resize classified against the stale offset does not overwrite the index scroll', () => {
  // Not iOS-specific. scrollOffset still holds the old position until the
  // scroll event, so row 38 (below the target) reads as above the viewport;
  // resizes before the read-back are left to reconcile.
  const h = makeDeferralHarness({ ios: false, start: 2000 })
  h.v.scrollToIndex(10, { align: 'start' })
  expect(h.el.scrollTop).toBe(500)
  h.v.resizeItem(38, 100)
  h.scroll(true)
  h.frame()
  expect(h.el.scrollTop).toBe(500)
})

test('scrollToIndex (#1307): a drag that never reached the target is not pulled back when the target moves', () => {
  // Seen in iOS Safari: a scrollToIndex issued while a finger is dragging is
  // ignored by the browser, so the offset never gets near the target.
  const h = makeDeferralHarness()
  h.run(() => {
    h.v.scrollToIndex(50, { align: 'start' })
    h.scroll(true, 20)
    h.frame()
    h.scroll(true, 60)
    h.frame()
    // A row measures and moves the target; the user is still at 60.
    h.v.resizeItem(30, 100)
    h.frame()
    expect(h.el.scrollTop).toBe(60)
  })
})

test('scrollToIndex (#1307): a scroll away from a target that moved before landing is not pulled back, non-iOS', () => {
  // Not specific to iOS ignoring writes under a finger: a target that moves
  // before reconcile sees the scroll land leaves the state alive too.
  const h = makeDeferralHarness({ ios: false })
  h.v.scrollToIndex(50, { align: 'start' })
  h.scroll(true)
  h.v.resizeItem(10, 100)
  h.frame()
  h.scroll(true)
  expect(h.el.scrollTop).toBe(2550)
  // The user scrolls away, then a row above them measures.
  h.scroll(true, 1000)
  h.frame()
  h.v.resizeItem(5, 100)
  h.frame()
  expect(h.el.scrollTop).toBe(1050)
})

test('iOS deferral: a deferred correction follows the viewport through momentum', () => {
  const h = makeDeferralHarness({ start: 1000 })
  h.touch('touchstart')
  h.run(() => {
    h.scroll(true, 1010)
    h.v.resizeItem(5, 100)
  })
  h.touch('touchend')
  h.run(() => {
    h.scroll(true, 3000) // momentum
    h.scroll(false)
  })
  h.expireTail()
  // Applied where the momentum ended, not where the resize was seen.
  expect(h.el.scrollTop).toBe(3050)
  expect(h.rowTop(60)).toBe(0)
})

test('iOS deferral: a re-measure above the viewport is deferred scrolling forward, skipped scrolling backward', () => {
  const h = makeDeferralHarness({ start: 2000 })
  h.run(() => {
    h.v.resizeItem(5, 60)
    h.scroll(false)
    h.el._dispatch('touchstart')
    h.scroll(true, 1990)
    h.v.resizeItem(5, 100)
    expect(h.v['_holdOffset']).toBe(0)
    h.scroll(true, 2020)
    h.v.resizeItem(5, 120)
    expect(h.v['_holdOffset']).toBe(20)
  })
})

test('iOS deferral: a custom adjust predicate that opts out defers nothing', () => {
  const h = makeDeferralHarness({ start: 2000 })
  h.run(() => {
    h.v.shouldAdjustScrollPositionOnItemSizeChange = () => false
    h.el._dispatch('touchstart')
    h.scroll(true, 2010)
    h.v.resizeItem(5, 100)
    expect(h.v['_holdOffset']).toBe(0)
  })
})

test('iOS deferral: the first measure of the row spanning the viewport top is compensated', () => {
  const h = makeDeferralHarness({ start: 2000 })
  h.touch('touchstart')
  h.run(() => {
    h.scroll(true, 2010)
    expect(h.rowTop(41)).toBe(40)
    // Row 40 starts at 2000, 10px above the viewport top.
    h.v.resizeItem(40, 100)
    expect(h.v['_holdOffset']).toBe(50)
  })
  h.touch('touchend')
  h.run(() => h.scroll(false))
  h.expireTail()
  expect(h.rowTop(41)).toBe(40)
})

// ─── Phase 1: touch event distinction ────────────────────────────────────────

function makeIOSVirtualizerWithRealEl(
  scrollToFn: ReturnType<typeof vi.fn>,
  mockWindow: any,
) {
  const el = makeMockScrollElement({
    scrollTop: 100,
    scrollLeft: 0,
    scrollHeight: 500,
    clientHeight: 200,
    offsetHeight: 200,
    ownerDocument: { defaultView: mockWindow },
  })
  const v = new Virtualizer({
    count: 10,
    estimateSize: () => 50,
    getScrollElement: () => el as any,
    scrollToFn,
    observeElementRect: () => {},
    observeElementOffset: (_inst, cb) => {
      cb(100, false)
      return () => {}
    },
  })
  v._willUpdate()
  v['getMeasurements']()
  return { v, el }
}

function dispatchTouchEvent(
  el: any,
  type: 'touchstart' | 'touchend' | 'touchcancel',
) {
  el._dispatch(type)
}

test('iOS Phase 1: touchstart enters the `down` phase and ends a prior tail', () => {
  withFakeIOSUserAgent(() => {
    const mockWindow = {
      setTimeout: globalThis.setTimeout.bind(globalThis),
      clearTimeout: globalThis.clearTimeout.bind(globalThis),
    }
    const { v, el } = makeIOSVirtualizerWithRealEl(vi.fn(), mockWindow)
    dispatchTouchEvent(el, 'touchstart')
    dispatchTouchEvent(el, 'touchend') // leaves a tail armed
    expect(v['_iosGesture'].touch?.phase).toBe('tail')
    dispatchTouchEvent(el, 'touchstart')
    expect(v['_iosGesture'].touch).toEqual({ phase: 'down', moved: false })
  })
})

test('iOS Phase 1: touchcancel clears touching the same as touchend, and cleanup removes the listener', () => {
  withFakeIOSUserAgent(() => {
    let timerId = 0
    const timers = new Map<number, () => void>()
    const mockWindow = {
      setTimeout: (fn: () => void, _ms: number) => {
        const id = ++timerId
        timers.set(id, fn)
        return id
      },
      clearTimeout: (id: number) => timers.delete(id),
    }
    const { v, el } = makeIOSVirtualizerWithRealEl(vi.fn(), mockWindow)
    expect(el._hasListener('touchcancel')).toBe(true)

    dispatchTouchEvent(el, 'touchstart')
    expect(v['_iosGesture'].touch).toEqual({ phase: 'down', moved: false })
    dispatchTouchEvent(el, 'touchcancel')
    expect(v['_iosGesture'].touch?.phase).toBe('tail')

    const unmount = v._didMount()
    unmount()
    expect(el._hasListener('touchcancel')).toBe(false)
    expect(el._hasListener('touchend')).toBe(false)
    expect(el._hasListener('touchstart')).toBe(false)
  })
})

test('iOS Phase 1: touchend sets justTouchEnded + starts grace timer, then expires', async () => {
  await withFakeIOSUserAgent(async () => {
    let timerId = 0
    const timers = new Map<number, () => void>()
    const mockWindow = {
      setTimeout: (fn: () => void, _ms: number) => {
        const id = ++timerId
        timers.set(id, fn)
        return id
      },
      clearTimeout: (id: number) => timers.delete(id),
    }
    const { v, el } = makeIOSVirtualizerWithRealEl(vi.fn(), mockWindow)
    dispatchTouchEvent(el, 'touchstart')
    dispatchTouchEvent(el, 'touchend')
    const touch = v['_iosGesture'].touch
    expect(touch?.phase).toBe('tail')

    // Fire the timer manually (simulating 150ms elapsing).
    const fn = timers.get((touch as { timerId: number }).timerId)!
    fn()
    expect(v['_iosGesture'].touch).toBeNull()
  })
})

test('iOS Phase 1: resize during active touch defers (no scrollTop write)', () => {
  withFakeIOSUserAgent(() => {
    const scrollToFn = vi.fn()
    const mockWindow = {
      setTimeout: globalThis.setTimeout.bind(globalThis),
      clearTimeout: globalThis.clearTimeout.bind(globalThis),
    }
    const { v, el } = makeIOSVirtualizerWithRealEl(scrollToFn, mockWindow)
    // Bring scroll state to a typical "user touched the screen" pose.
    dispatchTouchEvent(el, 'touchstart')
    scrollToFn.mockClear()

    // Above-viewport item resizes mid-drag. Must defer.
    v.resizeItem(0, 100)
    expect(scrollToFn).not.toHaveBeenCalled()
    expect(v['_holdOffset']).toBe(50)
  })
})

test('iOS Phase 1: resize in post-touchend grace window defers; flushes when timer fires', () => {
  withFakeIOSUserAgent(() => {
    const scrollToFn = vi.fn()
    let timerId = 0
    const timers = new Map<number, () => void>()
    const mockWindow = {
      setTimeout: (fn: () => void, _ms: number) => {
        const id = ++timerId
        timers.set(id, fn)
        return id
      },
      clearTimeout: (id: number) => timers.delete(id),
    }
    const { v, el } = makeIOSVirtualizerWithRealEl(scrollToFn, mockWindow)
    dispatchTouchEvent(el, 'touchstart')
    dispatchTouchEvent(el, 'touchend')
    const touch = v['_iosGesture'].touch
    expect(touch?.phase).toBe('tail')
    scrollToFn.mockClear()

    // Items measure during the grace window — must defer
    v.resizeItem(0, 100)
    v.resizeItem(1, 65)
    expect(scrollToFn).not.toHaveBeenCalled()
    expect(v['_holdOffset']).toBe(50 + 15)

    // Expire the grace timer; the timer callback flushes the accumulated delta.
    const fn = timers.get((touch as { timerId: number }).timerId)!
    fn()
    expect(v['_iosGesture'].touch).toBeNull()
    expect(scrollToFn).toHaveBeenCalledTimes(1)
    expect(v['_holdOffset']).toBe(0)
  })
})

test('iOS Phase 1: momentum scroll events re-arm the post-touchend tail until the fling ends', () => {
  withFakeIOSUserAgent(() => {
    const { v, scrollToFn, scroll, touch, expireTouchTail } =
      makeIOSTouchVirtualizer()
    touch('touchstart')
    touch('touchend')
    const firstTimer =
      (v['_iosGesture'].touch as { timerId?: number } | null)?.timerId ?? null
    expect(firstTimer).not.toBeNull()

    // iOS fires no touch events during momentum, only scroll events. Each
    // one must push the tail out — otherwise it would expire 150 ms into a
    // fling that lasts a second or more, and the next resize would write
    // scrollTop and kill the momentum (#884).
    scroll(120, true)
    expect(v['_iosGesture'].touch?.phase).toBe('tail')
    expect(
      (v['_iosGesture'].touch as { timerId?: number } | null)?.timerId ?? null,
    ).not.toBe(firstTimer)

    v.resizeItem(0, 100)
    expect(scrollToFn).not.toHaveBeenCalled()
    expect(v['_holdOffset']).toBe(50)

    scroll(140, true) // still flinging: re-armed again, still deferred
    expect(v['_iosGesture'].touch?.phase).toBe('tail')
    expect(scrollToFn).not.toHaveBeenCalled()

    // 150 ms after the last frame the tail expires and the delta flushes.
    expireTouchTail()
    expect(v['_iosGesture'].touch?.phase).not.toBe('tail')
    expect(
      (v['_iosGesture'].touch as { timerId?: number } | null)?.timerId ?? null,
    ).toBeNull()
    expect(scrollToFn).toHaveBeenCalledTimes(1)
    expect(v['_holdOffset']).toBe(0)
  })
})

// The first frame of a fling can come 150–250ms after touchend when the main
// thread is busy (27.0 simulator, #1307): after the tail has closed.
function dragThenLateFling({ ios27 = false } = {}) {
  const h = makeDeferralHarness({ start: 2000, ios27 })
  h.touch('touchstart')
  h.run(() => h.scroll(true, 1990))
  h.touch('touchend')
  h.advance(150)
  h.expireTail() // no momentum frame yet
  h.writes.length = 0
  return h
}

test('iOS: a fling whose first frame comes after the tail closed reopens it', () => {
  const h = dragThenLateFling()
  h.advance(100)
  h.run(() => {
    h.scroll(true, 1960)
    h.v.resizeItem(5, 100)
  })
  // Held: a write would stop the fling (26) or be overridden (27).
  expect(h.writes).toEqual([])
  h.run(() => {
    h.scroll(true, 1900)
    h.scroll(false)
  })
  h.expireTail()
  expect(h.writes).toEqual([1950])
})

test('iOS 27: a command mid-fling waits when the first frame came late', () => {
  const h = dragThenLateFling({ ios27: true })
  h.advance(100)
  h.run(() => {
    h.scroll(true, 1960)
    h.v.scrollToIndex(90, { align: 'start' })
  })
  expect(h.writes).toEqual([])
  expect(h.v.scrollState?.phase).toBe('queued')
})

test('iOS: a scroll event over 1s after the tail closed does not reopen it', () => {
  const h = dragThenLateFling()
  h.advance(1100)
  h.run(() => {
    h.scroll(true, 1960)
    h.v.resizeItem(5, 100)
  })
  expect(h.writes).toEqual([2010])
})

test('iOS: after a fling that reported in time, a later scroll event opens no tail', () => {
  const h = makeDeferralHarness({ start: 2000 })
  h.touch('touchstart')
  h.run(() => h.scroll(true, 1990))
  h.touch('touchend')
  h.run(() => {
    h.scroll(true, 1900)
    h.scroll(false)
  })
  h.expireTail()
  h.writes.length = 0
  // Say the app scrolls the element itself.
  h.advance(100)
  h.run(() => {
    h.scroll(true, 1800)
    h.v.resizeItem(5, 100)
  })
  expect(h.writes).toEqual([1850])
})

test('iOS: a tap opens no late-fling window', () => {
  const h = makeDeferralHarness({ start: 2000 })
  h.touch('touchstart')
  h.touch('touchend')
  h.expireTail()
  h.writes.length = 0
  h.advance(100)
  h.run(() => {
    h.scroll(true, 1960)
    h.v.resizeItem(5, 100)
  })
  expect(h.writes).toEqual([2010])
})

test('iOS Phase 1: new touchstart during grace window cancels pending flush timer', () => {
  withFakeIOSUserAgent(() => {
    const scrollToFn = vi.fn()
    let timerId = 0
    const timers = new Map<number, () => void>()
    const mockWindow = {
      setTimeout: (fn: () => void, _ms: number) => {
        const id = ++timerId
        timers.set(id, fn)
        return id
      },
      clearTimeout: (id: number) => timers.delete(id),
    }
    const { v, el } = makeIOSVirtualizerWithRealEl(scrollToFn, mockWindow)
    dispatchTouchEvent(el, 'touchstart')
    dispatchTouchEvent(el, 'touchend')
    const firstTimerId = (v['_iosGesture'].touch as { timerId: number }).timerId
    expect(timers.has(firstTimerId)).toBe(true)

    // User puts finger back down before grace window expired.
    dispatchTouchEvent(el, 'touchstart')
    // The pending timer must have been canceled.
    expect(timers.has(firstTimerId)).toBe(false)
    expect(v['_iosGesture'].touch).toEqual({ phase: 'down', moved: false })
  })
})

// Helper for the element-swap tests below: like makeIOSVirtualizerWithRealEl
// but getScrollElement reads a mutable holder, so tests can swap the scroll
// element and re-run _willUpdate (which triggers cleanup + re-attach).
function makeIOSVirtualizerWithSwappableEl(
  scrollToFn: ReturnType<typeof vi.fn>,
  mockWindow: any,
  { startScrolling = false }: { startScrolling?: boolean } = {},
) {
  const makeEl = () =>
    makeMockScrollElement({
      scrollTop: 100,
      scrollLeft: 0,
      scrollHeight: 500,
      clientHeight: 200,
      offsetHeight: 200,
      ownerDocument: { defaultView: mockWindow },
    })
  const holder = { el: makeEl() }
  let scrollCallback: ((offset: number, isScrolling: boolean) => void) | null =
    null
  const v = new Virtualizer({
    count: 10,
    estimateSize: () => 50,
    getScrollElement: () => holder.el as any,
    scrollToFn,
    observeElementRect: () => {},
    observeElementOffset: (_inst, cb) => {
      scrollCallback = cb
      cb(100, startScrolling)
      return () => {}
    },
  })
  v._willUpdate()
  v['getMeasurements']()
  return {
    v,
    holder,
    makeEl,
    getScrollCallback: () => scrollCallback!,
  }
}

test('iOS Phase 1: scroll-element swap does not replay a stale deferred adjustment', () => {
  withFakeIOSUserAgent(() => {
    const scrollToFn = vi.fn()
    const mockWindow = {
      setTimeout: globalThis.setTimeout.bind(globalThis),
      clearTimeout: globalThis.clearTimeout.bind(globalThis),
    }
    const { v, holder, makeEl, getScrollCallback } =
      makeIOSVirtualizerWithSwappableEl(scrollToFn, mockWindow)
    scrollToFn.mockClear()

    // A resize above the viewport during an active touch defers its
    // adjustment instead of writing scrollTop.
    dispatchTouchEvent(holder.el, 'touchstart')
    v.resizeItem(0, 100)
    expect(scrollToFn).not.toHaveBeenCalled()
    expect(v['_holdOffset']).toBe(50)

    // The scroll element is swapped while the deferral is pending — the
    // delta was computed against the old element's content and must not
    // survive into the new element.
    holder.el = makeEl()
    v._willUpdate()
    expect(v['_holdOffset']).toBe(0)

    // The new element's first quiescence must not write the stale delta.
    scrollToFn.mockClear()
    getScrollCallback()(100, false)
    expect(scrollToFn).not.toHaveBeenCalled()
  })
})

test('iOS Phase 1: scroll-element swap mid-touch does not strand the `down` phase', () => {
  withFakeIOSUserAgent(() => {
    const mockWindow = {
      setTimeout: globalThis.setTimeout.bind(globalThis),
      clearTimeout: globalThis.clearTimeout.bind(globalThis),
    }
    const { v, holder, makeEl } = makeIOSVirtualizerWithSwappableEl(
      vi.fn(),
      mockWindow,
    )
    dispatchTouchEvent(holder.el, 'touchstart')
    expect(v['_iosGesture'].touch).toEqual({ phase: 'down', moved: false })

    // The in-flight touch keeps targeting the old element (implicit touch
    // capture), so the new element will never deliver its touchend. Without
    // a reset, every adjustment on the new element would be deferred and
    // the flush blocked until the user's next full touch cycle.
    holder.el = makeEl()
    v._willUpdate()
    expect(v['_iosGesture'].touch).toBeNull()
  })
})

test('iOS Phase 1: scroll-element swap during grace window does not strand the tail', () => {
  withFakeIOSUserAgent(() => {
    let timerId = 0
    const timers = new Map<number, () => void>()
    const mockWindow = {
      setTimeout: (fn: () => void, _ms: number) => {
        const id = ++timerId
        timers.set(id, fn)
        return id
      },
      clearTimeout: (id: number) => timers.delete(id),
    }
    const { v, holder, makeEl } = makeIOSVirtualizerWithSwappableEl(
      vi.fn(),
      mockWindow,
    )
    dispatchTouchEvent(holder.el, 'touchstart')
    dispatchTouchEvent(holder.el, 'touchend')
    expect(v['_iosGesture'].touch?.phase).toBe('tail')

    // Swapping inside the grace window removes the listeners and clears the
    // grace timer — which was the only pending reset of the record. Without
    // the cleanup reset the tail would stay set indefinitely.
    holder.el = makeEl()
    v._willUpdate()
    expect(v['_iosGesture'].touch).toBeNull()
    expect(timers.size).toBe(0)
  })
})

// ─── Phase 2a: subpixel scrollTop reconciliation ─────────────────────────────

test('Phase 2a: browser-rounded scrollTop after self-write is reconciled to intended value', () => {
  let scrollCallback: ((o: number, s: boolean) => void) | null = null
  const v = new Virtualizer({
    count: 10,
    estimateSize: () => 50,
    getScrollElement: () =>
      ({
        scrollTop: 0,
        scrollLeft: 0,
        scrollHeight: 500,
        clientHeight: 200,
        offsetHeight: 200,
        scrollTo: vi.fn(),
      }) as any,
    scrollToFn: vi.fn(),
    observeElementRect: () => {},
    observeElementOffset: (_inst, cb) => {
      scrollCallback = cb
      cb(0, false)
      return () => {}
    },
  })
  v._willUpdate()

  // Simulate a self-write to 123.5 (subpixel target).
  v.scrollToOffset(123.5, { behavior: 'auto' })
  expect(v['pendingWrite']?.target ?? null).toBe(123.5)

  // Browser fires a scroll event reporting 123 (integer-rounded).
  scrollCallback!(123, false)

  // We should have reconciled the offset back to the intended 123.5,
  // not stored the browser's rounded 123.
  expect(v.scrollOffset).toBe(123.5)
  expect(v['pendingWrite']?.target ?? null).toBeNull()
})

test('Phase 2a: user-initiated scroll (large delta) is NOT reconciled to intended value', () => {
  let scrollCallback: ((o: number, s: boolean) => void) | null = null
  const v = new Virtualizer({
    count: 10,
    estimateSize: () => 50,
    getScrollElement: () =>
      ({
        scrollTop: 0,
        scrollLeft: 0,
        scrollHeight: 500,
        clientHeight: 200,
        offsetHeight: 200,
        scrollTo: vi.fn(),
      }) as any,
    scrollToFn: vi.fn(),
    observeElementRect: () => {},
    observeElementOffset: (_inst, cb) => {
      scrollCallback = cb
      cb(0, false)
      return () => {}
    },
  })
  v._willUpdate()
  v.scrollToOffset(100, { behavior: 'auto' })
  expect(v['pendingWrite']?.target ?? null).toBe(100)

  // User then scrolls way past — browser reports 500. Diff (400) > 1.5 px
  // tolerance, so we trust the browser-reported value.
  scrollCallback!(500, true)
  expect(v.scrollOffset).toBe(500)
  expect(v['pendingWrite']?.target ?? null).toBeNull()
})

// ─── Phase 2b: scrollTopMax elastic-overscroll clamp ─────────────────────────

test('Phase 2b: flush skipped when scrollTop is in elastic-overscroll zone (negative)', () => {
  withFakeIOSUserAgent(() => {
    const { v, el, scrollToFn, scroll, touch, expireTouchTail } =
      makeIOSTouchVirtualizer()
    touch('touchstart')

    // Resize during the drag: defers
    v.resizeItem(0, 100)
    expect(v['_holdOffset']).toBe(50)

    // User rubber-bands past the top and lets go: scrollTop is negative
    // when the gesture settles. The elastic-zone check blocks the flush so
    // we don't snap back to a clamped position.
    el.scrollTop = -25
    scroll(-25, true)
    touch('touchend')
    expireTouchTail()
    expect(scrollToFn).not.toHaveBeenCalled()
    expect(v['_holdOffset']).toBe(50) // still deferred

    // Bounce-back resolves in-bounds. The next scroll event flushes.
    el.scrollTop = 100
    scroll(100, false)
    expect(scrollToFn).toHaveBeenCalled()
    expect(v['_holdOffset']).toBe(0)
  })
})

test('Phase 2b: flush skipped when scrollTop > scrollHeight-clientHeight (overscroll bottom)', () => {
  withFakeIOSUserAgent(() => {
    const { v, el, scrollToFn, scroll, touch, expireTouchTail } =
      makeIOSTouchVirtualizer() // clientHeight 200 → max valid scrollTop = 300
    touch('touchstart')

    v.resizeItem(0, 100)
    expect(v['_holdOffset']).toBe(50)

    // User pulls past the bottom and lets go: scrollTop is 350 (> max 300)
    // when the tail expires, so the flush is skipped.
    el.scrollTop = 350
    scroll(350, true)
    touch('touchend')
    expireTouchTail()
    expect(scrollToFn).not.toHaveBeenCalled()

    // Bounce-back resolves
    el.scrollTop = 300
    scroll(300, false)
    expect(scrollToFn).toHaveBeenCalled()
  })
})

test('Phase 2b: in-bounds flush proceeds normally (no regression)', () => {
  withFakeIOSUserAgent(() => {
    const scrollToFn = vi.fn()
    let scrollCb: ((o: number, s: boolean) => void) | null = null
    const el = makeMockScrollElement({
      scrollTop: 100,
      scrollLeft: 0,
      scrollHeight: 500,
      clientHeight: 200,
      offsetHeight: 200,
      ownerDocument: {
        defaultView: {
          setTimeout: globalThis.setTimeout.bind(globalThis),
          clearTimeout: globalThis.clearTimeout.bind(globalThis),
        },
      },
    })
    const v = new Virtualizer({
      count: 10,
      estimateSize: () => 50,
      getScrollElement: () => el as any,
      scrollToFn,
      observeElementRect: () => {},
      observeElementOffset: (_inst, cb) => {
        scrollCb = cb
        cb(100, true)
        return () => {}
      },
    })
    v._willUpdate()
    v['getMeasurements']()
    scrollToFn.mockClear()

    v.resizeItem(0, 100)
    el.scrollTop = 150
    scrollCb!(150, false) // in-bounds (0..300)
    expect(scrollToFn).toHaveBeenCalledTimes(1)
    expect(v['_holdOffset']).toBe(0)
  })
})

test('Phase 2a: a second self-write replaces the intended target', () => {
  let scrollCallback: ((o: number, s: boolean) => void) | null = null
  const v = new Virtualizer({
    count: 10,
    estimateSize: () => 50,
    getScrollElement: () =>
      ({
        scrollTop: 0,
        scrollLeft: 0,
        scrollHeight: 500,
        clientHeight: 200,
        offsetHeight: 200,
        scrollTo: vi.fn(),
      }) as any,
    scrollToFn: vi.fn(),
    observeElementRect: () => {},
    observeElementOffset: (_inst, cb) => {
      scrollCallback = cb
      cb(0, false)
      return () => {}
    },
  })
  v._willUpdate()
  v.scrollToOffset(100, { behavior: 'auto' })
  v.scrollToOffset(200.7, { behavior: 'auto' })
  expect(v['pendingWrite']?.target ?? null).toBe(200.7)
  // First scrollTo's offset (100) was overwritten — a scroll event near it
  // would NOT reconcile.
  scrollCallback!(101, true)
  // 101 is not within 1.5px of 200.7, so browser value wins.
  expect(v.scrollOffset).toBe(101)
})

test('iOS Phase 1: non-iOS still does NOT install touch state machine', () => {
  // On non-iOS, touchend should not arm the grace timer.
  _resetIOSDetectionForTests()
  const scrollToFn = vi.fn()
  const mockWindow = {
    setTimeout: globalThis.setTimeout.bind(globalThis),
    clearTimeout: globalThis.clearTimeout.bind(globalThis),
  }
  const { v, el } = makeIOSVirtualizerWithRealEl(scrollToFn, mockWindow)

  dispatchTouchEvent(el, 'touchstart')
  expect(v['_iosGesture'].touch).toEqual({ phase: 'down', moved: false }) // touchstart still records (cheap)
  dispatchTouchEvent(el, 'touchend')
  // Non-iOS path returns before arming a tail
  expect(v['_iosGesture'].touch).toBeNull()
})

test('non-iOS: adjustment is applied immediately during scroll (no regression)', () => {
  // Without the iOS user-agent, the normal flow should run unchanged.
  _resetIOSDetectionForTests()
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
      cb(100, true)
      return () => {}
    },
  })
  v._willUpdate()
  v['getMeasurements']()
  scrollToFn.mockClear()

  v.resizeItem(0, 100)

  // Should have fired immediately
  expect(scrollToFn).toHaveBeenCalled()
  expect(v['_holdOffset']).toBe(0)
})

// #1250: the deferral is gated on touch provenance only. Any scroll event,
// including the read-back of our own write, sets `isScrolling`, so a
// programmatic landing used to defer its compensation past a paint.

test('#1250: a programmatic scrollToIndex landing compensates synchronously with no touch', () => {
  withFakeIOSUserAgent(() => {
    const { v, scrollToFn, scroll } = makeIOSTouchVirtualizer()

    v.scrollToIndex(8)
    expect(scrollToFn).toHaveBeenCalledTimes(1)
    scroll(250, true) // the write's own scroll-event echo: isScrolling=true
    expect(v.isScrolling).toBe(true)
    expect(v['_iosGesture'].touch?.phase).not.toBe('tail') // an echo never opens the tail
    scrollToFn.mockClear()

    // Newly mounted rows measure. Item 0 sits above the fold, so its first
    // measurement must compensate pre-paint — not defer past it.
    v.resizeItem(0, 100)
    expect(v['_holdOffset']).toBe(0)
    expect(scrollToFn).toHaveBeenCalledTimes(1)
  })
})

test('#1250: a tap that never scrolls does not latch the deferral gate', () => {
  withFakeIOSUserAgent(() => {
    const { v, scrollToFn, touch, expireTouchTail } = makeIOSTouchVirtualizer()

    // Tap a row: touchstart + touchend, no scroll events at all.
    touch('touchstart')
    touch('touchend')
    expireTouchTail()
    expect(v['_iosGesture'].touch?.phase).not.toBe('down')
    expect(v['_iosGesture'].touch?.phase).not.toBe('tail')
    expect(
      (v['_iosGesture'].touch as { timerId?: number } | null)?.timerId ?? null,
    ).toBeNull()

    // Every piece of touch state is timer-bounded, so the next compensation
    // is applied synchronously rather than deferred by a stuck gate.
    v.resizeItem(0, 100)
    expect(v['_holdOffset']).toBe(0)
    expect(scrollToFn).toHaveBeenCalledTimes(1)
  })
})

test('#1250: a scrollToIndex issued from a tap handler lands compensated', () => {
  withFakeIOSUserAgent(() => {
    const { v, scrollToFn, scroll, touch } = makeIOSTouchVirtualizer()

    // Tapping a search result: its click handler calls scrollToIndex inside
    // the post-touchend window.
    touch('touchstart')
    touch('touchend')
    expect(v['_iosGesture'].touch?.phase).toBe('tail')

    // The command's own write cancels any momentum, so it closes the tail.
    v.scrollToIndex(8)
    expect(v['_iosGesture'].touch?.phase).not.toBe('tail')
    expect(
      (v['_iosGesture'].touch as { timerId?: number } | null)?.timerId ?? null,
    ).toBeNull()
    scroll(250, true) // the echo must not re-open it
    expect(v['_iosGesture'].touch?.phase).not.toBe('tail')
    scrollToFn.mockClear()

    v.resizeItem(0, 100)
    expect(v['_holdOffset']).toBe(0)
    expect(scrollToFn).toHaveBeenCalledTimes(1)
  })
})

test('#1250: an absolute command under a dragging finger keeps deferring', () => {
  withFakeIOSUserAgent(() => {
    const { v, scrollToFn, scroll, touch } = makeIOSTouchVirtualizer()

    touch('touchstart')
    scroll(90, true) // the finger drags
    v.scrollToIndex(8) // the dragging finger still owns the scroll
    expect(v['_iosGesture'].touch?.phase).toBe('down')
    scrollToFn.mockClear()

    v.resizeItem(0, 100)
    expect(scrollToFn).not.toHaveBeenCalled()
    expect(v['_holdOffset']).toBe(50)
  })
})

test('#1250: a scrollToIndex with no target leaves the fling running and the held correction', () => {
  withFakeIOSUserAgent(() => {
    const { v, scrollToFn, scroll, touch, expireTouchTail } =
      makeIOSTouchVirtualizer()
    touch('touchstart')
    touch('touchend')
    scroll(120, true) // momentum
    v.resizeItem(0, 100)
    expect(v['_holdOffset']).toBe(50)
    const timer =
      (v['_iosGesture'].touch as { timerId?: number } | null)?.timerId ?? null
    expect(timer).not.toBeNull()

    // getOffsetForIndex finds no measurement for the index (e.g. the list was
    // emptied), so scrollToIndex writes nothing. Nothing stopped the fling,
    // so the tail stays open. The held correction is already in
    // `scrollOffset` and stays for the flush.
    v.measurementsCache = []
    v.scrollToIndex(5)
    expect(scrollToFn).not.toHaveBeenCalled()
    expect(v['_holdOffset']).toBe(50)
    expect(v['_iosGesture'].touch?.phase).toBe('tail')
    expect(
      (v['_iosGesture'].touch as { timerId?: number } | null)?.timerId ?? null,
    ).toBe(timer)

    // A resize during the remaining momentum is held too rather than
    // written into the fling.
    v.resizeItem(1, 80)
    expect(scrollToFn).not.toHaveBeenCalled()
    expect(v['_holdOffset']).toBe(80)

    expireTouchTail()
    expect(scrollToFn).toHaveBeenCalledTimes(1)
    expect(scrollToFn.mock.calls[0]![0]).toBe(200)
    expect(v['_holdOffset']).toBe(0)
  })
})

test('iOS Phase 1: touchcancel releases the touch like touchend', () => {
  withFakeIOSUserAgent(() => {
    const { v, scrollToFn, touch, expireTouchTail } = makeIOSTouchVirtualizer()

    // A system gesture steals the touch: iOS fires touchcancel, never
    // touchend. Without handling it the touch would stay `down` forever.
    touch('touchstart')
    expect(v['_iosGesture'].touch?.phase).toBe('down')
    touch('touchcancel')
    expect(v['_iosGesture'].touch?.phase).not.toBe('down')
    expect(v['_iosGesture'].touch?.phase).toBe('tail')

    expireTouchTail()
    expect(v['_iosGesture'].touch?.phase).not.toBe('tail')

    v.resizeItem(0, 100)
    expect(scrollToFn).toHaveBeenCalledTimes(1)
  })
})

test.each([
  ['scrollToOffset', (v: any) => v.scrollToOffset(250)],
  ['scrollToEnd', (v: any) => v.scrollToEnd()],
] as const)(
  '#1250: a %s issued from a tap handler lands compensated',
  (_name, command) => {
    withFakeIOSUserAgent(() => {
      const { v, el, scrollToFn, scroll, touch } = makeIOSTouchVirtualizer()

      touch('touchstart')
      touch('touchend')
      expect(v['_iosGesture'].touch?.phase).toBe('tail')

      // The command's own write stops any momentum, so it closes the tail.
      command(v)
      expect(v['_iosGesture'].touch?.phase).not.toBe('tail')
      scroll(el.scrollTop, true) // the read-back must not re-open it
      scrollToFn.mockClear()

      v.resizeItem(0, 100)
      expect(v['_holdOffset']).toBe(0)
      expect(scrollToFn).toHaveBeenCalledTimes(1)
    })
  },
)

test('iOS deferral: under a resting finger the retarget lands and the correction is applied once', () => {
  // scrollToIndex issued with a finger resting on the list (a touchstart
  // handler, a long press). iOS ignores writes only under a dragging finger,
  // so the command and reconcile's retarget from the grown row both land,
  // and that retarget already contains the correction: the flush after the
  // lift must not apply it again (@phcorp on #1318: row 20 ended 210px off).
  const h = makeDeferralHarness({ start: 2000 })
  h.touch('touchstart')
  h.run(() => {
    h.v.scrollToIndex(20, { align: 'start' })
    h.v.resizeItem(10, 100)
    for (let i = 0; i < 5; i++) {
      h.frame()
      h.scroll(true)
    }
  })
  h.touch('touchend')
  h.run(() => h.scroll(false))
  h.expireTail()
  expect(h.el.scrollTop).toBe(1050)
  expect(h.rowTop(20)).toBe(0)
})

test('iOS deferral: a scroll report at rest under a resting finger is not a drag', () => {
  // The command lands under a resting finger and the browser reports it,
  // then reports the scroll at rest without the position moving. That is no
  // drag, so a later retarget still lands and the correction is applied once
  // (CodeRabbit on #1318).
  const h = makeDeferralHarness({ start: 2000 })
  h.touch('touchstart')
  h.run(() => {
    h.v.scrollToIndex(20, { align: 'start' })
    h.scroll(true) // the write's read-back
    h.scroll(false) // at rest, same position
    h.v.resizeItem(10, 100)
    for (let i = 0; i < 5; i++) {
      h.frame()
      h.scroll(true)
    }
  })
  h.touch('touchend')
  h.run(() => h.scroll(false))
  h.expireTail()
  expect(h.el.scrollTop).toBe(1050)
  expect(h.rowTop(20)).toBe(0)
})

test('iOS deferral: a retarget iOS ignores under a finger keeps the deferred correction', () => {
  // Same start, but the finger drags and reconcile retargets under it: iOS
  // ignores that write, so the correction must survive it. The finger
  // then scrolls, which ends the index scroll, and the flush applies it.
  const h = makeDeferralHarness({ start: 2000 })
  const write = h.v.options.scrollToFn
  h.v.setOptions({
    ...h.v.options,
    scrollToFn: (offset, opts, inst) => {
      if (!h.v['_iosGesture'].dragging()) write(offset, opts, inst)
    },
  })
  h.touch('touchstart')
  h.run(() => h.scroll(true, 1990)) // the finger drags
  h.run(() => {
    h.v.scrollToIndex(20, { align: 'start' })
    h.v.resizeItem(10, 100)
    h.frame() // reconcile retargets to 1050; ignored under the finger
    h.scroll(true, 2000) // the finger scrolls: the index scroll ends
  })
  h.touch('touchend')
  h.run(() => h.scroll(false))
  h.expireTail()
  // Row 10 grew above the reader, so the content they were on moved down 50.
  expect(h.el.scrollTop).toBe(2050)
})

test('iOS touch: a row that stops touch propagation does not hide the gesture', () => {
  // The listeners run in the capture phase on the scroll element, before a
  // descendant's handler can stop the event (@phcorp on #1318: a fling was
  // cut short and a drag lost a correction when touches went unseen).
  // Another test leaves a non-constructor ResizeObserver on window; this one
  // runs on the real window, so give it a working one for its lifetime.
  const prevRO = window.ResizeObserver
  window.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver
  try {
    withFakeIOSUserAgent(() => {
      const scrollEl = document.createElement('div')
      const row = document.createElement('div')
      scrollEl.appendChild(row)
      document.body.appendChild(scrollEl)
      const stop = (e: Event) => e.stopPropagation()
      row.addEventListener('touchstart', stop)
      row.addEventListener('touchend', stop)

      const v = new Virtualizer({
        count: 10,
        estimateSize: () => 50,
        getScrollElement: () => scrollEl,
        scrollToFn: () => {},
        observeElementRect: () => () => {},
        observeElementOffset: (_inst, cb) => {
          cb(0, false)
          return () => {}
        },
      })
      const unmount = v._didMount()
      v._willUpdate()

      row.dispatchEvent(new Event('touchstart', { bubbles: true }))
      expect(v['_iosGesture'].touch).toEqual({ phase: 'down', moved: false })
      row.dispatchEvent(new Event('touchend', { bubbles: true }))
      expect(v['_iosGesture'].touch?.phase).toBe('tail')

      unmount()
      row.dispatchEvent(new Event('touchstart', { bubbles: true }))
      expect(v['_iosGesture'].touch).toBeNull()
      scrollEl.remove()
    })
  } finally {
    window.ResizeObserver = prevRO
  }
})

// `scrollToOffset` closes the tail, so `_canWriteScroll()` is true while the
// command's write (270) has no read-back yet. The flush in the next
// `_willUpdate` must write the command's target (`getCommandWrittenOffset`),
// not the pre-command layout offset (250), which the read-back would then
// retire the command with as an external scroll.
test('iOS hold: a command that closes the tail is not overwritten by a flush before its read-back', () => {
  withFakeIOSUserAgent(() => {
    const { v, scrollToFn, scroll, touch } = makeIOSTouchVirtualizer({
      scrollTop: 200,
    })
    touch('touchstart')
    touch('touchend')
    scroll(200, true) // momentum tail
    v.resizeItem(0, 100) // above the viewport: held
    expect(v['_holdOffset']).toBe(50)
    expect(v.scrollOffset).toBe(250)

    // The command closes the tail and writes its target the hold short.
    v.scrollToOffset(320)
    expect(scrollToFn.mock.calls.at(-1)![0]).toBe(270)
    scrollToFn.mockClear()

    // The adapter renders (a layout effect) before the scroll event of that
    // write arrives. Whatever is written now must not undo the command.
    v._willUpdate()
    for (const [offset, opts] of scrollToFn.mock.calls) {
      expect(offset + (opts.adjustments ?? 0)).toBe(320)
    }
    // The element reports the command's position; the read-back must not be
    // taken for a user scroll away from the target.
    scroll(scrollToFn.mock.calls.at(-1)?.[0] ?? 270, false)
    expect(v.scrollOffset).toBe(320)
  })
})

// The same invariant through the flush in `resizeItem`, which runs even when
// `awaitingCommandReadBack` skips the compensation.
test('iOS hold: a resize landing between a command and its read-back does not flush the stale offset', () => {
  withFakeIOSUserAgent(() => {
    const { v, scrollToFn, scroll, touch } = makeIOSTouchVirtualizer({
      scrollTop: 200,
    })
    touch('touchstart')
    touch('touchend')
    scroll(200, true)
    v.resizeItem(0, 100) // held: 50
    v.scrollToOffset(320) // closes the tail, writes 270
    scrollToFn.mockClear()
    // A row below the viewport re-measures before the read-back: no
    // compensation, but `resizeItem` runs the flush.
    v.resizeItem(9, 80)
    for (const [offset, opts] of scrollToFn.mock.calls) {
      expect(offset + (opts.adjustments ?? 0)).toBe(320)
    }
    scroll(scrollToFn.mock.calls.at(-1)?.[0] ?? 270, false)
    expect(v.scrollOffset).toBe(320)
  })
})

// A compensation write clamped by a not-yet-grown sizer is retried once the
// sizer grows (#1258). That retry is a write like any other: it must wait
// while a touch owns the scroll, and go out once the tail closes (#1327).
test('iOS deferral: a clamped compensation is not retried while a touch owns the scroll (#1327)', () => {
  withFakeIOSUserAgent(() => {
    // 10 × 50 = 500px, viewport 200: reading at the bottom, max 300.
    const { v, el, scrollToFn, touch, expireTouchTail } =
      makeIOSTouchVirtualizer({ scrollTop: 300 })
    // A row above the viewport grows by 70: the write to 370 is clamped
    // to 300 because the consumer has not committed the 570px sizer yet.
    v.resizeItem(0, 120)
    expect(scrollToFn).toHaveBeenCalledTimes(1)
    expect(v['_clampedAdjustment']).toEqual({ target: 370, maxAtWrite: 300 })
    scrollToFn.mockClear()

    // A finger comes down before the consumer's commit lands.
    touch('touchstart')
    el.scrollHeight = 570
    v._willUpdate()
    expect(scrollToFn).not.toHaveBeenCalled()
    expect(v['_clampedAdjustment']).not.toBeNull()

    // A tap: the write waits for its tail too.
    touch('touchend')
    v._willUpdate()
    expect(scrollToFn).not.toHaveBeenCalled()

    expireTouchTail()
    expect(scrollToFn).toHaveBeenCalledTimes(1)
    expect(scrollToFn.mock.calls[0]![0]).toBe(370)
    expect(v['_clampedAdjustment']).toBeNull()
  })
})
