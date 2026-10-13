import { expect, test } from 'vitest'
import { Virtualizer, _resetIOSDetectionForTests } from '../src/index'
import type { VirtualItem } from '../src/index'

// A prepend that lands while the element cannot take a scrollTop write
// (#1287, #1307). Both traces come from the react `chat` example
// (`anchorTo: 'end'`, 12 rows prepended 180ms after scrollTop < 120):
//
// - Desktop Safari 18.4: the load lands during the top rubber-band bounce.
//   WebKit discards a scrollTop write made while the element is overscrolled
//   and the bounce stalls where it was: the new rows are on screen, the top
//   of the viewport is blank, and no scroll event comes until the user
//   scrolls again.
// - iOS Safari 27: the load lands during the momentum tail of a touch. The
//   anchor delta is deferred, the new rows show through the bounce, and the
//   flush at the end of the tail snaps back to the reader's row.
//
// Each scenario runs the same event sequence on a control virtualizer that
// gets no prepend. At every step the reader's row must be at the same
// viewport position as on the control and no viewport pixel may be blank;
// nothing may be written while a write is impossible; and once a write is
// possible the element lands exactly one prepend further.

const VIEWPORT = 200
const ROW = 50
const PREPEND = 12
const IOS_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)'

function withUserAgent<T>(ios: boolean, fn: () => T): T {
  if (ios) {
    Object.defineProperty(navigator, 'userAgent', {
      value: IOS_UA,
      configurable: true,
    })
  }
  _resetIOSDetectionForTests()
  try {
    return fn()
  } finally {
    delete (navigator as any).userAgent
    _resetIOSDetectionForTests()
  }
}

function makeHarness(ios: boolean) {
  const timers = new Map<number, { fn: () => void; due: number }>()
  let timerId = 0
  let clock = 0
  const win = {
    requestAnimationFrame: () => 1,
    cancelAnimationFrame: () => {},
    setTimeout: (fn: () => void, ms = 0) => {
      timers.set(++timerId, { fn, due: clock + ms })
      return timerId
    },
    clearTimeout: (id: number) => timers.delete(id),
    performance: { now: () => clock },
  }
  const listeners: Record<string, Array<() => void>> = {}
  let ids = Array.from({ length: 45 }, (_, i) => i)
  let nextId = 0
  const writes: Array<number> = []
  // The reader row's rendered start at the moment of each write.
  const writeViews: Array<{ to: number; readerStart: number | null }> = []
  let touching = false
  let dragged = false
  // The bounce stalled after a discarded write: no more scroll events.
  let stalled = false
  const el = {
    pos: 0,
    size: 0,
    get scrollTop() {
      return this.pos
    },
    get scrollHeight() {
      return this.size
    },
    clientHeight: VIEWPORT,
    offsetHeight: VIEWPORT,
    ownerDocument: { defaultView: win },
    addEventListener: (type: string, fn: () => void) => {
      ;(listeners[type] ??= []).push(fn)
    },
    removeEventListener: (type: string, fn: () => void) => {
      listeners[type] = (listeners[type] ?? []).filter((f) => f !== fn)
    },
  }
  const max = () => Math.max(0, el.size - VIEWPORT)
  let scrollCallback: ((offset: number, isScrolling: boolean) => void) | null =
    null
  let rendered: Array<VirtualItem> = []
  let rendering = false
  let dirty = false

  const v = new Virtualizer({
    count: ids.length,
    estimateSize: () => ROW,
    getItemKey: (i) => ids[i]!,
    getScrollElement: () => el as any,
    anchorTo: 'end',
    overscan: 1,
    scrollToFn: (offset, { adjustments = 0 }) => {
      const to = offset + adjustments
      writes.push(to)
      writeViews.push({
        to,
        readerStart:
          rendered.find((item) => ids[item.index] === 0)?.start ?? null,
      })
      // iOS ignores a write while a finger drags the content.
      if (ios && touching && dragged) return
      // WebKit discards a write made while the element is overscrolled, and
      // the bounce stalls where it was (#1287).
      if (el.pos < 0 || el.pos > max()) {
        stalled = true
        return
      }
      el.pos = Math.max(0, Math.min(to, max()))
    },
    observeElementRect: (_inst, cb) => {
      cb({ width: VIEWPORT, height: VIEWPORT })
      return () => {}
    },
    observeElementOffset: (_inst, cb) => {
      scrollCallback = cb
      cb(el.pos, false)
      return () => {}
    },
    onChange: (_inst, sync) => {
      // A sync notify re-renders before paint; an async one before the next
      // step. Either way the rows and the sizer catch up before anything is
      // observed.
      if (sync && !rendering) render()
      else dirty = true
    },
  })
  v._didMount()

  // What an adapter does on render: read the rows, run the update hook, and
  // size the container.
  const render = () => {
    rendering = true
    try {
      rendered = v.getVirtualItems()
      v._willUpdate()
      el.size = v.getTotalSize()
      rendered = v.getVirtualItems()
    } finally {
      rendering = false
      dirty = false
    }
  }
  const settle = () => {
    if (dirty) render()
  }
  const fire = (type: string) => listeners[type]?.forEach((fn) => fn())
  const advance = (ms: number) => {
    const until = clock + ms
    for (;;) {
      let next: [number, { fn: () => void; due: number }] | undefined
      for (const entry of timers) {
        if (entry[1].due <= until && (!next || entry[1].due < next[1].due)) {
          next = entry
        }
      }
      if (!next) break
      timers.delete(next[0])
      clock = Math.max(clock, next[1].due)
      next[1].fn()
    }
    clock = until
    settle()
  }

  return {
    v,
    el,
    writes,
    render,
    // The element reports a position (the user, a bounce frame, or a
    // momentum frame). A stalled bounce reports nothing.
    scroll: (pos: number, isScrolling = true) => {
      if (stalled) return
      el.pos = pos
      if (touching) dragged = true
      scrollCallback!(pos, isScrolling)
      settle()
    },
    // The read-back of the element's current position.
    readBack: (isScrolling = false) => {
      scrollCallback!(el.pos, isScrolling)
      settle()
    },
    touchstart: () => {
      touching = true
      dragged = false
      fire('touchstart')
    },
    touchend: () => {
      touching = false
      fire('touchend')
    },
    advance,
    prepend: () => {
      ids = [...Array.from({ length: PREPEND }, () => --nextId), ...ids]
      v.setOptions({ ...v.options, count: ids.length })
      render()
    },
    // The options change alone, before the adapter commits.
    prependOptions: () => {
      ids = [...Array.from({ length: PREPEND }, () => --nextId), ...ids]
      v.setOptions({ ...v.options, count: ids.length })
    },
    writeViews,
    // The screen: the viewport position of the reader's row (the first row
    // of the original list) and the viewport pixels no rendered row covers.
    // The gap a bounce opens above the content is not blank.
    view: () => {
      const reader = rendered.find((item) => ids[item.index] === 0)
      const total = v.getTotalSize()
      let blank = 0
      for (
        let px = Math.max(el.pos, 0);
        px < Math.min(el.pos + VIEWPORT, total);
        px++
      ) {
        if (!rendered.some((item) => item.start <= px && px < item.end)) {
          blank++
        }
      }
      return {
        readerTop: reader ? reader.start - el.pos : null,
        blank,
        rows: `${rendered[0]?.index}-${rendered[rendered.length - 1]?.index}`,
      }
    },
  }
}

type Harness = ReturnType<typeof makeHarness>

// Drive the prepend run and the control run through the same steps; after
// each one the screen must match.
function run(ios: boolean, script: (h: Harness, prepend: () => void) => void) {
  return withUserAgent(ios, () => {
    const h = makeHarness(ios)
    const control = makeHarness(ios)
    h.render()
    control.render()
    // The mount-time write of the initial offset is not under test.
    h.writes.length = 0
    control.writes.length = 0
    h.writeViews.length = 0
    control.writeViews.length = 0
    const steps: Array<string> = []
    const both = (label: string, fn: (x: Harness) => void) => {
      fn(h)
      fn(control)
      const a = h.view()
      const b = control.view()
      steps.push(
        `${label}: pos=${h.el.pos} rows=${a.rows} ${JSON.stringify(a)}`,
      )
      expect(
        a.readerTop,
        `${label}: reader row moved\n${steps.join('\n')}`,
      ).toBe(b.readerTop)
      expect(a.blank, `${label}: blank viewport\n${steps.join('\n')}`).toBe(0)
      // The comparison above is vacuous when neither run renders the
      // reader's row; at the prepend it must be on screen.
      if (label === 'prepend') {
        expect(a.readerTop, `${label}: reader row not rendered`).not.toBeNull()
      }
    }
    const proxy: Harness = {
      ...h,
      scroll: (pos, isScrolling) =>
        both(`scroll ${pos}`, (x) => x.scroll(pos, isScrolling)),
      readBack: (isScrolling) =>
        both('read-back', (x) => x.readBack(isScrolling)),
      touchstart: () => both('touchstart', (x) => x.touchstart()),
      touchend: () => both('touchend', (x) => x.touchend()),
      advance: (ms) => both(`wait ${ms}`, (x) => x.advance(ms)),
    }
    script(proxy, () => both('prepend', (x) => x === h && x.prepend()))
    return { h, control }
  })
}

test('desktop: a prepend during the top rubber-band bounce holds the reader row and lands once the bounce ends (#1287)', () => {
  const { h, control } = run(false, (h, prepend) => {
    // A trackpad fling reaches the top and bounces past it.
    h.scroll(0)
    h.scroll(-38)
    h.scroll(-128)
    h.scroll(-94)
    // History lands mid-bounce. No write is possible here.
    prepend()
    expect(h.writes).toEqual([])
    // The bounce springs back. A discarded write would have stalled it.
    h.scroll(-80)
    h.scroll(-40)
    h.scroll(0)
    h.readBack()
  })
  // The element is in bounds: the prepend has been written, exactly once.
  expect(h.writes).toEqual([PREPEND * ROW])
  expect(h.el.pos).toBe(PREPEND * ROW)
  expect(control.el.pos).toBe(0)
  // The rows are back in layout coordinates and the sizer holds them all.
  expect(
    h.v.getVirtualItems().find((item) => item.index === PREPEND)?.start,
  ).toBe(PREPEND * ROW)
  expect(h.v.getTotalSize()).toBe(control.v.getTotalSize() + PREPEND * ROW)
  expect(h.v.scrollOffset).toBe(PREPEND * ROW)
})

test('desktop: a prepend at rest is written at once (no hold)', () => {
  // At rest at the top, with the reader's row on screen, so the per-step
  // comparison checks the row through the immediate write as well.
  const { h } = run(false, (h, prepend) => {
    h.scroll(0, false)
    prepend()
    expect(h.writes).toEqual([PREPEND * ROW])
    h.readBack()
  })
  expect(h.el.pos).toBe(PREPEND * ROW)
})

test('iOS: a prepend during a momentum bounce holds the reader row and lands when the tail closes (#1307)', () => {
  const { h, control } = run(true, (h, prepend) => {
    h.scroll(112, false)
    // Finger down, drag up to the top, release into momentum.
    h.touchstart()
    h.scroll(60)
    h.touchend()
    h.scroll(10)
    h.scroll(-17)
    h.scroll(-113)
    // History lands mid-fling: the tail is open and the element overscrolled.
    prepend()
    expect(h.writes).toEqual([])
    h.scroll(-91)
    h.scroll(-40)
    h.scroll(0)
    expect(h.writes).toEqual([])
    // The tail closes 150ms after the last momentum frame.
    h.advance(160)
    h.readBack()
  })
  expect(h.writes).toEqual([PREPEND * ROW])
  expect(h.el.pos).toBe(PREPEND * ROW)
  expect(control.el.pos).toBe(0)
  expect(
    h.v.getVirtualItems().find((item) => item.index === PREPEND)?.start,
  ).toBe(PREPEND * ROW)
  expect(h.v.scrollOffset).toBe(PREPEND * ROW)
})

test('iOS: two prepends in one tail hold together and land as one write', () => {
  const { h } = run(true, (h, prepend) => {
    h.scroll(112, false)
    h.touchstart()
    h.scroll(60)
    h.touchend()
    h.scroll(20)
    prepend()
    h.scroll(5)
    prepend()
    expect(h.writes).toEqual([])
    h.scroll(0)
    h.advance(160)
    h.readBack()
  })
  expect(h.writes).toEqual([2 * PREPEND * ROW])
  expect(h.el.pos).toBe(2 * PREPEND * ROW)
})

test('desktop: the flush re-renders the rows in layout coordinates before it writes', () => {
  const { h } = run(false, (h, prepend) => {
    h.scroll(0)
    h.scroll(-94)
    prepend()
    h.scroll(-40)
    h.scroll(0)
    h.readBack()
  })
  // The write that releases the hold must find the rows already re-rendered
  // in layout coordinates (a synchronous notify), or one paint shows the
  // element moved under rows that have not.
  expect(h.writeViews).toEqual([
    { to: PREPEND * ROW, readerStart: PREPEND * ROW },
  ])
})

test('desktop: a user scroll back into bounds during a hold releases it where the user is', () => {
  const { h, control } = run(false, (h, prepend) => {
    h.scroll(0)
    h.scroll(-94)
    prepend()
    expect(h.writes).toEqual([])
    // The user drags down through the top, past the bounce, into the list.
    h.scroll(-20)
    h.scroll(30)
    h.readBack()
  })
  // Released by the first in-bounds event, at the user's position.
  expect(h.writes).toEqual([30 + PREPEND * ROW])
  expect(h.el.pos).toBe(30 + PREPEND * ROW)
  expect(control.el.pos).toBe(30)
})

// Known gap in the `_willUpdate` fallback: a scroll event between
// `setOptions` and `_willUpdate` overwrites the eagerly bumped `scrollOffset`
// with the element's offset before the hold is applied, and the fallback
// then adds the hold without restoring the layout offset. For one event the
// range is computed from an element offset while the rows are shifted by the
// hold: rows 0-3 render at -600 and the viewport is blank (106px). The next
// scroll event self-heals. Without the fallback the old stall would return,
// so it stays; this pins the glitch.
test.fails(
  'desktop: an overscroll event between the options change and the commit still holds',
  () => {
    const { h, control } = run(false, (h, prepend) => {
      h.scroll(0, false)
      // The options change finds the element writable (at rest, in bounds)...
      h.prependOptions()
      // ...but a bounce event lands before the adapter commits (`_willUpdate`
      // runs inside the render this event triggers).
      h.scroll(-94)
      expect(h.writes).toEqual([])
      h.scroll(-40)
      h.scroll(0)
      h.readBack()
      void prepend
    })
    expect(h.writes).toEqual([PREPEND * ROW])
    expect(h.el.pos).toBe(PREPEND * ROW)
    expect(control.el.pos).toBe(0)
    expect(h.v.scrollOffset).toBe(PREPEND * ROW)
  },
)

test('desktop: an above-viewport grow during a bottom bounce holds and lands once in bounds', () => {
  const max = (45 - 4) * ROW // 2050
  const { h, control } = run(false, (h) => {
    h.scroll(max, false)
    h.scroll(max + 30)
    h.scroll(max + 70)
    // Row 0 (above the viewport, at the end) grows by 30: held.
    h.v.resizeItem(0, ROW + 30)
    h.render()
    expect(h.writes).toEqual([])
    h.scroll(max + 35)
    h.scroll(max)
    h.readBack()
  })
  expect(h.writes).toEqual([max + 30])
  expect(h.el.pos).toBe(max + 30)
  expect(control.el.pos).toBe(max)
  // The last row sits where it did on the control.
  const last = (x: Harness) =>
    x.v.getVirtualItems().find((i) => i.index === 44)!.start - x.el.pos
  expect(last(h)).toBe(last(control))
})
