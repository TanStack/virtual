import React from 'react'
import ReactDOM from 'react-dom/client'
import { flushSync } from 'react-dom'
import { elementScroll, useVirtualizer } from '@tanstack/react-virtual'

// Instrumented page for measuring the iOS scroll-correction deferral on a real
// device or simulator (#1307). It records a timeline of scroll events, touch
// events, scrollTop writes and resizes; a driver (or a finger) provides the
// gestures. Nothing here asserts anything.

const params = new URLSearchParams(window.location.search)
const num = (name: string, fallback: number) =>
  Number(params.get(name) ?? fallback)

const COUNT = num('count', 400)
const EST = num('est', 50)
const VIEWPORT = num('h', 400)
const OVERSCAN = num('overscan', 5)
const INITIAL_OFFSET = num('initialOffset', 0)
// `tall=a-b:px` renders rows a..b at `px` instead of the estimate, so their
// first measurement differs from it.
const tall = (params.get('tall') ?? '').match(/^(\d+)-(\d+):(\d+)$/)

const name = params.get('name') ?? params.get('mode') ?? 'run'

const heights = new Map<number, number>()
const heightOf = (index: number) =>
  heights.get(index) ??
  (tall && index >= Number(tall[1]) && index <= Number(tall[2])
    ? Number(tall[3])
    : EST)

type Entry = Record<string, unknown>

const t: any = {
  log: [] as Array<Entry>,
  el: null as HTMLElement | null,
  v: null as any,
  watch: [] as Array<number>,
  hooks: [] as Array<{ left: number; when: string; fn: () => void }>,
  touching: false,
  touchEnded: false,
}
;(window as any).__t = t

const state = () => {
  const v = t.v
  const el = t.el as HTMLElement | null
  const entry: Entry = { top: el ? el.scrollTop : null }
  if (v) {
    entry.off = v.scrollOffset
    entry.scrolling = v.isScrolling
    entry.dir = v.scrollDirection
    entry.def = v._iosDeferredAdjustment
    entry.adj = v.scrollAdjustments
    const s = v.scrollState
    entry.st = s
      ? [s.index, s.lastTargetOffset, s.hasReachedTarget, s.stableFrames]
      : null
    if (t.watch.length > 0 && el) {
      const m = v.getMeasurements()
      entry.rows = t.watch.map((i: number) => m[i].start - el.scrollTop)
    }
  }
  return entry
}

const log = (type: string, data: Entry = {}) => {
  t.log.push({
    t: Math.round(performance.now() * 10) / 10,
    type,
    ...data,
    ...state(),
  })
}
t.mark = log
t.clear = () => {
  t.log.length = 0
}
// Viewport-relative top of a mounted row, read from the DOM.
t.rowTop = (index: number) => {
  const row = t.el?.querySelector(`[data-index="${index}"]`)
  if (!row) return null
  return row.getBoundingClientRect().top - t.el.getBoundingClientRect().top
}
t.snap = (label: string, rows: Array<number> = t.watch) =>
  log('snap', { label, dom: rows.map((i) => t.rowTop(i)) })
// Run `fn` on the n-th scroll event from now, or on the n-th one after the
// next touchend (i.e. during momentum).
t.onScroll = (n: number, fn: () => void) =>
  t.hooks.push({ left: n, when: 'any', fn })
t.onMomentumScroll = (n: number, fn: () => void) =>
  t.hooks.push({ left: n, when: 'momentum', fn })
// Same, counting only scroll events while a finger is down.
t.onTouchScroll = (n: number, fn: () => void) =>
  t.hooks.push({ left: n, when: 'touching', fn })
t.frames = (n: number) =>
  new Promise<void>((resolve) => {
    const step = () => (n-- > 0 ? requestAnimationFrame(step) : resolve())
    step()
  })
t.wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
t.send = (label: string) =>
  fetch(`/log?name=${encodeURIComponent(label)}`, {
    method: 'POST',
    body: JSON.stringify({
      name: label,
      ua: navigator.userAgent,
      url: location.href,
      log: t.log,
    }),
  }).then(
    () => 'sent',
    (e) => `failed: ${e}`,
  )

// `autosend=ms` posts the log once the scroller has been quiet for `ms`
// after a touch, so a run needs no WebDriver session (which blocks touches).
const AUTOSEND = num('autosend', 0)
let quietTimer = 0
const quiet = () => {
  if (!AUTOSEND || !t.touchEnded) return
  clearTimeout(quietTimer)
  quietTimer = window.setTimeout(() => {
    t.snap('quiet')
    t.send(name).then((status: string) => {
      document.title = status
      const out = document.getElementById('status')
      if (out) out.textContent = `${status} (${t.log.length} entries)`
    })
    t.touchEnded = false
  }, AUTOSEND)
}

const attach = (el: HTMLElement) => {
  t.el = el
  el.addEventListener(
    'scroll',
    () => {
      log('scroll')
      for (const hook of t.hooks.slice()) {
        if (hook.when === 'momentum' && (!t.touchEnded || t.touching)) continue
        if (hook.when === 'touching' && !t.touching) continue
        if (--hook.left > 0) continue
        t.hooks.splice(t.hooks.indexOf(hook), 1)
        hook.fn()
      }
      quiet()
    },
    { passive: true },
  )
  el.addEventListener(
    'touchstart',
    () => {
      t.touching = true
      log('touchstart')
    },
    { passive: true },
  )
  const end = (type: string) => () => {
    t.touching = false
    t.touchEnded = true
    log(type)
    quiet()
  }
  el.addEventListener('touchend', end('touchend'), { passive: true })
  el.addEventListener('touchcancel', end('touchcancel'), { passive: true })
}

// Presets for runs driven by a finger instead of a WebDriver session, each
// fired on the `n`-th momentum scroll event:
// `arm=write` writes scrollTop (+`d`); `arm=resize` changes row `row`
// (default: a mounted one above the viewport) to `px`; `arm=index` calls
// scrollToIndex(`to`). `arm=smooth` starts a smooth scrollToIndex(`to`) on
// load, to be interrupted by a drag.
const arm = () => {
  const n = num('n', 5)
  const preset = params.get('arm')
  t.watch = params.get('watch')?.split(',').map(Number) ?? []
  if (preset === 'write') {
    t.onMomentumScroll(n, () => {
      t.el.scrollTop += num('d', 0)
      log('rawWrite', { d: num('d', 0) })
    })
  } else if (preset === 'resize') {
    t.onMomentumScroll(n, () => {
      // A mounted row above the viewport that stays mounted for a few frames.
      const above = t.v.getVirtualItems()[0].index + num('skip', 2)
      t.setH(num('row', above), num('px', EST * 2), true)
    })
  } else if (preset === 'index') {
    // `any=1` counts every scroll event (wheel), `touching=1` only those
    // under a finger, instead of momentum ones.
    const on = params.has('any')
      ? t.onScroll
      : params.has('touching')
        ? t.onTouchScroll
        : t.onMomentumScroll
    on(n, () => {
      log('scrollToIndex', { index: num('to', 0) })
      t.v.scrollToIndex(num('to', 0), { align: 'start' })
      // `late=ms` then grows the first mounted row, which moves the target.
      if (params.has('late')) {
        window.setTimeout(
          () => t.setH(t.v.getVirtualItems()[0].index, EST * 3),
          num('late', 0),
        )
      }
    })
  } else if (preset === 'smooth') {
    window.setTimeout(
      () => {
        log('scrollToIndex', { index: num('to', 0) })
        t.v.scrollToIndex(num('to', 0), { align: 'start', behavior: 'smooth' })
      },
      num('delay', 1000),
    )
  }
}

const Controls = ({ label }: { label: string }) => {
  const [status, setStatus] = React.useState('')
  return (
    <div style={{ font: '12px monospace', padding: 4 }}>
      <button id="send" onClick={() => t.send(label).then(setStatus)}>
        send log
      </button>{' '}
      <button id="clear" onClick={t.clear}>
        clear
      </button>{' '}
      {label} <span id="status">{status}</span>
    </div>
  )
}

// No virtualizer: checks what a scrollTop write does to iOS momentum.
const Plain = () => {
  const ref = React.useRef<HTMLDivElement>(null)
  React.useEffect(() => {
    attach(ref.current!)
    arm()
  }, [])
  return (
    <div
      ref={ref}
      id="scroll-container"
      style={{ height: VIEWPORT, overflow: 'auto' }}
    >
      {Array.from({ length: COUNT }, (_, i) => (
        <div key={i} style={{ height: EST, boxSizing: 'border-box' }}>
          Row {i}
        </div>
      ))}
    </div>
  )
}

const App = () => {
  const parentRef = React.useRef<HTMLDivElement>(null)
  const [, bump] = React.useReducer((x: number) => x + 1, 0)

  const rowVirtualizer = useVirtualizer({
    count: COUNT,
    getScrollElement: () => parentRef.current,
    estimateSize: () => EST,
    overscan: OVERSCAN,
    initialOffset: INITIAL_OFFSET,
    scrollToFn: (offset, options, instance) => {
      log('write', {
        to: offset + (options.adjustments ?? 0),
        behavior: options.behavior,
      })
      elementScroll(offset, options, instance)
    },
  })
  t.v = rowVirtualizer

  React.useEffect(() => {
    attach(parentRef.current!)
    const resizeItem = rowVirtualizer.resizeItem
    rowVirtualizer.resizeItem = (index, size) => {
      const before = t.v.getMeasurements()[index]?.size
      resizeItem(index, size)
      if (before !== size) log('resizeItem', { index, size, before })
    }
    // Changes a mounted row's height; the ResizeObserver reports it.
    t.setH = (index: number, px: number, sync = false) => {
      heights.set(index, px)
      log('setH', { index, px, sync })
      if (sync) flushSync(bump)
      else bump()
    }
    arm()
  }, [])

  return (
    <div
      ref={parentRef}
      id="scroll-container"
      style={{ height: VIEWPORT, overflow: 'auto' }}
    >
      <div
        style={{
          height: rowVirtualizer.getTotalSize(),
          position: 'relative',
        }}
      >
        {rowVirtualizer.getVirtualItems().map((v) => (
          <div
            key={v.key}
            ref={rowVirtualizer.measureElement}
            data-index={v.index}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              transform: `translateY(${v.start}px)`,
              width: '100%',
            }}
          >
            <div
              style={{
                height: heightOf(v.index),
                boxSizing: 'border-box',
                borderBottom: '1px solid #ccc',
                background: heights.has(v.index) ? '#fd8' : undefined,
              }}
            >
              Row {v.index}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <div>
    <Controls label={name} />
    {params.get('mode') === 'plain' ? <Plain /> : <App />}
  </div>,
)
