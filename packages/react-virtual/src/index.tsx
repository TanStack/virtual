import * as React from 'react'
import { flushSync } from 'react-dom'
import { useSyncExternalStore } from 'use-sync-external-store/shim'
import {
  Virtualizer,
  elementScroll,
  observeElementOffset,
  observeElementRect,
  observeWindowOffset,
  observeWindowRect,
  windowScroll,
} from '@tanstack/virtual-core'
import type { PartialKeys, VirtualizerOptions } from '@tanstack/virtual-core'

export * from '@tanstack/virtual-core'

const useIsomorphicLayoutEffect =
  typeof document !== 'undefined' ? React.useLayoutEffect : React.useEffect

/**
 * Bridges the virtualizer's `onChange` notifications to
 * `useSyncExternalStore`. The snapshot is a version counter: every
 * notification the adapter decides to render bumps it. Consumers keep reading
 * render-facing values (`getVirtualItems()`, `getTotalSize()`, …) straight
 * from the instance — the counter only tells React *that* the instance moved,
 * which is enough for it to schedule the re-render and, under concurrent
 * rendering, to detect a store change mid-render and re-render synchronously
 * instead of committing a torn frame.
 */
function createStore() {
  const listeners = new Set<() => void>()
  let version = 0

  return {
    subscribe: (listener: () => void) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    getSnapshot: () => version,
    notify: () => {
      version++
      listeners.forEach((listener) => listener())
    },
  }
}

export type ReactVirtualizer<
  TScrollElement extends Element | Window,
  TItemElement extends Element,
> = Virtualizer<TScrollElement, TItemElement> & {
  /**
   * Ref callback for the inner size container element. Only meaningful when
   * `directDomUpdates: true` — the virtualizer writes the container's
   * main-axis size (`height` or `width`) directly to skip React re-renders.
   */
  containerRef: (node: HTMLElement | null) => void
}

export type ReactVirtualizerOptions<
  TScrollElement extends Element | Window,
  TItemElement extends Element,
> = VirtualizerOptions<TScrollElement, TItemElement> & {
  useFlushSync?: boolean
  /**
   * Skip React re-renders for scroll-only updates. The virtualizer writes
   * item positions (`top`/`left`) and the container size (`height`/`width`)
   * directly to the DOM, and only re-renders when the visible index range
   * or `isScrolling` changes.
   *
   * Requirements when enabled:
   * - Item elements must be `position: absolute`; in `'transform'` mode they
   *   must also be anchored with `top: 0` / `left: 0`.
   * - Item elements must NOT set the main-axis position in their style — the
   *   virtualizer owns `top` / `left` in `'position'` mode and `transform` in
   *   `'transform'` mode.
   * - The inner size container must receive `virtualizer.containerRef` and
   *   must NOT set `height` / `width` in its style.
   * - For multi-lane layouts (grids / masonry), the cross-axis position
   *   (e.g. `left: ${(item.lane * 100) / lanes}%`) is stable per item and
   *   must still be set in your JSX — only the main axis is automated.
   *
   * This flag is intended to be set once at mount. Toggling it (or
   *  `directDomUpdatesMode`) at runtime can leave stale inline styles on
   *  items and the container.
   */
  directDomUpdates?: boolean
  /**
   * How `directDomUpdates` positions item elements.
   * - `'transform'` (default): writes `transform: translate3d(...)`.
   *   Promotes items to their own compositor layer — usually smoother on long
   *   lists, but creates a stacking context and can interfere with
   *   `position: fixed` descendants. Item elements must still be anchored with
   *   `position: absolute`, `top: 0`, and `left: 0`.
   * - `'position'`: writes `top` / `left`. Item elements must be
   *   `position: absolute`.
   */
  directDomUpdatesMode?: 'position' | 'transform'
}

function useVirtualizerBase<
  TScrollElement extends Element | Window,
  TItemElement extends Element,
>({
  useFlushSync = true,
  directDomUpdates = false,
  directDomUpdatesMode = 'transform',
  ...options
}: ReactVirtualizerOptions<TScrollElement, TItemElement>): ReactVirtualizer<
  TScrollElement,
  TItemElement
> {
  const [store] = React.useState(createStore)

  // `useSyncExternalStore` subscribes in a passive effect, so a notification
  // raised while React is committing — the initial rect / offset measurement
  // in `_willUpdate`, a scroll-element swap, or a `measureElement` ref firing
  // for a freshly mounted item — has no listener yet and would only be picked
  // up by the store's post-commit check, i.e. after the browser has painted
  // the stale range. The layout effect at the bottom of this hook dispatches
  // this reducer when the store moved during commit so React re-renders
  // synchronously, before paint — the timing the reducer-only implementation
  // always had.
  const [, rerenderBeforePaint] = React.useReducer((x: number) => x + 1, 0)

  // Mutable across renders so the onChange closure captured by setOptions
  // always reads the latest values without us having to re-create it.
  const directRef = React.useRef({
    enabled: directDomUpdates,
    mode: directDomUpdatesMode,
    container: null as HTMLElement | null,
    lastSize: null as number | null,
    // Keyed by the element itself so a remounted node (same key, new DOM
    // node — e.g. when `enabled` is toggled off then on) is treated as fresh
    // and gets its style written.
    lastPositions: new WeakMap<HTMLElement, number>(),
    prevRange: null as {
      startIndex: number
      endIndex: number
      isScrolling: boolean
    } | null,
  })
  directRef.current.enabled = directDomUpdates
  directRef.current.mode = directDomUpdatesMode

  // Writes the size container's total extent to the DOM. Idempotent — guarded
  // by lastSize. Split out from applyDirectStyles so it can run *before* the
  // scroll-position sync in the _willUpdate effect: an end-anchored prepend
  // grows the total and bumps scrollOffset in the same pass, and if scrollTop
  // is written before the container has grown the browser clamps it to the
  // stale (shorter) scrollHeight, leaving a gap at the top until the next
  // scroll (visible only in directDomUpdates mode — React-rendered sizers get
  // their height during render).
  const applyContainerSize = (
    instance: Virtualizer<TScrollElement, TItemElement>,
  ) => {
    const state = directRef.current
    if (!state.enabled || !state.container) return

    const totalSize = instance.getTotalSize()
    if (totalSize !== state.lastSize) {
      state.lastSize = totalSize
      const sizeAxis = instance.options.horizontal ? 'width' : 'height'
      state.container.style[sizeAxis] = `${totalSize}px`
    }
  }

  // Writes container size + item positions to the DOM. Idempotent — guarded
  // by lastSize / lastPositions. Called from onChange (covers scroll-driven
  // updates) and from a layout effect (covers post-render commits when refs
  // have just registered new items in elementsCache).
  const applyDirectStyles = (
    instance: Virtualizer<TScrollElement, TItemElement>,
  ) => {
    const state = directRef.current
    if (!state.enabled || !state.container) return

    applyContainerSize(instance)

    const horizontal = !!instance.options.horizontal
    const useTransform = state.mode === 'transform'
    const posAxis = horizontal ? 'left' : 'top'
    const scrollMargin = instance.options.scrollMargin
    const items = instance.getVirtualItems()
    for (const item of items) {
      const next = item.start - scrollMargin
      const el = instance.elementsCache.get(item.key) as HTMLElement | undefined
      if (!el) continue
      if (state.lastPositions.get(el) === next) continue
      state.lastPositions.set(el, next)
      if (useTransform) {
        el.style.transform = horizontal
          ? `translate3d(${next}px, 0, 0)`
          : `translate3d(0, ${next}px, 0)`
      } else {
        el.style[posAxis] = `${next}px`
      }
    }
  }

  const resolvedOptions: VirtualizerOptions<TScrollElement, TItemElement> = {
    ...options,
    onChange: (instance, sync) => {
      const state = directRef.current
      let shouldRerender = true

      if (state.enabled) {
        applyDirectStyles(instance)

        // Only re-render on range / isScrolling changes
        const range = instance.range
        const prev = state.prevRange
        shouldRerender =
          !prev ||
          prev.isScrolling !== instance.isScrolling ||
          prev.startIndex !== range?.startIndex ||
          prev.endIndex !== range?.endIndex
        if (shouldRerender) {
          state.prevRange = range
            ? {
                startIndex: range.startIndex,
                endIndex: range.endIndex,
                isScrolling: instance.isScrolling,
              }
            : null
        }
      }

      if (shouldRerender) {
        if (useFlushSync && sync) {
          flushSync(store.notify)
        } else {
          store.notify()
        }
      }

      options.onChange?.(instance, sync)
    },
  }

  const [instance] = React.useState(() => {
    const v = new Virtualizer<TScrollElement, TItemElement>(resolvedOptions)
    return Object.assign(v, {
      containerRef: (node: HTMLElement | null) => {
        const state = directRef.current
        state.container = node
        state.lastSize = null
        if (node && state.enabled) {
          const total = v.getTotalSize()
          state.lastSize = total
          const axis = v.options.horizontal ? 'width' : 'height'
          node.style[axis] = `${total}px`
        }
      },
    })
  })

  instance.setOptions(resolvedOptions)

  const renderedVersion = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getSnapshot,
  )

  useIsomorphicLayoutEffect(() => {
    return instance._didMount()
  }, [])

  useIsomorphicLayoutEffect(() => {
    // Grow the size container to the new total BEFORE _willUpdate syncs the
    // scroll position. On an end-anchored prepend the scroll target lands at
    // the new bottom; if the container is still at its old (shorter) height the
    // browser clamps the scrollTop write and the list is left with a gap at the
    // top until the next scroll. Positions are written afterwards by the
    // applyDirectStyles effect below.
    applyContainerSize(instance)
    return instance._willUpdate()
  })

  // After every render commit, newly mounted item refs have registered in
  // elementsCache; write their positions to the DOM so the user doesn't see
  // them at (0, 0) until the next onChange.
  useIsomorphicLayoutEffect(() => {
    applyDirectStyles(instance)
  })

  // Must stay the last layout effect: it observes notifications raised by the
  // effects above (and by item refs, which attach before layout effects run).
  useIsomorphicLayoutEffect(() => {
    if (store.getSnapshot() !== renderedVersion) {
      rerenderBeforePaint()
    }
  })

  return instance
}

export function useVirtualizer<
  TScrollElement extends Element,
  TItemElement extends Element,
>(
  options: PartialKeys<
    ReactVirtualizerOptions<TScrollElement, TItemElement>,
    'observeElementRect' | 'observeElementOffset' | 'scrollToFn'
  >,
): ReactVirtualizer<TScrollElement, TItemElement> {
  return useVirtualizerBase<TScrollElement, TItemElement>({
    observeElementRect: observeElementRect,
    observeElementOffset: observeElementOffset,
    scrollToFn: elementScroll,
    ...options,
  })
}

export function useWindowVirtualizer<TItemElement extends Element>(
  options: PartialKeys<
    ReactVirtualizerOptions<Window, TItemElement>,
    | 'getScrollElement'
    | 'observeElementRect'
    | 'observeElementOffset'
    | 'scrollToFn'
  >,
): ReactVirtualizer<Window, TItemElement> {
  return useVirtualizerBase<Window, TItemElement>({
    getScrollElement: () => (typeof document !== 'undefined' ? window : null),
    observeElementRect: observeWindowRect,
    observeElementOffset: observeWindowOffset,
    scrollToFn: windowScroll,
    initialOffset: () => (typeof document !== 'undefined' ? window.scrollY : 0),
    ...options,
  })
}
