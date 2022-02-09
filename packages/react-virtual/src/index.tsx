import * as React from 'react'
import { useRect, Rect } from './useRect'
import { useIsomorphicLayoutEffect } from './useIsomorphicLayoutEffect'
import { useLatestRef } from './useLatestRef'

export { useRect }

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

type ScrollToOffsetOptions = ScrollToOptions

type ScrollToIndexOptions = ScrollToOptions

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
  const size = measurements.length - 1
  const getOffset = (index: number) => measurements[index].start

  const start = findNearestBinarySearch(0, size, getOffset, scrollOffset)
  let end = start

  while (end < size && measurements[end].end < scrollOffset + outerSize) {
    end++
  }

  return { start, end }
}

export const useElementScroll = <T extends HTMLElement>(
  onScroll: (offset: number) => void,
  {
    parentRef,
    horizontal,
  }: { parentRef: React.RefObject<T>; horizontal: boolean },
) => {
  const scrollKey = horizontal ? 'scrollLeft' : 'scrollTop'

  useIsomorphicLayoutEffect(() => {
    const element = parentRef.current

    if (!element) {
      return
    }

    const handleScroll = () => {
      onScroll(element[scrollKey])
    }

    handleScroll()

    element.addEventListener('scroll', handleScroll, {
      capture: false,
      passive: true,
    })

    return () => {
      element.removeEventListener('scroll', handleScroll)
    }
  }, [scrollKey, parentRef, onScroll])

  const scrollToFn = React.useCallback(
    (offset: number) => {
      if (parentRef.current) {
        parentRef.current[scrollKey] = offset
      }
    },
    [parentRef, scrollKey],
  )

  return {
    scrollToFn,
  }
}

export const useWindowScroll = <T extends HTMLElement>(
  onScroll: (offset: number) => void,
  {
    parentRef,
    windowRef,
    horizontal,
  }: {
    parentRef: React.RefObject<T>
    windowRef: React.RefObject<Window>
    horizontal: boolean
  },
) => {
  const rectKey = horizontal ? 'left' : 'top'

  useIsomorphicLayoutEffect(() => {
    const window = windowRef.current
    const element = parentRef.current

    if (!window || !element) {
      return
    }

    const handleScroll = () => {
      onScroll(Math.max(0, element.getBoundingClientRect()[rectKey] * -1))
    }

    handleScroll()

    window.addEventListener('scroll', handleScroll, {
      capture: false,
      passive: true,
    })

    return () => {
      window.removeEventListener('scroll', handleScroll)
    }
  }, [rectKey, parentRef, windowRef, onScroll])

  const scrollToFn = React.useCallback(
    (offset: number) => {
      if (windowRef.current && parentRef.current) {
        const scrollKey = horizontal ? 'scrollX' : 'scrollY'

        const delta =
          windowRef.current[scrollKey] +
          parentRef.current.getBoundingClientRect()[rectKey]

        windowRef.current.scrollTo({ [rectKey]: offset + delta })
      }
    },
    [windowRef, parentRef, horizontal, rectKey],
  )

  return {
    scrollToFn,
  }
}

export interface VirtualItem extends Item {
  measureRef: (el: HTMLElement | null) => void
}

interface BaseOptions<T> {
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
  initialRect?: Rect
  keyExtractor?: (index: number) => Key
  rangeExtractor?: (range: Range) => number[]
  measureSize?: (el: HTMLElement, horizontal: boolean) => number
}

interface ElementOptions<T> extends BaseOptions<T> {
  useScroll?: (
    onScroll: (offset: number) => void,
    options: {
      parentRef: React.RefObject<T>
      horizontal: boolean
    },
  ) => {
    scrollToFn: (offset: number) => void
  }
  useObserver?: (ref: React.RefObject<T>, initialRect?: Rect) => Rect
  windowRef?: undefined
}

interface WindowOptions<T> extends BaseOptions<T> {
  useScroll?: undefined
  useObserver?: (ref: React.RefObject<Window>, initialRect?: Rect) => Rect
  windowRef: React.RefObject<Window>
}

export type Options<T> = ElementOptions<T> | WindowOptions<T>

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
  keyExtractor = defaultKeyExtractor,
  measureSize = defaultMeasureSize,
  rangeExtractor = defaultRangeExtractor,
  useScroll = useElementScroll,
  windowRef,
}: Options<T>) => {
  const latestRef = React.useRef<{
    measurements: Item[]
    outerSize: number
    scrollOffset: number
    totalSize: number
  }>({
    measurements: [],
    outerSize: 0,
    scrollOffset: 0,
    totalSize: 0,
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fixUnion = <T extends (...args: any[]) => any>(
    t: T,
  ): ((...args: Parameters<T>) => ReturnType<T>) => t

  const useMeasureParent = fixUnion(useObserver || useRect)

  const sizeKey = horizontal ? 'width' : 'height'

  const { [sizeKey]: outerSize } = useMeasureParent(
    ...(windowRef ? [windowRef, initialRect] : [parentRef, initialRect]),
  )

  const [{ start, end }, setRange] = React.useState<{
    start: number
    end: number
  }>({ start: 0, end: 0 })

  const updateRange = React.useCallback(
    (...args: Parameters<typeof calculateRange>) => {
      const next = calculateRange(...args)
      setRange((prev) => {
        if (next.start !== prev.start || next.end !== prev.end) {
          return next
        }
        return prev
      })
    },
    [],
  )

  const onScroll = React.useCallback(
    (offset: number) => {
      latestRef.current.scrollOffset = offset

      updateRange(latestRef.current)
    },
    [updateRange],
  )

  const nullRef = React.useRef(null)

  const windowScroll = useWindowScroll(onScroll, {
    parentRef,
    windowRef: windowRef ?? nullRef,
    horizontal,
  })

  const elementScroll = useScroll(onScroll, {
    parentRef: windowRef ? nullRef : parentRef,
    horizontal,
  })

  const defaultScrollToFn = windowRef
    ? windowScroll.scrollToFn
    : elementScroll.scrollToFn

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

  const mountedRef = React.useRef(false)

  useIsomorphicLayoutEffect(() => {
    if (mountedRef.current) {
      setMeasuredCache({})
    }
    mountedRef.current = true
  }, [estimateSize])

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
    latestRef.current.measurements = measurements

    return measurements
  }, [estimateSize, measuredCache, paddingStart, size, keyExtractor])

  const totalSize = (measurements[size - 1]?.end || paddingStart) + paddingEnd

  useIsomorphicLayoutEffect(() => {
    latestRef.current.totalSize = totalSize
    latestRef.current.outerSize = outerSize

    updateRange(latestRef.current)
  }, [updateRange, measurements, totalSize, outerSize])

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

  const measureSizeRef = useLatestRef(measureSize)

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
                const delta = measuredSize - item.size
                latestRef.current.scrollOffset += delta

                defaultScrollToFn(latestRef.current.scrollOffset)
              }

              pendingMeasuredCacheIndexesRef.current.push(i)

              setMeasuredCache((prev) => ({
                ...prev,
                [item.key]: measuredSize,
              }))
            }
          }
        },
      }

      virtualItems.push(item)
    }

    return virtualItems
  }, [indexes, defaultScrollToFn, horizontal, measurements, measureSizeRef])

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
