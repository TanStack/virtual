import observeRect from '@reach/observe-rect'
import React from 'react'
import { memo } from './utils'

export * from './utils'

//

type ScrollAlignment = 'start' | 'center' | 'end' | 'auto'

interface ScrollToOptions {
  align: ScrollAlignment
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

interface Item {
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

export interface VirtualItem<TItemElement> extends Item {
  measureElement: (el: TItemElement | null) => void
}

//

const DEBUG = true
export const defaultEstimateSize = () => 50
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

export const observeElementRect = (
  instance: Virtual<any, any>,
  cb: (rect: Rect) => void,
) => {
  const observer = observeRect(instance.scrollElement as Element, (rect) => {
    cb(rect)
  })

  observer.observe()

  return () => {
    observer.unobserve()
  }
}

export const observeWindowRect = (
  instance: Virtual<any, any>,
  cb: (rect: Rect) => void,
) => {
  const onResize = () => {
    cb({
      width: instance.scrollElement.innerWidth,
      height: instance.scrollElement.innerHeight,
    })
  }

  instance.scrollElement.addEventListener('resize', onResize, {
    capture: false,
    passive: true,
  })

  return () => {
    instance.scrollElement.removeEventListener('resize', onResize)
  }
}

export const observeElementOffset = (
  instance: Virtual<any, any>,
  cb: (offset: number) => void,
) => {
  const onScroll = () =>
    cb(
      instance.scrollElement[
        instance.options.horizontal ? 'scrollLeft' : 'scrollTop'
      ],
    )

  onScroll()

  instance.scrollElement.addEventListener('scroll', onScroll, {
    capture: false,
    passive: true,
  })

  return () => {
    instance.scrollElement.removeEventListener('scroll', onScroll)
  }
}

export const observeWindowOffset = (
  instance: Virtual<any, any>,
  cb: (offset: number) => void,
) => {
  const onScroll = () =>
    cb(
      instance.scrollElement[
        instance.options.horizontal ? 'scrollX' : 'scrollY'
      ],
    )

  onScroll()

  instance.scrollElement.addEventListener('scroll', onScroll, {
    capture: false,
    passive: true,
  })

  return () => {
    instance.scrollElement.removeEventListener('scroll', onScroll)
  }
}

// export const defaultScrollToFn: Options['scrollToFn'] = (offset, instance) => instance.options.parentElement[instance.getScrollKey()] = offset
// export const defaultGetScrollOffset = (
//   element: unknown,
//   instance: Virtual<any, any>,
// ) => (element as Element)?.[instance.getScrollKey()] ?? 0

export interface VirtualOptions<
  TScrollElement = unknown,
  TItemElement = unknown,
> {
  count: number
  onOffsetChange?: (offset: number) => void
  onUpdate?: () => void
  measureSize?: (
    el: TItemElement,
    instance: Virtual<TScrollElement, TItemElement>,
  ) => number
  scrollToFn?: (
    offset: number,
    instance: Virtual<TScrollElement, TItemElement>,
  ) => void
  //
  estimateSize?: (index: number) => number
  overscan?: number
  horizontal?: boolean
  paddingStart?: number
  paddingEnd?: number
  scrollElement: TScrollElement
  observeElementRect?: (
    instance: Virtual<TScrollElement, TItemElement>,
    cb: (rect: Rect) => void,
  ) => () => void
  observeElementOffset?: (
    instance: Virtual<TScrollElement, TItemElement>,
    cb: (offset: number) => void,
  ) => () => void
  initialRect?: Rect
  initialOffset?: number
  keyExtractor?: (index: number) => Key
  rangeExtractor?: (range: Range) => number[]
}

export class Virtual<TScrollElement = unknown, TItemElement = unknown> {
  options!: Required<VirtualOptions<TScrollElement, TItemElement>>
  scrollElement: TScrollElement | null = null
  private measurementsCache: Item[] = []
  private itemMeasurementsCache: Record<Key, number> = {}
  private pendingMeasuredCacheIndexes: number[] = []
  private scrollRect: Rect
  private scrollOffset: number

  //
  // virtualItems: VirtualItem<TItemElement>[]
  // totalSize: number
  // scrollToOffset: (offset: number, options?: ScrollToOffsetOptions) => void
  // scrollToIndex: (index: number, options?: ScrollToIndexOptions) => void
  // measure: (index: number) => void

  constructor(opts: VirtualOptions<TScrollElement, TItemElement>) {
    this.setOptions(opts)
    this.scrollRect = this.options.initialRect
    this.scrollOffset = this.options.initialOffset
  }

  setOptions = (opts: VirtualOptions<TScrollElement, TItemElement>) => {
    let isWindow
    let windowHeight

    if (typeof window !== 'undefined') {
      isWindow = !(opts.scrollElement as unknown as Element).tagName

      if (isWindow) {
        windowHeight = {
          width: window.innerWidth,
          height: window.innerHeight,
        }
      }
    }

    this.options = {
      ...opts,
      estimateSize: opts.estimateSize ?? defaultEstimateSize,
      overscan: opts.overscan ?? 1,
      paddingStart: opts.paddingStart ?? 0,
      paddingEnd: opts.paddingEnd ?? 0,
      horizontal: opts.horizontal ?? false,
      keyExtractor: opts.keyExtractor ?? defaultKeyExtractor,
      rangeExtractor: opts.rangeExtractor ?? defaultRangeExtractor,
      observeElementRect:
        opts.observeElementRect ??
        (isWindow ? observeWindowRect : observeElementRect),
      observeElementOffset:
        opts.observeElementOffset ??
        (isWindow ? observeWindowOffset : observeElementOffset),
      initialRect:
        opts.initialRect ?? (windowHeight || { width: 0, height: 0 }),
      initialOffset: opts.initialOffset ?? 0,
      onOffsetChange: opts.onOffsetChange ?? (() => {}),
      onUpdate: opts.onUpdate ?? (() => {}),
      scrollToFn: opts.scrollToFn ?? (() => {}),
      measureSize: opts.measureSize ?? ((() => {}) as any),
    }
  }

  _willUpdate = () => {
    const unsubs: (() => void)[] = []

    if (this.scrollElement !== this.options.scrollElement) {
      this.scrollElement = this.options.scrollElement

      unsubs.push(
        this.options.observeElementRect(this, (rect) => {
          this.scrollRect = rect
        }),
      )

      unsubs.push(
        this.options.observeElementOffset(this, (offset) => {
          this.scrollOffset = offset
        }),
      )
    }

    return () => {
      unsubs.forEach((d) => d())
    }
  }

  private getSize = () => {
    return this.scrollRect[this.getSizeKey()]
  }

  private getMeasurements = memo(
    () => [
      this.options.count,
      this.options.paddingStart,
      this.getEstimateSizeFn(),
      this.options.keyExtractor,
    ],
    (count, paddingStart, estimateSize, keyExtractor) => {
      const min =
        this.pendingMeasuredCacheIndexes.length > 0
          ? Math.min(...this.pendingMeasuredCacheIndexes)
          : 0
      this.pendingMeasuredCacheIndexes = []

      const measurements = this.measurementsCache.slice(0, min)

      for (let i = min; i < count; i++) {
        const key = keyExtractor(i)
        const measuredSize = this.itemMeasurementsCache[key]
        const start = measurements[i - 1]
          ? measurements[i - 1]!.end
          : paddingStart
        const size =
          typeof measuredSize === 'number' ? measuredSize : estimateSize(i)
        const end = start + size
        measurements[i] = { index: i, start, size, end, key }
      }

      this.measurementsCache = measurements
      return measurements
    },
    {
      key: process.env.NODE_ENV === 'development' && 'getMeasurements',
      debug: () => DEBUG,
    },
  )

  private calculateRange = memo(
    () => [this.getMeasurements(), this.getSize(), this.scrollOffset],
    (measurements, outerSize, scrollOffset) => {
      return calculateRange({
        measurements,
        outerSize,
        scrollOffset,
      })
    },
    {
      key: process.env.NODE_ENV === 'development' && 'calculateRange',
    },
  )

  private getIndexes = memo(
    () => [
      this.options.rangeExtractor,
      this.calculateRange(),
      this.options.overscan,
      this.options.count,
    ],
    (rangeExtractor, range, overscan, measurementsLength) => {
      return rangeExtractor({
        ...range,
        overscan,
        count: measurementsLength,
      })
    },
    {
      key: process.env.NODE_ENV === 'development' && 'getIndexes',
    },
  )

  getVirtualItems = memo(
    () => [this.getIndexes(), this.getMeasurements(), this.options.measureSize],
    (indexes, measurements, measureSize) => {
      const virtualItems: VirtualItem<TItemElement>[] = []

      for (let k = 0, len = indexes.length; k < len; k++) {
        const i = indexes[k]!
        const measurement = measurements[i]!

        const item = {
          ...measurement,
          measureElement: (measurableItem: TItemElement | null) => {
            if (measurableItem) {
              const measuredItemSize = measureSize(measurableItem, this)

              if (measuredItemSize !== item.size) {
                if (item.start < this.scrollOffset) {
                  this.setScrollOffset(
                    this.scrollOffset + (measuredItemSize - item.size),
                  )
                }

                this.pendingMeasuredCacheIndexes.push(i)
                this.itemMeasurementsCache[item.key] = measuredItemSize
              }
            }
          },
        }

        virtualItems.push(item)
      }

      return virtualItems
      // }, [indexes, defaultScrollToFn, horizontal, measurements])
    },
    {
      key: process.env.NODE_ENV === 'development' && 'getIndexes',
    },
  )

  scrollToOffset = (
    toOffset: number,
    { align }: ScrollToOffsetOptions = { align: 'start' },
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

    if (align === 'start') {
      this.setScrollOffset(toOffset)
    } else if (align === 'end') {
      this.setScrollOffset(toOffset - size)
    } else if (align === 'center') {
      this.setScrollOffset(toOffset - size / 2)
    }
  }

  private tryScrollToIndex = (
    index: number,
    { align, ...rest }: ScrollToIndexOptions = { align: 'auto' },
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
      if (measurement.end >= offset + size) {
        align = 'end'
      } else if (measurement.start <= offset) {
        align = 'start'
      } else {
        return
      }
    }

    const toOffset =
      align === 'center'
        ? measurement.start + measurement.size / 2
        : align === 'end'
        ? measurement.end
        : measurement.start

    this.scrollToOffset(toOffset, { align, ...rest })
  }

  scrollToIndex = (index: number, options?: ScrollToIndexOptions) => {
    // We do a double request here because of
    // dynamic sizes which can cause offset shift
    // and end up in the wrong spot. Unfortunately,
    // we can't know about those dynamic sizes until
    // we try and render them. So double down!
    this.tryScrollToIndex(index, options)
    requestAnimationFrame(() => {
      this.tryScrollToIndex(index, options)
    })
  }

  getTotalSize = () =>
    (this.getMeasurements()[this.options.count - 1]?.end ||
      this.options.paddingStart) + this.options.paddingEnd

  private getSizeKey = () => (this.options.horizontal ? 'width' : 'height')

  private setScrollOffset = (offset: number) => {
    this.options.onOffsetChange(offset)
  }

  private getEstimateSizeFn = memo(
    () => [this.options.estimateSize],
    (d) => d,
    {
      key: false,
      onChange: () => {
        this.itemMeasurementsCache = {}
      },
    },
  )

  measure = () => {
    this.itemMeasurementsCache = {}
    this.options.onUpdate()
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
  measurements: Item[]
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
