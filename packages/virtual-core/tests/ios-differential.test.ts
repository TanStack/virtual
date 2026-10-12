import { describe, expect, test } from 'vitest'
import { Virtualizer, _resetIOSDetectionForTests } from '../src/index'
import type { ScrollAlignment, VirtualizerOptions } from '../src/index'

// Differential check for the iOS scroll deferral (#1307).
//
// On iOS WebKit a scrollTop write cancels momentum, so size corrections made
// while the scroller is live are deferred and written once it settles. On
// every other platform the same correction is written immediately. Deferral
// should change only *when* a correction lands, never *how much*: after the
// same sequence of events, both platforms must settle at the same scrollTop.
//
// Each case runs on two fresh virtualizers, one with an iOS user agent, and
// compares the settled scrollTop.

type Step =
  | { t: 'at'; top: number } // the element starts here, at rest
  | { t: 'index'; i: number; align?: ScrollAlignment }
  | { t: 'end' }
  | { t: 'by'; d: number }
  | { t: 'cancel' }
  | { t: 'resize'; i: number; size: number }
  | { t: 'prepend'; n: number }
  | { t: 'event' } // read-back of the current position, still scrolling
  | { t: 'idle' } // a scroll event that reports the scroller at rest
  | { t: 'drag'; d: number } // native scroll by the user
  | { t: 'touchstart' }
  | { t: 'touchend' }
  | { t: 'frame' }
  | { t: 'valve' } // jump past the reconcile safety valve, then a frame

type Options = Partial<VirtualizerOptions<any, any>>

const IOS_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)'
const VIEWPORT = 200

function run(ios: boolean, c: Case) {
  if (ios) {
    Object.defineProperty(navigator, 'userAgent', {
      value: IOS_UA,
      configurable: true,
    })
  }
  _resetIOSDetectionForTests()
  try {
    return runSteps(c.steps, c.options ?? {}, c.setup)
  } finally {
    delete (navigator as any).userAgent
    _resetIOSDetectionForTests()
  }
}

function runSteps(
  steps: Array<Step>,
  options: Options,
  setup?: (v: Virtualizer<any, any>) => void,
) {
  const rafs: Array<FrameRequestCallback> = []
  const timers = new Map<number, () => void>()
  let timerId = 0
  let clock = 0
  const listeners: Record<string, Array<() => void>> = {}
  const win = {
    requestAnimationFrame: (cb: FrameRequestCallback) => rafs.push(cb),
    cancelAnimationFrame: () => {},
    setTimeout: (fn: () => void) => {
      timers.set(++timerId, fn)
      return timerId
    },
    clearTimeout: (id: number) => timers.delete(id),
    performance: { now: () => clock },
  }
  const el = {
    scrollTop: 0,
    scrollLeft: 0,
    scrollHeight: 0,
    clientHeight: VIEWPORT,
    offsetHeight: VIEWPORT,
    ownerDocument: { defaultView: win },
    addEventListener: (type: string, fn: () => void) => {
      ;(listeners[type] ??= []).push(fn)
    },
    removeEventListener: () => {},
  }
  const max = () => el.scrollHeight - el.clientHeight
  let ids = Array.from({ length: options.count ?? 100 }, (_, i) => i)
  let scrollCallback: ((offset: number, isScrolling: boolean) => void) | null =
    null
  let dragClamped = false

  const v = new Virtualizer({
    count: ids.length,
    estimateSize: () => 50,
    getItemKey: (i) => ids[i]!,
    getScrollElement: () => el as any,
    scrollToFn: (offset, { adjustments = 0 }) => {
      el.scrollTop = Math.max(0, Math.min(offset + adjustments, max()))
    },
    observeElementRect: (_inst, cb) => {
      cb({ width: 400, height: VIEWPORT })
      return () => {}
    },
    observeElementOffset: (_inst, cb) => {
      scrollCallback = cb
      cb(el.scrollTop, false)
      return () => {}
    },
    ...options,
  })
  setup?.(v)

  // What a framework adapter does on every render: rebuild measurements,
  // run the update hook, and size the scroll container to the total.
  const render = () => {
    v['getMeasurements']()
    v._willUpdate()
    el.scrollHeight = v.getTotalSize() + (v.options.scrollMargin ?? 0)
  }
  const scroll = (isScrolling: boolean) =>
    scrollCallback!(el.scrollTop, isScrolling)
  const frame = () => rafs.splice(0).forEach((cb) => cb(clock))
  const fire = (type: string) => listeners[type]?.forEach((fn) => fn())

  render()

  for (const step of steps) {
    switch (step.t) {
      case 'at':
        el.scrollTop = step.top
        scroll(false)
        break
      case 'index':
        v.scrollToIndex(step.i, { align: step.align ?? 'start' })
        break
      case 'end':
        v.scrollToEnd()
        break
      case 'by':
        v.scrollBy(step.d)
        break
      case 'cancel':
        v.cancelScroll()
        break
      case 'resize':
        v.resizeItem(step.i, step.size)
        render()
        break
      case 'prepend':
        ids = [
          ...Array.from({ length: step.n }, (_, i) => i - step.n - ids.length),
          ...ids,
        ]
        v.setOptions({ ...v.options, count: ids.length })
        render()
        break
      case 'event':
        scroll(true)
        break
      case 'idle':
        scroll(false)
        break
      case 'drag': {
        const next = el.scrollTop + step.d
        el.scrollTop = Math.max(0, Math.min(next, max()))
        if (el.scrollTop !== next) dragClamped = true
        scroll(true)
        break
      }
      case 'touchstart':
        fire('touchstart')
        break
      case 'touchend':
        fire('touchend')
        break
      case 'frame':
        frame()
        break
      case 'valve':
        clock += 6000
        frame()
        break
    }
  }

  // Settle: let reconcile finish while the scroller still reports motion,
  // report rest, let the touch grace timer expire, and finish reconcile at
  // rest. A reconcile still running then is stuck off its target; push it
  // through the safety valve so the positions compare, but report it.
  for (let i = 0; i < 20 && rafs.length > 0; i++) {
    frame()
    scroll(true)
  }
  scroll(false)
  timers.forEach((fn) => fn())
  timers.clear()
  for (let i = 0; i < 20 && rafs.length > 0; i++) {
    frame()
    scroll(false)
  }
  const stuck = v.scrollState !== null
  if (stuck) {
    clock += 6000
    frame()
    scroll(false)
  }

  return { top: el.scrollTop, dragClamped, stuck }
}

type Case = {
  name: string
  steps: Array<Step>
  options?: Options
  setup?: (v: Virtualizer<any, any>) => void
}

const at1000 = (): Step => ({ t: 'at', top: 1000 })
const landedOn20 = (align: ScrollAlignment = 'start'): Array<Step> => [
  { t: 'index', i: 20, align },
  { t: 'event' },
  { t: 'frame' }, // reached the target, still waiting for stable frames
]

const keyedEnd: Options = { anchorTo: 'end' }

const cases: Array<Case> = [
  {
    name: 'A: resize above the target during an index scroll, lands (#1304)',
    steps: [
      { t: 'index', i: 20 },
      { t: 'event' },
      { t: 'resize', i: 10, size: 100 },
    ],
  },
  {
    name: 'B: resize after the last reconcile write, gesture interrupts',
    steps: [
      ...landedOn20(),
      { t: 'resize', i: 10, size: 100 },
      { t: 'drag', d: -100 },
    ],
  },
  {
    name: 'C: scroll up, row between target and old viewport grows before the read-back, gesture',
    steps: [
      { t: 'at', top: 2000 },
      { t: 'index', i: 20 },
      { t: 'resize', i: 30, size: 100 },
      { t: 'event' },
      { t: 'frame' },
      { t: 'drag', d: -50 },
    ],
  },
  {
    name: 'D: scroll up, row between target and old viewport grows before the read-back, lands',
    steps: [
      { t: 'at', top: 2000 },
      { t: 'index', i: 20 },
      { t: 'resize', i: 30, size: 100 },
    ],
  },
  {
    name: 'D2: scroll up, row above the target grows before the read-back, lands',
    steps: [
      { t: 'at', top: 2000 },
      { t: 'index', i: 20 },
      { t: 'resize', i: 10, size: 100 },
    ],
  },
  {
    name: 'E: user scroll, row above grows, user flings past it',
    steps: [
      { t: 'drag', d: 1000 },
      { t: 'resize', i: 10, size: 100 },
      { t: 'drag', d: -700 },
    ],
  },
  {
    name: 'F: align end, a visible row grows, gesture',
    steps: [
      ...landedOn20('end'),
      { t: 'resize', i: 19, size: 100 },
      { t: 'drag', d: -100 },
    ],
  },
  {
    name: 'G: align end, a row above grows, gesture',
    steps: [
      ...landedOn20('end'),
      { t: 'resize', i: 10, size: 100 },
      { t: 'drag', d: -100 },
    ],
  },
  {
    name: 'H: align center, a row above grows, gesture',
    steps: [
      ...landedOn20('center'),
      { t: 'resize', i: 10, size: 100 },
      { t: 'drag', d: -100 },
    ],
  },
  {
    name: 'I: lanes 2 measured, the target changes lane, gesture',
    options: {
      lanes: 2,
      laneAssignmentMode: 'measured',
      estimateSize: (i) => (i === 19 ? 80 : 50),
    },
    steps: [
      ...landedOn20(),
      { t: 'resize', i: 18, size: 100 },
      { t: 'drag', d: -100 },
    ],
  },
  {
    name: 'J: scrollPaddingStart, a visible row above the target grows, gesture',
    options: { scrollPaddingStart: 100 },
    steps: [
      ...landedOn20(),
      { t: 'resize', i: 19, size: 100 },
      { t: 'drag', d: -100 },
    ],
  },
  {
    name: 'K: scrollMargin, target near the end, a row above grows, gesture',
    options: { scrollMargin: 300 },
    steps: [
      { t: 'index', i: 93 },
      { t: 'event' },
      { t: 'frame' },
      { t: 'resize', i: 10, size: 100 },
      { t: 'drag', d: -100 },
    ],
  },
  {
    name: 'L: custom predicate opting out, gesture',
    setup: (v) => {
      v.shouldAdjustScrollPositionOnItemSizeChange = () => false
    },
    steps: [
      ...landedOn20(),
      { t: 'resize', i: 10, size: 100 },
      { t: 'drag', d: -100 },
    ],
  },
  {
    name: 'M: cancelScroll after the scroll settled',
    steps: [
      { t: 'index', i: 20 },
      { t: 'event' },
      { t: 'resize', i: 10, size: 100 },
      { t: 'idle' },
      { t: 'cancel' },
    ],
  },
  {
    name: 'M2: cancelScroll while still scrolling',
    steps: [
      { t: 'index', i: 20 },
      { t: 'event' },
      { t: 'resize', i: 10, size: 100 },
      { t: 'cancel' },
    ],
  },
  {
    name: 'N: safety valve after the scroll settled',
    steps: [
      { t: 'index', i: 20 },
      { t: 'event' },
      { t: 'resize', i: 10, size: 100 },
      { t: 'idle' },
      { t: 'valve' },
    ],
  },
  {
    name: 'N2: safety valve while still scrolling',
    steps: [
      { t: 'index', i: 20 },
      { t: 'event' },
      { t: 'resize', i: 10, size: 100 },
      { t: 'valve' },
    ],
  },
  {
    name: 'O: prepend during an index scroll, lands',
    options: keyedEnd,
    steps: [...landedOn20(), { t: 'prepend', n: 10 }],
  },
  {
    name: 'O2: prepend during an index scroll, gesture',
    options: keyedEnd,
    steps: [...landedOn20(), { t: 'prepend', n: 10 }, { t: 'drag', d: -100 }],
  },
  {
    name: 'O3: prepend and a resize during an index scroll, gesture',
    options: keyedEnd,
    steps: [
      ...landedOn20(),
      { t: 'prepend', n: 10 },
      { t: 'resize', i: 5, size: 100 },
      { t: 'drag', d: -100 },
    ],
  },
  {
    name: 'P: user scroll, a row above grows, then a row at the new fold is measured',
    steps: [
      { t: 'drag', d: 1000 },
      { t: 'resize', i: 10, size: 100 },
      { t: 'resize', i: 19, size: 120 },
    ],
  },
  {
    name: 'T: scrollBy right after scrollToIndex',
    steps: [
      { t: 'index', i: 20 },
      { t: 'by', d: 100 },
    ],
  },
  {
    name: 'U: touch drag, a row above grows mid-touch, release',
    steps: [
      at1000(),
      { t: 'touchstart' },
      { t: 'drag', d: -30 },
      { t: 'resize', i: 10, size: 100 },
      { t: 'drag', d: -30 },
      { t: 'touchend' },
    ],
  },
  {
    name: 'X: scrollToEnd with anchorTo end, the last row grows, gesture',
    options: keyedEnd,
    steps: [
      { t: 'end' },
      { t: 'event' },
      { t: 'frame' },
      { t: 'resize', i: 99, size: 100 },
      { t: 'drag', d: -100 },
    ],
  },
  {
    name: 'X2: scrollToEnd, rows at the old position measured before the read-back',
    steps: [
      { t: 'end' },
      { t: 'resize', i: 0, size: 30 },
      { t: 'resize', i: 1, size: 30 },
      { t: 'resize', i: 2, size: 30 },
    ],
  },
  {
    name: 'Y: user scroll, a row above shrinks',
    steps: [
      { t: 'drag', d: 1000 },
      { t: 'resize', i: 10, size: 20 },
    ],
  },
  {
    name: 'Z: two resizes after the last reconcile write, gesture',
    steps: [
      ...landedOn20(),
      { t: 'resize', i: 10, size: 100 },
      { t: 'resize', i: 11, size: 70 },
      { t: 'drag', d: -100 },
    ],
  },
]

// Cases where iOS still diverges, by id. All but P drop a correction deferred
// while an index scroll runs (#1305) instead of applying it the way non-iOS
// does; P misses the pending deferral when classifying the next resize.
// #1307 fixes them and must remove them from this list: the test asserts
// that each one still diverges, so a fix can't go unnoticed.
const KNOWN_DIVERGENT = new Set([
  'B',
  'G',
  'H',
  'I',
  'K',
  'M',
  'M2',
  'N',
  'N2',
  'O3',
  'P',
  'Z',
])

describe('iOS deferral settles where non-iOS does', () => {
  for (const c of cases) {
    test(c.name, () => {
      const plain = run(false, c)
      const ios = run(true, c)
      const result = JSON.stringify({ plain: plain.top, ios: ios.top })
      // A drag the clamp cut short is not additive with a later correction,
      // so the two platforms legitimately differ; keep cases clear of it.
      expect(plain.dragClamped || ios.dragClamped, result).toBe(false)
      // Both platforms share a reconcile; a bug there matches on both sides,
      // so check it separately: settling never needs the safety valve.
      expect({ plain: plain.stuck, ios: ios.stuck }).toEqual({
        plain: false,
        ios: false,
      })
      if (KNOWN_DIVERGENT.has(c.name.split(':')[0]!)) {
        expect(Math.abs(plain.top - ios.top), result).toBeGreaterThan(1)
      } else {
        expect(ios.top, result).toBe(plain.top)
      }
    })
  }
})
