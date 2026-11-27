import { expect, test } from 'vitest'
import { _resetIOSDetectionForTests } from '../src/index'
import { makeDeferralHarness } from './helpers'

const SAFARI =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15'
const CHROME =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36'

function withUserAgent(userAgent: string, fn: () => void) {
  Object.defineProperty(navigator, 'userAgent', {
    value: userAgent,
    configurable: true,
  })
  _resetIOSDetectionForTests()
  try {
    fn()
  } finally {
    delete (navigator as any).userAgent
    _resetIOSDetectionForTests()
  }
}

// An end-anchored list at rest at 2000: rows 50px, viewport 200px, the
// element's max 4800. `expireTail` runs the wheel timer: 150ms with no
// wheel event.
function endAnchoredAt2000() {
  const h = makeDeferralHarness({ ios: false })
  h.v.setOptions({ ...h.v.options, anchorTo: 'end', getItemKey: (i) => i })
  h.v._willUpdate()
  h.v.scrollToOffset(2000)
  h.scroll(true)
  for (let i = 0; i < 5; i++) h.frame()
  h.scroll(false)
  h.writes.length = 0
  return h
}

// 12 rows of 50px above the reader: the anchor write is 600px.
function prepend(h: ReturnType<typeof endAnchoredAt2000>) {
  h.v.setOptions({ ...h.v.options, count: 112, getItemKey: (i) => i - 12 })
  h.v._willUpdate()
}

test('WebKit (#1398): a size correction under wheel input is held until the wheel rests', () => {
  withUserAgent(SAFARI, () => {
    const h = endAnchoredAt2000()
    h.el._dispatch('wheel')
    h.scroll(true, 1900)
    const top = h.rowTop(40)

    h.v.resizeItem(0, 70)
    expect(h.writes).toEqual([])
    // Row 40 is exposed where the reader sees it.
    expect(h.v.getVirtualItems().find((item) => item.index === 40)!.start).toBe(
      top + h.el.scrollTop,
    )

    // The wheel carries on: neither a scroll event nor a frame writes.
    h.el._dispatch('wheel')
    h.scroll(true, 1800)
    h.frame()
    h.frame()
    expect(h.writes).toEqual([])

    h.expireTail()
    expect(h.writes).toEqual([1820])
    expect(h.rowTop(40)).toBe(top + 100)
  })
})

test('WebKit (#1398): a prepend under wheel input is held until the wheel rests', () => {
  withUserAgent(SAFARI, () => {
    const h = endAnchoredAt2000()
    h.el._dispatch('wheel')
    h.scroll(true, 1900)
    const top = h.rowTop(40)

    prepend(h)
    expect(h.writes).toEqual([])
    expect(h.v.getVirtualItems().find((item) => item.index === 52)!.start).toBe(
      top + h.el.scrollTop,
    )

    h.expireTail()
    expect(h.writes).toEqual([2500])
    expect(h.rowTop(52)).toBe(top)
  })
})

test('WebKit: a hold is written two frames after the element reaches the top, the wheel still running', () => {
  withUserAgent(SAFARI, () => {
    const h = endAnchoredAt2000()
    h.el._dispatch('wheel')
    prepend(h)
    // Not before the edge.
    h.scroll(true, 100)
    h.frame()
    h.frame()
    expect(h.writes).toEqual([])

    h.el._dispatch('wheel')
    h.scroll(true, 0)
    h.frame()
    expect(h.writes).toEqual([])
    h.frame()
    expect(h.writes).toEqual([600])

    // The wheel still holds what comes next.
    h.writes.length = 0
    h.scroll(true, 600)
    h.v.resizeItem(0, 70)
    expect(h.writes).toEqual([])
  })
})

test('WebKit: a hold at the top is written with no scroll event, from the wheel event', () => {
  withUserAgent(SAFARI, () => {
    const h = endAnchoredAt2000()
    h.el._dispatch('wheel')
    h.scroll(true, 0)
    prepend(h)
    expect(h.writes).toEqual([])
    h.el._dispatch('wheel')
    h.frame()
    h.frame()
    expect(h.writes).toEqual([600])
  })
})

test('WebKit: a hold is written two frames after the element reaches the end', () => {
  withUserAgent(SAFARI, () => {
    const h = endAnchoredAt2000()
    h.el._dispatch('wheel')
    h.scroll(true, 4800)
    h.v.resizeItem(0, 70)
    expect(h.writes).toEqual([])
    h.el._dispatch('wheel')
    h.frame()
    h.frame()
    expect(h.writes).toEqual([4820])
  })
})

test('WebKit: a correction with no wheel input is written at once', () => {
  withUserAgent(SAFARI, () => {
    const h = endAnchoredAt2000()
    h.v.resizeItem(0, 70)
    expect(h.writes).toEqual([2020])
  })
})

test('WebKit: a new scroll element drops the wheel state', () => {
  withUserAgent(SAFARI, () => {
    const h = endAnchoredAt2000()
    h.el._dispatch('wheel')
    h.scroll(true, 0)
    prepend(h)
    h.el._dispatch('wheel')
    expect(h.v['_wheelTimer']).not.toBeNull()
    expect(h.v['_edgeFlushFrame']).not.toBeNull()
    h.v.setOptions({ ...h.v.options, enabled: false })
    h.v._willUpdate()
    expect(h.v['_wheelTimer']).toBeNull()
    expect(h.v['_edgeFlushFrame']).toBeNull()
  })
})

test('not WebKit: corrections under wheel input are written at once', () => {
  withUserAgent(CHROME, () => {
    const h = endAnchoredAt2000()
    h.el._dispatch('wheel')
    h.v.resizeItem(0, 70)
    expect(h.writes).toEqual([2020])
    h.writes.length = 0
    prepend(h)
    expect(h.writes).toEqual([2620])
  })
})
