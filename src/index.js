import React from 'react'

import useScroll from './useScroll'
import useRect from './useRect'

export function useVirtual({
  size = 0,
  estimateSize,
  overscan = 1,
  parentRef,
  horizontal,
  // pinnedIndices,
  // stickyIndices,
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

  const setScrollOffset = React.useCallback(
    offset => {
      _setScrollOffset(offset)
      parentRef.current[scrollKey] = offset
    },
    [parentRef, scrollKey]
  )

  const scrollOffsetPlusSize = scrollOffset + outerSize

  const [measuredCache, setMeasuredCache] = React.useState({})

  React.useEffect(() => {
    if (estimateSize || size) setMeasuredCache({})
  }, [estimateSize, size])

  const measurements = React.useMemo(() => {
    const measurements = []
    for (let i = 0; i < size; i++) {
      const start = measurements[i - 1]?.end || 0
      const size = measuredCache[i] || estimateSize(i)
      const end = start + size
      measurements[i] = {
        index: i,
        start,
        size,
        end,
      }
    }

    return measurements
  }, [estimateSize, measuredCache, size])

  const total = measurements[size - 1]?.end || 0

  let start = React.useMemo(
    () => measurements.find(rowStat => rowStat.end >= scrollOffset),
    [measurements, scrollOffset]
  )
  let end = React.useMemo(
    () =>
      [...measurements]
        .reverse()
        .find(rowStat => rowStat.start <= scrollOffsetPlusSize),
    [measurements, scrollOffsetPlusSize]
  )

  let startIndex = start ? start.index : 0
  let endIndex = end ? end.index : 0

  // Always add at least one overscan item, so focus will work
  startIndex = Math.max(startIndex - 1 - overscan, 0)
  endIndex = Math.min(endIndex + 1 + overscan, size - 1)

  const items = React.useMemo(() => {
    const items = []

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

      items.push(item)
    }

    return items
  }, [startIndex, endIndex, measurements, sizeKey])

  return {
    items,
    totalSize: total,
    setScrollOffset,
  }
}
