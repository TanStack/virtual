// Shared scenario definitions used by every library page + the Playwright runner.
// JSON-serializable so the runner can pass them as JS args via page.evaluate().

export type LibraryName = 'tanstack' | 'virtua' | 'virtuoso' | 'window'

export interface ScenarioInput {
  /** Stable id used for table keys and result filenames. */
  id: string
  /** Number of items to render. */
  count: number
  /** Fixed item size in px (lower bound used as estimate when dynamic). */
  itemSize: number
  /** If true, items vary in height by content; forces ResizeObserver storms. */
  dynamic: boolean
  /** Which scripted action to run after mount. */
  action:
    | 'idle'
    | 'scroll-to-bottom'
    | 'jump-to-end'
    | 'wait-dynamic-measure'
}

export interface ScenarioMetrics {
  /** ms from React.render call to "list is mounted" (first item rendered). */
  mountMs: number
  /** ms from React.render to a fully painted first frame. */
  firstPaintMs: number
  /** Action-specific. For scroll-to-bottom: total animation ms. For wait-dynamic-measure: total ms. */
  actionMs: number | null
  /** FPS averaged during the scripted action (scroll), or null. */
  scrollFps: number | null
  /** Number of dropped frames during the action (frames longer than 32ms). */
  longFrames: number | null
  /** Sum of frame durations > 50ms ("long tasks") during the action, in ms. */
  jankMs: number | null
  /** Heap snapshot after mount (Chromium only; null elsewhere). */
  memoryBytes: number | null
}

export interface ScenarioResult {
  library: LibraryName
  scenario: ScenarioInput
  metrics: ScenarioMetrics
  /** ISO timestamp the scenario ran. */
  ranAt: string
  /** Notes from the page (e.g. opt-outs, library-specific caveats). */
  notes?: string
}

// The fixed scenarios all libraries run. Adding scenarios here surfaces them
// in the runner without further plumbing.
export const SCENARIOS: ScenarioInput[] = [
  {
    id: 'mount-fixed-1k',
    count: 1_000,
    itemSize: 30,
    dynamic: false,
    action: 'idle',
  },
  {
    id: 'mount-fixed-10k',
    count: 10_000,
    itemSize: 30,
    dynamic: false,
    action: 'idle',
  },
  {
    id: 'mount-fixed-100k',
    count: 100_000,
    itemSize: 30,
    dynamic: false,
    action: 'idle',
  },
  {
    id: 'mount-dynamic-1k',
    count: 1_000,
    itemSize: 30,
    dynamic: true,
    action: 'wait-dynamic-measure',
  },
  {
    id: 'mount-dynamic-10k',
    count: 10_000,
    itemSize: 30,
    dynamic: true,
    action: 'wait-dynamic-measure',
  },
  {
    id: 'scroll-to-bottom-10k',
    count: 10_000,
    itemSize: 30,
    dynamic: false,
    action: 'scroll-to-bottom',
  },
  {
    id: 'fast-scroll-dynamic-10k',
    count: 10_000,
    itemSize: 30,
    dynamic: true,
    action: 'scroll-to-bottom',
  },
  {
    id: 'jump-to-end-dynamic-10k',
    count: 10_000,
    itemSize: 30,
    dynamic: true,
    action: 'jump-to-end',
  },
]
