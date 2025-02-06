import { approxEqual, debounce, memo, notUndefined } from './utils'

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
  instance: Virtualizer<T, any, any>,
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

  if (!targetWindow.ResizeObserver) {
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
  instance: Virtualizer<Window, any, any>,
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

export const observeElementOffset = <T extends Element>(
  instance: Virtualizer<T, any, any>,
  cb: ObserveOffsetCallBack,
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
  const fallback =
    instance.options.useScrollendEvent && supportsScrollend
      ? () => undefined
      : debounce(
          targetWindow,
          () => {
            cb(offset, false)
          },
          instance.options.isScrollingResetDelay,
        )

  const createHandler = (isScrolling: boolean) => () => {
    const { horizontal, isRtl } = instance.options
    offset = horizontal
      ? element['scrollLeft'] * ((isRtl && -1) || 1)
      : element['scrollTop']
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
  instance: Virtualizer<Window, any, any>,
  cb: ObserveOffsetCallBack,
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
  const fallback =
    instance.options.useScrollendEvent && supportsScrollend
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
  instance: Virtualizer<any, TItemElement, any>,
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
  instance: Virtualizer<T, any, any>,
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
  instance: Virtualizer<T, any, any>,
) => {
  const toOffset = offset + adjustments

  instance.scrollElement?.scrollTo?.({
    [instance.options.horizontal ? 'left' : 'top']: toOffset,
    behavior,
  })
}

export const defaultApplyTotalSize = (
  element: Element | undefined | null,
  instance: Virtualizer<any, any, any>,
) => {
  if (!(element instanceof HTMLElement)) {
    throw Error(
      process.env.NODE_ENV === 'development'
        ? 'Element is not an HTMLElement'
        : '',
    )
  }

  element.style.height = `${instance.getTotalSize()}px`
}

export const defaultApplyElementStyles = (
  data: {
    node: Element | null | undefined
    index: number
  },
  instance: Virtualizer<any, any, any>,
) => {
  if (!(data.node instanceof HTMLElement)) {
    throw Error(
      process.env.NODE_ENV === 'development'
        ? 'Element is not an HTMLElement'
        : '',
    )
  }

  const offset = instance.measurementsCache[data.index]?.start ?? 0

  data.node.style.transform = `translateY(${offset}px)`
}

export interface VirtualizerOptions<
  TScrollElement extends Element | Window,
  TItemElement extends Element,
  TTotalSizeElement extends Element,
> {
  // Required from the user
  count: number
  getScrollElement: () => TScrollElement | null
  getInnerElement: () => TItemElement | null
  estimateSize: (index: number) => number

  // Required from the framework adapter (but can be overridden)
  scrollToFn: (
    offset: number,
    options: { adjustments?: number; behavior?: ScrollBehavior },
    instance: Virtualizer<TScrollElement, TItemElement, TTotalSizeElement>,
  ) => void
  observeElementRect: (
    instance: Virtualizer<TScrollElement, TItemElement, TTotalSizeElement>,
    cb: (rect: Rect) => void,
  ) => void | (() => void)
  observeElementOffset: (
    instance: Virtualizer<TScrollElement, TItemElement, TTotalSizeElement>,
    cb: ObserveOffsetCallBack,
  ) => void | (() => void)
  // Optional
  debug?: boolean
  initialRect?: Rect
  onChange?: (
    instance: Virtualizer<TScrollElement, TItemElement, TTotalSizeElement>,
    sync: boolean,
  ) => void
  measureElement?: (
    element: TItemElement,
    entry: ResizeObserverEntry | undefined,
    instance: Virtualizer<TScrollElement, TItemElement, TTotalSizeElement>,
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
  isScrollingResetDelay?: number
  useScrollendEvent?: boolean
  enabled?: boolean
  isRtl?: boolean
  applyTotalSize?: (
    element: Element | undefined | null,
    instance: Virtualizer<any, any, any>,
  ) => void
  applyElementStyles?: (
    data: {
      node: Element | null | undefined
      index: number
    },
    instance: Virtualizer<any, any, any>,
  ) => void
}

export type AnyEmitterEvent = {
  type: string
}

class Emitter<TEvent extends AnyEmitterEvent> {
  events = new Map<TEvent['type'], Set<(event: TEvent) => void>>()

  on<T extends TEvent['type']>(
    type: T,
    cb: (event: Extract<TEvent, { type: T }>) => void,
  ) {
    let listeners = this.events.get(type)
    if (!listeners) {
      listeners = new Set()
      this.events.set(type, listeners)
    }
    listeners.add(cb as any)
    return () => listeners.delete(cb as any)
  }

  emit<T extends TEvent>(event: T) {
    const listeners = this.events.get(event.type)
    if (listeners) {
      listeners.forEach((cb) => cb(event))
    }
  }

  destroy() {
    this.events.clear()
  }
}

export type VirtualizerEvent =
  | VirtualizerEventOnScrollRect
  | VirtualizerEventOnScrollOffset
  | VirtualizerEventOnElementEnter
  | VirtualizerEventOnElementResize

export type VirtualizerEventOnScrollRect = {
  type: 'scrollRect'
  rect: Rect
}

export type VirtualizerEventOnScrollOffset = {
  type: 'scrollOffset'
  offset: number
  isScrolling: boolean
}

export type VirtualizerEventOnElementEnter = {
  type: 'elementEnter'
  node: Element | null | undefined
  index: number
}

export type VirtualizerEventOnElementResize = {
  type: 'elementResize'
  node: Element | null | undefined
  index: number
  size: number
}

export class Virtualizer<
  TScrollElement extends Element | Window,
  TItemElement extends Element,
  TTotalSizeElement extends Element,
> extends Emitter<VirtualizerEvent> {
  private unsubs: Array<void | (() => void)> = []
  options!: Required<
    VirtualizerOptions<TScrollElement, TItemElement, TTotalSizeElement>
  >
  scrollElement: TScrollElement | null = null
  innerElement: TItemElement | null = null
  targetWindow: (Window & typeof globalThis) | null = null
  isScrolling = false
  private scrollToIndexTimeoutId: number | null = null
  measurementsCache: Array<VirtualItem> = []
  private itemSizeCache = new Map<Key, number>()
  private pendingMeasuredCacheIndexes: Array<number> = []
  scrollRect: Rect | null = null
  scrollOffset: number | null = null
  scrollDirection: ScrollDirection | null = null
  private scrollAdjustments = 0
  shouldAdjustScrollPositionOnItemSizeChange:
    | undefined
    | ((
        item: VirtualItem,
        delta: number,
        instance: Virtualizer<TScrollElement, TItemElement, TTotalSizeElement>,
      ) => boolean)
  elementsCache = new Map<Key, TItemElement>()
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
          this.measureElement(entry.target as TItemElement, entry)
        })
      }))
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

  constructor(
    opts: VirtualizerOptions<TScrollElement, TItemElement, TTotalSizeElement>,
  ) {
    super()
    this.setOptions(opts)
  }

  indexes: Array<number> = []

  setOptions = (
    opts: VirtualizerOptions<TScrollElement, TItemElement, TTotalSizeElement>,
  ) => {
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
      enabled: true,
      isRtl: false,
      useScrollendEvent: true,
      applyTotalSize: defaultApplyTotalSize,
      applyElementStyles: defaultApplyElementStyles,
      ...opts,
    }
  }

  private notify = (sync: boolean) => {
    this.options.onChange?.(this, sync)
  }

  destroy = () => {
    super.destroy()
    this.unsubs.filter(Boolean).forEach((d) => d!())
    this.unsubs = []
    this.observer.disconnect()
    this.scrollElement = null
    this.targetWindow = null
  }

  _didMount = () => {
    this.updateScrollIndexes()

    return () => {
      this.destroy()
    }
  }

  _willUpdate = () => {
    this.updateScrollElement()
    this.updateInnerElement()
    this.measure()
  }

  private updateInnerElement = () => {
    const innerElement = this.options.enabled
      ? this.options.getInnerElement()
      : null

    if (this.innerElement !== innerElement) {
      this.innerElement = innerElement

      const cb = () => this.options.applyTotalSize(this.innerElement, this)
      cb()
      // this.on('onTotalResize', cb)
    }
  }

  private updateScrollElement = () => {
    const scrollElement = this.options.enabled
      ? this.options.getScrollElement()
      : null

    if (this.scrollElement !== scrollElement) {
      this.destroy()

      if (!scrollElement) {
        this.notify(true)
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

      this._scrollToOffset(this.getScrollOffset(), {
        adjustments: undefined,
        behavior: undefined,
      })

      this.unsubs.push(
        this.options.observeElementRect(this, (rect) => {
          this.scrollRect = rect
          this.emit({
            type: 'scrollRect',
            rect,
          })
        }),
      )

      this.unsubs.push(
        this.options.observeElementOffset(this, (offset, isScrolling) => {
          this.emit({
            type: 'scrollOffset',
            offset,
            isScrolling,
          })
        }),
      )

      this.unsubs.push(
        this.on('scrollOffset', (event) => {
          this.scrollAdjustments = 0
          this.scrollDirection = event.isScrolling
            ? this.getScrollOffset() < event.offset
              ? 'forward'
              : 'backward'
            : null
          this.scrollOffset = event.offset
          this.isScrolling = event.isScrolling

          this.updateScrollIndexes()
        }),
      )

      this.unsubs.push(
        this.on('elementEnter', (event) => {
          this.options.applyElementStyles(event, this)
        }),
      )

      this.unsubs.push(
        this.on('elementResize', (event) => {
          this.updateScrollIndexes()
          this.applyAllElementStyles()
        }),
      )
    }
  }

  private applyAllElementStyles = () => {
    this.indexes.forEach((index) => {
      const element = this.elementsCache.get(index)
      if (element) {
        this.options.applyElementStyles(
          {
            node: element,
            index,
          },
          this,
        )
      }
    })
  }

  private updateScrollIndexes = () => {
    const prevIndexes = this.indexes
    this.indexes = this.getVirtualIndexes()
    if (prevIndexes !== this.indexes) {
      this.notify(false)
    }
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

  private getFurthestMeasurement = (
    measurements: Array<VirtualItem>,
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

  private getMeasurementOptions = memo(
    () => [
      this.options.count,
      this.options.paddingStart,
      this.options.scrollMargin,
      this.options.getItemKey,
      this.options.enabled,
    ],
    (count, paddingStart, scrollMargin, getItemKey, enabled) => {
      this.pendingMeasuredCacheIndexes = []
      return {
        count,
        paddingStart,
        scrollMargin,
        getItemKey,
        enabled,
      }
    },
    {
      key: false,
    },
  )

  private getMeasurements = memo(
    () => [this.getMeasurementOptions(), this.itemSizeCache],
    (
      { count, paddingStart, scrollMargin, getItemKey, enabled },
      itemSizeCache,
    ) => {
      if (!enabled) {
        this.measurementsCache = []
        this.itemSizeCache.clear()
        return []
      }

      if (this.measurementsCache.length === 0) {
        this.measurementsCache = this.options.initialMeasurementsCache
        this.measurementsCache.forEach((item) => {
          this.itemSizeCache.set(item.key, item.size)
        })
      }

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
    () => [this.getMeasurements(), this.getSize(), this.getScrollOffset()],
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

  getVirtualIndexes = memo(
    () => {
      let startIndex: number | null = null
      let endIndex: number | null = null
      const range = this.calculateRange()
      if (range) {
        startIndex = range.startIndex
        endIndex = range.endIndex
      }
      return [
        this.options.rangeExtractor,
        this.options.overscan,
        this.options.count,
        startIndex,
        endIndex,
      ]
    },
    (rangeExtractor, overscan, count, startIndex, endIndex) => {
      return startIndex === null || endIndex === null
        ? []
        : rangeExtractor({
            startIndex,
            endIndex,
            overscan,
            count,
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

  handleElement = (node: TItemElement | null | undefined) => {
    if (!node) {
      this.elementsCache.forEach((cached, key) => {
        if (!cached.isConnected) {
          this.observer.unobserve(cached)
          this.elementsCache.delete(key)
        }
      })

      return
    }

    this.measureElement(node, undefined)
    this.emit({
      type: 'elementEnter',
      node,
      index: this.indexFromElement(node),
    })
  }

  private measureElement = (
    node: TItemElement,
    entry: ResizeObserverEntry | undefined,
  ) => {
    const index = this.indexFromElement(node)
    const item = this.measurementsCache[index]!
    const key = item.key
    const prevNode = this.elementsCache.get(key)

    if (prevNode !== node) {
      if (prevNode) {
        this.observer.unobserve(prevNode)
      }
      this.observer.observe(node)
      this.elementsCache.set(key, node)
    }

    if (node.isConnected) {
      const prevSize = this.itemSizeCache.get(item.key) ?? item.size
      const size = this.options.measureElement(node, entry, this)
      const delta = size - prevSize

      if (delta !== 0) {
        if (
          this.shouldAdjustScrollPositionOnItemSizeChange !== undefined
            ? this.shouldAdjustScrollPositionOnItemSizeChange(item, delta, this)
            : item.start < this.getScrollOffset() + this.scrollAdjustments
        ) {
          if (process.env.NODE_ENV !== 'production' && this.options.debug) {
            console.info('correction', delta)
          }

          this._scrollToOffset(this.getScrollOffset(), {
            adjustments: (this.scrollAdjustments += delta),
            behavior: undefined,
          })
        }

        this.pendingMeasuredCacheIndexes.push(item.index)
        this.itemSizeCache = new Map(this.itemSizeCache.set(item.key, size))

        console.log('elementResize', item.key, size)

        this.emit({
          type: 'elementResize',
          node: this.elementsCache.get(item.key),
          index: item.index,
          size: size,
        })
      }
    }
  }

  getVirtualItemForOffset = (offset: number) => {
    const measurements = this.getMeasurements()
    if (measurements.length === 0) {
      return undefined
    }
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
    const scrollOffset = this.getScrollOffset()

    if (align === 'auto') {
      if (toOffset >= scrollOffset + size) {
        align = 'end'
      }
    }

    if (align === 'end') {
      toOffset -= size
    }

    const scrollSizeProp = this.options.horizontal
      ? 'scrollWidth'
      : 'scrollHeight'
    const scrollSize = this.scrollElement
      ? 'document' in this.scrollElement
        ? this.scrollElement.document.documentElement[scrollSizeProp]
        : this.scrollElement[scrollSizeProp]
      : 0

    const maxOffset = scrollSize - size

    return Math.max(Math.min(maxOffset, toOffset), 0)
  }

  getOffsetForIndex = (index: number, align: ScrollAlignment = 'auto') => {
    index = Math.max(0, Math.min(index, this.options.count - 1))

    const item = this.measurementsCache[index]
    if (!item) {
      return undefined
    }

    const size = this.getSize()
    const scrollOffset = this.getScrollOffset()

    if (align === 'auto') {
      if (item.end >= scrollOffset + size - this.options.scrollPaddingEnd) {
        align = 'end'
      } else if (item.start <= scrollOffset + this.options.scrollPaddingStart) {
        align = 'start'
      } else {
        return [scrollOffset, align] as const
      }
    }

    const centerOffset =
      item.start - this.options.scrollPaddingStart + (item.size - size) / 2

    switch (align) {
      case 'center':
        return [this.getOffsetForAlignment(centerOffset, align), align] as const
      case 'end':
        return [
          this.getOffsetForAlignment(
            item.end + this.options.scrollPaddingEnd,
            align,
          ),
          align,
        ] as const
      default:
        return [
          this.getOffsetForAlignment(
            item.start - this.options.scrollPaddingStart,
            align,
          ),
          align,
        ] as const
    }
  }

  private isDynamicMode = () => this.elementsCache.size > 0

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

    const offsetAndAlign = this.getOffsetForIndex(index, initialAlign)
    if (!offsetAndAlign) return

    const [offset, align] = offsetAndAlign

    this._scrollToOffset(offset, { adjustments: undefined, behavior })

    if (behavior !== 'smooth' && this.isDynamicMode() && this.targetWindow) {
      this.scrollToIndexTimeoutId = this.targetWindow.setTimeout(() => {
        this.scrollToIndexTimeoutId = null

        const elementInDOM = this.elementsCache.has(
          this.options.getItemKey(index),
        )

        if (elementInDOM) {
          const [latestOffset] = notUndefined(
            this.getOffsetForIndex(index, align),
          )

          if (!approxEqual(latestOffset, this.getScrollOffset())) {
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

    this._scrollToOffset(this.getScrollOffset() + delta, {
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
          ? (measurements[measurements.length - 1]?.end ?? 0)
          : Math.max(
              ...measurements.slice(-this.options.lanes).map((m) => m.end),
            )
    }

    return Math.max(
      end - this.options.scrollMargin + this.options.paddingEnd,
      0,
    )
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
    // this.itemSizeCache = new Map()
    this.indexes.forEach((index) => {
      const element = this.elementsCache.get(index)
      if (element) {
        this.measureElement(element, undefined)
      }
    })
    // this.updateScrollIndexes()
    // this.applyAllElementStyles()
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
  measurements: Array<VirtualItem>
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
