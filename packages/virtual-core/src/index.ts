import { memo } from './utils'

export * from './utils'

//

type ScrollAlignment = 'start' | 'center' | 'end' | 'auto'

export interface ScrollToOptions {
  align?: ScrollAlignment
  smoothScroll?: boolean
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
}

interface Rect {
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

const memoRectCallback = (
  instance: Virtualizer<any, any>,
  cb: (rect: Rect) => void,
) => {
  let prev: Rect = { height: -1, width: -1 }

  return (rect: Rect) => {
    if (
      instance.options.horizontal
        ? rect.width !== prev.width
        : rect.height !== prev.height
    ) {
      cb(rect)
    }

    prev = rect
  }
}

export const observeElementRect = (
  instance: Virtualizer<any, any>,
  cb: (rect: Rect) => void,
) => {
  const observer = new ResizeObserver((entries) => {
    cb({
      width: entries[0]?.contentRect.width as number,
      height: entries[0]?.contentRect.height as number,
    })
  })

  if (!instance.scrollElement) {
    return
  }

  cb(instance.scrollElement.getBoundingClientRect())

  observer.observe(instance.scrollElement)

  return () => {
    observer.unobserve(instance.scrollElement)
  }
}

export const observeWindowRect = (
  instance: Virtualizer<any, any>,
  cb: (rect: Rect) => void,
) => {
  const memoizedCallback = memoRectCallback(instance, cb)
  const onResize = () =>
    memoizedCallback({
      width: instance.scrollElement.innerWidth,
      height: instance.scrollElement.innerHeight,
    })

  if (!instance.scrollElement) {
    return
  }

  onResize()

  instance.scrollElement.addEventListener('resize', onResize, {
    capture: false,
    passive: true,
  })

  return () => {
    instance.scrollElement.removeEventListener('resize', onResize)
  }
}

type ObserverMode = 'element' | 'window'

const scrollProps = {
  element: ['scrollLeft', 'scrollTop'],
  window: ['scrollX', 'scrollY'],
} as const

const createOffsetObserver = (mode: ObserverMode) => {
  return (instance: Virtualizer<any, any>, cb: (offset: number) => void) => {
    if (!instance.scrollElement) {
      return
    }

    const propX = scrollProps[mode][0]
    const propY = scrollProps[mode][1]

    let prevX: number = instance.scrollElement[propX]
    let prevY: number = instance.scrollElement[propY]

    const scroll = () => {
      const offset =
        instance.scrollElement[instance.options.horizontal ? propX : propY]

      cb(Math.max(0, offset - instance.options.scrollMargin))
    }

    scroll()

    const onScroll = (e: Event) => {
      const target = e.currentTarget as HTMLElement & Window
      const scrollX = target[propX]
      const scrollY = target[propY]

      if (instance.options.horizontal ? prevX - scrollX : prevY - scrollY) {
        scroll()
      }

      prevX = scrollX
      prevY = scrollY
    }

    instance.scrollElement.addEventListener('scroll', onScroll, {
      capture: false,
      passive: true,
    })

    return () => {
      instance.scrollElement.removeEventListener('scroll', onScroll)
    }
  }
}

export const observeElementOffset = createOffsetObserver('element')
export const observeWindowOffset = createOffsetObserver('window')

export const measureElement = <TItemElement extends Element>(
  element: TItemElement,
  instance: Virtualizer<any, TItemElement>,
) => {
  return Math.round(
    element.getBoundingClientRect()[
      instance.options.horizontal ? 'width' : 'height'
    ],
  )
}

export const windowScroll = (
  offset: number,
  { canSmooth, sync }: { canSmooth: boolean; sync: boolean },
  instance: Virtualizer<any, any>,
) => {
  const toOffset = sync ? offset : offset + instance.options.scrollMargin

  ;(instance.scrollElement as Window)?.scrollTo?.({
    [instance.options.horizontal ? 'left' : 'top']: toOffset,
    behavior: canSmooth ? 'smooth' : undefined,
  })
}

export const elementScroll = (
  offset: number,
  { canSmooth, sync }: { canSmooth: boolean; sync: boolean },
  instance: Virtualizer<any, any>,
) => {
  const toOffset = sync ? offset : offset + instance.options.scrollMargin

  ;(instance.scrollElement as Element)?.scrollTo?.({
    [instance.options.horizontal ? 'left' : 'top']: toOffset,
    behavior: canSmooth ? 'smooth' : undefined,
  })
}

export interface VirtualizerOptions<
  TScrollElement extends unknown,
  TItemElement extends Element,
> {
  // Required from the user
  count: number
  getScrollElement: () => TScrollElement | null
  estimateSize: (index: number) => number

  // Required from the framework adapter (but can be overridden)
  scrollToFn: (
    offset: number,
    options: { canSmooth: boolean; sync: boolean },
    instance: Virtualizer<TScrollElement, TItemElement>,
  ) => void
  observeElementRect: (
    instance: Virtualizer<TScrollElement, TItemElement>,
    cb: (rect: Rect) => void,
  ) => void | (() => void)
  observeElementOffset: (
    instance: Virtualizer<TScrollElement, TItemElement>,
    cb: (offset: number) => void,
  ) => void | (() => void)

  // Optional
  debug?: any
  initialRect?: Rect
  onChange?: (instance: Virtualizer<TScrollElement, TItemElement>) => void
  measureElement?: (
    el: TItemElement,
    instance: Virtualizer<TScrollElement, TItemElement>,
  ) => number
  overscan?: number
  horizontal?: boolean
  paddingStart?: number
  paddingEnd?: number
  scrollPaddingStart?: number
  scrollPaddingEnd?: number
  initialOffset?: number
  getItemKey?: (index: number) => Key
  rangeExtractor?: (range: Range) => number[]
  enableSmoothScroll?: boolean
  scrollMargin?: number
  scrollingDelay?: number
  indexAttribute?: string
}

export class Virtualizer<
  TScrollElement extends unknown,
  TItemElement extends Element,
> {
  private unsubs: (void | (() => void))[] = []
  options!: Required<VirtualizerOptions<TScrollElement, TItemElement>>
  scrollElement: TScrollElement | null = null
  isScrolling: boolean = false
  private isScrollingTimeoutId: ReturnType<typeof setTimeout> | null = null
  measurementsCache: VirtualItem[] = []
  private itemMeasurementsCache: Record<Key, number> = {}
  private pendingMeasuredCacheIndexes: number[] = []
  private scrollRect: Rect
  private scrollOffset: number
  private scrollDelta: number = 0
  private destinationOffset: undefined | number
  private scrollCheckFrame!: ReturnType<typeof setTimeout>
  private measureElementCache: Record<string, TItemElement> = {}
  private ro = new ResizeObserver((entries) => {
    entries.forEach((entry) => {
      this._measureElement(entry.target as TItemElement, false)
    })
  })
  range: { startIndex: number; endIndex: number } = {
    startIndex: 0,
    endIndex: 0,
  }

  constructor(opts: VirtualizerOptions<TScrollElement, TItemElement>) {
    this.setOptions(opts)
    this.scrollRect = this.options.initialRect
    this.scrollOffset = this.options.initialOffset

    this.calculateRange()
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
      enableSmoothScroll: true,
      onChange: () => {},
      measureElement,
      initialRect: { width: 0, height: 0 },
      scrollMargin: 0,
      scrollingDelay: 150,
      indexAttribute: 'data-index',
      ...opts,
    }
  }

  private notify = () => {
    this.options.onChange?.(this)
  }

  private cleanup = () => {
    this.unsubs.filter(Boolean).forEach((d) => d!())
    this.unsubs = []
    this.scrollElement = null
  }

  _didMount = () => {
    return () => {
      this.ro.disconnect()
      this.measureElementCache = {}

      this.cleanup()
    }
  }

  _willUpdate = () => {
    const scrollElement = this.options.getScrollElement()

    if (this.scrollElement !== scrollElement) {
      this.cleanup()

      this.scrollElement = scrollElement
      this._scrollToOffset(this.scrollOffset, {
        canSmooth: false,
        sync: true,
        requested: false,
      })

      this.unsubs.push(
        this.options.observeElementRect(this, (rect) => {
          this.scrollRect = rect
          this.calculateRange()
        }),
      )

      this.unsubs.push(
        this.options.observeElementOffset(this, (offset) => {
          if (this.isScrollingTimeoutId !== null) {
            clearTimeout(this.isScrollingTimeoutId)
            this.isScrollingTimeoutId = null
          }

          if (this.scrollOffset !== offset) {
            this.scrollOffset = offset
            this.isScrolling = true
            this.scrollDelta = 0

            this.isScrollingTimeoutId = setTimeout(() => {
              this.isScrollingTimeoutId = null
              this.isScrolling = false

              this.notify()
            }, this.options.scrollingDelay)
          } else {
            this.isScrolling = false
            this.scrollDelta = 0
          }

          this.calculateRange()
        }),
      )
    } else if (!this.isScrolling) {
      this.calculateRange()
    }
  }

  private getSize = () => {
    return this.scrollRect[this.options.horizontal ? 'width' : 'height']
  }

  private getMeasurements = memo(
    () => [
      this.options.count,
      this.options.paddingStart,
      this.options.getItemKey,
      this.itemMeasurementsCache,
    ],
    (count, paddingStart, getItemKey, measurementsCache) => {
      const min =
        this.pendingMeasuredCacheIndexes.length > 0
          ? Math.min(...this.pendingMeasuredCacheIndexes)
          : 0
      this.pendingMeasuredCacheIndexes = []

      const measurements = this.measurementsCache.slice(0, min)

      for (let i = min; i < count; i++) {
        const key = getItemKey(i)
        const measuredSize = measurementsCache[key]
        const start = measurements[i - 1]
          ? measurements[i - 1]!.end
          : paddingStart
        const size =
          typeof measuredSize === 'number'
            ? measuredSize
            : this.options.estimateSize(i)
        const end = start + size
        measurements[i] = { index: i, start, size, end, key }
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
      const range = calculateRange({
        measurements,
        outerSize,
        scrollOffset,
      })
      if (
        range.startIndex !== this.range.startIndex ||
        range.endIndex !== this.range.endIndex
      ) {
        this.range = range
        this.notify()
      }
      return this.range
    },
    {
      key: process.env.NODE_ENV !== 'production' && 'calculateRange',
      debug: () => this.options.debug,
    },
  )

  private getIndexes = memo(
    () => [
      this.options.rangeExtractor,
      this.range,
      this.options.overscan,
      this.options.count,
    ],
    (rangeExtractor, range, overscan, count) => {
      return rangeExtractor({
        ...range,
        overscan,
        count: count,
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

  _measureElement = (node: TItemElement, _sync: boolean) => {
    const index = this.indexFromElement(node)

    const item = this.measurementsCache[index]
    if (!item) {
      return
    }
    const key = String(item.key)

    const prevNode = this.measureElementCache[key]

    if (!node.isConnected) {
      if (prevNode) {
        this.ro.unobserve(prevNode)
        delete this.measureElementCache[key]
      }
      return
    }

    if (!prevNode || prevNode !== node) {
      if (prevNode) {
        this.ro.unobserve(prevNode)
      }
      this.measureElementCache[key] = node
      this.ro.observe(node)
    }

    const measuredItemSize = this.options.measureElement(node, this)

    const itemSize = this.itemMeasurementsCache[item.key] ?? item.size

    if (measuredItemSize !== itemSize) {
      if (item.start < this.scrollOffset) {
        if (process.env.NODE_ENV !== 'production' && this.options.debug) {
          console.info('correction', measuredItemSize - itemSize)
        }

        if (this.destinationOffset === undefined) {
          this.scrollDelta += measuredItemSize - itemSize

          this._scrollToOffset(this.scrollOffset + this.scrollDelta, {
            canSmooth: false,
            sync: false,
            requested: false,
          })
        }
      }

      this.pendingMeasuredCacheIndexes.push(index)
      this.itemMeasurementsCache = {
        ...this.itemMeasurementsCache,
        [item.key]: measuredItemSize,
      }
      this.notify()
    }
  }

  measureElement = (node: TItemElement | null) => {
    if (!node) {
      return
    }

    this._measureElement(node, true)
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

  scrollToOffset = (
    toOffset: number,
    {
      align = 'start',
      smoothScroll = this.options.enableSmoothScroll,
    }: ScrollToOffsetOptions = {},
  ) => {
    const offset = this.scrollOffset
    const size = this.getSize()

    if (align === 'auto') {
      if (toOffset <= offset) {
        align = 'start'
      } else if (toOffset >= offset + size) {
        align = 'end'
      } else {
        align = 'start'
      }
    }

    const options = {
      canSmooth: smoothScroll,
      sync: false,
      requested: true,
    }
    if (align === 'start') {
      this._scrollToOffset(toOffset, options)
    } else if (align === 'end') {
      this._scrollToOffset(toOffset - size, options)
    } else if (align === 'center') {
      this._scrollToOffset(toOffset - size / 2, options)
    }
  }

  scrollToIndex = (
    index: number,
    {
      align = 'auto',
      smoothScroll = this.options.enableSmoothScroll,
      ...rest
    }: ScrollToIndexOptions = {},
  ) => {
    const measurements = this.getMeasurements()
    const offset = this.scrollOffset
    const size = this.getSize()
    const { count } = this.options

    const measurement = measurements[Math.max(0, Math.min(index, count - 1))]

    if (!measurement) {
      return
    }

    if (align === 'auto') {
      if (measurement.end >= offset + size - this.options.scrollPaddingEnd) {
        align = 'end'
      } else if (
        measurement.start <=
        offset + this.options.scrollPaddingStart
      ) {
        align = 'start'
      } else {
        return
      }
    }

    const toOffset =
      align === 'end'
        ? measurement.end + this.options.scrollPaddingEnd
        : measurement.start - this.options.scrollPaddingStart

    this.scrollToOffset(toOffset, { align, smoothScroll, ...rest })
  }

  getTotalSize = () =>
    (this.getMeasurements()[this.options.count - 1]?.end ||
      this.options.paddingStart) + this.options.paddingEnd

  private _scrollToOffset = (
    offset: number,
    {
      requested,
      canSmooth,
      sync,
    }: { canSmooth: boolean; sync: boolean; requested: boolean },
  ) => {
    clearTimeout(this.scrollCheckFrame)

    if (requested) {
      this.destinationOffset = offset
    }
    this.options.scrollToFn(offset, { canSmooth, sync }, this)

    let scrollCheckFrame: ReturnType<typeof setTimeout>

    const check = () => {
      let lastOffset = this.scrollOffset
      this.scrollCheckFrame = scrollCheckFrame = setTimeout(() => {
        if (this.scrollCheckFrame !== scrollCheckFrame) {
          return
        }

        if (this.scrollOffset === lastOffset) {
          this.destinationOffset = undefined
          return
        }
        lastOffset = this.scrollOffset
        check()
      }, 100)
    }

    check()
  }

  measure = () => {
    this.itemMeasurementsCache = {}
    this.notify()
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
