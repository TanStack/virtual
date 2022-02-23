import React from 'react'
import useRect from './useRect'
import useIsomorphicLayoutEffect from './useIsomorphicLayoutEffect'

export { useRect }

const defaultEstimateSize = () => 50

const defaultKeyExtractor = index => index

const defaultMeasureSize = (el, horizontal) => {
  const key = horizontal ? 'offsetWidth' : 'offsetHeight'

  return el[key]
}

export const defaultRangeExtractor = range => {
  const start = Math.max(range.start - range.overscan, 0)
  const end = Math.min(range.end + range.overscan, range.size - 1)

  const arr = []

  for (let i = start; i <= end; i++) {
    arr.push(i)
  }

  return arr
}

export const useElementScroll = ({
  parentRef,
  horizontal,
  useObserver,
  initialRect,
}) => {
  const scrollKey = horizontal ? 'scrollLeft' : 'scrollTop'
  const [scrollOffset, setScrollOffset] = React.useState(0)
  const [element, setElement] = React.useState(parentRef.current)

  useIsomorphicLayoutEffect(() => {
    setElement(parentRef.current)
  })

  useIsomorphicLayoutEffect(() => {
    if (!element) {
      setScrollOffset(0)

      return
    }

    const onScroll = () => {
      setScrollOffset(element[scrollKey])
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

  const scrollToFn = React.useCallback(
    offset => {
      if (parentRef.current) {
        parentRef.current[scrollKey] = offset
      }
    },
    [parentRef, scrollKey]
  )

  const useMeasureParent = useObserver || useRect

  const sizeKey = horizontal ? 'width' : 'height'

  const { [sizeKey]: outerSize } = useMeasureParent(parentRef, initialRect)

  return {
    outerSize,
    scrollOffset,
    scrollToFn,
  }
}

export const useWindowRect = (
  windowRef,
  initialRect = { width: 0, height: 0 }
) => {
  const [rect, setRect] = React.useState(initialRect)
  const [element, setElement] = React.useState(windowRef.current)

  useIsomorphicLayoutEffect(() => {
    setElement(windowRef.current)
  })

  useIsomorphicLayoutEffect(() => {
    if (!element) {
      return
    }

    function resizeHandler() {
      const next = {
        width: element.innerWidth,
        height: element.innerHeight,
      }

      setRect(prev =>
        prev.height !== next.height || prev.width !== next.width ? next : prev
      )
    }
    resizeHandler()

    element.addEventListener('resize', resizeHandler)

    return () => {
      element.removeEventListener('resize', resizeHandler)
    }
  }, [element])

  return rect
}

export const useWindowScroll = ({
  windowRef,
  parentRef,
  horizontal,
  useWindowObserver,
  initialRect,
}) => {
  const [scrollOffset, setScrollOffset] = React.useState(0)
  const [element, setElement] = React.useState(windowRef.current)

  const rectKey = horizontal ? 'left' : 'top'

  const scrollKey = horizontal ? 'scrollX' : 'scrollY'

  useIsomorphicLayoutEffect(() => {
    setElement(windowRef.current)
  })

  useIsomorphicLayoutEffect(() => {
    if (!element) {
      setScrollOffset(0)

      return
    }

    const onScroll = () => {
      setScrollOffset(
        Math.max(0, parentRef.current.getBoundingClientRect()[rectKey] * -1)
      )
    }

    onScroll()

    element.addEventListener('scroll', onScroll, {
      capture: false,
      passive: true,
    })

    return () => {
      element.removeEventListener('scroll', onScroll)
    }
  }, [element, rectKey, parentRef])

  const scrollToFn = React.useCallback(
    (offset, reason) => {
      if (windowRef.current) {
        const delta = ['ToIndex', 'SizeChanged'].includes(reason)
          ? windowRef.current[scrollKey] +
            parentRef.current.getBoundingClientRect()[rectKey]
          : 0

        windowRef.current.scrollTo({ [rectKey]: offset + delta })
      }
    },
    [windowRef, parentRef, scrollKey, rectKey]
  )

  const useMeasureParent = useWindowObserver || useWindowRect

  const sizeKey = horizontal ? 'width' : 'height'

  const { [sizeKey]: outerSize } = useMeasureParent(windowRef, initialRect)

  return {
    outerSize,
    scrollOffset,
    scrollToFn,
  }
}

export const useDefaultScroll = props => {
  const { parentRef, windowRef } = props

  const useWindow = windowRef !== undefined

  const emptyRef = React.useRef(null)

  const elementRes = useElementScroll({
    ...props,
    parentRef: useWindow ? emptyRef : parentRef,
  })

  const windowRes = useWindowScroll({
    ...props,
    windowRef: useWindow ? windowRef : emptyRef,
  })

  return useWindow ? windowRes : elementRes
}

export function useVirtual({
  size = 0,
  estimateSize = defaultEstimateSize,
  overscan = 1,
  paddingStart = 0,
  paddingEnd = 0,
  scrollPaddingStart = 0,
  scrollPaddingEnd = 0,
  parentRef,
  windowRef,
  horizontal,
  scrollToFn,
  useObserver,
  useWindowObserver,
  initialRect,
  keyExtractor = defaultKeyExtractor,
  measureSize = defaultMeasureSize,
  rangeExtractor = defaultRangeExtractor,
  useScroll = useDefaultScroll,
}) {
  const latestRef = React.useRef({
    scrollOffset: 0,
    measurements: [],
  })

  const { outerSize, scrollOffset, scrollToFn: defaultScrollToFn } = useScroll({
    windowRef,
    parentRef,
    horizontal,
    useObserver,
    useWindowObserver,
    initialRect,
  })

  const scrollOffsetWithAdjustmentsRef = React.useRef(scrollOffset)
  if (latestRef.current.scrollOffset !== scrollOffset) {
    scrollOffsetWithAdjustmentsRef.current = scrollOffset
  }

  latestRef.current.outerSize = outerSize
  latestRef.current.scrollOffset = scrollOffset

  const scrollTo = React.useCallback(
    (offset, reason) => {
      const resolvedScrollToFn =
        scrollToFn || (offset => defaultScrollToFn(offset, reason))

      resolvedScrollToFn(offset, defaultScrollToFn)
    },
    [scrollToFn, defaultScrollToFn]
  )

  const [measuredCache, setMeasuredCache] = React.useState({})

  const measure = React.useCallback(() => setMeasuredCache({}), [])

  const pendingMeasuredCacheIndexesRef = React.useRef([])

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

  const totalSize = (measurements[size - 1]?.end || 0) + paddingEnd

  latestRef.current.measurements = measurements
  latestRef.current.totalSize = totalSize

  const { start, end } = calculateRange(latestRef.current)

  const indexes = React.useMemo(
    () =>
      rangeExtractor({
        start,
        end,
        overscan,
        size,
      }),
    [start, end, overscan, size, rangeExtractor]
  )

  const measureSizeRef = React.useRef(measureSize)
  measureSizeRef.current = measureSize

  const virtualItems = React.useMemo(() => {
    const virtualItems = []

    for (let k = 0, len = indexes.length; k < len; k++) {
      const i = indexes[k]
      const measurement = measurements[i]

      const item = {
        ...measurement,
        measureRef: el => {
          if (el) {
            const measuredSize = measureSizeRef.current(el, horizontal)

            if (measuredSize !== item.size) {
              const { scrollOffset } = latestRef.current

              if (item.start < scrollOffset) {
                const delta = measuredSize - item.size
                scrollOffsetWithAdjustmentsRef.current += delta

                defaultScrollToFn(
                  scrollOffsetWithAdjustmentsRef.current,
                  'SizeChanged'
                )
              }

              pendingMeasuredCacheIndexesRef.current.push(i)

              setMeasuredCache(old => ({
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
    (toOffset, { align = 'start' } = {}, reason = 'ToOffset') => {
      const { scrollOffset, outerSize } = latestRef.current

      if (align === 'auto') {
        if (toOffset <= scrollOffset + scrollPaddingStart) {
          align = 'start'
        } else if (toOffset >= scrollOffset + outerSize - scrollPaddingEnd) {
          align = 'end'
        } else {
          align = 'start'
        }
      }

      if (align === 'start') {
        scrollTo(toOffset - scrollPaddingStart, reason)
      } else if (align === 'end') {
        scrollTo(toOffset - outerSize + scrollPaddingEnd, reason)
      } else if (align === 'center') {
        scrollTo(
          toOffset -
            scrollPaddingStart -
            (outerSize - scrollPaddingStart - scrollPaddingEnd) / 2,
          reason
        )
      }
    },
    [scrollPaddingEnd, scrollPaddingStart, scrollTo]
  )

  const tryScrollToIndex = React.useCallback(
    (index, { align = 'auto', ...rest } = {}) => {
      const { measurements, scrollOffset, outerSize } = latestRef.current

      const measurement = measurements[Math.max(0, Math.min(index, size - 1))]

      if (!measurement) {
        return
      }

      if (align === 'auto') {
        if (measurement.end >= scrollOffset + outerSize - scrollPaddingEnd) {
          align = 'end'
        } else if (measurement.start <= scrollOffset + scrollPaddingStart) {
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

      scrollToOffset(toOffset, { align, ...rest }, 'ToIndex')
    },
    [scrollPaddingEnd, scrollPaddingStart, scrollToOffset, size]
  )

  const scrollToIndex = React.useCallback(
    (...args) => {
      // We do a double request here because of
      // dynamic sizes which can cause offset shift
      // and end up in the wrong spot. Unfortunately,
      // we can't know about those dynamic sizes until
      // we try and render them. So double down!
      tryScrollToIndex(...args)
      requestAnimationFrame(() => {
        tryScrollToIndex(...args)
      })
    },
    [tryScrollToIndex]
  )

  return {
    virtualItems,
    totalSize,
    scrollToOffset,
    scrollToIndex,
    measure,
  }
}

const findNearestBinarySearch = (low, high, getCurrentValue, value) => {
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

function calculateRange({ measurements, outerSize, scrollOffset }) {
  const size = measurements.length - 1
  const getOffset = index => measurements[index].start

  let start = findNearestBinarySearch(0, size, getOffset, scrollOffset)
  let end = start

  while (end < size && measurements[end].end < scrollOffset + outerSize) {
    end++
  }

  return { start, end }
}
