import { describe, expect, test } from 'vitest'
import { Virtualizer, _resetIOSDetectionForTests } from '../src/index'
import type { ScrollToOptions, VirtualizerOptions } from '../src/index'

type ScrollAlignment = NonNullable<ScrollToOptions['align']>

// Behaviour snapshot for refactors of the scroll machinery.
//
// Seeded random event sequences (scroll commands, read-backs, smooth
// animation steps, content resizes delivered by ResizeObserver, prepends,
// user drags that rubber-band past an edge, touches, renders, frames, waits
// that fire due timers, the reconcile safety valve)
// run against a simulated browser, on iOS and non-iOS, across a set of layout
// options. Each sequence records only what a consumer can observe: every
// write to the element, where it rests after each step, and what the adapter
// renders. The traces are hashed per seed and compared with the committed
// snapshot.
//
// A refactor with no behaviour change leaves the snapshot untouched. A fix
// that changes behaviour updates it (`vitest -u`), and the snapshot diff shows
// which configurations and seeds moved. To read one trace in full:
//
//   SCROLL_TRACE=lanes/ios/17 pnpm vitest run tests/scroll-trace.test.ts
//
// Private state is deliberately not recorded: it is what refactors change.

type Behavior = 'auto' | 'smooth'

type Step =
  | { t: 'index'; i: number; align: ScrollAlignment; behavior: Behavior }
  | { t: 'offset'; to: number; behavior: Behavior }
  | { t: 'by'; d: number; behavior: Behavior }
  | { t: 'end'; behavior: Behavior }
  | { t: 'cancel' }
  // Content changes size. `pick` chooses among the rendered rows; the
  // ResizeObserver delivers all of a step's rows in one callback.
  | { t: 'resize'; picks: Array<number>; sizes: Array<number> }
  | { t: 'prepend'; n: number }
  | { t: 'append'; n: number }
  | { t: 'render' } // the adapter re-renders after onChange
  | { t: 'event' } // a scroll event reporting the element, still scrolling
  | { t: 'idle' } // a scroll event reporting the element at rest
  | { t: 'anim' } // one frame of a native smooth scroll animation
  | { t: 'drag'; d: number } // native scroll by the user
  | { t: 'touchstart' }
  | { t: 'touchend' }
  | { t: 'touchcancel' }
  | { t: 'frame' }
  | { t: 'wait'; ms: number } // time passes: timeouts due by then fire
  | { t: 'valve' } // jump past the reconcile safety valve, then a frame

type Options = Partial<VirtualizerOptions<any, any>>

type Config = {
  name: string
  options?: Options
  setup?: (v: Virtualizer<any, any>) => void
  // Share of scroll commands issued with `behavior: 'smooth'`.
  smooth?: number
}

const IOS_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)'
const VIEWPORT = 200
const SEEDS = 60
const STEPS = 50

const configs: Array<Config> = [
  { name: 'base' },
  {
    name: 'variable',
    options: { estimateSize: (i) => 30 + (i % 5) * 15 },
  },
  { name: 'lanes', options: { lanes: 2 } },
  {
    name: 'padding',
    options: {
      paddingStart: 30,
      paddingEnd: 40,
      scrollPaddingStart: 20,
      scrollPaddingEnd: 10,
      gap: 5,
    },
  },
  { name: 'margin', options: { scrollMargin: 100 } },
  { name: 'anchorEnd', options: { anchorTo: 'end' } },
  {
    name: 'predicate',
    setup: (v) => {
      v.shouldAdjustScrollPositionOnItemSizeChange = (_item, delta) => delta > 0
    },
  },
  { name: 'horizontal', options: { horizontal: true } },
  { name: 'smooth', smooth: 0.8 },
]

// mulberry32
function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// FNV-1a, 32 bit
function hash(s: string) {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(16).padStart(8, '0')
}

// A row's size before any content change: fixed per key, unknown to the
// virtualizer until it is measured.
const naturalSize = (key: number) =>
  25 + (Math.abs(Math.imul(key + 7, 0x9e3779b1)) % 90)

const ALIGNS: Array<ScrollAlignment> = ['start', 'center', 'end', 'auto']

function makeSteps(seed: number, smooth: number): Array<Step> {
  const r = rng(seed)
  const int = (n: number) => Math.floor(r() * n)
  const behavior = (): Behavior => (r() < smooth ? 'smooth' : 'auto')
  const resize = (n: number): Step => ({
    t: 'resize',
    picks: Array.from({ length: n }, () => r()),
    sizes: Array.from({ length: n }, () => 20 + int(100)),
  })
  // [weight, make]
  const table: Array<[number, () => Step]> = [
    [
      6,
      () => ({
        t: 'index',
        i: int(100),
        align: ALIGNS[int(4)]!,
        behavior: behavior(),
      }),
    ],
    [2, () => ({ t: 'offset', to: int(5200), behavior: behavior() })],
    [3, () => ({ t: 'by', d: int(1200) - 600, behavior: behavior() })],
    [2, () => ({ t: 'end', behavior: behavior() })],
    [1, () => ({ t: 'cancel' })],
    [10, () => resize(1)],
    [4, () => resize(2 + int(3))],
    [1, () => ({ t: 'prepend', n: 1 + int(5) })],
    [1, () => ({ t: 'append', n: 1 + int(5) })],
    [10, () => ({ t: 'render' })],
    [10, () => ({ t: 'event' })],
    [4, () => ({ t: 'idle' })],
    [6, () => ({ t: 'anim' })],
    [6, () => ({ t: 'drag', d: int(800) - 400 })],
    [2, () => ({ t: 'touchstart' })],
    [3, () => ({ t: 'touchend' })],
    [1, () => ({ t: 'touchcancel' })],
    [12, () => ({ t: 'frame' })],
    // Either side of the 150ms post-touch tail.
    [2, () => ({ t: 'wait', ms: [40, 100, 160, 400][int(4)]! })],
    [1, () => ({ t: 'valve' })],
  ]
  const total = table.reduce((sum, [w]) => sum + w, 0)
  const steps: Array<Step> = []
  for (let n = 0; n < STEPS; n++) {
    let pick = r() * total
    for (const [w, make] of table) {
      pick -= w
      if (pick < 0) {
        steps.push(make())
        break
      }
    }
  }
  return steps
}

function runTrace(config: Config, ios: boolean, seed: number): Array<string> {
  if (ios) {
    Object.defineProperty(navigator, 'userAgent', {
      value: IOS_UA,
      configurable: true,
    })
  }
  _resetIOSDetectionForTests()
  try {
    return simulate(config, ios, makeSteps(seed, config.smooth ?? 0.3))
  } finally {
    delete (navigator as any).userAgent
    _resetIOSDetectionForTests()
  }
}

type Row = {
  index: number
  isConnected: boolean
  getAttribute: (name: string) => string | null
}

function simulate(
  config: Config,
  ios: boolean,
  steps: Array<Step>,
): Array<string> {
  const options = config.options ?? {}
  const rafs: Array<FrameRequestCallback> = []
  const timers = new Map<number, { fn: () => void; due: number }>()
  let timerId = 0
  let clock = 0
  // The ResizeObserver callback the virtualizer registers.
  const ro: { deliver: ((rows: Array<Row>) => void) | null } = {
    deliver: null,
  }
  const win = {
    requestAnimationFrame: (cb: FrameRequestCallback) => rafs.push(cb),
    cancelAnimationFrame: () => {},
    setTimeout: (fn: () => void, ms = 0) => {
      timers.set(++timerId, { fn, due: clock + ms })
      return timerId
    },
    clearTimeout: (id: number) => timers.delete(id),
    performance: { now: () => clock },
    ResizeObserver: class {
      constructor(cb: (entries: Array<{ target: Row }>) => void) {
        ro.deliver = (rows) => cb(rows.map((target) => ({ target })))
      }
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  }
  const listeners: Record<string, Array<() => void>> = {}
  // Both axes mirror each other, so `horizontal` runs the same scenario.
  const el = {
    pos: 0,
    size: 0,
    get scrollTop() {
      return this.pos
    },
    set scrollTop(v: number) {
      this.pos = v
    },
    get scrollLeft() {
      return this.pos
    },
    set scrollLeft(v: number) {
      this.pos = v
    },
    get scrollHeight() {
      return this.size
    },
    get scrollWidth() {
      return this.size
    },
    clientHeight: VIEWPORT,
    clientWidth: VIEWPORT,
    offsetHeight: VIEWPORT,
    offsetWidth: VIEWPORT,
    ownerDocument: { defaultView: win },
    addEventListener: (type: string, fn: () => void) => {
      ;(listeners[type] ??= []).push(fn)
    },
    removeEventListener: (type: string, fn: () => void) => {
      listeners[type] = (listeners[type] ?? []).filter((f) => f !== fn)
    },
  }
  const max = () => Math.max(0, el.size - VIEWPORT)
  // The browser keeps whole pixels, so a read-back can differ from a
  // fractional write.
  const clamp = (x: number) => Math.round(Math.max(0, Math.min(x, max())))
  // A drag past an edge rubber-bands by a share of the excess; each
  // following frame springs half way back, and a rest report lands on the
  // edge. WebKit discards a write made while the element is overscrolled and
  // the bounce stalls: no scroll event comes until the user scrolls again
  // (#1287).
  const overscrolled = () => el.pos < 0 || el.pos > max()
  let stalled = false
  const spring = () => {
    if (el.pos < 0) el.pos = Math.ceil(el.pos / 2)
    else if (el.pos > max()) el.pos = max() + Math.floor((el.pos - max()) / 2)
  }
  let ids = Array.from({ length: 100 }, (_, i) => i)
  let nextId = 100
  const content = new Map<number, number>()
  const sizeOf = (index: number) => {
    const key = ids[index]!
    return content.get(key) ?? naturalSize(key)
  }
  const rows = new Map<number, Row>()
  let scrollCallback: ((offset: number, isScrolling: boolean) => void) | null =
    null
  let touching = false
  // The finger has moved the content since it touched down.
  let dragged = false
  // A native smooth scroll in flight, and a frame of it computed before an
  // instant write replaced it, which WebKit can still apply and report.
  let smoothTarget: number | null = null
  let lateFrame: number | null = null
  let writes: Array<string> = []
  let rendered: Array<number> = []

  const v = new Virtualizer({
    count: ids.length,
    estimateSize: () => 50,
    getItemKey: (i) => ids[i]!,
    getScrollElement: () => el as any,
    measureElement: (node) => sizeOf((node as unknown as Row).index),
    scrollToFn: (offset, { adjustments = 0, behavior }) => {
      const to = offset + adjustments
      writes.push(`${behavior === 'smooth' ? 's' : 'w'}${to}`)
      // iOS ignores a programmatic write while a finger drags; under a
      // finger resting on the content the write lands.
      if (ios && touching && dragged) return
      if (overscrolled()) {
        stalled = true
        return
      }
      // A write that lands is reported like any other move.
      stalled = false
      if (behavior === 'smooth') {
        smoothTarget = clamp(to)
        lateFrame = null
      } else {
        if (smoothTarget !== null) {
          lateFrame = Math.round((el.pos + smoothTarget) / 2)
        }
        smoothTarget = null
        el.pos = clamp(to)
      }
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
    ...options,
  })
  config.setup?.(v)
  const unmount = v._didMount()

  // What a framework adapter does on render: read the items, mount and
  // measure their rows, run the update hook, and size the container. A
  // container that shrinks under the position clamps it; the scroll event
  // for that comes with the next event step.
  const render = () => {
    const items = v.getVirtualItems()
    rendered = items.map((item) => item.index)
    const mounted = new Set<number>()
    for (const item of items) {
      const key = ids[item.index]!
      mounted.add(key)
      let row = rows.get(key)
      if (!row) {
        const node: Row = {
          index: item.index,
          isConnected: true,
          getAttribute: (name) =>
            name === 'data-index' ? String(node.index) : null,
        }
        row = node
        rows.set(key, row)
      }
      row.index = item.index
      row.isConnected = true
      v.measureElement(row as any)
    }
    let unmounted = false
    for (const [key, row] of rows) {
      if (!mounted.has(key)) {
        row.isConnected = false
        rows.delete(key)
        unmounted = true
      }
    }
    if (unmounted) v.measureElement(null)
    v._willUpdate()
    el.size = v.getTotalSize() + (v.options.scrollMargin ?? 0)
    // A bounce past the top is left alone: the content cannot clamp it.
    el.pos = Math.min(el.pos, max())
    return `r${rendered[0] ?? '-'}-${rendered[rendered.length - 1] ?? '-'}/${el.size}`
  }
  // A stalled bounce reports nothing.
  const scroll = (isScrolling: boolean) => {
    if (!stalled) scrollCallback!(el.pos, isScrolling)
  }
  const frame = () => rafs.splice(0).forEach((cb) => cb(clock))
  // Move the clock forward, firing each timeout at its due time in order.
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
  }
  const fire = (type: string) => listeners[type]?.forEach((fn) => fn())

  const trace: Array<string> = []
  const record = (label: string, extra = '') => {
    trace.push(
      `${label} ${writes.join(',')} @${el.pos}${extra ? ' ' + extra : ''}`,
    )
    writes = []
  }

  // An adapter renders before mount (nothing to show yet) and again after.
  render()
  record('init', render())

  for (const step of steps) {
    let extra = ''
    switch (step.t) {
      case 'index':
        v.scrollToIndex(step.i % v.options.count, {
          align: step.align,
          behavior: step.behavior,
        })
        break
      case 'offset':
        v.scrollToOffset(step.to, { behavior: step.behavior })
        break
      case 'by':
        v.scrollBy(step.d, { behavior: step.behavior })
        break
      case 'end':
        v.scrollToEnd({ behavior: step.behavior })
        break
      case 'cancel':
        v.cancelScroll()
        break
      case 'resize': {
        const changed: Array<Row> = []
        step.picks.forEach((pick, k) => {
          const index = rendered[Math.floor(pick * rendered.length)]
          if (index === undefined) return
          content.set(ids[index]!, step.sizes[k]!)
          const row = rows.get(ids[index]!)
          if (row && !changed.includes(row)) changed.push(row)
        })
        if (changed.length > 0) ro.deliver?.(changed)
        extra = changed.map((row) => `#${row.index}`).join('')
        break
      }
      case 'prepend':
        ids = [...Array.from({ length: step.n }, () => -++nextId), ...ids]
        v.setOptions({ ...v.options, count: ids.length })
        extra = render()
        break
      case 'append':
        ids = [...ids, ...Array.from({ length: step.n }, () => ++nextId)]
        v.setOptions({ ...v.options, count: ids.length })
        extra = render()
        break
      case 'render':
        extra = render()
        break
      case 'event':
        spring()
        scroll(true)
        break
      case 'idle':
        el.pos = clamp(el.pos)
        scroll(false)
        break
      case 'anim':
        if (stalled) break
        if (lateFrame !== null) {
          el.pos = clamp(lateFrame)
          lateFrame = null
          scroll(true)
        } else if (smoothTarget !== null) {
          const remaining = smoothTarget - el.pos
          el.pos =
            Math.abs(remaining) <= 40
              ? smoothTarget
              : Math.round(el.pos + remaining / 2)
          if (el.pos === smoothTarget) smoothTarget = null
          scroll(true)
        }
        break
      case 'drag': {
        // A user scroll stops a native smooth animation.
        smoothTarget = null
        lateFrame = null
        if (touching) dragged = true
        // The user scrolls: a stalled bounce reports again.
        stalled = false
        const to = el.pos + step.d
        el.pos =
          to < 0
            ? -Math.min(Math.round(-to / 3), 100)
            : to > max()
              ? max() + Math.min(Math.round((to - max()) / 3), 100)
              : to
        scroll(true)
        break
      }
      case 'touchstart':
        touching = true
        dragged = false
        smoothTarget = null
        lateFrame = null
        fire('touchstart')
        break
      case 'touchend':
        touching = false
        fire('touchend')
        break
      case 'touchcancel':
        touching = false
        fire('touchcancel')
        break
      case 'frame':
        frame()
        break
      case 'wait':
        advance(step.ms)
        break
      case 'valve':
        advance(6000)
        frame()
        break
    }
    advance(16)
    record(step.t, extra)
  }

  // Settle: the finger lifts, any animation finishes, reconcile runs while
  // the element reports motion, then rest, timers, and reconcile at rest.
  if (touching) {
    touching = false
    fire('touchend')
  }
  lateFrame = null
  if (smoothTarget !== null) {
    el.pos = smoothTarget
    smoothTarget = null
    scroll(true)
  }
  for (let i = 0; i < 20 && rafs.length > 0; i++) {
    frame()
    render()
    spring()
    scroll(true)
  }
  el.pos = clamp(el.pos)
  scroll(false)
  advance(1000)
  for (let i = 0; i < 20 && rafs.length > 0; i++) {
    frame()
    render()
    scroll(false)
  }
  record('settled', render())
  unmount()
  return trace
}

const key = (config: Config, ios: boolean, seed: number) =>
  `${config.name}/${ios ? 'ios' : 'web'}/${seed}`

const only = process.env.SCROLL_TRACE

describe.skipIf(!!only)('scroll behaviour snapshot', () => {
  for (const config of configs) {
    for (const ios of [false, true]) {
      test(`${config.name} ${ios ? 'ios' : 'web'}`, () => {
        const hashes: Array<string> = []
        for (let seed = 0; seed < SEEDS; seed++) {
          hashes.push(hash(runTrace(config, ios, seed).join('\n')))
        }
        // Ten per row so a diff points at the seeds that moved.
        const rows: Array<string> = []
        for (let k = 0; k < hashes.length; k += 10) {
          rows.push(`${k}: ${hashes.slice(k, k + 10).join(' ')}`)
        }
        expect(rows).toMatchSnapshot()
      })
    }
  }
})

describe.runIf(!!only)('scroll trace', () => {
  test(`${only}`, () => {
    const [name, platform, seed] = only!.split('/')
    const config = configs.find((c) => c.name === name)
    if (!config) throw new Error(`unknown config ${name}`)
    const trace = runTrace(config, platform === 'ios', Number(seed))
    // Vitest captures console output; write straight to stderr.
    process.stderr.write(
      `${key(config, platform === 'ios', Number(seed))}\n${trace.join('\n')}\n`,
    )
  })
})
