import {
  createLazyMeasurementsView,
  getMeasurementKey,
} from './lazy-measurements'
import { approxEqual, debounce, memo, notUndefined } from './utils'

// Browser-aware iOS detection. Programmatic `scrollTo`/`scrollTop` writes
// during a momentum-scroll cancel the momentum on iOS WebKit, so we defer
// scroll-position adjustments triggered by mid-scroll resizes until the
// scroll settles. SSR-safe (returns false when navigator is unavailable).
let _isIOSResult: boolean | undefined
const isIOSWebKit = (): boolean => {
  if (_isIOSResult !== undefined) return _isIOSResult
  if (typeof navigator === 'undefined') return (_isIOSResult = false)
  if (/iP(hone|od|ad)/.test(navigator.userAgent)) return (_isIOSResult = true)
  // iPadOS 13+ reports as MacIntel; touch-points distinguishes it from desktop.
  const mtp = (navigator as Navigator & { maxTouchPoints?: number })
    .maxTouchPoints
  return (_isIOSResult =
    navigator.platform === 'MacIntel' && mtp !== undefined && mtp > 0)
}

// Test hook: reset the iOS detection cache. Not exported.
export const _resetIOSDetectionForTests = () => {
  _isIOSResult = undefined
}

export { approxEqual, debounce, memo, notUndefined } from './utils'
export type { NoInfer, PartialKeys } from './utils'

//

type ScrollDirection = 'forward' | 'backward'

type ScrollAlignment = 'start' | 'center' | 'end' | 'auto'

type ScrollBehavior = 'auto' | 'smooth' | 'instant'

type ScrollAnchor = 'start' | 'end'

type FollowOnAppend = boolean | ScrollBehavior

export interface ScrollToOptions {
  align?: ScrollAlignment
  behavior?: ScrollBehavior
}

type ScrollToOffsetOptions = ScrollToOptions

type ScrollToIndexOptions = ScrollToOptions

type ScrollToEndOptions = Pick<ScrollToOptions, 'behavior'>

export interface Range {
  startIndex: number
  endIndex: number
  overscan: number
  count: number
  /**
   * Lane count of the virtualizer. When greater than 1, `overscan` counts
   * rows of `lanes` items rather than single items.
   */
  lanes?: number
}

type Key = number | string | bigint

export interface VirtualItem {
  key: Key
  index: number
  start: number
  end: number
  size: number
  lane: number
}

export interface Rect {
  width: number
  height: number
}

//

const getRect = (element: HTMLElement): Rect => {
  const { offsetWidth, offsetHeight } = element
  return { width: offsetWidth, height: offsetHeight }
}

export const defaultKeyExtractor = (index: number) => index

export const defaultRangeExtractor = (range: Range) => {
  // With lanes, the visible range is already aligned to whole rows; overscan
  // by whole rows too, so every lane gets the same number of items rendered
  // (and measured). Overscanning single items leaves partial rows, letting one
  // lane collect more measured sizes than the others and drift (#1036).
  const overscan = range.overscan * Math.max(range.lanes ?? 1, 1)
  const start = Math.max(range.startIndex - overscan, 0)
  const end = Math.min(range.endIndex + overscan, range.count - 1)
  const len = end - start + 1

  const arr = new Array<number>(len)
  for (let i = 0; i < len; i++) {
    arr[i] = start + i
  }
  return arr
}

export const observeElementRect = <T extends Element>(
  instance: Virtualizer<T, any>,
  cb: (rect: Rect) => void,
) => {
  const element = instance.scrollElement
  if (!element) {
    return
  }
  const targetWindow = instance.targetWindow
  if (!targetWindow) {
    return
  }

  const handler = (rect: Rect) => {
    const { width, height } = rect
    cb({ width: Math.round(width), height: Math.round(height) })
  }

  handler(getRect(element as unknown as HTMLElement))

  if (!targetWindow.ResizeObserver) {
    return () => {}
  }

  const observer = new targetWindow.ResizeObserver((entries) => {
    const run = () => {
      const entry = entries[0]
      if (entry?.borderBoxSize) {
        const box = entry.borderBoxSize[0]
        if (box) {
          handler({ width: box.inlineSize, height: box.blockSize })
          return
        }
      }
      handler(getRect(element as unknown as HTMLElement))
    }

    instance.options.useAnimationFrameWithResizeObserver
      ? requestAnimationFrame(run)
      : run()
  })

  observer.observe(element, { box: 'border-box' })

  return () => {
    observer.unobserve(element)
  }
}

const addEventListenerOptions = {
  passive: true,
}

export const observeWindowRect = (
  instance: Virtualizer<Window, any>,
  cb: (rect: Rect) => void,
) => {
  const element = instance.scrollElement
  if (!element) {
    return
  }

  const handler = () => {
    cb({ width: element.innerWidth, height: element.innerHeight })
  }
  handler()

  element.addEventListener('resize', handler, addEventListenerOptions)

  return () => {
    element.removeEventListener('resize', handler)
  }
}

const supportsScrollend =
  typeof window == 'undefined' ? true : 'onscrollend' in window

type ObserveOffsetCallBack = (offset: number, isScrolling: boolean) => void

// Shared core: both element and window variants attach scroll/scrollend
// listeners with the same lifecycle; they only differ in how to read the
// current offset from the scroll target.
const observeOffset = <T extends Element | Window>(
  instance: Virtualizer<T, any>,
  cb: ObserveOffsetCallBack,
  readOffset: (target: T) => number,
) => {
  const element = instance.scrollElement
  if (!element) {
    return
  }
  const targetWindow = instance.targetWindow
  if (!targetWindow) {
    return
  }

  const registerScrollendEvent =
    instance.options.useScrollendEvent && supportsScrollend

  let offset = 0
  const fallback = registerScrollendEvent
    ? null
    : debounce(
        targetWindow,
        () => cb(readOffset(element), false),
        instance.options.isScrollingResetDelay,
      )

  const createHandler = (isScrolling: boolean) => () => {
    offset = readOffset(element)
    fallback?.()
    cb(offset, isScrolling)
  }
  const handler = createHandler(true)
  const endHandler = createHandler(false)

  element.addEventListener('scroll', handler, addEventListenerOptions)
  if (registerScrollendEvent) {
    element.addEventListener('scrollend', endHandler, addEventListenerOptions)
  }
  return () => {
    element.removeEventListener('scroll', handler)
    if (registerScrollendEvent) {
      element.removeEventListener('scrollend', endHandler)
    }
    // Removing the listener doesn't retract a reset already queued by the
    // last scroll, and that call would land on a virtualizer that has been
    // torn down — in React, a dispatch into an unmounted tree.
    fallback?.cancel()
  }
}

export const observeElementOffset = <T extends Element>(
  instance: Virtualizer<T, any>,
  cb: ObserveOffsetCallBack,
) =>
  observeOffset(instance, cb, (el) => {
    const { horizontal, isRtl } = instance.options
    return horizontal ? el.scrollLeft * ((isRtl && -1) || 1) : el.scrollTop
  })

export const observeWindowOffset = (
  instance: Virtualizer<Window, any>,
  cb: ObserveOffsetCallBack,
) =>
  observeOffset(instance, cb, (win) =>
    instance.options.horizontal ? win.scrollX : win.scrollY,
  )

export const measureElement = <TItemElement extends Element>(
  element: TItemElement,
  entry: ResizeObserverEntry | undefined,
  instance: Virtualizer<any, TItemElement>,
) => {
  // When useCachedMeasurements is enabled, return the cached size
  // (or estimateSize as fallback) instead of measuring the DOM.
  if (instance.options.useCachedMeasurements) {
    const index = instance.indexFromElement(element)
    const key = instance.options.getItemKey(index)
    return (
      instance.itemSizeCache.get(key) ?? instance.options.estimateSize(index)
    )
  }

  if (entry?.borderBoxSize) {
    const box = entry.borderBoxSize[0]
    if (box) {
      const size = Math.round(
        box[instance.options.horizontal ? 'inlineSize' : 'blockSize'],
      )
      return size
    }
  }

  // When called without a ResizeObserverEntry (sync measurement path),
  // return the previously measured size if available. This avoids a
  // synchronous layout read (offsetWidth/offsetHeight) on re-renders.
  // The ResizeObserver is already observing the element and will deliver
  // the accurate size asynchronously if it changed.
  // Users who need synchronous DOM reads can provide a custom measureElement.
  if (!entry) {
    const index = instance.indexFromElement(element)
    const key = instance.options.getItemKey(index)
    const cachedSize = instance.itemSizeCache.get(key)
    if (cachedSize !== undefined) {
      return cachedSize
    }
  }

  return (element as unknown as HTMLElement)[
    instance.options.horizontal ? 'offsetWidth' : 'offsetHeight'
  ]
}

const scrollWithAdjustments = (
  offset: number,
  {
    adjustments = 0,
    behavior,
  }: { adjustments?: number; behavior?: ScrollBehavior },
  instance: Virtualizer<any, any>,
) => {
  instance.scrollElement?.scrollTo?.({
    [instance.options.horizontal ? 'left' : 'top']: offset + adjustments,
    behavior,
  })
}

export const windowScroll: <T extends Window>(
  offset: number,
  options: { adjustments?: number; behavior?: ScrollBehavior },
  instance: Virtualizer<T, any>,
) => void = scrollWithAdjustments

export const elementScroll: <T extends Element>(
  offset: number,
  options: { adjustments?: number; behavior?: ScrollBehavior },
  instance: Virtualizer<T, any>,
) => void = scrollWithAdjustments

type LaneAssignmentMode = 'estimate' | 'measured'

export interface VirtualizerOptions<
  TScrollElement extends Element | Window,
  TItemElement extends Element,
> {
  // Required from the user
  count: number
  getScrollElement: () => TScrollElement | null
  estimateSize: (index: number) => number

  // Required from the framework adapter (but can be overridden)
  scrollToFn: (
    offset: number,
    options: { adjustments?: number; behavior?: ScrollBehavior },
    instance: Virtualizer<TScrollElement, TItemElement>,
  ) => void
  observeElementRect: (
    instance: Virtualizer<TScrollElement, TItemElement>,
    cb: (rect: Rect) => void,
  ) => void | (() => void)
  observeElementOffset: (
    instance: Virtualizer<TScrollElement, TItemElement>,
    cb: ObserveOffsetCallBack,
  ) => void | (() => void)
  // Optional
  debug?: boolean
  initialRect?: Rect
  onChange?: (
    instance: Virtualizer<TScrollElement, TItemElement>,
    sync: boolean,
  ) => void
  measureElement?: (
    element: TItemElement,
    entry: ResizeObserverEntry | undefined,
    instance: Virtualizer<TScrollElement, TItemElement>,
  ) => number
  overscan?: number
  horizontal?: boolean
  paddingStart?: number
  paddingEnd?: number
  scrollPaddingStart?: number
  scrollPaddingEnd?: number
  initialOffset?: number | (() => number)
  getItemKey?: (index: number) => Key
  rangeExtractor?: (range: Range) => Array<number>
  scrollMargin?: number
  gap?: number
  indexAttribute?: string
  initialMeasurementsCache?: Array<VirtualItem>
  lanes?: number
  anchorTo?: ScrollAnchor
  followOnAppend?: FollowOnAppend
  scrollEndThreshold?: number
  isScrollingResetDelay?: number
  useScrollendEvent?: boolean
  enabled?: boolean
  isRtl?: boolean
  useAnimationFrameWithResizeObserver?: boolean
  laneAssignmentMode?: LaneAssignmentMode
  useCachedMeasurements?: boolean
}

// Where an in-flight scroll command is in its lifecycle, which decides how
// its scroll events and measurements are read:
//   smooth           a smooth animation is travelling to the target
//   smoothLanded     a smooth scroll is at its target, waiting to retire
//   smoothFinishing  a smooth scroll switched to instant writes for the
//                    final approach; its animation can still report positions
//   instant          instant writes
type ScrollPhase = 'smooth' | 'smoothLanded' | 'smoothFinishing' | 'instant'

type ScrollState = {
  // what we want
  index: number | null
  align: ScrollAlignment
  // scrollToEnd: track the DOM max scroll offset instead of the item's offset
  toEnd?: boolean

  // lifecycle
  startedAt: number

  // target tracking
  lastTargetOffset: number

  // settling
  stableFrames: number
  phase: ScrollPhase
}

const initialScrollPhase = (
  behavior: ScrollBehavior,
  atTarget: boolean,
): ScrollPhase =>
  behavior === 'smooth' ? (atTarget ? 'smoothLanded' : 'smooth') : 'instant'

// A smooth scroll owns the position: size compensation, the prepend anchor
// sync and far measurements hold off until it switches to instant writes.
const isSmoothScroll = (state: ScrollState | null): state is ScrollState =>
  state?.phase === 'smooth' || state?.phase === 'smoothLanded'

// The smooth animation may still be reporting positions, so a scroll event
// that isn't the read-back of our own write may not be the user.
const isAnimating = (state: ScrollState) =>
  state.phase === 'smooth' || state.phase === 'smoothFinishing'

// What `setOptions` decided about the scroll position for `_willUpdate` to
// carry out once the consumer has rendered: keep the reading anchor in place
// after a prepend (`scrollOffset` already moved by `delta`, the element has
// not), or follow an append to the end. A prepend that qualifies for both
// only follows.
type PendingScrollAnchor =
  | { kind: 'anchor'; delta: number }
  | { kind: 'follow'; behavior: ScrollBehavior }

function isAppendWithTrim(
  prevCount: number,
  nextCount: number,
  getPreviousKey: (index: number) => Key,
  getNextKey: (index: number) => Key,
): boolean {
  if (nextCount === 0) return false

  const firstKey = getNextKey(0)
  const removedKeys = new Set<Key>()
  let removedCount = 0
  while (removedCount < prevCount) {
    const key = getPreviousKey(removedCount)
    if (key === firstKey) break
    removedKeys.add(key)
    removedCount++
  }

  const retainedCount = prevCount - removedCount
  if (retainedCount === 0 || retainedCount >= nextCount) return false

  for (let i = 0; i < retainedCount; i++) {
    if (getNextKey(i) !== getPreviousKey(removedCount + i)) return false
  }
  for (let i = retainedCount; i < nextCount; i++) {
    if (removedKeys.has(getNextKey(i))) return false
  }
  return true
}

export class Virtualizer<
  TScrollElement extends Element | Window,
  TItemElement extends Element,
> {
  private unsubs: Array<void | (() => void)> = []
  options!: Required<VirtualizerOptions<TScrollElement, TItemElement>>
  scrollElement: TScrollElement | null = null
  targetWindow: (Window & typeof globalThis) | null = null
  isScrolling = false
  private scrollState: ScrollState | null = null
  measurementsCache: Array<VirtualItem> = []
  // Keys belong to the layout build, even when VirtualItems are read later.
  // The flat [start, size, ...] buffer is reused across builds.
  private _singleLaneMeasurements: {
    flat: Float64Array
    items: Array<Key | VirtualItem>
  } | null = null
  itemSizeCache = new Map<Key, number>()
  private itemSizeCacheVersion = 0
  private laneAssignments = new Map<number, number>() // index → lane cache
  // Earliest index dirtied since last getMeasurements() rebuild, or null.
  private pendingMin: number | null = null
  private prevLanes: number | undefined = undefined
  private lanesChangedFlag = false
  private lanesSettling = false
  private pendingScrollAnchor: PendingScrollAnchor | null = null
  scrollRect: Rect | null = null
  scrollOffset: number | null = null
  scrollDirection: ScrollDirection | null = null
  // Size compensation written to the element but not yet reflected in
  // `scrollOffset`: the element is expected at `scrollOffset +
  // scrollAdjustments` until the next scroll event reports it.
  get scrollAdjustments() {
    return this.pendingWrite?.adjustments ?? 0
  }
  // Sum of size-change deltas above-viewport that were skipped during
  // iOS momentum scroll (writing scrollTop mid-momentum cancels it).
  // Flushed in a single scrollTo when iOS is fully settled.
  private _iosDeferredAdjustment = 0
  // The touch gesture in progress. iOS WebKit cancels momentum when
  // scrollTop is written, so adjustments are deferred not only during
  // `isScrolling` but through the whole gesture: `down` from touchstart to
  // touchend/touchcancel (active drag), then `tail` for a short grace window
  // after the finger lifts (early momentum — iOS fires touch events only
  // once at the start of momentum, so the tail is a timer rather than
  // another event). Null between gestures, and after touchend on non-iOS,
  // which arms no tail. The tail record owns its timer: `_endIosTouch` is
  // the only way to drop either, so a cleared record never leaves a timer
  // behind, and a live timer always has its record.
  private _iosTouch:
    | { phase: 'down' }
    | { phase: 'tail'; timerId: number }
    | null = null
  // Our last write to the element, from `_scrollToOffset` until the next
  // scroll event reports it (the only place it is cleared). Until then
  // `scrollOffset` may still hold the old position.
  //
  // - `target`: where the write puts the element (offset + adjustments).
  //   Safari (and Chrome/Firefox under certain DPRs) round writes to whole
  //   pixels: wrote 12345.5, read back 12346. A read-back within 1.5px of
  //   `target` is taken as our own and adopts the exact value, so reconcile
  //   does not see a moved target and write again; a user scroll has moved
  //   further by the time it reports.
  // - `smooth`: the write animates, so until it lands the element is
  //   somewhere between the old offset and `target`.
  // - `adjustments`: see `scrollAdjustments`. Writes that pass none keep the
  //   previous value.
  private pendingWrite: {
    target: number
    smooth: boolean
    adjustments: number
  } | null = null
  // A compensation write from `applyScrollAdjustment` whose target exceeded
  // the element's scroll max at the moment of the write. The browser clamps
  // such a write because the consumer's sizer has not grown yet: an
  // end-anchored item growing at the bottom only extends `scrollHeight` to
  // its own end, so with `paddingEnd > 0` the clamp lands exactly
  // `paddingEnd` short of the target (#1258). `_willUpdate` re-issues the
  // write once the sizer has caught up; the clamped read-back keeps it
  // pending, any other scroll event (a real gesture) cancels it.
  private _clampedAdjustment: { target: number; maxAtWrite: number } | null =
    null
  shouldAdjustScrollPositionOnItemSizeChange:
    | undefined
    | ((
        item: VirtualItem,
        delta: number,
        instance: Virtualizer<TScrollElement, TItemElement>,
      ) => boolean)
  elementsCache = new Map<Key, TItemElement>()
  // Set while a ResizeObserver callback measures its entries; `resizeItem`
  // records the pending notify here instead of firing it per entry.
  private _resizeBatch: { sync: boolean; notify?: boolean } | null = null
  private now = () => this.targetWindow?.performance?.now?.() ?? Date.now()
  private observer = (() => {
    let _ro: ResizeObserver | null = null

    const get = () => {
      if (_ro) {
        return _ro
      }

      if (!this.targetWindow || !this.targetWindow.ResizeObserver) {
        return null
      }

      return (_ro = new this.targetWindow.ResizeObserver((entries) => {
        const run = () => {
          // Measure every entry before notifying. A notify that adjusted
          // scroll re-renders synchronously, and that render can unmount
          // nodes whose entries are still queued here, leaving them
          // unmeasured. With lanes, a half-measured row lets one lane drift
          // away from the others (#1036).
          const batch: { sync: boolean; notify?: boolean } = { sync: false }
          this._resizeBatch = batch
          try {
            entries.forEach(measureEntry)
          } finally {
            this._resizeBatch = null
            if (batch.notify) {
              this.notify(batch.sync)
              this._retryClampedAdjustment()
            }
          }
        }
        this.options.useAnimationFrameWithResizeObserver
          ? requestAnimationFrame(run)
          : run()
      }))
    }

    const measureEntry = (entry: ResizeObserverEntry) => {
      const node = entry.target as TItemElement
      const index = this.indexFromElement(node)

      if (!node.isConnected) {
        this.observer.unobserve(node)
        // Find the cache entry pointing to this exact node and remove
        // it. We can't call getItemKey(index) here because items may
        // have been removed since this node was rendered — the index
        // could be stale and out-of-bounds in the user's data array
        // (regression test in e2e/.../stale-index.spec.ts, fix #1148).
        // The === comparison naturally handles the React-replaced-
        // a-node-for-the-same-key case: that entry now points to a
        // different node, so this loop won't match.
        for (const [cacheKey, cachedNode] of this.elementsCache) {
          if (cachedNode === node) {
            this.elementsCache.delete(cacheKey)
            break
          }
        }
        return
      }

      if (!this.isIndexInRange(index)) return

      if (this.shouldMeasureDuringScroll(index)) {
        this.resizeItem(index, this.options.measureElement(node, entry, this))
      }
    }

    return {
      disconnect: () => {
        get()?.disconnect()
        _ro = null
      },
      observe: (target: Element) =>
        get()?.observe(target, { box: 'border-box' }),
      unobserve: (target: Element) => get()?.unobserve(target),
    }
  })()
  range: { startIndex: number; endIndex: number } | null = null

  constructor(opts: VirtualizerOptions<TScrollElement, TItemElement>) {
    this.setOptions(opts)
  }

  setOptions = (opts: VirtualizerOptions<TScrollElement, TItemElement>) => {
    // Skip `{...defaults, ...opts}` because explicit `undefined` values in
    // opts would override defaults with `undefined`.
    const merged = {
      debug: false,
      initialOffset: 0,
      overscan: 1,
      paddingStart: 0,
      paddingEnd: 0,
      scrollPaddingStart: 0,
      scrollPaddingEnd: 0,
      horizontal: false,
      getItemKey: defaultKeyExtractor,
      rangeExtractor: defaultRangeExtractor,
      onChange: () => {},
      measureElement,
      initialRect: { width: 0, height: 0 },
      scrollMargin: 0,
      gap: 0,
      indexAttribute: 'data-index',
      initialMeasurementsCache: [],
      lanes: 1,
      anchorTo: 'start',
      followOnAppend: false,
      scrollEndThreshold: 1,
      isScrollingResetDelay: 150,
      enabled: true,
      isRtl: false,
      useScrollendEvent: false,
      useAnimationFrameWithResizeObserver: false,
      laneAssignmentMode: 'estimate',
      useCachedMeasurements: false,
    } as unknown as Required<VirtualizerOptions<TScrollElement, TItemElement>>

    for (const key in opts) {
      const v = (opts as any)[key]
      if (v !== undefined) (merged as any)[key] = v
    }

    const prevOptions = this.options as
      | Required<VirtualizerOptions<TScrollElement, TItemElement>>
      | undefined
    let anchor: [Key, number] | null = null
    let followOnAppend: ScrollBehavior | null = null
    let edgeKeysChanged = false

    if (
      prevOptions !== undefined &&
      prevOptions.enabled &&
      merged.enabled &&
      merged.anchorTo === 'end' &&
      this.scrollElement !== null
    ) {
      const prevCount = prevOptions.count
      const nextCount = merged.count
      const measurements = this.getMeasurements()
      const previousItems = this._singleLaneMeasurements?.items ?? measurements
      const getPreviousKey = (index: number) =>
        getMeasurementKey(previousItems[index]!)
      const prevFirstKey = prevCount > 0 ? getPreviousKey(0) : null
      const prevLastKey = prevCount > 0 ? getPreviousKey(prevCount - 1) : null
      const didCountChange = nextCount !== prevCount
      const didEdgeKeysChange =
        didCountChange ||
        (prevCount > 0 &&
          nextCount > 0 &&
          (merged.getItemKey(0) !== prevFirstKey ||
            merged.getItemKey(nextCount - 1) !== prevLastKey))

      if (didEdgeKeysChange) {
        edgeKeysChanged = true
        const item =
          prevCount > 0
            ? (this.getVirtualItemForOffset(this.getScrollOffset()) ??
              measurements[0])
            : null

        if (item) {
          anchor = [item.key, this.getScrollOffset() - item.start]
        }

        const behavior =
          merged.followOnAppend === true
            ? 'auto'
            : merged.followOnAppend || null

        if (
          behavior &&
          nextCount > 0 &&
          this.isAtEnd(prevOptions.scrollEndThreshold) &&
          (prevCount === 0 || merged.getItemKey(nextCount - 1) !== prevLastKey)
        ) {
          if (
            nextCount > prevCount ||
            isAppendWithTrim(
              prevCount,
              nextCount,
              getPreviousKey,
              merged.getItemKey,
            )
          ) {
            followOnAppend = behavior
          }
        }
      }
    }

    this.options = merged

    // When edge keys changed (prepend, trim, reorder, etc.) the key→index
    // mapping has shifted. Force a full measurement rebuild so the anchor
    // resolution below reads positions from the new layout, not the stale
    // memoised cache. Without this, a stable `getItemKey` reference +
    // unchanged `count` would let getMeasurements() return the old layout.
    if (edgeKeysChanged) {
      this.pendingMin = 0
      this.itemSizeCacheVersion++
    }

    // Eagerly adjust scrollOffset so the virtualizer computes the correct
    // visible range during the current render pass — before _willUpdate
    // syncs the DOM scroll position in a layout effect. Without this,
    // the virtualizer would render the wrong items for one frame (the
    // estimate-based positions are stale) and then correct in the next
    // frame, producing a visible "jump" on prepend with dynamic sizes.
    let anchorDelta: number | null = null
    if (anchor && this.scrollOffset !== null) {
      const [anchorKey, anchorOffset] = anchor
      const newMeasurements = this.getMeasurements()
      const { count, getItemKey } = this.options
      let idx = 0
      while (idx < count && getItemKey(idx) !== anchorKey) {
        idx++
      }
      if (idx < count) {
        const anchorItem = newMeasurements[idx]
        if (anchorItem) {
          // Clamp to the reachable range's lower bound — anchorOffset may
          // have been derived from a transiently negative scrollOffset
          // (rubber-band), and a negative tracked offset never self-heals
          // when the element cannot scroll (#1229).
          const newOffset = Math.max(0, anchorItem.start + anchorOffset)
          // A no-op end scroll emits no event to correct a reading-anchor offset.
          if (!followOnAppend && newOffset !== this.scrollOffset) {
            anchorDelta = newOffset - this.scrollOffset
            this.scrollOffset = newOffset
          }
        }
      }
    }

    if (followOnAppend) {
      this.pendingScrollAnchor = { kind: 'follow', behavior: followOnAppend }
    } else if (anchorDelta !== null) {
      this.pendingScrollAnchor = { kind: 'anchor', delta: anchorDelta }
    }
  }

  private notify = (sync: boolean) => {
    this.options.onChange?.(this, sync)
  }

  // Returns `true` when it performed a synchronous `scrollTop` write this
  // tick, `false` when the delta was zero or the write was deferred (iOS).
  // `resizeItem` uses that to decide whether the follow-up `notify` must be
  // synchronous so the grown transforms commit in the same paint (#1227).
  private applyScrollAdjustment(
    delta: number,
    behavior?: ScrollBehavior,
  ): boolean {
    if (delta === 0) return false

    if (process.env.NODE_ENV !== 'production' && this.options.debug) {
      console.info('correction', delta)
    }

    if (isIOSWebKit() && this._iosInMotion()) {
      // An index scroll retargets from fresh measurements in reconcileScroll;
      // replaying this delta after it lands would count it twice.
      if (this.scrollState?.index == null) {
        this._iosDeferredAdjustment += delta
      }
      return false
    } else {
      const target = this.getScrollOffset() + this.scrollAdjustments + delta
      // Guarded so a bare test double without `scrollHeight` / `document`
      // does not crash in `getMaxScrollOffset`.
      const el = this.scrollElement
      const maxAtWrite =
        el !== null && ('scrollHeight' in el || 'document' in el)
          ? this.getMaxScrollOffset()
          : null
      this._clampedAdjustment =
        maxAtWrite !== null && target > maxAtWrite + 0.5
          ? { target, maxAtWrite }
          : null
      this._scrollToOffset(this.getScrollOffset(), {
        adjustments: this.scrollAdjustments + delta,
        behavior,
      })
      // Eagerly carry the intended target in `scrollOffset` so callers that
      // read it before the next scroll event — notably the next `resizeItem`
      // tick's `getVirtualDistanceFromEnd()` / `wasAtEnd` check — see the
      // post-adjustment position even when the DOM `scrollTop` write was
      // clamped because the consumer hasn't grown the sizer yet (`notify()`
      // runs after this in `resizeItem`). Same idea as the eager
      // `scrollOffset` adjustment for prepend in `setOptions` (#1176). The
      // adjustment is now baked into `scrollOffset`, so zero
      // `scrollAdjustments` to keep their sum invariant.
      if (this.scrollOffset !== null) {
        this.scrollOffset += this.scrollAdjustments
        // Clamp only the lower bound: a negative offset is unreachable, and
        // on an unscrollable element (content fits the viewport) no scroll
        // event ever fires to correct it, permanently skewing
        // getDistanceFromEnd() and wedging _flushIosDeferredIfReady (#1229).
        // Upper-bound overflow stays untouched — it is transiently
        // legitimate mid-prepend while the consumer's sizer catches up.
        if (this.scrollOffset < 0) this.scrollOffset = 0
        if (this.pendingWrite) this.pendingWrite.adjustments = 0
      }
      return true
    }
  }

  private maybeNotify = memo(
    () => {
      this.calculateRange()

      return [
        this.isScrolling,
        this.range ? this.range.startIndex : null,
        this.range ? this.range.endIndex : null,
      ]
    },
    (isScrolling) => {
      this.notify(isScrolling)
    },
    {
      key: process.env.NODE_ENV !== 'production' && 'maybeNotify',
      debug: () => this.options.debug,
      initialDeps: [
        this.isScrolling,
        this.range ? this.range.startIndex : null,
        this.range ? this.range.endIndex : null,
      ] as [boolean, number | null, number | null],
    },
  )

  private cleanup = () => {
    this.unsubs.filter(Boolean).forEach((d) => d!())
    this.unsubs = []
    this.observer.disconnect()
    if (this.rafId != null && this.targetWindow) {
      this.targetWindow.cancelAnimationFrame(this.rafId)
      this.rafId = null
    }
    this.scrollState = null
    // The debounce cancelled above is the only thing that writes `isScrolling`
    // back to false, so a cleanup inside the reset window would strand it, and
    // the direction derived from it, as true. That matters because `cleanup`
    // also runs when the scroll element changes or `enabled` goes false, where
    // the instance lives on.
    this.isScrolling = false
    this.scrollDirection = null
    // The iOS gesture/deferral state is scoped to the current scroll
    // element: the touch listeners that maintain it were just removed, and
    // an in-flight touch keeps targeting the old element (implicit touch
    // capture), so the new element never reports it. Carrying the state
    // over would replay a stale deferred delta on the new element's first
    // flush, and a cleanup that lands mid-touch or inside the post-touchend
    // grace window would strand `_iosTouch` (the listeners that end it were
    // just removed), deferring every adjustment on the new element until
    // its next touch cycle.
    this._iosDeferredAdjustment = 0
    this._endIosTouch()
    this._clampedAdjustment = null
    // A write to the old element will never be read back.
    this.pendingWrite = null
    this.scrollElement = null
    this.targetWindow = null
  }

  _didMount = () => {
    return () => {
      this.cleanup()
    }
  }

  _willUpdate = () => {
    const scrollElement = this.options.enabled
      ? this.options.getScrollElement()
      : null

    if (this.scrollElement !== scrollElement) {
      this.cleanup()

      if (!scrollElement) {
        this.maybeNotify()
        return
      }

      this.scrollElement = scrollElement

      if (this.scrollElement && 'ownerDocument' in this.scrollElement) {
        this.targetWindow = this.scrollElement.ownerDocument.defaultView
      } else {
        this.targetWindow = this.scrollElement?.window ?? null
      }

      this.elementsCache.forEach((cached) => {
        this.observer.observe(cached)
      })

      this.unsubs.push(
        this.options.observeElementRect(this, (rect) => {
          this.scrollRect = rect
          this.maybeNotify()
        }),
      )

      this.unsubs.push(
        this.options.observeElementOffset(this, (offset, isScrolling) => {
          // A scroll event that reports movement but lands on the offset we
          // already hold — and isn't a self-write read-back — is a spurious
          // no-op re-emit that Safari/Firefox fire after a re-render's layout
          // (Chrome doesn't). Treating it as scrolling re-arms `isScrolling`,
          // which forces a render that triggers another such event: an
          // infinite re-render loop. Ignore it. (Self-writes are matched to
          // `pendingWrite` just below.)
          if (
            isScrolling &&
            this.pendingWrite === null &&
            offset === this.scrollOffset
          ) {
            return
          }

          // The read-back of our own write: adopt the exact target over the
          // browser's rounded value (see `pendingWrite`).
          const pending = this.pendingWrite
          if (pending !== null && Math.abs(offset - pending.target) < 1.5) {
            offset = pending.target
          } else if (
            this.scrollState?.index != null &&
            // A non-smooth write lands at once, so any other scroll event is
            // the user's, even before reconcile saw the target reached (the
            // target may keep moving, or iOS ignored the write under a
            // finger). A write the browser clamped because the sizer hasn't
            // grown yet reads back at the max, which is also where the fresh
            // target clamps, so the check below keeps it reconciling (#1294).
            // Not when rows above the target shrink before the read-back and
            // pull the target below the new max: the read-back then looks
            // like the user and the scroll stops at the max. That needs the
            // sizer re-rendered before the scroll event, which browsers have
            // not been seen to do (pinned by a `.fails` test).
            // While a smooth scroll's animation may still report, its events
            // look like a user's, so it yields only once it has landed.
            !isAnimating(this.scrollState) &&
            !approxEqual(offset, this.scrollState.lastTargetOffset) &&
            !approxEqual(offset, this.getScrollStateTarget(this.scrollState)) &&
            (this._clampedAdjustment === null ||
              Math.abs(offset - this._clampedAdjustment.maxAtWrite) >= 1.5)
          ) {
            // An external scroll moved away from the index scroll's target.
            // Our own measurement updates (including clamped writes) still
            // need to reconcile.
            this.scrollState = null
          }
          this.pendingWrite = null

          // A pending clamped compensation write (#1258) survives only its
          // own read-back, which the browser reports at the scroll max we
          // saw at write time. Anything else is a real gesture (or the write
          // landing after all), so drop it rather than yank the user later.
          if (
            this._clampedAdjustment !== null &&
            Math.abs(offset - this._clampedAdjustment.maxAtWrite) >= 1.5
          ) {
            this._clampedAdjustment = null
          }

          // If the offset hasn't moved, this is the echo of our own
          // adjustment write — `applyScrollAdjustment` already folded it
          // into `scrollOffset`. There's no direction to infer, so leave
          // it alone; a real gesture always moves the offset.
          const prevOffset = this.getScrollOffset()
          this.scrollDirection = isScrolling
            ? prevOffset === offset
              ? this.scrollDirection
              : prevOffset < offset
                ? 'forward'
                : 'backward'
            : null
          this.scrollOffset = offset
          this.isScrolling = isScrolling

          // Flush deferred iOS adjustments if we're now fully settled.
          // "Fully settled" means: not actively scrolling, no finger on
          // screen, and the post-touchend grace window has expired.
          this._flushIosDeferredIfReady()

          if (this.scrollState) {
            this.scheduleScrollReconcile()
          }
          this.maybeNotify()
        }),
      )

      // Touch event listeners (iOS-aware deferral). We attach unconditionally
      // — the listeners are passive and cheap; on non-touch devices they
      // simply never fire. The gating by isIOSWebKit() lives in resizeItem
      // and _flushIosDeferredIfReady so we only burn the path on iOS.
      if ('addEventListener' in this.scrollElement) {
        const scrollEl = this.scrollElement as unknown as EventTarget
        const onTouchStart = () => {
          // A finger back down inside the grace window cancels its tail.
          this._endIosTouch()
          this._iosTouch = { phase: 'down' }
        }
        const onTouchEnd = () => {
          this._endIosTouch()
          if (!isIOSWebKit() || this.targetWindow == null) {
            // Non-iOS: nothing more to track.
            return
          }
          // After ~150 ms with no scroll/touch events, momentum is done.
          const tail = {
            phase: 'tail' as const,
            timerId: this.targetWindow.setTimeout(() => {
              if (this._iosTouch === tail) this._iosTouch = null
              // After the grace window, attempt to flush. The scroll event
              // for momentum decay may have already fired before our timer.
              this._flushIosDeferredIfReady()
            }, 150),
          }
          this._iosTouch = tail
        }
        scrollEl.addEventListener(
          'touchstart',
          onTouchStart,
          addEventListenerOptions,
        )
        scrollEl.addEventListener(
          'touchend',
          onTouchEnd,
          addEventListenerOptions,
        )
        // Same handler as touchend: iOS can end a touch with touchcancel
        // (system gesture, interrupted scroll) and never fire touchend.
        scrollEl.addEventListener(
          'touchcancel',
          onTouchEnd,
          addEventListenerOptions,
        )
        this.unsubs.push(() => {
          scrollEl.removeEventListener('touchstart', onTouchStart)
          scrollEl.removeEventListener('touchend', onTouchEnd)
          scrollEl.removeEventListener('touchcancel', onTouchEnd)
          this._endIosTouch()
        })
      }

      this._scrollToOffset(this.getScrollOffset(), {
        adjustments: undefined,
        behavior: undefined,
      })
    }

    const anchor = this.pendingScrollAnchor
    this.pendingScrollAnchor = null

    if (anchor && this.scrollElement && this.options.enabled) {
      if (anchor.kind === 'anchor') {
        // scrollOffset was eagerly adjusted in setOptions so the
        // virtualizer already computed the correct range during render.
        // Now sync the browser's actual scroll position to match.
        //
        // On iOS WebKit, writing scrollTop during touch/momentum cancels
        // the in-flight scroll. Defer the DOM sync the same way
        // applyScrollAdjustment does — accumulate the delta and let
        // _flushIosDeferredIfReady handle it once the scroll settles.
        if (isIOSWebKit() && this._iosInMotion()) {
          this._iosDeferredAdjustment += anchor.delta
        } else if (
          isSmoothScroll(this.scrollState) &&
          !approxEqual(
            this.getScrollOffset() - anchor.delta,
            this.scrollState.lastTargetOffset,
          )
        ) {
          // A smooth programmatic scroll is still travelling. Writing scrollTop
          // here would cancel the browser's animation, and Chromium drops a
          // smooth request re-issued in the frame right after that cancel, so
          // the journey would be stranded. The target is index-based and
          // recomputes against the new layout in reconcileScroll, so let the
          // animation run; the next scroll event re-syncs the tracked offset.
          // A smooth scroll that has already landed (offset at its target,
          // reconcile not yet retired it) still gets the anchor sync.
        } else {
          this._scrollToOffset(this.getScrollOffset(), {
            adjustments: undefined,
            behavior: undefined,
          })
        }
      } else {
        this.scrollToEnd({ behavior: anchor.behavior })
      }
    }

    // The consumer has committed the new total size by now, so a clamped
    // compensation write may have room (#1258).
    this._retryClampedAdjustment()
  }

  // Re-issue a compensation write the browser clamped because the sizer had
  // not grown yet (#1258, #1266). Called after `notify` in `resizeItem`,
  // which covers consumers that size the container synchronously inside
  // `onChange` (direct DOM updates, flushSync renders — where no re-render
  // may follow at all), and from `_willUpdate` for consumers that size it
  // during an asynchronous render. Both the clamped read-back and the
  // absence of one leave `_clampedAdjustment` set, so timing does not matter.
  private _retryClampedAdjustment = () => {
    if (
      this._clampedAdjustment === null ||
      !this.scrollElement ||
      !this.options.enabled
    ) {
      return
    }
    const { target, maxAtWrite } = this._clampedAdjustment
    const max = this.getMaxScrollOffset()
    if (max > maxAtWrite + 0.5) {
      // Still short (the sizer grew only partially): stay pending against
      // the new max so the next opportunity retries.
      this._clampedAdjustment =
        target > max + 0.5 ? { target, maxAtWrite: max } : null
      this._scrollToOffset(target, {
        adjustments: undefined,
        behavior: undefined,
      })
    }
  }

  // The element is moving or about to: a scroll in progress, or a touch
  // gesture that may still turn into one (see `_iosTouch`). On iOS a write
  // now would cancel the momentum, so adjustments wait for the flush below.
  private _iosInMotion = () => this.isScrolling || this._iosTouch !== null

  private _endIosTouch = () => {
    if (this._iosTouch?.phase === 'tail' && this.targetWindow != null) {
      this.targetWindow.clearTimeout(this._iosTouch.timerId)
    }
    this._iosTouch = null
  }

  // Apply any accumulated iOS-deferred scroll adjustment, but only when we're
  // truly settled — not actively scrolling, not under an active touch, and
  // past the post-touchend grace window. Called from the scroll callback
  // and the touchend grace-timer.
  private _flushIosDeferredIfReady = () => {
    if (this._iosDeferredAdjustment === 0) return
    if (this._iosInMotion()) return
    // Phase 2b: Safari elastic-overscroll (rubber-band) lets scrollTop go
    // negative or beyond scrollHeight - clientHeight. Writing scrollTop
    // while in that zone snaps the page back to the clamped value at the
    // end of the bounce, often discarding the user's intent. Skip the
    // flush; the next in-bounds scroll event will retry.
    const cur = this.getScrollOffset()
    const max = this.getMaxScrollOffset()
    if (cur < 0 || cur > max) return
    // At the end clamp the browser already absorbed a shrink above the
    // viewport (it clamped scrollTop onto the new bottom), so replaying our
    // deferred negative delta would lift the view off the bottom — drop it.
    // Positive deltas still replay: growth above doesn't clamp. (#1233)
    if (this._iosDeferredAdjustment < 0 && cur >= max - 1) {
      this._iosDeferredAdjustment = 0
      return
    }
    const delta = this._iosDeferredAdjustment
    this._iosDeferredAdjustment = 0
    // Roll the deferred delta into the running accumulator so any resize
    // landing between now and the resulting scroll event computes from the
    // post-flush offset rather than the stale one.
    this._scrollToOffset(cur, {
      adjustments: this.scrollAdjustments + delta,
      behavior: undefined,
    })
  }

  private rafId: number | null = null
  private scheduleScrollReconcile() {
    if (!this.targetWindow) {
      this.scrollState = null
      return
    }
    if (this.rafId != null) return
    this.rafId = this.targetWindow.requestAnimationFrame(() => {
      this.rafId = null
      this.reconcileScroll()
    })
  }
  private getScrollStateTarget(state: ScrollState) {
    const offsetInfo = state.toEnd
      ? ([Math.max(this.getMaxScrollOffset(), 0)] as const)
      : state.index != null
        ? this.getOffsetForIndex(state.index, state.align)
        : undefined
    return offsetInfo ? offsetInfo[0] : state.lastTargetOffset
  }
  private reconcileScroll() {
    if (!this.scrollState) return

    const el = this.scrollElement
    if (!el) return

    // Safety valve: bail out if reconciliation has been running too long
    const MAX_RECONCILE_MS = 5000
    if (this.now() - this.scrollState.startedAt > MAX_RECONCILE_MS) {
      this.scrollState = null
      return
    }

    // A resize since the last render leaves measurementsCache stale until
    // something reads getMeasurements(); rebuild it (memoized) so an index
    // target reflects it even when no render ran in between.
    this.getMeasurements()
    const targetOffset = this.getScrollStateTarget(this.scrollState)

    // Index targets can still depend on cached sizes during the first rAF,
    // which runs before ResizeObserver delivers pending measurements. Wait
    // another frame (two when measurements are themselves deferred to rAF)
    // before retiring an index scroll. Absolute offsets don't need this wait.
    const STABLE_FRAMES =
      this.scrollState.index == null
        ? 1
        : this.options.useAnimationFrameWithResizeObserver
          ? 3
          : 2

    const targetChanged = targetOffset !== this.scrollState.lastTargetOffset

    if (!targetChanged && approxEqual(targetOffset, this.getScrollOffset())) {
      // At the target: a travelling smooth scroll has landed, and a
      // finishing one is now an instant scroll.
      if (this.scrollState.phase === 'smooth') {
        this.scrollState.phase = 'smoothLanded'
      } else if (this.scrollState.phase === 'smoothFinishing') {
        this.scrollState.phase = 'instant'
      }
      this.scrollState.stableFrames++
      if (this.scrollState.stableFrames >= STABLE_FRAMES) {
        // Final-pass exact landing. The reconcile-stable check uses a 1.01px
        // tolerance (approxEqual) so we don't fight subpixel browser rounding
        // during the converging phase. Once we're definitively settled,
        // commit the exact target so consumers calling scrollToIndex(N)
        // end up at the EXACT computed position of item N — matching
        // virtuoso's 0px landing accuracy rather than our prior 0.5-1px.
        if (this.getScrollOffset() !== targetOffset) {
          this._scrollToOffset(targetOffset, {
            adjustments: undefined,
            behavior: 'auto',
          })
        }
        this.scrollState = null
        return
      }
    } else {
      this.scrollState.stableFrames = 0

      if (targetChanged) {
        // When the target moves during smooth scroll (because items came into
        // view and got measured, shifting positions), the original logic was
        // to immediately snap to 'auto' — visibly jarring on long
        // scroll-to-index calls. Now: keep smooth while we're still far
        // (more than a viewport) from the new target. Only fall back to
        // 'auto' for the final approach, so the user sees one continuous
        // motion that smoothly adjusts its endpoint as measurements arrive.
        const viewport = this.getSize() || 600
        const distance = Math.abs(targetOffset - this.getScrollOffset())
        const keepSmooth =
          isSmoothScroll(this.scrollState) && distance > viewport

        this.scrollState.lastTargetOffset = targetOffset
        if (keepSmooth) {
          // A smooth retarget travels again, so its intermediate scroll
          // events must not read as an external scroll away from the target.
          this.scrollState.phase = 'smooth'
        } else if (this.scrollState.phase === 'smooth') {
          // The final approach is instant, but the animation can still report.
          this.scrollState.phase = 'smoothFinishing'
        } else if (this.scrollState.phase === 'smoothLanded') {
          this.scrollState.phase = 'instant'
        }
        // 'smoothFinishing' stays as it is (its animation may still report)
        // until reconcile sees it at the target; 'instant' stays instant.

        this._scrollToOffset(targetOffset, {
          adjustments: undefined,
          behavior: keepSmooth ? 'smooth' : 'auto',
        })
      }
    }

    // Always reschedule while scrollState is active to guarantee
    // the safety valve timeout runs even if no scroll events fire
    // (e.g. no-op scrollToFn, detached element)
    this.scheduleScrollReconcile()
  }

  private getSize = () => {
    if (!this.options.enabled) {
      this.scrollRect = null
      return 0
    }

    this.scrollRect = this.scrollRect ?? this.options.initialRect

    return this.scrollRect[this.options.horizontal ? 'width' : 'height']
  }

  private getScrollOffset = () => {
    if (!this.options.enabled) {
      this.scrollOffset = null
      return 0
    }

    this.scrollOffset =
      this.scrollOffset ??
      (typeof this.options.initialOffset === 'function'
        ? this.options.initialOffset()
        : this.options.initialOffset)

    return this.scrollOffset
  }

  private getMeasurementOptions = memo(
    () => [
      this.options.count,
      this.options.paddingStart,
      this.options.scrollMargin,
      this.options.getItemKey,
      this.options.enabled,
      this.options.lanes,
      this.options.laneAssignmentMode,
      this.options.gap,
    ],
    (
      count,
      paddingStart,
      scrollMargin,
      getItemKey,
      enabled,
      lanes,
      laneAssignmentMode,
      gap,
    ) => {
      const lanesChanged =
        this.prevLanes !== undefined && this.prevLanes !== lanes

      if (lanesChanged) {
        // Set flag for getMeasurements to handle
        this.lanesChangedFlag = true
      }

      this.prevLanes = lanes
      this.pendingMin = null

      return {
        count,
        paddingStart,
        scrollMargin,
        getItemKey,
        enabled,
        lanes,
        laneAssignmentMode,
        gap,
      }
    },
    {
      key: false,
    },
  )

  private isIndexInRange = (index: number): boolean =>
    index >= 0 && index < this.options.count

  private getMeasurements = memo(
    () => [this.getMeasurementOptions(), this.itemSizeCacheVersion],
    (
      {
        count,
        paddingStart,
        scrollMargin,
        getItemKey,
        enabled,
        lanes,
        laneAssignmentMode,
        gap,
      },
      _itemSizeCacheVersion,
    ) => {
      const itemSizeCache = this.itemSizeCache
      if (!enabled) {
        this.measurementsCache = []
        this._singleLaneMeasurements = null
        this.itemSizeCache.clear()
        this.laneAssignments.clear()
        return []
      }

      // Clean up stale lane cache entries when count decreases
      if (this.laneAssignments.size > count) {
        for (const index of this.laneAssignments.keys()) {
          if (index >= count) {
            this.laneAssignments.delete(index)
          }
        }
      }

      // ✅ Force complete recalculation when lanes change
      if (this.lanesChangedFlag) {
        this.lanesChangedFlag = false // Reset immediately
        this.lanesSettling = true // Start settling period
        this.measurementsCache = []
        this._singleLaneMeasurements = null
        this.itemSizeCache.clear()
        this.laneAssignments.clear() // Clear lane cache for new lane count
        // Force min = 0 on the rebuild
        this.pendingMin = null
      }

      // Don't restore from initialMeasurementsCache during lane changes
      // as it contains stale lane assignments from the previous lane count
      if (this.measurementsCache.length === 0 && !this.lanesSettling) {
        this.measurementsCache = this.options.initialMeasurementsCache
        this.measurementsCache.forEach((item) => {
          this.itemSizeCache.set(item.key, item.size)
        })
      }

      // During lanes settling, ignore pendingMin to prevent repositioning
      const min = this.lanesSettling ? 0 : (this.pendingMin ?? 0)
      this.pendingMin = null

      // ✅ End settling period when cache is fully built
      if (this.lanesSettling && this.measurementsCache.length === count) {
        this.lanesSettling = false
      }

      // ─── Fast path: single-lane lazy materialization ────────────────────
      // For lanes === 1 (the default and most common case), skip the
      // per-item VirtualItem object allocation. We write start/size pairs
      // into a Float64Array and return a Proxy that builds VirtualItem
      // objects on demand (only the indices a consumer actually reads).
      if (lanes === 1) {
        // Reuse flat backing if large enough; else grow (preserving data
        // before `min` to mirror the slice-and-rebuild contract).
        const need = count * 2
        let flat = this._singleLaneMeasurements?.flat
        if (!flat || flat.length < need) {
          const next = new Float64Array(need)
          if (flat && min > 0) next.set(flat.subarray(0, min * 2))
          flat = next
        }

        const items: Array<Key | VirtualItem> =
          min === 0
            ? new Array(count)
            : this._singleLaneMeasurements!.items.slice()

        let runningStart: number
        if (min === 0) {
          runningStart = paddingStart + scrollMargin
        } else {
          // Continue from where we left off
          const prevIdx = min - 1
          runningStart = flat[prevIdx * 2]! + flat[prevIdx * 2 + 1]! + gap
        }

        for (let i = min; i < count; i++) {
          const key = getItemKey(i)
          items[i] = key
          const measuredSize = itemSizeCache.get(key)
          const size =
            typeof measuredSize === 'number'
              ? measuredSize
              : this.options.estimateSize(i)
          flat[i * 2] = runningStart
          flat[i * 2 + 1] = size
          runningStart += size + gap
        }

        this._singleLaneMeasurements = { flat, items }
        const view = createLazyMeasurementsView(items, flat)
        this.measurementsCache = view
        return view
      }

      const measurements = this.measurementsCache.slice(0, min)

      // ✅ Performance: Track last item index per lane for O(1) lookup
      const laneLastIndex: Array<number | undefined> = new Array(lanes).fill(
        undefined,
      )
      // Running end position of each lane's last item, so the shortest lane
      // can be found with an O(lanes) argmin instead of the old backward walk
      // through `measurements` (getFurthestMeasurement). `filledLanes` tracks
      // how many lanes have at least one item, mirroring the previous
      // "all lanes seen → shortest lane, else i % lanes" branch.
      const laneEnds = new Float64Array(lanes)
      let filledLanes = 0

      // Initialize from existing measurements (before min)
      for (let m = 0; m < min; m++) {
        const item = measurements[m]
        if (item) {
          if (laneLastIndex[item.lane] === undefined) filledLanes++
          laneLastIndex[item.lane] = m
          laneEnds[item.lane] = item.end
        }
      }

      for (let i = min; i < count; i++) {
        const key = getItemKey(i)

        // Check for cached lane assignment
        const cachedLane = this.laneAssignments.get(i)
        let lane: number
        let start: number

        const shouldCacheLane =
          laneAssignmentMode === 'estimate' || itemSizeCache.has(key)

        if (cachedLane !== undefined && this.options.lanes > 1) {
          // Use cached lane - O(1) lookup for previous item in same lane
          lane = cachedLane
          const prevIndex = laneLastIndex[lane]
          const prevInLane =
            prevIndex !== undefined ? measurements[prevIndex] : undefined
          start = prevInLane
            ? prevInLane.end + gap
            : paddingStart + scrollMargin
        } else if (filledLanes === lanes) {
          // No cache, every lane seeded: place in the shortest lane.
          // Read the running per-lane ends (O(lanes) argmin) instead of the
          // old backward scan. Tie-break on the lane's last-item index to
          // preserve the previous sort-by-(end, index) placement exactly.
          let bestLane = 0
          let bestEnd = laneEnds[0]!
          let bestIdx = laneLastIndex[0]!
          for (let l = 1; l < lanes; l++) {
            const e = laneEnds[l]!
            if (e < bestEnd || (e === bestEnd && laneLastIndex[l]! < bestIdx)) {
              bestLane = l
              bestEnd = e
              bestIdx = laneLastIndex[l]!
            }
          }
          lane = bestLane
          start = bestEnd + gap

          if (shouldCacheLane) {
            this.laneAssignments.set(i, lane)
          }
        } else {
          // No cache and not every lane seeded yet — seed lanes in order,
          // matching the previous `i % lanes` fallback for the first row.
          lane = i % this.options.lanes
          start = paddingStart + scrollMargin

          if (shouldCacheLane) {
            this.laneAssignments.set(i, lane)
          }
        }

        const measuredSize = itemSizeCache.get(key)
        const size =
          typeof measuredSize === 'number'
            ? measuredSize
            : this.options.estimateSize(i)

        const end = start + size

        measurements[i] = {
          index: i,
          start,
          size,
          end,
          key,
          lane,
        }

        // ✅ Performance: Update lane's last item index + running end
        if (laneLastIndex[lane] === undefined) filledLanes++
        laneLastIndex[lane] = i
        laneEnds[lane] = end
      }

      this.measurementsCache = measurements

      return measurements
    },
    {
      key: process.env.NODE_ENV !== 'production' && 'getMeasurements',
      debug: () => this.options.debug,
    },
  )

  calculateRange = memo(
    () => [
      this.getMeasurements(),
      this.getSize(),
      this.getScrollOffset(),
      this.options.lanes,
    ],
    (measurements, outerSize, scrollOffset, lanes) => {
      if (measurements.length === 0 || outerSize === 0) {
        this.range = null
        return null
      }
      this.range = calculateRangeImpl(
        measurements,
        outerSize,
        scrollOffset,
        lanes,
        // Pass the typed array so binary search + forward-walk can read
        // start/end directly from Float64Array, skipping the Proxy traps.
        lanes === 1 && this._singleLaneMeasurements !== null
          ? this._singleLaneMeasurements.flat
          : null,
      )
      return this.range
    },
    {
      key: process.env.NODE_ENV !== 'production' && 'calculateRange',
      debug: () => this.options.debug,
    },
  )

  getVirtualIndexes = memo(
    () => {
      let startIndex: number | null = null
      let endIndex: number | null = null
      const range = this.calculateRange()
      if (range) {
        startIndex = range.startIndex
        endIndex = range.endIndex
      }
      this.maybeNotify.updateDeps([this.isScrolling, startIndex, endIndex])
      return [
        this.options.rangeExtractor,
        this.options.overscan,
        this.options.count,
        startIndex,
        endIndex,
        this.options.lanes,
      ]
    },
    (rangeExtractor, overscan, count, startIndex, endIndex, lanes) => {
      return startIndex === null || endIndex === null
        ? []
        : rangeExtractor({
            startIndex,
            endIndex,
            overscan,
            count,
            lanes,
          })
    },
    {
      key: process.env.NODE_ENV !== 'production' && 'getVirtualIndexes',
      debug: () => this.options.debug,
    },
  )

  indexFromElement = (node: TItemElement) => {
    const attributeName = this.options.indexAttribute
    const indexStr = node.getAttribute(attributeName)

    if (!indexStr) {
      console.warn(
        `Missing attribute name '${attributeName}={index}' on measured element.`,
      )
      return -1
    }

    return parseInt(indexStr, 10)
  }

  /**
   * Determines if an item at the given index should be measured during smooth scroll.
   * During smooth scroll, only items within a buffer range around the target are measured
   * to prevent items far from the target from pushing it away.
   */
  private shouldMeasureDuringScroll = (index: number): boolean => {
    // No scroll state or not smooth scroll - always allow measurements
    if (!isSmoothScroll(this.scrollState)) {
      return true
    }

    const scrollIndex =
      this.scrollState.index ??
      this.getVirtualItemForOffset(this.scrollState.lastTargetOffset)?.index

    if (scrollIndex !== undefined && this.range) {
      // Allow measurements within a buffer range around the scroll target
      const bufferSize = Math.max(
        this.options.overscan,
        Math.ceil((this.range.endIndex - this.range.startIndex) / 2),
      )
      const minIndex = Math.max(0, scrollIndex - bufferSize)
      const maxIndex = Math.min(
        this.options.count - 1,
        scrollIndex + bufferSize,
      )
      return index >= minIndex && index <= maxIndex
    }

    return true
  }

  measureElement = (node: TItemElement | null) => {
    if (!node) {
      this.elementsCache.forEach((cached, key) => {
        if (!cached.isConnected) {
          this.observer.unobserve(cached)
          this.elementsCache.delete(key)
        }
      })
      return
    }

    const index = this.indexFromElement(node)
    if (!this.isIndexInRange(index)) return

    const key = this.options.getItemKey(index)
    const prevNode = this.elementsCache.get(key)

    if (prevNode !== node) {
      if (prevNode) {
        this.observer.unobserve(prevNode)
      }
      this.observer.observe(node)
      this.elementsCache.set(key, node)
    }

    // Sync-measure when idle (initial render) or during programmatic scrolling
    // (scrollToIndex/scrollToOffset) where reconcileScroll needs sizes in the same frame.
    // During normal user scrolling, skip sync measurement — the RO callback handles it async.
    // Skip nodes that aren't attached yet: they have no layout and would be
    // cached as 0. Vue calls function refs during patch, before the parent is
    // inserted. The node is observed above, so the RO reports its size once
    // it's connected.
    if (
      node.isConnected &&
      (!this.isScrolling || this.scrollState) &&
      this.shouldMeasureDuringScroll(index)
    ) {
      this.resizeItem(index, this.options.measureElement(node, undefined, this))
    }
  }

  resizeItem = (index: number, size: number) => {
    if (!this.isIndexInRange(index)) return

    // An earlier entry in this ResizeObserver batch moved `scrollOffset`.
    // Outside a batch its sync notify would have re-rendered and rebuilt the
    // caches read below; rebuild them here so the anchoring check compares
    // this item's current start, not a stale one, against the adjusted
    // offset (#1218). Without a scroll move, the caches are exactly as stale
    // as they were before batching, so skip the rebuild.
    if (this._resizeBatch?.sync) this.getMeasurements()

    // Fast field reads. For lanes===1 we read raw start/size from the flat
    // typed array, avoiding a Proxy.get + VirtualItem allocation per call.
    // For lanes>1 we fall back to the cached VirtualItem array.
    let cachedSize: number
    let itemStart: number
    let key: Key
    const flat = this._singleLaneMeasurements?.flat
    if (this.options.lanes === 1 && flat != null) {
      key = this.options.getItemKey(index)
      itemStart = flat[index * 2]!
      cachedSize = flat[index * 2 + 1]!
    } else {
      const item = this.measurementsCache[index]
      if (!item) return
      key = item.key
      itemStart = item.start
      cachedSize = item.size
    }

    const itemSize = this.itemSizeCache.get(key) ?? cachedSize
    const delta = size - itemSize

    if (delta !== 0) {
      const wasAtEnd =
        this.options.anchorTo === 'end' &&
        !isSmoothScroll(this.scrollState) &&
        this.getVirtualDistanceFromEnd() <= this.options.scrollEndThreshold
      const prevTotalSize = wasAtEnd ? this.getTotalSize() : 0
      // Default anchoring predicate (used unless the consumer supplies a
      // custom shouldAdjustScrollPositionOnItemSizeChange).
      const scrollOffsetWithAdj =
        this.getScrollOffset() + this.scrollAdjustments
      const isFirstMeasure = !this.itemSizeCache.has(key)
      const defaultShouldAdjust = isFirstMeasure
        ? // First measurement: compensate any item whose top sits above the
          // fold — the estimate→actual delta must be corrected regardless of
          // scroll direction, since the whole estimated block was above it.
          itemStart < scrollOffsetWithAdj
        : // Re-measurement: only compensate an item that is ENTIRELY above the
          // fold. An item that merely *spans* the fold (top above, bottom
          // below — e.g. a streaming chat message growing at its bottom)
          // changes size *below* the anchor point, so shifting scrollTop by the
          // delta would drag the viewport downward on every growth (#1218).
          // Also skip during backward scroll to avoid the "items jump while
          // scrolling up" cascade.
          itemStart + itemSize <= scrollOffsetWithAdj &&
          this.scrollDirection !== 'backward'
      const shouldAdjustScroll =
        !isSmoothScroll(this.scrollState) &&
        (this.shouldAdjustScrollPositionOnItemSizeChange !== undefined
          ? this.shouldAdjustScrollPositionOnItemSizeChange(
              // The callback expects a VirtualItem; build one lazily only
              // when the consumer actually supplied a custom predicate.
              this.measurementsCache[index] ?? {
                index,
                key,
                start: itemStart,
                size: cachedSize,
                end: itemStart + cachedSize,
                lane: 0,
              },
              delta,
              this,
            )
          : defaultShouldAdjust)

      if (this.pendingMin === null || index < this.pendingMin) {
        this.pendingMin = index
      }
      this.itemSizeCache.set(key, size)
      this.itemSizeCacheVersion++

      // A scroll command (or reconcile) wrote a new position that neither a
      // scroll event nor an eager update has reflected in `scrollOffset` yet.
      // The rows being measured were rendered for the old position, so
      // "above the viewport" means nothing against either offset. An index
      // or end target is retargeted from fresh measurements by
      // reconcileScroll next frame; an offset target (scrollToOffset,
      // scrollBy) lands where it was written and the delta is not applied,
      // since compensating against the stale offset would overwrite the
      // command. Compensation writes and the prepend anchor sync update
      // `scrollOffset` eagerly, and the iOS flush writes exactly
      // `scrollOffset + scrollAdjustments`, so none of them count.
      const writtenOffset = this.getCommandWrittenOffset()
      const awaitingCommandReadBack =
        writtenOffset !== null &&
        !approxEqual(
          writtenOffset,
          this.getScrollOffset() + this.scrollAdjustments,
        )

      let adjustedSync = false
      if (!awaitingCommandReadBack) {
        if (wasAtEnd) {
          adjustedSync = this.applyScrollAdjustment(
            this.getTotalSize() - prevTotalSize,
          )
        } else if (shouldAdjustScroll) {
          adjustedSync = this.applyScrollAdjustment(delta)
        }
      }

      // When we just moved `scrollTop` to compensate for an above-viewport
      // resize, the grown item transforms must commit in the SAME frame as
      // that write. `applyScrollAdjustment` writes `scrollTop` synchronously
      // inside this ResizeObserver callback, but an async `notify` schedules
      // the transform render for a later commit — so the browser can paint
      // one frame with the new `scrollTop` and the old positions, and the
      // viewport visibly jumps by `delta` before snapping back (#1227). A
      // synchronous notify flushes the render in this same callback, so both
      // land in one paint. When nothing moved (or the write was deferred on
      // iOS), keep the cheaper async notify.
      if (this._resizeBatch) {
        // Inside a ResizeObserver callback: notify once after every entry
        // is measured, synchronously if any of them moved `scrollTop`.
        this._resizeBatch.notify = true
        this._resizeBatch.sync ||= adjustedSync
        return
      }
      this.notify(adjustedSync)
      // A consumer that grows the sizer synchronously inside `onChange`
      // (direct DOM updates) may never re-render when the range is
      // unchanged, so retry a clamped write here rather than only in
      // `_willUpdate` (#1266).
      this._retryClampedAdjustment()
    }
  }

  getVirtualItems = memo(
    () => [this.getVirtualIndexes(), this.getMeasurements()],
    (indexes, measurements) => {
      const virtualItems: Array<VirtualItem> = []

      for (let k = 0, len = indexes.length; k < len; k++) {
        const i = indexes[k]!
        const measurement = measurements[i]!

        virtualItems.push(measurement)
      }

      return virtualItems
    },
    {
      key: process.env.NODE_ENV !== 'production' && 'getVirtualItems',
      debug: () => this.options.debug,
    },
  )

  getVirtualItemForOffset = (offset: number) => {
    const measurements = this.getMeasurements()
    if (measurements.length === 0) {
      return undefined
    }
    // Same fast-path as calculateRange: read start values directly from the
    // typed array during binary search to skip the Proxy.get materialization
    // per probe.
    const flat = this._singleLaneMeasurements?.flat
    const useFlat = this.options.lanes === 1 && flat != null
    const idx = findNearestBinarySearch(
      0,
      measurements.length - 1,
      useFlat
        ? (i: number) => flat[i * 2]!
        : (i: number) => notUndefined(measurements[i]).start,
      offset,
    )
    return notUndefined(measurements[idx])
  }

  private getMaxScrollOffset = () => {
    if (!this.scrollElement) return 0

    if ('scrollHeight' in this.scrollElement) {
      // Element
      return this.options.horizontal
        ? this.scrollElement.scrollWidth - this.scrollElement.clientWidth
        : this.scrollElement.scrollHeight - this.scrollElement.clientHeight
    } else {
      // Window
      const doc = this.scrollElement.document.documentElement
      return this.options.horizontal
        ? doc.scrollWidth - this.scrollElement.innerWidth
        : doc.scrollHeight - this.scrollElement.innerHeight
    }
  }

  private getVirtualDistanceFromEnd = () => {
    return Math.max(
      this.getTotalSize() - this.getSize() - this.getScrollOffset(),
      0,
    )
  }

  getDistanceFromEnd = () => {
    return Math.max(this.getMaxScrollOffset() - this.getScrollOffset(), 0)
  }

  isAtEnd = (threshold = this.options.scrollEndThreshold) => {
    return this.getDistanceFromEnd() <= threshold
  }

  getOffsetForAlignment = (
    toOffset: number,
    align: ScrollAlignment,
    itemSize = 0,
  ) => {
    if (!this.scrollElement) return 0

    const size = this.getSize()
    const scrollOffset = this.getScrollOffset()

    if (align === 'auto') {
      align = toOffset >= scrollOffset + size ? 'end' : 'start'
    }

    if (align === 'center') {
      // When aligning to a particular item (e.g. with scrollToIndex),
      // adjust offset by the size of the item to center on the item
      toOffset += (itemSize - size) / 2
    } else if (align === 'end') {
      toOffset -= size
    }

    const maxOffset = this.getMaxScrollOffset()

    return Math.max(Math.min(maxOffset, toOffset), 0)
  }

  getOffsetForIndex = (index: number, align: ScrollAlignment = 'auto') => {
    index = Math.max(0, Math.min(index, this.options.count - 1))

    const size = this.getSize()
    const scrollOffset = this.getScrollOffset()

    const item = this.measurementsCache[index]
    if (!item) return

    if (align === 'auto') {
      if (item.end >= scrollOffset + size - this.options.scrollPaddingEnd) {
        align = 'end'
      } else if (item.start <= scrollOffset + this.options.scrollPaddingStart) {
        align = 'start'
      } else {
        return [scrollOffset, align] as const
      }
    }

    // For the last item with 'end' alignment, use browser's actual max scroll
    // to account for borders/padding that aren't in our measurements (#1001),
    // but swap paddingEnd for scrollPaddingEnd so the last item lands where
    // any other end-aligned item would instead of overshooting past it (#1257).
    if (align === 'end' && index === this.options.count - 1) {
      const maxOffset = this.getMaxScrollOffset()
      const toOffset =
        maxOffset - this.options.paddingEnd + this.options.scrollPaddingEnd
      return [Math.max(Math.min(toOffset, maxOffset), 0), align] as const
    }

    const toOffset =
      align === 'end'
        ? item.end + this.options.scrollPaddingEnd
        : item.start - this.options.scrollPaddingStart

    return [
      this.getOffsetForAlignment(toOffset, align, item.size),
      align,
    ] as const
  }

  scrollToOffset = (
    toOffset: number,
    { align = 'start', behavior = 'auto' }: ScrollToOffsetOptions = {},
  ) => {
    this._startScroll(
      { index: null, align },
      this.getOffsetForAlignment(toOffset, align),
      behavior,
      'absolute',
    )
  }

  scrollToIndex = (
    index: number,
    {
      align: initialAlign = 'auto',
      behavior = 'auto',
    }: ScrollToIndexOptions = {},
  ) => {
    index = Math.max(0, Math.min(index, this.options.count - 1))

    const offsetInfo = this.getOffsetForIndex(index, initialAlign)
    if (!offsetInfo) {
      // No target (an empty list), so nothing is written; still drop the
      // deferral like every absolute command, or it replays once the list
      // refills.
      this._iosDeferredAdjustment = 0
      return
    }
    const [offset, align] = offsetInfo

    this._startScroll({ index, align }, offset, behavior, 'absolute')
  }

  scrollBy = (
    delta: number,
    { behavior = 'auto' }: ScrollToOffsetOptions = {},
  ) => {
    // Build on a position we just wrote even before its scroll event arrives.
    // Clamp: a write past either edge that leaves the element where it was
    // fires no scroll event, so nothing would clear an unreachable offset.
    const offset = this.getOffsetForAlignment(
      (this.getCommandWrittenOffset() ?? this.getScrollOffset()) + delta,
      'start',
    )

    this._startScroll(
      { index: null, align: 'start' },
      offset,
      behavior,
      'relative',
    )
  }

  scrollToEnd = ({ behavior = 'auto' }: ScrollToEndOptions = {}) => {
    if (this.options.count > 0) {
      // Target the browser's max scroll rather than the last item's end-align
      // offset, so paddingEnd is included and isAtEnd() holds afterwards.
      this._startScroll(
        { index: this.options.count - 1, align: 'end', toEnd: true },
        Math.max(this.getMaxScrollOffset(), 0),
        behavior,
        'absolute',
      )
      return
    }

    this.scrollToOffset(Math.max(this.getTotalSize() - this.getSize(), 0), {
      behavior,
    })
  }

  // Every scroll command starts here: it becomes the in-flight command,
  // writes its first target and leaves reconcile to retarget and retire it.
  //
  // An absolute command derives its target from current measurements, so
  // any iOS-deferred compensation still pending is stale by definition —
  // the command already accounts for the measurements the delta was
  // compensating for. Drop it so _flushIosDeferredIfReady doesn't replay it
  // onto the just-established position. A relative command (scrollBy)
  // builds on the current offset, so it keeps the deferral.
  //
  // An index or end target that is already at its offset starts a smooth
  // scroll as landed; an offset target never does, so its first scroll
  // event is read as the user's (see the scroll handler in `_willUpdate`).
  private _startScroll(
    target: Pick<ScrollState, 'index' | 'align' | 'toEnd'>,
    offset: number,
    behavior: ScrollBehavior,
    kind: 'absolute' | 'relative',
  ) {
    if (kind === 'absolute') {
      this._iosDeferredAdjustment = 0
    }
    this.scrollState = {
      ...target,
      startedAt: this.now(),
      lastTargetOffset: offset,
      stableFrames: 0,
      phase: initialScrollPhase(
        behavior,
        target.index != null && approxEqual(offset, this.getScrollOffset()),
      ),
    }
    this._scrollToOffset(offset, { adjustments: undefined, behavior })
    this.scheduleScrollReconcile()
  }

  // Drops the target of an in-flight scrollToIndex / scrollToOffset /
  // scrollBy / scrollToEnd so a user gesture can take over the viewport.
  // The scroll position is left untouched: writing it would stop iOS
  // momentum, and a real gesture already interrupts a native smooth scroll.
  cancelScroll = () => {
    if (this.rafId != null && this.targetWindow) {
      this.targetWindow.cancelAnimationFrame(this.rafId)
      this.rafId = null
    }
    this.scrollState = null
  }

  getTotalSize = () => {
    const measurements = this.getMeasurements()

    let end: number
    // If there are no measurements, set the end to paddingStart
    // If there is only one lane, use the last measurement's end
    // Otherwise find the maximum end value among all measurements
    if (measurements.length === 0) {
      end = this.options.paddingStart
    } else if (this.options.lanes === 1) {
      // Fast path: read last item's end directly from the flat typed array
      // when available; avoids a Proxy.get + VirtualItem materialization
      // just to call getTotalSize (which React renders trigger every commit).
      const lastIdx = measurements.length - 1
      const flat = this._singleLaneMeasurements?.flat
      if (flat != null) {
        end = flat[lastIdx * 2]! + flat[lastIdx * 2 + 1]!
      } else {
        end = measurements[lastIdx]?.end ?? 0
      }
    } else {
      const endByLane = Array<number | null>(this.options.lanes).fill(null)
      let endIndex = measurements.length - 1
      while (endIndex >= 0 && endByLane.some((val) => val === null)) {
        const item = measurements[endIndex]!
        if (endByLane[item.lane] === null) {
          endByLane[item.lane] = item.end
        }

        endIndex--
      }

      end = Math.max(...endByLane.filter((val): val is number => val !== null))
    }

    return Math.max(
      end - this.options.scrollMargin + this.options.paddingEnd,
      0,
    )
  }

  /**
   * Returns a snapshot of currently-measured items suitable for round-
   * tripping through state storage (sessionStorage, history, etc.) and
   * passing back as `initialMeasurementsCache` on remount. Pair with the
   * current `scrollOffset` to restore exact scroll position after navigation.
   *
   * Only items the consumer has actually rendered (and thus measured) appear
   * in the snapshot; unmeasured items will fall back to `estimateSize` on
   * restore. Returns an empty array if no items have been measured.
   */
  takeSnapshot = (): Array<VirtualItem> => {
    const snapshot: Array<VirtualItem> = []
    if (this.itemSizeCache.size === 0) return snapshot
    // Iterate measurementsCache only for indices whose key is in itemSizeCache
    // (i.e., have been measured). We build VirtualItem objects with the
    // current start/size/end so they can be persisted as plain data.
    const m = this.getMeasurements()
    for (const item of m) {
      if (item && this.itemSizeCache.has(item.key)) {
        // Force materialization (lazy path) and copy plain fields.
        snapshot.push({
          index: item.index,
          key: item.key,
          start: item.start,
          size: item.size,
          end: item.end,
          lane: item.lane,
        })
      }
    }
    return snapshot
  }

  private _scrollToOffset = (
    offset: number,
    {
      adjustments,
      behavior,
    }: {
      adjustments: number | undefined
      behavior: ScrollBehavior | undefined
    },
  ) => {
    this.pendingWrite = {
      target: offset + (adjustments ?? 0),
      smooth: behavior === 'smooth',
      adjustments: adjustments ?? this.scrollAdjustments,
    }
    this.options.scrollToFn(offset, { behavior, adjustments }, this)
  }

  // Where the in-flight command's last instant write put the element, until
  // its scroll event arrives; the rows on screen are still the ones rendered
  // for the old `scrollOffset`. Null after a smooth write (the element is
  // somewhere on the way) and without a command, so a write the browser
  // ignored (no read-back) does not outlive its command.
  private getCommandWrittenOffset = () =>
    this.scrollState !== null &&
    this.pendingWrite !== null &&
    !this.pendingWrite.smooth
      ? this.pendingWrite.target
      : null

  measure = () => {
    // Reset pendingMin so the next getMeasurements rebuilds from index 0.
    // Without this, a prior resizeItem() that left pendingMin > 0 would
    // cause the rebuild to preserve stale items before that index.
    this.pendingMin = null
    this.itemSizeCache.clear()
    this.laneAssignments.clear() // Clear lane cache for full re-layout
    this.itemSizeCacheVersion++
    this.notify(false)
  }
}

const findNearestBinarySearch = (
  low: number,
  high: number,
  getCurrentValue: (i: number) => number,
  value: number,
) => {
  while (low <= high) {
    const middle = ((low + high) / 2) | 0
    const currentValue = getCurrentValue(middle)

    if (currentValue < value) {
      low = middle + 1
    } else if (currentValue > value) {
      high = middle - 1
    } else {
      return middle
    }
  }

  if (low > 0) {
    return low - 1
  } else {
    return 0
  }
}

// Monomorphic Float64Array variant — reads start values directly at stride
// 2 instead of through a getter closure. JITs the inner load to a typed-
// array bounds-check + load with no indirect call.
function findNearestBinarySearchFlat(
  flat: Float64Array,
  high: number,
  value: number,
) {
  let low = 0
  while (low <= high) {
    const middle = ((low + high) / 2) | 0
    const currentValue = flat[middle * 2]!

    if (currentValue < value) {
      low = middle + 1
    } else if (currentValue > value) {
      high = middle - 1
    } else {
      return middle
    }
  }
  return low > 0 ? low - 1 : 0
}

function calculateRangeImpl(
  measurements: Array<VirtualItem>,
  outerSize: number,
  scrollOffset: number,
  lanes: number,
  flat: Float64Array | null,
) {
  const lastIndex = measurements.length - 1

  // handle case when item count is less than or equal to lanes
  if (measurements.length <= lanes) {
    return { startIndex: 0, endIndex: lastIndex }
  }

  if (lanes === 1 && flat !== null) {
    // Hot single-lane path: typed-array reads, no closures, no Proxy traps.
    const startIndex = findNearestBinarySearchFlat(
      flat,
      lastIndex,
      scrollOffset,
    )
    let endIndex = startIndex
    const limit = scrollOffset + outerSize
    while (
      endIndex < lastIndex &&
      flat[endIndex * 2]! + flat[endIndex * 2 + 1]! < limit
    ) {
      endIndex++
    }
    return { startIndex, endIndex }
  }

  // Fallback (lanes > 1 or no flat array): closure-based reads.
  const getStart = (index: number) => measurements[index]!.start
  let startIndex = findNearestBinarySearch(0, lastIndex, getStart, scrollOffset)
  let endIndex = startIndex

  if (lanes === 1) {
    while (
      endIndex < lastIndex &&
      measurements[endIndex]!.end < scrollOffset + outerSize
    ) {
      endIndex++
    }
  } else if (lanes > 1) {
    // Expand forward until we include the visible items from all lanes
    // which are closer to the end of the virtualizer window
    const endPerLane = Array(lanes).fill(0)
    while (
      endIndex < lastIndex &&
      endPerLane.some((pos) => pos < scrollOffset + outerSize)
    ) {
      const item = measurements[endIndex]!
      endPerLane[item.lane] = item.end
      endIndex++
    }

    // Expand backward until we include all lanes' visible items
    // closer to the top
    const startPerLane = Array(lanes).fill(scrollOffset + outerSize)
    while (startIndex >= 0 && startPerLane.some((pos) => pos >= scrollOffset)) {
      const item = measurements[startIndex]!
      startPerLane[item.lane] = item.start
      startIndex--
    }

    // Align startIndex to the beginning of its lane
    startIndex = Math.max(0, startIndex - (startIndex % lanes))
    // Align endIndex to the end of its lane
    endIndex = Math.min(lastIndex, endIndex + (lanes - 1 - (endIndex % lanes)))
  }

  return { startIndex, endIndex }
}
