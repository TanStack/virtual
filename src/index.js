import React from 'react'

import useScroll from './useScroll'
import useRect from './useRect'
import useIsomorphicLayoutEffect from './useIsomorphicLayoutEffect'

export function useVirtual({
  size = 0,
  estimateSize,
  overscan = 0,
  parentRef,
  horizontal,
  scrollToFn,
}) {
  const sizeKey = horizontal ? 'width' : 'height'
  const scrollKey = horizontal ? 'scrollLeft' : 'scrollTop'

  const defaultScrollToFn = React.useCallback(
    offset => {
      parentRef.current[scrollKey] = offset
    },
    [parentRef, scrollKey]
  )

  scrollToFn = scrollToFn || defaultScrollToFn

  const { [sizeKey]: outerSize } = useRect(parentRef) || {
    [sizeKey]: 0,
  }

  const [scrollOffset, _setScrollOffset] = React.useState(0)

  useScroll(parentRef, ({ [scrollKey]: newScrollOffset }) => {
    _setScrollOffset(newScrollOffset)
  })

  const scrollOffsetPlusOuterSize = scrollOffset + outerSize

  const [measuredCache, setMeasuredCache] = React.useState({})

  const mountedRef = React.useRef()

  useIsomorphicLayoutEffect(() => {
    if (mountedRef.current) {
      if (estimateSize || size) setMeasuredCache({})
    }
    mountedRef.current = true
  }, [estimateSize, size])

  const { measurements, reversedMeasurements } = React.useMemo(() => {
    const measurements = []
    const reversedMeasurements = []

    for (let i = 0, j = size - 1; i < size; i++, j--) {
      const start = measurements[i - 1]?.end || 0
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
    () => measurements.find(rowStat => rowStat.end >= scrollOffset),
    [measurements, scrollOffset]
  )

  let end = React.useMemo(
    () =>
      reversedMeasurements.find(
        rowStat => rowStat.start <= scrollOffsetPlusOuterSize
      ),
    [reversedMeasurements, scrollOffsetPlusOuterSize]
  )

  let startIndex = start ? start.index : 0
  let endIndex = end ? end.index : 0

  // Always add at least one overscan item, so focus will work
  startIndex = Math.max(startIndex - 1 - overscan, 0)
  endIndex = Math.min(endIndex + 1 + overscan, size - 1)

  const virtualItems = React.useMemo(() => {
    const virtualItems = []

    for (let i = startIndex; i <= endIndex; i++) {
      const measurement = measurements[i]

      const item = {
        ...measurement,
        measureRef: el => {
          if (!el) return

          const { [sizeKey]: measuredSize } = el.getBoundingClientRect()

          if (measuredSize !== item.size) {
            setMeasuredCache(old => ({
              ...old,
              [i]: measuredSize,
            }))
          }
        },
      }

      virtualItems.push(item)
    }

    return virtualItems
  }, [startIndex, endIndex, measurements, sizeKey])

  const latestRef = React.useRef()
  latestRef.current = {
    measurements,
    outerSize,
    scrollOffset,
    scrollOffsetPlusOuterSize,
    totalSize,
  }

  const scrollToOffset = React.useCallback(
    (offset, { align = 'start' } = {}) => {
      const {
        outerSize,
        scrollOffset,
        scrollOffsetPlusOuterSize,
        totalSize,
      } = latestRef.current

      offset = Math.max(0, Math.min(offset, totalSize - outerSize))

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

  const scrollToIndex = React.useCallback(
    (index, { align = 'auto' } = {}) => {
      const {
        measurements,
        scrollOffset,
        scrollOffsetPlusOuterSize,
      } = latestRef.current

      const measurement = measurements[index]

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
      scrollToOffset(offset, { align })
    },
    [scrollToOffset]
  )

  return {
    virtualItems,
    totalSize,
    scrollToOffset,
    scrollToIndex,
  }
}
