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

// An end-anchored list at rest at 2000, rows 50px.
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

test('WebKit (#1398): a prepend under wheel input is written two frames later', () => {
  withUserAgent(SAFARI, () => {
    const h = endAnchoredAt2000()
    h.el._dispatch('wheel')
    h.scroll(true, 1900)
    const top = h.rowTop(40)

    prepend(h)
    expect(h.writes).toEqual([])
    // The reader's row (now index 52) has not moved.
    expect(h.v.getVirtualItems().find((item) => item.index === 52)!.start).toBe(
      top + h.el.scrollTop,
    )

    // The wheel carries on meanwhile; a scroll event does not flush.
    h.el._dispatch('wheel')
    h.scroll(true, 1800)
    h.frame()
    expect(h.writes).toEqual([])

    h.frame()
    expect(h.writes).toEqual([2400])
    expect(h.rowTop(52)).toBe(top + 100)
  })
})

test('WebKit (#1398): a size correction within the two frames joins the hold', () => {
  withUserAgent(SAFARI, () => {
    const h = endAnchoredAt2000()
    h.el._dispatch('wheel')
    prepend(h)
    h.v.resizeItem(0, 70)
    expect(h.writes).toEqual([])
    h.frame()
    h.frame()
    expect(h.writes).toEqual([2620])
  })
})

test('WebKit: a size correction under wheel input is written at once', () => {
  withUserAgent(SAFARI, () => {
    const h = endAnchoredAt2000()
    h.el._dispatch('wheel')
    h.v.resizeItem(0, 70)
    expect(h.writes).toEqual([2020])
  })
})

test('WebKit: a prepend 150ms after the last wheel event is written at once', () => {
  withUserAgent(SAFARI, () => {
    const h = endAnchoredAt2000()
    h.el._dispatch('wheel')
    h.advance(150)
    prepend(h)
    expect(h.writes).toEqual([2600])
  })
})

test('WebKit: a new scroll element drops the wait', () => {
  withUserAgent(SAFARI, () => {
    const h = endAnchoredAt2000()
    h.el._dispatch('wheel')
    prepend(h)
    expect(h.v['_anchorHoldFrame']).not.toBeNull()
    h.v.setOptions({ ...h.v.options, enabled: false })
    h.v._willUpdate()
    expect(h.v['_anchorHoldFrame']).toBeNull()
    expect(h.v['_lastWheelAt']).toBeNull()
  })
})

test('not WebKit: a prepend under wheel input is written at once', () => {
  withUserAgent(CHROME, () => {
    const h = endAnchoredAt2000()
    h.el._dispatch('wheel')
    prepend(h)
    expect(h.writes).toEqual([2600])
  })
})
