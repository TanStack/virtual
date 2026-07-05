import {
  Virtualizer,
  observeWindowOffset,
  observeWindowRect,
  windowScroll,
} from '@tanstack/virtual-core'
import type { Range, VirtualItem, VirtualizerOptions } from '@tanstack/virtual-core'

// The subset of tag input that maps onto virtual-core options. Kept here
// (rather than imported from index.marko) so this helper has no dependency
// on the Marko template's generated types.
export interface WindowVirtualizerInput {
  count: number
  estimateSize?: (index: number) => number
  overscan?: number
  // Horizontal window scrolling (the page scrolls sideways; default false).
  horizontal?: boolean
  paddingStart?: number
  paddingEnd?: number
  scrollPaddingStart?: number
  scrollPaddingEnd?: number
  gap?: number
  lanes?: number
  // Starting scroll offset. Defaults to reading the live window scroll position
  // (window.scrollY, or window.scrollX when horizontal) on the client and 0 on the
  // server. Pass a number to seed a server slice at a position (pairs with initialRect).
  initialOffset?: number | (() => number)
  // Window viewport size for the render-time (server / pre-mount) slice. When omitted,
  // there is no server slice.
  initialRect?: { width: number; height: number }
  // Stable per-item identity so cached measurements survive reorder (defaults to the index).
  getItemKey?: (index: number) => number | string | bigint
  // Hook over the visible index range: force extra indexes (e.g. a pinned sticky header)
  // into the rendered window. Compose with virtual-core's `defaultRangeExtractor`.
  rangeExtractor?: (range: Range) => Array<number>
  // DOM attribute carrying the item index for `measureElement` (default 'data-index').
  // Two instances measuring the SAME element (a grid cell) need distinct attributes.
  indexAttribute?: string
  // Pre-measured items (plain data) to seed the measurement cache.
  initialMeasurementsCache?: Array<VirtualItem>
  // Anchor the window to the list 'start' (default) or 'end' (a chat pinned to newest).
  anchorTo?: 'start' | 'end'
  // With anchorTo 'end': stay pinned to the end as items append
  // (true, or a ScrollBehavior for how to get there).
  followOnAppend?: boolean | ScrollBehavior
  // How close (px) to the end still counts as "at the end" (default 1).
  scrollEndThreshold?: number
  // The list's offset (px) from the top of the page, when other content sits above it.
  // Shifts all position math; item.start values then INCLUDE this margin (subtract it
  // when positioning items relative to the list). The textbook window-virtualizer knob.
  scrollMargin?: number
  // Disable switch (default true). false is NOT a freeze: core unobserves, clears
  // its measurements, and renders an EMPTY window until re-enabled (re-enabling
  // re-windows from the live scroll position).
  enabled?: boolean
  // Right-to-left horizontal lists (default false).
  isRtl?: boolean
  // ms after the last scroll event before "user is scrolling" ends (default 150).
  isScrollingResetDelay?: number
  // Use the native scrollend event instead of the isScrollingResetDelay timer.
  useScrollendEvent?: boolean
  // Batch ResizeObserver measurements into animation frames (avoids
  // "ResizeObserver loop" console errors under heavy resize load).
  useAnimationFrameWithResizeObserver?: boolean
  // Masonry/multi-lane: how items are assigned to lanes — by 'estimate' (default)
  // or by 'measured' sizes.
  laneAssignmentMode?: 'estimate' | 'measured'
  // Make the default measurer return the cached (or estimated) size instead of
  // reading the DOM — freezes sizes when they are already known and DOM
  // re-measures are unwanted.
  useCachedMeasurements?: boolean
  // Verbose engine logging.
  debug?: boolean
  // Replace HOW an item's size is read from its element (e.g. include margins,
  // or measure a child). Defaults to core's border-box measurer.
  measureElement?: (
    element: Element,
    entry: ResizeObserverEntry | undefined,
    instance: Virtualizer<Window, Element>,
  ) => number
}

// Single source of truth for the input -> virtual-core option mapping,
// shared by the render-time seed, onMount (construction) and onUpdate (setOptions).
// Optional inputs are forwarded possibly-undefined on purpose: virtual-core's
// setOptions() skips undefined keys, so its own defaults apply.
export function buildOptions(
  input: WindowVirtualizerInput,
  notify: () => void,
): VirtualizerOptions<Window, Element> {
  return {
    count: input.count,
    estimateSize: input.estimateSize ?? (() => 50),
    getScrollElement: () => (typeof document !== 'undefined' ? window : null),
    overscan: input.overscan ?? 5,
    horizontal: input.horizontal,
    paddingStart: input.paddingStart,
    paddingEnd: input.paddingEnd,
    scrollPaddingStart: input.scrollPaddingStart,
    scrollPaddingEnd: input.scrollPaddingEnd,
    gap: input.gap,
    lanes: input.lanes,
    // Consumer override first (mirrors react-virtual's spread-over-defaults), then the
    // live window position on the client / 0 (top) on the server.
    initialOffset:
      input.initialOffset ??
      (() =>
        typeof document !== 'undefined'
          ? input.horizontal
            ? window.scrollX
            : window.scrollY
          : 0),
    initialRect: input.initialRect,
    getItemKey: input.getItemKey,
    rangeExtractor: input.rangeExtractor,
    indexAttribute: input.indexAttribute,
    initialMeasurementsCache: input.initialMeasurementsCache,
    anchorTo: input.anchorTo,
    followOnAppend: input.followOnAppend,
    scrollEndThreshold: input.scrollEndThreshold,
    scrollMargin: input.scrollMargin,
    enabled: input.enabled,
    isRtl: input.isRtl,
    isScrollingResetDelay: input.isScrollingResetDelay,
    useScrollendEvent: input.useScrollendEvent,
    useAnimationFrameWithResizeObserver: input.useAnimationFrameWithResizeObserver,
    laneAssignmentMode: input.laneAssignmentMode,
    useCachedMeasurements: input.useCachedMeasurements,
    debug: input.debug,
    measureElement: input.measureElement,
    observeElementRect: observeWindowRect,
    observeElementOffset: observeWindowOffset,
    scrollToFn: windowScroll,
    onChange: notify,
  }
}

// Render-time (server / pre-mount) slice — the window counterpart of the element helper.
// Opt-in: without `initialRect` there is no server slice (trivial window), which keeps every
// example that does not pass it byte-for-byte identical to a client-only build. With
// `initialRect` a transient instance derives the initial window as plain data and is discarded;
// nothing live is retained or serialized, and the values recompute identically on resume.
// The probe never observes, so it reads `initialRect` directly (getScrollElement returns null on
// the server and window on the client, but neither is measured before getVirtualItems()).
// `range` is the visible window ({ startIndex, endIndex }) the probe computed — plain data,
// null when there is no slice.
export function renderSlice(
  input: WindowVirtualizerInput,
): {
  items: VirtualItem[]
  size: number
  range: { startIndex: number; endIndex: number } | null
} {
  if (!input.initialRect) {
    return { items: [], size: 0, range: null }
  }
  const probe = new Virtualizer<Window, Element>(buildOptions(input, () => {}))
  const items = probe.getVirtualItems()
  return { items, size: probe.getTotalSize(), range: probe.range }
}
