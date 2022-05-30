import * as React from 'react'
import { Virtual, VirtualOptions, PartialKeys } from '../../virtual-core/src'
import { useRect, Rect } from '../../virtual-core/src/useRect'
import { useIsomorphicLayoutEffect } from './useIsomorphicLayoutEffect'

const defaultEstimateSize = () => 50

const defaultKeyExtractor = (index: number) => index

const defaultMeasureSize = <TItemElement,>(
  el: TItemElement,
  horizontal: boolean,
) => {
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

export interface VirtualItem<TItemElement> extends Item {
  measureRef: (el: TItemElement | null) => void
}

//

export const measureHtmlElement = (el: HTMLElement, instance: Virtual<any>) => {
  return el[instance.options.horizontal ? 'offsetWidth' : 'offsetHeight']
}

export interface UseVirtualOptions<TScrollElement, TItemElement>
  extends PartialKeys<
    VirtualOptions<TItemElement>,
    | 'size'
    | 'start'
    | 'end'
    | 'offset'
    | 'onOffsetChange'
    | 'onUpdate'
    | 'outerSize'
    | 'scrollToFn'
  > {
  scrollElement: TScrollElement
}

export function useVirtual<TScrollElement, TItem = unknown>(
  opts: UseVirtualOptions<TScrollElement, TItem>,
): Virtual<TItem> {
  const resolvedOptions: VirtualOptions<TItem> = {
    ...opts,
    size: 0,
    outerSize: 0,
    start: 0,
    end: 0,
    offset: 0,
    onOffsetChange: () => {},
    onUpdate: () => {},
    measureSize: opts.measureSize || defaultMeasureSize,
  }

  // Create a new instance and store it in state
  const [instance] = React.useState(() => new Virtual<TItem>(resolvedOptions))

  // Keep the options up to date
  instance.setOptions(resolvedOptions)

  const sizeKey = opts.horizontal ? 'width' : 'height'
  const scrollKey = opts.horizontal ? 'scrollLeft' : 'scrollTop'

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

  // const { start, end } = calculateRange(latestRef.current)

  return instance
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

function RowVirtualizerDynamic({ rows }) {
  const scrollRef = React.useRef<HTMLDivElement>(null)

  const rowVirtualizer = useVirtual({
    count: rows.length,
    scrollElement: scrollRef.current,
    measureSize: measureHtmlElement,
  })

  return (
    <>
      <div
        ref={scrollRef}
        className="List"
        style={{
          height: `200px`,
          width: `400px`,
          overflow: 'auto',
        }}
      >
        <div
          style={{
            height: rowVirtualizer.getTotalSize(),
            width: '100%',
            position: 'relative',
          }}
        >
          {rowVirtualizer.getVirtualItems().map((virtualRow) => (
            <div
              key={virtualRow.index}
              ref={(el) => virtualRow.measureElement(el)}
              className={virtualRow.index % 2 ? 'ListItemOdd' : 'ListItemEven'}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              <div style={{ height: rows[virtualRow.index] }}>
                Row {virtualRow.index}
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
// {
//   virtualItems: VirtualItem<TItemElement>[]
//   totalSize: number
//   scrollToOffset: (offset: number, options?: ScrollToOffsetOptions) => void
//   scrollToIndex: (index: number, options?: ScrollToIndexOptions) => void
//   measure: (index: number) => void
// }
