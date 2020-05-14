import React from 'react'

import useScroll from './useScroll'
import useRect from './useRect'
import useIsomorphicLayoutEffect from './useIsomorphicLayoutEffect'

const defaultEstimateSize = () => 50

export function useVirtual({
  size = 0,
  estimateSize = defaultEstimateSize,
  overscan = 0,
  parentRef,
  horizontal,
  scrollToFn,
}) {
  const sizeKey = horizontal ? 'width' : 'height'
  const scrollKey = horizontal ? 'scrollLeft' : 'scrollTop'

  const { [sizeKey]: outerSize } = useRect(parentRef) || {
    [sizeKey]: 0,
  }

  const [scrollOffset, _setScrollOffset] = React.useState(0)

  useScroll(parentRef, ({ [scrollKey]: newScrollOffset }) => {
    _setScrollOffset(newScrollOffset)
  })

  const defaultScrollToFn = React.useCallback(
    offset => {
      if (parentRef.current) {
        _setScrollOffset(offset)
        parentRef.current[scrollKey] = offset
      }
    },
    [parentRef, scrollKey]
  )

  const resolvedScrollToFn = scrollToFn || defaultScrollToFn

  scrollToFn = React.useCallback(
    offset => {
      resolvedScrollToFn(offset, defaultScrollToFn)
    },
    [defaultScrollToFn, resolvedScrollToFn]
  )

  const scrollOffsetPlusOuterSize = scrollOffset + outerSize

  const [measuredCache, setMeasuredCache] = React.useState({})

  const { measurements, reversedMeasurements } = React.useMemo(() => {
    const measurements = []
    const reversedMeasurements = []

    for (let i = 0, j = size - 1; i < size; i++, j--) {
      const start = measurements[i - 1] ? measurements[i - 1].end : 0
      const size = measuredCache[i] || estimateSize(i)
      const end = start + size
      const bounds = { index: i, start, size, end }
      measurements[i] = {
        ...bounds,
      }
      reversedMeasurements[j] = {
        ...bounds,
      }
    }
    return { measurements, reversedMeasurements }
  }, [estimateSize, measuredCache, size])

  const totalSize = measurements[size - 1]?.end || 0

  let start = React.useMemo(
    () =>
      reversedMeasurements.reduce(
        (last, rowStat) => (rowStat.end >= scrollOffset ? rowStat : last),
        reversedMeasurements[0]
      ),
    [reversedMeasurements, scrollOffset]
  )

  let end = React.useMemo(
    () =>
      measurements.reduce(
        (last, rowStat) =>
          rowStat.start <= scrollOffsetPlusOuterSize ? rowStat : last,
        measurements[0]
      ),
    [measurements, scrollOffsetPlusOuterSize]
  )

  let startIndex = start ? start.index : 0
  let endIndex = end ? end.index : 0

  // Always add at least one overscan item, so focus will work
  startIndex = Math.max(startIndex - overscan, 0)
  endIndex = Math.min(endIndex + overscan, size - 1)

  const latestRef = React.useRef({})

  latestRef.current = {
    measurements,
    outerSize,
    scrollOffset,
    scrollOffsetPlusOuterSize,
    totalSize,
  }

  const virtualItems = React.useMemo(() => {
    const virtualItems = []

    for (let i = startIndex; i <= endIndex; i++) {
      const measurement = measurements[i]

      const item = {
        ...measurement,
        measureRef: el => {
          const { scrollOffset } = latestRef.current

          if (el) {
            const { [sizeKey]: measuredSize } = el.getBoundingClientRect()

            if (measuredSize !== item.size) {
              if (item.start < scrollOffset) {
                defaultScrollToFn(scrollOffset + (measuredSize - item.size))
              }

              setMeasuredCache(old => ({
                ...old,
                [i]: measuredSize,
              }))
            }
          }
        },
      }

      virtualItems.push(item)
    }

    return virtualItems
  }, [startIndex, endIndex, measurements, sizeKey, defaultScrollToFn])

  const mountedRef = React.useRef()

  useIsomorphicLayoutEffect(() => {
    if (mountedRef.current) {
      if (estimateSize || size) setMeasuredCache({})
    }
    mountedRef.current = true
  }, [estimateSize, size])

  const scrollToOffset = React.useCallback(
    (offset, { align = 'start' } = {}) => {
      const {
        outerSize,
        scrollOffset,
        scrollOffsetPlusOuterSize,
      } = latestRef.current

      if (align === 'auto') {
        if (offset <= scrollOffset) {
          align = 'start'
        } else if (offset >= scrollOffsetPlusOuterSize) {
          align = 'end'
        } else {
          align = 'start'
        }
      }

      if (align === 'start') {
        scrollToFn(offset)
      } else if (align === 'end') {
        scrollToFn(offset - outerSize)
      } else if (align === 'center') {
        scrollToFn(offset - outerSize / 2)
      }
    },
    [scrollToFn]
  )

  const tryScrollToIndex = React.useCallback(
    (index, { align = 'auto', ...rest } = {}) => {
      const {
        measurements,
        scrollOffset,
        scrollOffsetPlusOuterSize,
      } = latestRef.current

      const measurement = measurements[Math.max(0, Math.min(index, size - 1))]

      if (!measurement) {
        return
      }

      if (align === 'auto') {
        if (measurement.end >= scrollOffsetPlusOuterSize) {
          align = 'end'
        } else if (measurement.start <= scrollOffset) {
          align = 'start'
        } else {
          return
        }
      }

      let offset =
        align === 'center'
          ? measurement.start + measurement.size / 2
          : align === 'end'
          ? measurement.end
          : measurement.start

      scrollToOffset(offset, { align, ...rest })
    },
    [scrollToOffset, size]
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
  }
}
