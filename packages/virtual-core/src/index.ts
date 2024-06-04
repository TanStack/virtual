import { approxEqual, memo, notUndefined, debounce } from './utils'

export * from './utils'

//

type ScrollDirection = 'forward' | 'backward'

type ScrollAlignment = 'start' | 'center' | 'end' | 'auto'

type ScrollBehavior = 'auto' | 'smooth'

export interface ScrollToOptions {
  align?: ScrollAlignment
  behavior?: ScrollBehavior
}

type ScrollToOffsetOptions = ScrollToOptions

type ScrollToIndexOptions = ScrollToOptions

export interface Range {
  startIndex: number
  endIndex: number
  overscan: number
  count: number
}

type Key = number | string

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

export const defaultKeyExtractor = (index: number) => index

export const defaultRangeExtractor = (range: Range) => {
  const start = Math.max(range.startIndex - range.overscan, 0)
  const end = Math.min(range.endIndex + range.overscan, range.count - 1)

  const arr = []

  for (let i = start; i <= end; i++) {
    arr.push(i)
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

  handler(element.getBoundingClientRect())

  if (typeof ResizeObserver === 'undefined') {
    return () => {}
  }

  const observer = new targetWindow.ResizeObserver((entries) => {
    const entry = entries[0]
    if (entry?.borderBoxSize) {
      const box = entry.borderBoxSize[0]
      if (box) {
        handler({ width: box.inlineSize, height: box.blockSize })
        return
      }
    }
    handler(element.getBoundingClientRect())
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

export const observeElementOffset = <T extends Element>(
  instance: Virtualizer<T, any>,
  cb: (offset: number, isScrolling: boolean) => void,
) => {
  const element = instance.scrollElement
  if (!element) {
    return
  }
  const targetWindow = instance.targetWindow
  if (!targetWindow) {
    return
  }

  let offset = 0
  const fallback = supportsScrollend
    ? () => undefined
    : debounce(
        targetWindow,
        () => {
          cb(offset, false)
        },
        instance.options.isScrollingResetDelay,
      )

  const createHandler = (isScrolling: boolean) => () => {
    offset = element[instance.options.horizontal ? 'scrollLeft' : 'scrollTop']
    fallback()
    cb(offset, isScrolling)
  }
  const handler = createHandler(true)
  const endHandler = createHandler(false)
  endHandler()

  element.addEventListener('scroll', handler, addEventListenerOptions)
  element.addEventListener('scrollend', endHandler, addEventListenerOptions)

  return () => {
    element.removeEventListener('scroll', handler)
    element.removeEventListener('scrollend', endHandler)
  }
}

export const observeWindowOffset = (
  instance: Virtualizer<Window, any>,
  cb: (offset: number, isScrolling: boolean) => void,
) => {
  const element = instance.scrollElement
  if (!element) {
    return
  }
  const targetWindow = instance.targetWindow
  if (!targetWindow) {
    return
  }

  let offset = 0
  const fallback = supportsScrollend
    ? () => undefined
    : debounce(
        targetWindow,
        () => {
          cb(offset, false)
        },
        instance.options.isScrollingResetDelay,
      )

  const createHandler = (isScrolling: boolean) => () => {
    offset = element[instance.options.horizontal ? 'scrollX' : 'scrollY']
    fallback()
    cb(offset, isScrolling)
  }
  const handler = createHandler(true)
  const endHandler = createHandler(false)
  endHandler()

  element.addEventListener('scroll', handler, addEventListenerOptions)
  element.addEventListener('scrollend', endHandler, addEventListenerOptions)

  return () => {
    element.removeEventListener('scroll', handler)
    element.removeEventListener('scrollend', endHandler)
  }
}

export const measureElement = <TItemElement extends Element>(
  element: TItemElement,
  entry: ResizeObserverEntry | undefined,
  instance: Virtualizer<any, TItemElement>,
) => {
  if (entry?.borderBoxSize) {
    const box = entry.borderBoxSize[0]
    if (box) {
      const size = Math.round(
        box[instance.options.horizontal ? 'inlineSize' : 'blockSize'],
      )
      return size
    }
  }
  return Math.round(
    element.getBoundingClientRect()[
      instance.options.horizontal ? 'width' : 'height'
    ],
  )
}

export const windowScroll = <T extends Window>(
  offset: number,
  {
    adjustments = 0,
    behavior,
  }: { adjustments?: number; behavior?: ScrollBehavior },
  instance: Virtualizer<T, any>,
) => {
  const toOffset = offset + adjustments

  instance.scrollElement?.scrollTo?.({
    [instance.options.horizontal ? 'left' : 'top']: toOffset,
    behavior,
  })
}

export const elementScroll = <T extends Element>(
  offset: number,
  {
    adjustments = 0,
    behavior,
  }: { adjustments?: number; behavior?: ScrollBehavior },
  instance: Virtualizer<T, any>,
) => {
  const toOffset = offset + adjustments

  instance.scrollElement?.scrollTo?.({
    [instance.options.horizontal ? 'left' : 'top']: toOffset,
    behavior,
  })
}

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
    cb: (offset: number, isScrolling: boolean) => void,
  ) => void | (() => void)

  // Optional
  debug?: any
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
  rangeExtractor?: (range: Range) => number[]
  scrollMargin?: number
  gap?: number
  indexAttribute?: string
  initialMeasurementsCache?: VirtualItem[]
  lanes?: number
  isScrollingResetDelay?: number
}

export class Virtualizer<
  TScrollElement extends Element | Window,
  TItemElement extends Element,
> {
  private unsubs: (void | (() => void))[] = []
  options!: Required<VirtualizerOptions<TScrollElement, TItemElement>>
  scrollElement: TScrollElement | null = null
  targetWindow: (Window & typeof globalThis) | null = null
  isScrolling: boolean = false
  private scrollToIndexTimeoutId: number | null = null
  measurementsCache: VirtualItem[] = []
  private itemSizeCache = new Map<Key, number>()
  private pendingMeasuredCacheIndexes: number[] = []
  scrollRect: Rect
  scrollOffset: number
  scrollDirection: ScrollDirection | null = null
  private scrollAdjustments: number = 0
  shouldAdjustScrollPositionOnItemSizeChange:
    | undefined
    | ((
        item: VirtualItem,
        delta: number,
        instance: Virtualizer<TScrollElement, TItemElement>,
      ) => boolean)
  measureElementCache = new Map<Key, TItemElement>()
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
        entries.forEach((entry) => {
          this._measureElement(entry.target as TItemElement, entry)
        })
      }))
    }

    return {
      disconnect: () => get()?.disconnect(),
      observe: (target: Element) =>
        get()?.observe(target, { box: 'border-box' }),
      unobserve: (target: Element) => get()?.unobserve(target),
    }
  })()
  range: { startIndex: number; endIndex: number } | null = null

  constructor(opts: VirtualizerOptions<TScrollElement, TItemElement>) {
    this.setOptions(opts)
    this.scrollRect = this.options.initialRect
    this.scrollOffset =
      typeof this.options.initialOffset === 'function'
        ? this.options.initialOffset()
        : this.options.initialOffset
    this.measurementsCache = this.options.initialMeasurementsCache
    this.measurementsCache.forEach((item) => {
      this.itemSizeCache.set(item.key, item.size)
    })

    this.notify(false, false)
  }

  setOptions = (opts: VirtualizerOptions<TScrollElement, TItemElement>) => {
    Object.entries(opts).forEach(([key, value]) => {
      if (typeof value === 'undefined') delete (opts as any)[key]
    })

    this.options = {
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
      isScrollingResetDelay: 150,
      ...opts,
    }
  }

  private notify = (force: boolean, sync: boolean) => {
    const { startIndex, endIndex } = this.range ?? {
      startIndex: undefined,
      endIndex: undefined,
    }
    const range = this.calculateRange()

    if (
      force ||
      startIndex !== range?.startIndex ||
      endIndex !== range?.endIndex
    ) {
      this.options.onChange?.(this, sync)
    }
  }

  private cleanup = () => {
    this.unsubs.filter(Boolean).forEach((d) => d!())
    this.unsubs = []
    this.scrollElement = null
  }

  _didMount = () => {
    this.measureElementCache.forEach(this.observer.observe)
    return () => {
      this.observer.disconnect()
      this.cleanup()
    }
  }

  _willUpdate = () => {
    const scrollElement = this.options.getScrollElement()

    if (this.scrollElement !== scrollElement) {
      this.cleanup()

      this.scrollElement = scrollElement

      if (this.scrollElement && 'ownerDocument' in this.scrollElement) {
        this.targetWindow = this.scrollElement.ownerDocument.defaultView
      } else {
        this.targetWindow = this.scrollElement?.window ?? null
      }

      this._scrollToOffset(this.scrollOffset, {
        adjustments: undefined,
        behavior: undefined,
      })

      this.unsubs.push(
        this.options.observeElementRect(this, (rect) => {
          this.scrollRect = rect
          this.notify(false, false)
        }),
      )

      this.unsubs.push(
        this.options.observeElementOffset(this, (offset, isScrolling) => {
          this.scrollAdjustments = 0
          this.scrollDirection = isScrolling
            ? this.scrollOffset < offset
              ? 'forward'
              : 'backward'
            : null
          this.scrollOffset = offset

          const prevIsScrolling = this.isScrolling
          this.isScrolling = isScrolling

          this.notify(prevIsScrolling !== isScrolling, isScrolling)
        }),
      )
    }
  }

  private getSize = () => {
    return this.scrollRect[this.options.horizontal ? 'width' : 'height']
  }

  private getMeasurementOptions = memo(
    () => [
      this.options.count,
      this.options.paddingStart,
      this.options.scrollMargin,
      this.options.getItemKey,
    ],
    (count, paddingStart, scrollMargin, getItemKey) => {
      this.pendingMeasuredCacheIndexes = []
      return {
        count,
        paddingStart,
        scrollMargin,
        getItemKey,
      }
    },
    {
      key: false,
    },
  )

  private getFurthestMeasurement = (
    measurements: VirtualItem[],
    index: number,
  ) => {
    const furthestMeasurementsFound = new Map<number, true>()
    const furthestMeasurements = new Map<number, VirtualItem>()
    for (let m = index - 1; m >= 0; m--) {
      const measurement = measurements[m]!

      if (furthestMeasurementsFound.has(measurement.lane)) {
        continue
      }

      const previousFurthestMeasurement = furthestMeasurements.get(
        measurement.lane,
      )
      if (
        previousFurthestMeasurement == null ||
        measurement.end > previousFurthestMeasurement.end
      ) {
        furthestMeasurements.set(measurement.lane, measurement)
      } else if (measurement.end < previousFurthestMeasurement.end) {
        furthestMeasurementsFound.set(measurement.lane, true)
      }

      if (furthestMeasurementsFound.size === this.options.lanes) {
        break
      }
    }

    return furthestMeasurements.size === this.options.lanes
      ? Array.from(furthestMeasurements.values()).sort((a, b) => {
          if (a.end === b.end) {
            return a.index - b.index
          }

          return a.end - b.end
        })[0]
      : undefined
  }

  private getMeasurements = memo(
    () => [this.getMeasurementOptions(), this.itemSizeCache],
    ({ count, paddingStart, scrollMargin, getItemKey }, itemSizeCache) => {
      const min =
        this.pendingMeasuredCacheIndexes.length > 0
          ? Math.min(...this.pendingMeasuredCacheIndexes)
          : 0
      this.pendingMeasuredCacheIndexes = []

      const measurements = this.measurementsCache.slice(0, min)

      for (let i = min; i < count; i++) {
        const key = getItemKey(i)

        const furthestMeasurement =
          this.options.lanes === 1
            ? measurements[i - 1]
            : this.getFurthestMeasurement(measurements, i)

        const start = furthestMeasurement
          ? furthestMeasurement.end + this.options.gap
          : paddingStart + scrollMargin

        const measuredSize = itemSizeCache.get(key)
        const size =
          typeof measuredSize === 'number'
            ? measuredSize
            : this.options.estimateSize(i)

        const end = start + size

        const lane = furthestMeasurement
          ? furthestMeasurement.lane
          : i % this.options.lanes

        measurements[i] = {
          index: i,
          start,
          size,
          end,
          key,
          lane,
        }
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
    () => [this.getMeasurements(), this.getSize(), this.scrollOffset],
    (measurements, outerSize, scrollOffset) => {
      return (this.range =
        measurements.length > 0 && outerSize > 0
          ? calculateRange({
              measurements,
              outerSize,
              scrollOffset,
            })
          : null)
    },
    {
      key: process.env.NODE_ENV !== 'production' && 'calculateRange',
      debug: () => this.options.debug,
    },
  )

  private getIndexes = memo(
    () => [
      this.options.rangeExtractor,
      this.calculateRange(),
      this.options.overscan,
      this.options.count,
    ],
    (rangeExtractor, range, overscan, count) => {
      return range === null
        ? []
        : rangeExtractor({
            startIndex: range.startIndex,
            endIndex: range.endIndex,
            overscan,
            count,
          })
    },
    {
      key: process.env.NODE_ENV !== 'production' && 'getIndexes',
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

  private _measureElement = (
    node: TItemElement,
    entry: ResizeObserverEntry | undefined,
  ) => {
    const item = this.measurementsCache[this.indexFromElement(node)]

    if (!item || !node.isConnected) {
      this.measureElementCache.forEach((cached, key) => {
        if (cached === node) {
          this.observer.unobserve(node)
          this.measureElementCache.delete(key)
        }
      })
      return
    }

    const prevNode = this.measureElementCache.get(item.key)

    if (prevNode !== node) {
      if (prevNode) {
        this.observer.unobserve(prevNode)
      }
      this.observer.observe(node)
      this.measureElementCache.set(item.key, node)
    }

    const measuredItemSize = this.options.measureElement(node, entry, this)

    this.resizeItem(item, measuredItemSize)
  }

  resizeItem = (item: VirtualItem, size: number) => {
    const itemSize = this.itemSizeCache.get(item.key) ?? item.size
    const delta = size - itemSize

    if (delta !== 0) {
      if (
        this.shouldAdjustScrollPositionOnItemSizeChange !== undefined
          ? this.shouldAdjustScrollPositionOnItemSizeChange(item, delta, this)
          : item.start < this.scrollOffset + this.scrollAdjustments
      ) {
        if (process.env.NODE_ENV !== 'production' && this.options.debug) {
          console.info('correction', delta)
        }

        this._scrollToOffset(this.scrollOffset, {
          adjustments: (this.scrollAdjustments += delta),
          behavior: undefined,
        })
      }

      this.pendingMeasuredCacheIndexes.push(item.index)
      this.itemSizeCache = new Map(this.itemSizeCache.set(item.key, size))

      this.notify(true, false)
    }
  }

  measureElement = (node: TItemElement | null) => {
    if (!node) {
      return
    }

    this._measureElement(node, undefined)
  }

  getVirtualItems = memo(
    () => [this.getIndexes(), this.getMeasurements()],
    (indexes, measurements) => {
      const virtualItems: VirtualItem[] = []

      for (let k = 0, len = indexes.length; k < len; k++) {
        const i = indexes[k]!
        const measurement = measurements[i]!

        virtualItems.push(measurement)
      }

      return virtualItems
    },
    {
      key: process.env.NODE_ENV !== 'production' && 'getIndexes',
      debug: () => this.options.debug,
    },
  )

  getVirtualItemForOffset = (offset: number) => {
    const measurements = this.getMeasurements()

    return notUndefined(
      measurements[
        findNearestBinarySearch(
          0,
          measurements.length - 1,
          (index: number) => notUndefined(measurements[index]).start,
          offset,
        )
      ],
    )
  }

  getOffsetForAlignment = (toOffset: number, align: ScrollAlignment) => {
    const size = this.getSize()

    if (align === 'auto') {
      if (toOffset <= this.scrollOffset) {
        align = 'start'
      } else if (toOffset >= this.scrollOffset + size) {
        align = 'end'
      } else {
        align = 'start'
      }
    }

    if (align === 'start') {
      toOffset = toOffset
    } else if (align === 'end') {
      toOffset = toOffset - size
    } else if (align === 'center') {
      toOffset = toOffset - size / 2
    }

    const scrollSizeProp = this.options.horizontal
      ? 'scrollWidth'
      : 'scrollHeight'
    const scrollSize = this.scrollElement
      ? 'document' in this.scrollElement
        ? this.scrollElement.document.documentElement[scrollSizeProp]
        : this.scrollElement[scrollSizeProp]
      : 0

    const maxOffset = scrollSize - this.getSize()

    return Math.max(Math.min(maxOffset, toOffset), 0)
  }

  getOffsetForIndex = (index: number, align: ScrollAlignment = 'auto') => {
    index = Math.max(0, Math.min(index, this.options.count - 1))

    const measurement = notUndefined(this.getMeasurements()[index])

    if (align === 'auto') {
      if (
        measurement.end >=
        this.scrollOffset + this.getSize() - this.options.scrollPaddingEnd
      ) {
        align = 'end'
      } else if (
        measurement.start <=
        this.scrollOffset + this.options.scrollPaddingStart
      ) {
        align = 'start'
      } else {
        return [this.scrollOffset, align] as const
      }
    }

    const toOffset =
      align === 'end'
        ? measurement.end + this.options.scrollPaddingEnd
        : measurement.start - this.options.scrollPaddingStart

    return [this.getOffsetForAlignment(toOffset, align), align] as const
  }

  private isDynamicMode = () => this.measureElementCache.size > 0

  private cancelScrollToIndex = () => {
    if (this.scrollToIndexTimeoutId !== null && this.targetWindow) {
      this.targetWindow.clearTimeout(this.scrollToIndexTimeoutId)
      this.scrollToIndexTimeoutId = null
    }
  }

  scrollToOffset = (
    toOffset: number,
    { align = 'start', behavior }: ScrollToOffsetOptions = {},
  ) => {
    this.cancelScrollToIndex()

    if (behavior === 'smooth' && this.isDynamicMode()) {
      console.warn(
        'The `smooth` scroll behavior is not fully supported with dynamic size.',
      )
    }

    this._scrollToOffset(this.getOffsetForAlignment(toOffset, align), {
      adjustments: undefined,
      behavior,
    })
  }

  scrollToIndex = (
    index: number,
    { align: initialAlign = 'auto', behavior }: ScrollToIndexOptions = {},
  ) => {
    index = Math.max(0, Math.min(index, this.options.count - 1))

    this.cancelScrollToIndex()

    if (behavior === 'smooth' && this.isDynamicMode()) {
      console.warn(
        'The `smooth` scroll behavior is not fully supported with dynamic size.',
      )
    }

    const [toOffset, align] = this.getOffsetForIndex(index, initialAlign)

    this._scrollToOffset(toOffset, { adjustments: undefined, behavior })

    if (behavior !== 'smooth' && this.isDynamicMode() && this.targetWindow) {
      this.scrollToIndexTimeoutId = this.targetWindow.setTimeout(() => {
        this.scrollToIndexTimeoutId = null

        const elementInDOM = this.measureElementCache.has(
          this.options.getItemKey(index),
        )

        if (elementInDOM) {
          const [toOffset] = this.getOffsetForIndex(index, align)

          if (!approxEqual(toOffset, this.scrollOffset)) {
            this.scrollToIndex(index, { align, behavior })
          }
        } else {
          this.scrollToIndex(index, { align, behavior })
        }
      })
    }
  }

  scrollBy = (delta: number, { behavior }: ScrollToOffsetOptions = {}) => {
    this.cancelScrollToIndex()

    if (behavior === 'smooth' && this.isDynamicMode()) {
      console.warn(
        'The `smooth` scroll behavior is not fully supported with dynamic size.',
      )
    }

    this._scrollToOffset(this.scrollOffset + delta, {
      adjustments: undefined,
      behavior,
    })
  }

  getTotalSize = () => {
    const measurements = this.getMeasurements()

    let end: number
    // If there are no measurements, set the end to paddingStart
    if (measurements.length === 0) {
      end = this.options.paddingStart
    } else {
      // If lanes is 1, use the last measurement's end, otherwise find the maximum end value among all measurements
      end =
        this.options.lanes === 1
          ? measurements[measurements.length - 1]?.end ?? 0
          : Math.max(
              ...measurements.slice(-this.options.lanes).map((m) => m.end),
            )
    }

    return end - this.options.scrollMargin + this.options.paddingEnd
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
    this.options.scrollToFn(offset, { behavior, adjustments }, this)
  }

  measure = () => {
    this.itemSizeCache = new Map()
    this.options.onChange?.(this, false)
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

function calculateRange({
  measurements,
  outerSize,
  scrollOffset,
}: {
  measurements: VirtualItem[]
  outerSize: number
  scrollOffset: number
}) {
  const count = measurements.length - 1
  const getOffset = (index: number) => measurements[index]!.start

  const startIndex = findNearestBinarySearch(0, count, getOffset, scrollOffset)
  let endIndex = startIndex

  while (
    endIndex < count &&
    measurements[endIndex]!.end < scrollOffset + outerSize
  ) {
    endIndex++
  }

  return { startIndex, endIndex }
}
