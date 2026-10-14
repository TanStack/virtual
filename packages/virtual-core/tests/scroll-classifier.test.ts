import { describe, expect, test, vi } from 'vitest'
import {
  classifyScrollEvent,
  externalRetiresCommand,
  flingCaught,
  flingSpedUp,
} from '../src/scroll-classifier'
import type {
  RetireInput,
  ScrollEventInput,
  ScrollSample,
} from '../src/scroll-classifier'
import flings from './fixtures/ios27-flings.json'

const at = (input: Partial<ScrollEventInput>) =>
  classifyScrollEvent({
    offset: 1000,
    isScrolling: true,
    elementMax: null,
    holdOffset: 0,
    scrollOffset: 500,
    pendingWrite: null,
    clampedMaxAtWrite: null,
    ...input,
  })

describe('classifyScrollEvent', () => {
  test('a scroll event with nothing pending is external', () => {
    expect(at({})).toBe('external')
    expect(at({ isScrolling: false })).toBe('external')
  })

  describe('spurious', () => {
    test('scrolling at the held offset with no write pending', () => {
      expect(at({ offset: 500, scrollOffset: 500 })).toBe('spurious')
    })

    test('needs an exact match', () => {
      expect(at({ offset: 500.5, scrollOffset: 500 })).toBe('external')
    })

    test('a report at rest is not spurious', () => {
      expect(at({ offset: 500, scrollOffset: 500, isScrolling: false })).toBe(
        'external',
      )
    })

    test('a pending write makes it a read-back instead', () => {
      expect(
        at({
          offset: 500,
          scrollOffset: 500,
          pendingWrite: { target: 500, smooth: false },
        }),
      ).toBe('readBack')
    })

    test('beats a clamped echo at the same position', () => {
      expect(
        at({ offset: 500, scrollOffset: 500, clampedMaxAtWrite: 500 }),
      ).toBe('spurious')
    })
  })

  describe('readBack', () => {
    test('within 1.5px of the pending target, either side', () => {
      const pendingWrite = { target: 1000, smooth: false }
      expect(at({ offset: 1001.4, pendingWrite })).toBe('readBack')
      expect(at({ offset: 998.6, pendingWrite })).toBe('readBack')
      expect(at({ offset: 1001.5, pendingWrite })).toBe('external')
    })

    test('a smooth write reads back the same way', () => {
      expect(
        at({ offset: 1000, pendingWrite: { target: 1000, smooth: true } }),
      ).toBe('readBack')
    })

    test('reported at rest', () => {
      expect(
        at({
          offset: 1000,
          isScrolling: false,
          pendingWrite: { target: 1000, smooth: false },
        }),
      ).toBe('readBack')
    })

    test('beats a clamped read-back when the target is just past the max', () => {
      expect(
        at({
          offset: 1000.5,
          elementMax: 1000,
          pendingWrite: { target: 1001, smooth: false },
        }),
      ).toBe('readBack')
    })

    test('beats a clamped echo near the max at write time', () => {
      expect(
        at({
          offset: 1000.4,
          pendingWrite: { target: 1000, smooth: false },
          clampedMaxAtWrite: 1000,
        }),
      ).toBe('readBack')
    })
  })

  describe('clampedReadBack', () => {
    const pendingWrite = { target: 1200, smooth: false }

    test('a non-smooth write past the max reporting at the max', () => {
      expect(at({ offset: 1000, elementMax: 1000, pendingWrite })).toBe(
        'clampedReadBack',
      )
      expect(at({ offset: 1001.4, elementMax: 1000, pendingWrite })).toBe(
        'clampedReadBack',
      )
      expect(at({ offset: 1001.5, elementMax: 1000, pendingWrite })).toBe(
        'external',
      )
    })

    test('the max is shifted by a held correction', () => {
      expect(
        at({ offset: 1000, elementMax: 950, holdOffset: 50, pendingWrite }),
      ).toBe('clampedReadBack')
      expect(
        at({ offset: 950, elementMax: 950, holdOffset: 50, pendingWrite }),
      ).toBe('external')
    })

    test('the target must exceed the max by more than 0.5px', () => {
      expect(
        at({
          offset: 998.6,
          elementMax: 1000,
          pendingWrite: { target: 1000.5, smooth: false },
        }),
      ).toBe('external')
    })

    test('not for a smooth write', () => {
      expect(
        at({
          offset: 1000,
          elementMax: 1000,
          pendingWrite: { target: 1200, smooth: true },
        }),
      ).toBe('external')
    })

    test('not without the element max (a report at rest)', () => {
      expect(at({ offset: 1000, elementMax: null, pendingWrite })).toBe(
        'external',
      )
    })

    test('beats a clamped echo at the same max', () => {
      expect(
        at({
          offset: 1000,
          elementMax: 1000,
          pendingWrite,
          clampedMaxAtWrite: 1000,
        }),
      ).toBe('clampedReadBack')
    })
  })

  describe('clampedEcho', () => {
    test('within 1.5px of the max at write time', () => {
      expect(at({ offset: 1000, clampedMaxAtWrite: 1000 })).toBe('clampedEcho')
      expect(at({ offset: 1001.4, clampedMaxAtWrite: 1000 })).toBe(
        'clampedEcho',
      )
      expect(at({ offset: 1001.5, clampedMaxAtWrite: 1000 })).toBe('external')
    })

    test('with an unrelated write pending', () => {
      expect(
        at({
          offset: 1000,
          pendingWrite: { target: 2000, smooth: true },
          clampedMaxAtWrite: 1000,
        }),
      ).toBe('clampedEcho')
    })

    test('reported at rest', () => {
      expect(
        at({ offset: 1000, isScrolling: false, clampedMaxAtWrite: 1000 }),
      ).toBe('clampedEcho')
    })
  })
})

describe('externalRetiresCommand', () => {
  const command: NonNullable<RetireInput['command']> = {
    index: 20,
    phase: 'instant',
    lastTargetOffset: 1000,
  }
  const retires = (input: Partial<RetireInput>, targetAt = 1000) => {
    const target = vi.fn(() => targetAt)
    const result = externalRetiresCommand({
      kind: 'external',
      offset: 500,
      command,
      target,
      ...input,
    })
    return { result, targetCalls: target.mock.calls.length }
  }

  test('an external scroll away from an index command retires it', () => {
    expect(retires({})).toEqual({ result: true, targetCalls: 1 })
  })

  test.each(['spurious', 'readBack', 'clampedReadBack'] as const)(
    'a %s event never retires, without computing the target',
    (kind) => {
      expect(retires({ kind })).toEqual({ result: false, targetCalls: 0 })
    },
  )

  test('a clamped echo keeps the command, but only after the target check', () => {
    expect(retires({ kind: 'clampedEcho' })).toEqual({
      result: false,
      targetCalls: 1,
    })
  })

  test('no command, or an offset or end command, is not retired here', () => {
    expect(retires({ command: null })).toEqual({
      result: false,
      targetCalls: 0,
    })
    expect(retires({ command: { ...command, index: null } })).toEqual({
      result: false,
      targetCalls: 0,
    })
  })

  test.each(['queued', 'smooth', 'smoothFinishing'] as const)(
    'a %s command is not retired',
    (phase) => {
      expect(retires({ command: { ...command, phase } })).toEqual({
        result: false,
        targetCalls: 0,
      })
    },
  )

  test('a landed smooth command is retired like an instant one', () => {
    expect(retires({ command: { ...command, phase: 'smoothLanded' } })).toEqual(
      { result: true, targetCalls: 1 },
    )
  })

  test('an event at the last target keeps the command', () => {
    expect(retires({ offset: 1000.5 })).toEqual({
      result: false,
      targetCalls: 0,
    })
  })

  test('an event at the recomputed target keeps the command', () => {
    expect(retires({ offset: 1200.5 }, 1200)).toEqual({
      result: false,
      targetCalls: 1,
    })
  })
})

// Scroll events recorded on an iPhone (iOS 27.0.1) while a `scrollToIndex`
// waited for the fling (#1307): `[time ms, scrollTop]`. A second flick during
// a fling fires no touch events, so these are the only trace of it.
describe('flingSpedUp', () => {
  // When `flingSpedUp` first holds, fed one event at a time with the last
  // 200ms kept, as the scroll handler does.
  const firstSpeedUp = (name: string) => {
    const recorded = flings.find((fling) => fling.name === name)!.samples
    let samples: Array<ScrollSample> = []
    for (const [t, offset] of recorded) {
      samples = samples.filter((sample) => t! - sample.t <= 200)
      samples.push({ t: t!, offset: offset! })
      if (flingSpedUp(samples)) return t
    }
    return null
  }

  test('a fling alone never speeds up, down to rest', () => {
    expect(firstSpeedUp('one flick, glide to rest (reflick run)')).toBeNull()
  })

  test.each([
    // [fling, when the second flick shows in the events, when it is seen]
    ['glide, flicked again the same way (back run)', 2417, 2468],
    ['glide, flicked again the same way (free run)', 5773, 5793],
    ['glide almost at rest, flicked again (free run)', 8708, 8708],
  ])('a second flick is seen within 60ms: %s', (name, flick, seen) => {
    expect(firstSpeedUp(name)).toBe(seen)
    expect(seen - flick).toBeLessThanOrEqual(60)
  })

  const samples = (...points: Array<[number, number]>) =>
    points.map(([t, offset]) => ({ t, offset }))

  test('needs two 40ms windows', () => {
    expect(flingSpedUp(samples([0, 0], [20, 0], [40, 200]))).toBe(false)
    expect(flingSpedUp(samples([0, 0], [40, 0], [80, 200]))).toBe(true)
  })

  test('a turn back is not a speed-up (handled as a reversal)', () => {
    expect(flingSpedUp(samples([0, 0], [40, 40], [80, -200]))).toBe(false)
  })

  test('a 2x rise of less than 0.8px/ms is not one', () => {
    expect(flingSpedUp(samples([0, 0], [40, 20], [80, 60]))).toBe(false)
    expect(flingSpedUp(samples([0, 0], [40, 20], [80, 100]))).toBe(true)
  })

  test('a 1.7x rise, as from a merged frame, is not one', () => {
    expect(flingSpedUp(samples([0, 0], [40, 80], [80, 216]))).toBe(false)
  })
})

describe('flingCaught', () => {
  // The last 200ms of a recorded fling, as the scroll handler keeps them.
  const tail = (name: string) => {
    const recorded = flings.find((fling) => fling.name === name)!.samples
    const [end] = recorded[recorded.length - 1]!
    return recorded
      .filter(([t]) => end! - t! <= 200)
      .map(([t, offset]) => ({ t: t!, offset: offset! }))
  }

  test.each([
    'glide stopped by a tap 1',
    'glide stopped by a tap 2',
    'glide stopped by a tap 3',
  ])('a fling stopped by a finger: %s', (name) => {
    expect(flingCaught(tail(name))).toBe(true)
  })

  test('a fling that ends on its own is not caught', () => {
    expect(flingCaught(tail('one flick, glide to rest (reflick run)'))).toBe(
      false,
    )
  })

  test('needs a 40ms window', () => {
    expect(flingCaught([])).toBe(false)
    expect(
      flingCaught([
        { t: 0, offset: 0 },
        { t: 20, offset: 40 },
      ]),
    ).toBe(false)
    expect(
      flingCaught([
        { t: 0, offset: 0 },
        { t: 40, offset: 2 },
      ]),
    ).toBe(true)
    expect(
      flingCaught([
        { t: 0, offset: 0 },
        { t: 40, offset: 1 },
      ]),
    ).toBe(false)
  })

  // A fling at a steady speed for 100ms, 16ms a frame.
  const atSpeed = (pxPerMs: number) =>
    Array.from({ length: 7 }, (_, i) => ({
      t: i * 16,
      offset: Math.round(i * 16 * pxPerMs),
    }))

  test('late taps (0.21–0.35px/ms, another iPhone) are caught', () => {
    expect(flingCaught(atSpeed(0.21))).toBe(true)
    expect(flingCaught(atSpeed(0.35))).toBe(true)
  })

  test('the slowest natural end recorded (0.015px/ms) is not', () => {
    // 1px every 67ms, as the last frames of a fling report.
    expect(
      flingCaught([
        { t: 0, offset: 0 },
        { t: 67, offset: 1 },
        { t: 134, offset: 2 },
      ]),
    ).toBe(false)
  })
})
