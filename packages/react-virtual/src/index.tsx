import * as React from 'react'
import { useRect, Rect } from './useRect'
import { useIsomorphicLayoutEffect } from './useIsomorphicLayoutEffect'

const defaultEstimateSize = () => 50

const defaultKeyExtractor = (index: number) => index

const defaultMeasureSize = (el: HTMLElement, horizontal: boolean) => {
  const key = horizontal ? 'offsetWidth' : 'offsetHeight'

  return el[key]
}

type ScrollAlignment = 'start' | 'center' | 'end' | 'auto'

interface ScrollToOptions {
  align: ScrollAlignment
}

interface ScrollToOffsetOptions extends ScrollToOptions {}

interface ScrollToIndexOptions extends ScrollToOptions {}

export interface Range {
  start: number
  end: number
  overscan: number
  size: number
}

export const defaultRangeExtractor = (range: Range) => {
  const start = Math.max(range.start - range.overscan, 0)
  const end = Math.min(range.end + range.overscan, range.size - 1)

  const arr = []

  for (let i = start; i <= end; i++) {
    arr.push(i)
  }

  return arr
}

type Key = number | string

interface Item {
  key: Key
  index: number
  start: number
  end: number
  size: number
}

export interface VirtualItem extends Item {
  measureRef: (el: HTMLElement | null) => void
}

export interface Options<T> {
  size: number
  parentRef: React.RefObject<T>
  estimateSize?: (index: number) => number
  overscan?: number
  horizontal?: boolean
  scrollToFn?: (
    offset: number,
    defaultScrollToFn?: (offset: number) => void,
  ) => void
  paddingStart?: number
  paddingEnd?: number
  useObserver?: (ref: React.RefObject<T>, initialRect?: Rect) => Rect
  initialRect?: Rect
  keyExtractor?: (index: number) => Key
  onScrollElement?: React.RefObject<HTMLElement>
  scrollOffsetFn?: (event?: Event) => number
  rangeExtractor?: (range: Range) => number[]
  measureSize?: (el: HTMLElement, horizontal: boolean) => number
}

export const useVirtual = <T extends HTMLElement>({
  size = 0,
  estimateSize = defaultEstimateSize,
  overscan = 1,
  paddingStart = 0,
  paddingEnd = 0,
  parentRef,
  horizontal = false,
  scrollToFn,
  useObserver,
  initialRect,
  onScrollElement,
  scrollOffsetFn,
  keyExtractor = defaultKeyExtractor,
  measureSize = defaultMeasureSize,
  rangeExtractor = defaultRangeExtractor,
}: Options<T>) => {
  const sizeKey = horizontal ? 'width' : 'height'
  const scrollKey = horizontal ? 'scrollLeft' : 'scrollTop'

  const latestRef = React.useRef<{
    scrollOffset: number
    measurements: Item[]
    outerSize: number
    totalSize: number
  }>({
    outerSize: 0,
    scrollOffset: 0,
    measurements: [],
    totalSize: 0,
  })

  const [scrollOffset, setScrollOffset] = React.useState(0)
  latestRef.current.scrollOffset = scrollOffset

  const useMeasureParent = useObserver || useRect

  const { [sizeKey]: outerSize } = useMeasureParent(parentRef, initialRect)

  latestRef.current.outerSize = outerSize

  const defaultScrollToFn = React.useCallback(
    (offset: number) => {
      if (parentRef.current) {
        parentRef.current[scrollKey] = offset
      }
    },
    [parentRef, scrollKey],
  )

  const resolvedScrollToFn = scrollToFn || defaultScrollToFn

  const scrollTo = React.useCallback(
    (offset: number) => {
      resolvedScrollToFn(offset, defaultScrollToFn)
    },
    [defaultScrollToFn, resolvedScrollToFn],
  )

  const [measuredCache, setMeasuredCache] = React.useState<Record<Key, number>>(
    {},
  )

  const measure = React.useCallback(() => setMeasuredCache({}), [])

  const pendingMeasuredCacheIndexesRef = React.useRef<number[]>([])

  const measurements = React.useMemo(() => {
    const min =
      pendingMeasuredCacheIndexesRef.current.length > 0
        ? Math.min(...pendingMeasuredCacheIndexesRef.current)
        : 0
    pendingMeasuredCacheIndexesRef.current = []

    const measurements = latestRef.current.measurements.slice(0, min)

    for (let i = min; i < size; i++) {
      const key = keyExtractor(i)
      const measuredSize = measuredCache[key]
      const start = measurements[i - 1] ? measurements[i - 1].end : paddingStart
      const size =
        typeof measuredSize === 'number' ? measuredSize : estimateSize(i)
      const end = start + size
      measurements[i] = { index: i, start, size, end, key }
    }
    return measurements
  }, [estimateSize, measuredCache, paddingStart, size, keyExtractor])

  const totalSize = (measurements[size - 1]?.end || paddingStart) + paddingEnd

  latestRef.current.measurements = measurements
  latestRef.current.totalSize = totalSize

  const element = onScrollElement ? onScrollElement.current : parentRef.current

  const scrollOffsetFnRef = React.useRef(scrollOffsetFn)
  scrollOffsetFnRef.current = scrollOffsetFn

  useIsomorphicLayoutEffect(() => {
    if (!element) {
      setScrollOffset(0)

      return
    }

    const onScroll = (event?: Event) => {
      const offset = scrollOffsetFnRef.current
        ? scrollOffsetFnRef.current(event)
        : element[scrollKey]

      setScrollOffset(offset)
    }

    onScroll()

    element.addEventListener('scroll', onScroll, {
      capture: false,
      passive: true,
    })

    return () => {
      element.removeEventListener('scroll', onScroll)
    }
  }, [element, scrollKey])

  const { start, end } = calculateRange(latestRef.current)

  const indexes = React.useMemo(
    () =>
      rangeExtractor({
        start,
        end,
        overscan,
        size: measurements.length,
      }),
    [start, end, overscan, measurements.length, rangeExtractor],
  )

  const measureSizeRef = React.useRef(measureSize)
  measureSizeRef.current = measureSize

  const virtualItems: VirtualItem[] = React.useMemo(() => {
    const virtualItems = []

    for (let k = 0, len = indexes.length; k < len; k++) {
      const i = indexes[k]
      const measurement = measurements[i]

      const item = {
        ...measurement,
        measureRef: (el: HTMLElement | null) => {
          if (el) {
            const measuredSize = measureSizeRef.current(el, horizontal)

            if (measuredSize !== item.size) {
              const { scrollOffset } = latestRef.current

              if (item.start < scrollOffset) {
                defaultScrollToFn(scrollOffset + (measuredSize - item.size))
              }

              pendingMeasuredCacheIndexesRef.current.push(i)

              setMeasuredCache((old) => ({
                ...old,
                [item.key]: measuredSize,
              }))
            }
          }
        },
      }

      virtualItems.push(item)
    }

    return virtualItems
  }, [indexes, defaultScrollToFn, horizontal, measurements])

  const mountedRef = React.useRef(false)

  useIsomorphicLayoutEffect(() => {
    if (mountedRef.current) {
      setMeasuredCache({})
    }
    mountedRef.current = true
  }, [estimateSize])

  const scrollToOffset = React.useCallback(
    (
      toOffset: number,
      { align }: ScrollToOffsetOptions = { align: 'start' },
    ) => {
      const { scrollOffset, outerSize } = latestRef.current

      if (align === 'auto') {
        if (toOffset <= scrollOffset) {
          align = 'start'
        } else if (toOffset >= scrollOffset + outerSize) {
          align = 'end'
        } else {
          align = 'start'
        }
      }

      if (align === 'start') {
        scrollTo(toOffset)
      } else if (align === 'end') {
        scrollTo(toOffset - outerSize)
      } else if (align === 'center') {
        scrollTo(toOffset - outerSize / 2)
      }
    },
    [scrollTo],
  )

  const tryScrollToIndex = React.useCallback(
    (
      index: number,
      { align, ...rest }: ScrollToIndexOptions = { align: 'auto' },
    ) => {
      const { measurements, scrollOffset, outerSize } = latestRef.current

      const measurement = measurements[Math.max(0, Math.min(index, size - 1))]

      if (!measurement) {
        return
      }

      if (align === 'auto') {
        if (measurement.end >= scrollOffset + outerSize) {
          align = 'end'
        } else if (measurement.start <= scrollOffset) {
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

      scrollToOffset(toOffset, { align, ...rest })
    },
    [scrollToOffset, size],
  )

  const scrollToIndex = React.useCallback(
    (index: number, options?: ScrollToIndexOptions) => {
      // We do a double request here because of
      // dynamic sizes which can cause offset shift
      // and end up in the wrong spot. Unfortunately,
      // we can't know about those dynamic sizes until
      // we try and render them. So double down!
      tryScrollToIndex(index, options)
      requestAnimationFrame(() => {
        tryScrollToIndex(index, options)
      })
    },
    [tryScrollToIndex],
  )

  return {
    virtualItems,
    totalSize,
    scrollToOffset,
    scrollToIndex,
    measure,
  }
}

const findNearestBinarySearch = (
  low: number,
  high: number,
  getCurrentValue: (i: number) => number,
  value: number,
) => {
  while (low <= high) {
    let middle = ((low + high) / 2) | 0
    let currentValue = getCurrentValue(middle)

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
  const size = measurements.length - 1
  const getOffset = (index: number) => measurements[index].start

  let start = findNearestBinarySearch(0, size, getOffset, scrollOffset)
  let end = start

  while (end < size && measurements[end].end < scrollOffset + outerSize) {
    end++
  }

  return { start, end }
}
