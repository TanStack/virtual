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
  start: number
  end: number
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

export interface VirtualItem<TItemElement> extends Item {
  measureElement: (el: TItemElement | null) => void
}

//

const DEBUG = true
const defaultEstimateSize = () => 50

const defaultKeyExtractor = (index: number) => index

export const defaultRangeExtractor = (range: Range) => {
  const start = Math.max(range.start - range.overscan, 0)
  const end = Math.min(range.end + range.overscan, range.count - 1)

  const arr = []

  for (let i = start; i <= end; i++) {
    arr.push(i)
  }

  return arr
}

// export const defaultScrollToFn: Options['scrollToFn'] = (offset, instance) => instance.options.parentElement[instance.getScrollKey()] = offset
// export const defaultGetScrollOffsetFn: Options['getScrollOffsetFn'] = (instance) => instance.options.parentElement[instance.getScrollKey()]

export interface VirtualOptions<TItemElement = unknown> {
  count: number
  size: number
  offset: number
  start: number
  end: number
  onOffsetChange: (offset: number) => void
  onUpdate: () => void
  outerSize: number
  measureSize: (el: TItemElement, instance: Virtual<TItemElement>) => number
  scrollToFn: (offset: number, instance: Virtual<TItemElement>) => void
  //
  estimateSize?: (index: number) => number
  overscan?: number
  horizontal?: boolean
  paddingStart?: number
  paddingEnd?: number
  // measureParent?: (element: TParentElement, initialRect?: Rect) => Rect
  // initialRect?: Rect
  keyExtractor?: (index: number) => Key
  // getScrollOffsetFn?: (instance: Virtual) => number
  rangeExtractor?: (range: Range) => number[]
}

export class Virtual<TItemElement = unknown> {
  private measurementsCache: Item[] = []

  options!: Required<VirtualOptions<TItemElement>>
  private itemMeasurementsCache: Record<Key, number> = {}
  private pendingMeasuredCacheIndexes: number[] = []

  //
  // virtualItems: VirtualItem<TItemElement>[]
  // totalSize: number
  // scrollToOffset: (offset: number, options?: ScrollToOffsetOptions) => void
  // scrollToIndex: (index: number, options?: ScrollToIndexOptions) => void
  // measure: (index: number) => void

  constructor(opts: VirtualOptions<TItemElement>) {
    this.setOptions(opts)
  }

  setOptions = (opts: VirtualOptions<TItemElement>) => {
    this.options = {
      ...opts,
      estimateSize: opts.estimateSize ?? defaultEstimateSize,
      overscan: opts.overscan ?? 1,
      paddingStart: opts.paddingStart ?? 0,
      paddingEnd: opts.paddingEnd ?? 0,
      horizontal: opts.horizontal ?? false,
      keyExtractor: opts.keyExtractor ?? defaultKeyExtractor,
      rangeExtractor: opts.rangeExtractor ?? defaultRangeExtractor,
    }
  }

  private getIndexes = memo(
    () => [
      this.options.rangeExtractor,
      this.options.start,
      this.options.end,
      this.options.overscan,
      this.options.count,
    ],
    (rangeExtractor, start, end, overscan, measurementsLength) => {
      return rangeExtractor({
        start,
        end,
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
        const measurement = measurements[i]

        const item = {
          ...measurement,
          measureElement: (measurableItem: TItemElement | null) => {
            if (measurableItem) {
              const measuredItemSize = measureSize(measurableItem, this)

              if (measuredItemSize !== item.size) {
                if (item.start < this.options.offset) {
                  this.setScrollOffset(
                    this.options.offset + (measuredItemSize - item.size),
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
    const { offset, outerSize } = this.options

    if (align === 'auto') {
      if (toOffset <= offset) {
        align = 'start'
      } else if (toOffset >= offset + outerSize) {
        align = 'end'
      } else {
        align = 'start'
      }
    }

    if (align === 'start') {
      this.setScrollOffset(toOffset)
    } else if (align === 'end') {
      this.setScrollOffset(toOffset - outerSize)
    } else if (align === 'center') {
      this.setScrollOffset(toOffset - outerSize / 2)
    }
  }

  private tryScrollToIndex = (
    index: number,
    { align, ...rest }: ScrollToIndexOptions = { align: 'auto' },
  ) => {
    const measurements = this.getMeasurements()
    const { count, offset, outerSize } = this.options

    const measurement = measurements[Math.max(0, Math.min(index, count - 1))]

    if (!measurement) {
      return
    }

    if (align === 'auto') {
      if (measurement.end >= offset + outerSize) {
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

  // getScrollKey = () => (this.options.horizontal ? 'scrollLeft' : 'scrollTop')
  // getSizeKey = () => (this.options.horizontal ? 'width' : 'height')

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

  private getMeasurements = memo(
    () => [
      this.options.count,
      this.options.paddingStart,
      this.getEstimateSizeFn(),
      this.options.keyExtractor,
      this.options.size,
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
          ? measurements[i - 1].end
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
  const getOffset = (index: number) => measurements[index].start

  const start = findNearestBinarySearch(0, count, getOffset, scrollOffset)
  let end = start

  while (end < count && measurements[end].end < scrollOffset + outerSize) {
    end++
  }

  return { start, end }
}
