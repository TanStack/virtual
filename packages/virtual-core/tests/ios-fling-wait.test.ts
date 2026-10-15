import { expect, test } from 'vitest'
import { makeDeferralHarness } from './helpers'
import flings from './fixtures/ios27-flings.json'

// ─── #1307 step 3: iOS 27, where a fling carries on past a write ────────────
//
// On the 27.0 simulator a scrollTop write mid-fling shows for one frame and
// the fling continues on its own path: it neither stops the momentum (iOS 26
// and earlier) nor stays. A correction is held through the tail as on every
// version; an absolute command issued mid-fling waits for the tail to close
// instead of being lost. Told apart by `CSS.supports('overflow-anchor:
// auto')`, stubbed here.

// A fling from 2000, now passing 1500.
function flingOnIOS27(ios27 = true) {
  const h = makeDeferralHarness({ start: 2000, ios27 })
  h.touch('touchstart')
  h.run(() => h.scroll(true, 2010))
  h.touch('touchend')
  h.run(() => h.scroll(true, 1500))
  h.writes.length = 0
  return h
}

test('iOS 27: a scrollToIndex mid-fling waits for the tail, and the fling does not retire it', () => {
  const h = flingOnIOS27()
  h.run(() => {
    h.v.scrollToIndex(90, { align: 'start' })
    // Not written: the fling would carry on past it.
    expect(h.writes).toEqual([])
    h.scroll(true, 1200)
    h.frame()
    expect(h.writes).toEqual([])
    expect(h.el.scrollTop).toBe(1200)
    h.scroll(false)
  })
  // The tail closes 150ms after the last fling frame: written now, once.
  h.expireTail()
  expect(h.writes).toEqual([4500])
  h.run(() => {
    h.scroll(true, 4500)
    h.frame()
    h.frame()
    h.scroll(false)
  })
  expect(h.rowTop(90)).toBe(0)
  expect(h.v.scrollState).toBeNull()
})

test('iOS 26: a scrollToIndex mid-fling is written at once, as before', () => {
  const h = flingOnIOS27(false)
  h.run(() => h.v.scrollToIndex(90, { align: 'start' }))
  expect(h.writes).toEqual([4500])
})

test('iOS 27: a waiting index target follows rows measured during the fling', () => {
  const h = flingOnIOS27()
  h.run(() => {
    h.v.scrollToIndex(90, { align: 'start' })
    h.v.resizeItem(30, 100)
    h.scroll(true, 1200)
    h.scroll(false)
  })
  h.expireTail()
  // Row 30 grew by 50 while the command waited: the write targets the fresh
  // start of row 90, not the 4500 computed at the call.
  expect(h.writes).toEqual([4550])
})

// A touch that lands on a scroller still in its fling fires no touch or
// pointer events on iOS (seen on the 26.5 and 27.0 simulators and an iPhone
// on 27.0.1, #1307). Touch events arrive only once the fling has stopped,
// inside the tail's 150ms.

test('iOS 27: a drag after the fling stopped, while the command waits, cancels it', () => {
  const h = flingOnIOS27()
  h.run(() => {
    h.v.scrollToIndex(90, { align: 'start' })
    h.scroll(false)
  })
  h.touch('touchstart')
  h.run(() => h.scroll(true, 1300))
  h.touch('touchend')
  h.run(() => h.scroll(false))
  h.expireTail()
  expect(h.writes).toEqual([])
  expect(h.el.scrollTop).toBe(1300)
  expect(h.v.scrollState).toBeNull()
})

test('iOS 27: a tap after the fling stopped, while the command waits, does not cancel it', () => {
  const h = flingOnIOS27()
  h.run(() => {
    h.v.scrollToIndex(90, { align: 'start' })
    h.scroll(false)
  })
  h.touch('touchstart')
  h.touch('touchend')
  h.expireTail()
  expect(h.writes).toEqual([4500])
})

test('iOS 27: a tap that stops the fling at speed (no touch events) cancels the waiting command', () => {
  const h = flingOnIOS27() // heading up, passing 1500
  h.run(() => {
    h.v.scrollToIndex(90, { align: 'start' })
    // Moving ~20px a frame when the finger lands: the events just stop.
    for (const top of [1480, 1460, 1441, 1422]) {
      h.advance(16)
      h.scroll(true, top)
    }
    h.scroll(false)
  })
  h.expireTail()
  // The finger is still down: iOS would undo a write now, and the user has
  // taken over.
  expect(h.writes).toEqual([])
  expect(h.v.scrollState).toBeNull()
})

test('iOS 27: a fling caught and dragged back (no touch events) cancels the waiting command', () => {
  const h = flingOnIOS27() // heading up, passing 1500
  h.run(() => {
    h.v.scrollToIndex(90, { align: 'start' })
    h.scroll(true, 1300)
    // A finger catches the fling and drags the other way. Momentum never
    // reverses inside the scroll range.
    h.scroll(true, 1350)
    h.scroll(true, 1600)
    h.scroll(false)
  })
  h.expireTail()
  expect(h.writes).toEqual([])
  expect(h.el.scrollTop).toBe(1600)
  expect(h.v.scrollState).toBeNull()
})

test('iOS 27: a fling bouncing off the top does not cancel the waiting command', () => {
  const h = flingOnIOS27()
  h.run(() => {
    h.v.scrollToIndex(90, { align: 'start' })
    h.scroll(true, 100)
    h.scroll(true, -40)
    // Back from the bounce in one frame: a reversal, but not the user's.
    h.scroll(true, 0)
    h.scroll(false)
  })
  h.expireTail()
  expect(h.writes).toEqual([4500])
})

test('iOS 27: a fling bouncing off the bottom does not cancel the waiting command', () => {
  const h = makeDeferralHarness({ start: 4000, ios27: true })
  h.touch('touchstart')
  h.run(() => h.scroll(true, 3990))
  h.touch('touchend')
  h.run(() => h.scroll(true, 4500))
  h.writes.length = 0
  h.run(() => {
    h.v.scrollToIndex(10, { align: 'start' })
    h.scroll(true, 4800) // max
    h.scroll(true, 4850)
    h.scroll(true, 4800)
    h.scroll(false)
  })
  h.expireTail()
  expect(h.writes).toEqual([500])
})

// Scroll events recorded on an iPhone (iOS 27.0.1), replayed with their
// timing and shifted into this list (`[time ms, scrollTop]`).
function replayOnIOS27(name: string, shift: number) {
  const recorded = flings.find((fling) => fling.name === name)!.samples
  const [t0, top0] = recorded[0]!
  // The flick that started the fling, in the fling's direction.
  const back = Math.sign(recorded[1]![1]! - top0!) * 10
  const h = makeDeferralHarness({
    start: top0! + shift - 2 * back,
    ios27: true,
  })
  h.touch('touchstart')
  h.run(() => h.scroll(true, top0! + shift - back))
  h.touch('touchend')
  h.run(() => h.scroll(true, top0! + shift))
  h.writes.length = 0
  h.run(() => h.v.scrollToIndex(90, { align: 'start' }))
  let last = t0!
  for (const [t, top] of recorded.slice(1)) {
    h.advance(t! - last)
    last = t!
    h.run(() => h.scroll(true, top! + shift))
  }
  h.run(() => h.scroll(false))
  h.expireTail()
  return h
}

test('iOS 27: a recorded fling alone does not cancel the waiting command', () => {
  const h = replayOnIOS27('one flick, glide to rest (reflick run)', -9000)
  expect(h.writes).toEqual([4500])
})

test.each([
  'glide stopped by a tap 1',
  'glide stopped by a tap 2',
  'glide stopped by a tap 3',
])(
  'iOS 27: a recorded tap that stops the fling cancels the waiting command: %s',
  (name) => {
    const h = replayOnIOS27(name, -5000)
    expect(h.writes).toEqual([])
    expect(h.v.scrollState).toBeNull()
  },
)

test('iOS 27: a second flick during the fling (no touch events) cancels the waiting command', () => {
  const h = replayOnIOS27('glide, flicked again the same way (back run)', -5000)
  expect(h.writes).toEqual([])
  expect(h.v.scrollState).toBeNull()
})

test('iOS 27: a fling caught, held, then dragged the same way (no touch events) cancels the waiting command', () => {
  const h = flingOnIOS27() // heading up, passing 1500
  h.run(() => {
    h.v.scrollToIndex(90, { align: 'start' })
    for (const top of [1480, 1462, 1446]) {
      h.advance(16)
      h.scroll(true, top)
    }
    // Caught: the finger rests, nothing moves.
    h.advance(100)
    h.scroll(true, 1445)
    // It drags on, faster than the fling was going.
    for (const top of [1400, 1350, 1300]) {
      h.advance(16)
      h.scroll(true, top)
    }
    h.scroll(false)
  })
  h.expireTail()
  expect(h.writes).toEqual([])
  expect(h.v.scrollState).toBeNull()
})

test('iOS 27: a command issued after a second flick waits for the new fling', () => {
  const h = flingOnIOS27() // heading up, passing 1500
  const glide = (tops: Array<number>) => {
    for (const top of tops) {
      h.advance(16)
      h.scroll(true, top)
    }
  }
  h.run(() => {
    h.v.scrollToIndex(90, { align: 'start' })
    glide([1490, 1481, 1473, 1466])
    // A second flick: the command waiting is the user's to drop.
    glide([1430, 1390, 1350])
    expect(h.v.scrollState).toBeNull()
    // A new one waits for the new fling as it slows.
    h.v.scrollToIndex(80, { align: 'start' })
    glide([1312, 1276, 1242, 1210, 1180])
    expect(h.v.scrollState?.phase).toBe('queued')
    // It fades out on its own.
    for (const top of [1176, 1174, 1173, 1172]) {
      h.advance(50)
      h.scroll(true, top)
    }
    h.scroll(false)
  })
  h.expireTail()
  expect(h.writes).toEqual([4000])
})

test('iOS 27: a tap late in the fling (0.21px/ms) cancels the waiting command', () => {
  const h = flingOnIOS27() // heading up, passing 1500
  h.run(() => {
    h.v.scrollToIndex(90, { align: 'start' })
    // ~3.4px a frame when the finger lands (another iPhone, #1307).
    for (const top of [1497, 1493, 1490, 1487, 1483, 1480]) {
      h.advance(16)
      h.scroll(true, top)
    }
    h.scroll(false)
  })
  h.expireTail()
  expect(h.writes).toEqual([])
  expect(h.v.scrollState).toBeNull()
})

test('iOS 27: a fling that went on with no scroll events is not read as caught', () => {
  const h = flingOnIOS27() // heading up, passing 1500
  h.run(() => {
    h.v.scrollToIndex(90, { align: 'start' })
    // 0.25px/ms when the events stop...
    for (const top of [1496, 1492, 1488, 1484]) {
      h.advance(16)
      h.scroll(true, top)
    }
  })
  // ...but the element keeps moving, fading out, with none.
  for (const top of [1478, 1476]) {
    h.advance(150)
    h.el.scrollTop = top
    h.expireTail()
    expect(h.writes).toEqual([])
  }
  // It stopped: the speed it stopped at is the silent one, not 0.25px/ms.
  h.advance(150)
  h.expireTail()
  expect(h.writes).toEqual([4500])
})

test('iOS 27: the waiting command is not written while the fling still moves between scroll events', () => {
  const h = flingOnIOS27()
  h.run(() => {
    h.v.scrollToIndex(90, { align: 'start' })
    h.scroll(true, 1490)
  })
  // The end of a fling: under a pixel per frame, so the element moves with
  // no scroll event for 150ms.
  h.el.scrollTop = 1488
  h.expireTail()
  expect(h.writes).toEqual([])
  expect(h.v.scrollState?.phase).toBe('queued')
  // At rest now: written.
  h.expireTail()
  expect(h.writes).toEqual([4500])
})

test("iOS 27: a command issued from a tap's tail is written at once", () => {
  const h = makeDeferralHarness({ start: 2000, ios27: true })
  h.touch('touchstart')
  h.touch('touchend')
  h.writes.length = 0
  h.run(() => h.v.scrollToIndex(90, { align: 'start' }))
  // No drag before the finger lifted, so no fling to wait for.
  expect(h.writes).toEqual([4500])
})

test('iOS 27: the hold is released before the waiting command is written', () => {
  const h = flingOnIOS27()
  h.run(() => {
    h.v.scrollToIndex(90, { align: 'start' })
    // Row 5 (above the viewport) grows by 50: held, the rows exposed
    // shifted back by it.
    h.v.resizeItem(5, 100)
    expect(h.writes).toEqual([])
    expect(h.v.getVirtualItems()[0]!.start).toBe(
      h.v['getMeasurements']()[h.v.getVirtualItems()[0]!.index]!.start - 50,
    )
    h.scroll(false)
  })
  h.expireTail()
  // The hold lands where the fling ended (1500 + 50), then the command.
  expect(h.writes).toEqual([1550, 4550])
  expect(h.v.getVirtualItems()[0]!.start).toBe(
    h.v['getMeasurements']()[h.v.getVirtualItems()[0]!.index]!.start,
  )
})

test('iOS 27: a command that waits past the safety valve is dropped', () => {
  const h = flingOnIOS27()
  h.run(() => {
    h.v.scrollToIndex(90, { align: 'start' })
    h.advance(6000)
    h.frame()
  })
  h.expireTail()
  expect(h.writes).toEqual([])
  expect(h.v.scrollState).toBeNull()
})

test('iOS 27: a correction mid-fling is held through the tail, as on 26', () => {
  const h = makeDeferralHarness({ start: 1000, ios27: true })
  h.writes.length = 0
  h.touch('touchstart')
  h.run(() => {
    h.scroll(true, 1010)
    h.v.resizeItem(5, 100)
  })
  h.touch('touchend')
  h.run(() => {
    h.scroll(true, 3000)
    h.scroll(false)
  })
  expect(h.writes).toEqual([])
  h.expireTail()
  expect(h.el.scrollTop).toBe(3050)
  expect(h.rowTop(60)).toBe(0)
})
