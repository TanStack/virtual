import type { ScenarioInput, ScenarioMetrics } from '../scenarios/types'

// Each library page mounts and waits, then a global driver runs the scripted
// action and returns metrics. To keep measurements uniform we share this
// harness.

export interface HarnessHandle {
  /** Container element the library is told to scroll. */
  getScrollContainer: () => HTMLElement | null
  /** Programmatically scroll to a target offset (px). */
  scrollToOffset?: (offset: number) => void
  /** Programmatically scroll to a target index. Some libraries expose
   *  scrollToIndex; if absent, harness falls back to scrollTo(maxOffset). */
  scrollToIndex?: (index: number, opts?: { align?: 'start' | 'end' }) => void
  /** Total scrollable height in px. Read after mount. */
  getTotalSize: () => number
  /** Returns true once every item in the visible range has had its real size
   *  measured. Used for the wait-dynamic-measure action. */
  isFullyMeasured?: () => boolean
}

declare global {
  interface Window {
    __bench?: {
      handle?: HarnessHandle
      mountStart?: number
      mountEnd?: number
      firstPaintEnd?: number
      ready?: boolean
    }
    bench?: {
      run: (scenario: ScenarioInput) => Promise<ScenarioMetrics>
      ready: () => boolean
    }
  }
}

function nextFrame(): Promise<number> {
  return new Promise((resolve) => requestAnimationFrame(resolve))
}

function waitFor<T>(
  predicate: () => T | false | null | undefined,
  timeoutMs = 8000,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const start = performance.now()
    const tick = () => {
      const r = predicate()
      if (r) return resolve(r as T)
      if (performance.now() - start > timeoutMs) {
        return reject(new Error('timeout waiting for predicate'))
      }
      requestAnimationFrame(tick)
    }
    tick()
  })
}

async function measureScrollFps(
  el: HTMLElement,
  startOffset: number,
  targetOffset: number,
  durationMs = 1500,
): Promise<{ fps: number; longFrames: number; jankMs: number }> {
  // Programmatic, requestAnimationFrame-driven scroll. We sample frame
  // timestamps and infer FPS / jank from inter-frame gaps.
  const frames: number[] = []
  let lastT = performance.now()
  let stop = false
  const onFrame = (t: number) => {
    frames.push(t - lastT)
    lastT = t
    if (!stop) requestAnimationFrame(onFrame)
  }
  requestAnimationFrame((t) => {
    lastT = t
    requestAnimationFrame(onFrame)
  })

  const startT = performance.now()
  while (performance.now() - startT < durationMs) {
    const elapsed = performance.now() - startT
    const t = Math.min(elapsed / durationMs, 1)
    el.scrollTop = startOffset + (targetOffset - startOffset) * t
    await nextFrame()
  }
  stop = true
  await nextFrame()

  const longFrames = frames.filter((f) => f > 32).length
  const jankMs = frames.filter((f) => f > 50).reduce((s, f) => s + f, 0)
  const avgFrame = frames.length
    ? frames.reduce((s, f) => s + f, 0) / frames.length
    : 0
  const fps = avgFrame > 0 ? 1000 / avgFrame : 0
  return { fps, longFrames, jankMs }
}

export function registerHarness(handle: HarnessHandle): void {
  window.__bench = window.__bench || {}
  window.__bench.handle = handle
  window.__bench.ready = true
}

export function markMountStart(): void {
  window.__bench = window.__bench || {}
  window.__bench.mountStart = performance.now()
}

export function markMountEnd(): void {
  window.__bench = window.__bench || {}
  if (window.__bench.mountEnd == null) {
    window.__bench.mountEnd = performance.now()
  }
}

export function markFirstPaint(): void {
  // Wait one rAF then mark — gives the browser a chance to actually paint.
  requestAnimationFrame(() => {
    window.__bench = window.__bench || {}
    if (window.__bench.firstPaintEnd == null) {
      window.__bench.firstPaintEnd = performance.now()
    }
  })
}

export function installBenchAPI(): void {
  window.bench = {
    ready: () => !!window.__bench?.ready,
    run: async (scenario: ScenarioInput): Promise<ScenarioMetrics> => {
      const h = await waitFor(() => window.__bench?.handle ?? null)
      const mountStart = window.__bench?.mountStart ?? 0
      const mountEnd = window.__bench?.mountEnd ?? performance.now()
      const firstPaintEnd =
        window.__bench?.firstPaintEnd ?? performance.now()

      const mountMs = Math.max(0, mountEnd - mountStart)
      const firstPaintMs = Math.max(0, firstPaintEnd - mountStart)

      let actionMs: number | null = null
      let scrollFps: number | null = null
      let longFrames: number | null = null
      let jankMs: number | null = null

      const container = h.getScrollContainer()
      if (!container) {
        throw new Error('harness: scroll container not available')
      }

      if (scenario.action === 'scroll-to-bottom') {
        const total = h.getTotalSize()
        const target = Math.max(0, total - container.clientHeight)
        const t0 = performance.now()
        const r = await measureScrollFps(container, 0, target, 1500)
        actionMs = performance.now() - t0
        scrollFps = r.fps
        longFrames = r.longFrames
        jankMs = r.jankMs
      } else if (scenario.action === 'jump-to-end') {
        const t0 = performance.now()
        if (h.scrollToIndex) {
          h.scrollToIndex(scenario.count - 1, { align: 'end' })
        } else {
          const total = h.getTotalSize()
          container.scrollTop = total
        }
        // Wait for scroll position to settle and not change for 5 frames
        let stableCount = 0
        let lastTop = container.scrollTop
        while (stableCount < 5 && performance.now() - t0 < 5000) {
          await nextFrame()
          const cur = container.scrollTop
          if (Math.abs(cur - lastTop) < 1) stableCount++
          else stableCount = 0
          lastTop = cur
        }
        actionMs = performance.now() - t0
      } else if (scenario.action === 'wait-dynamic-measure') {
        // Uniform metric across libraries: time until the total scroll height
        // stops changing for 8 consecutive frames. Libraries finish measuring
        // their visible window in different ways but they all converge on a
        // stable getTotalSize().
        const t0 = performance.now()
        let lastTotal = h.getTotalSize()
        let stableCount = 0
        while (stableCount < 8 && performance.now() - t0 < 3000) {
          await nextFrame()
          const cur = h.getTotalSize()
          if (cur === lastTotal && cur > 0) stableCount++
          else stableCount = 0
          lastTotal = cur
        }
        actionMs = performance.now() - t0
      }

      const mem = (performance as any).memory
      const memoryBytes =
        mem && typeof mem.usedJSHeapSize === 'number'
          ? mem.usedJSHeapSize
          : null

      return {
        mountMs,
        firstPaintMs,
        actionMs,
        scrollFps,
        longFrames,
        jankMs,
        memoryBytes,
      }
    },
  }
}
