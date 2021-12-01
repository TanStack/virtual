type ScrollAlignment = 'start' | 'center' | 'end' | 'auto'

interface ScrollToOptions {
  align: ScrollAlignment
}

interface ScrollToOffsetOptions extends ScrollToOptions {}
interface ScrollToIndexOptions extends ScrollToOptions {}

type Key = number | string

export type VirtualItem = {
  key: Key
  index: number
  start: number
  end: number
  size: number
  measureRef: (el: HTMLElement | null) => void
}

export interface Range {
  start: number
  end: number
  overscan: number
  size: number
}

declare function defaultRangeExtractor(range: Range): number[]

interface Rect {
  width: number
  height: number
}

interface ScrollOptions<T> {
  parentRef: React.RefObject<T>
  windowRef?: React.RefObject<Window>
  horizontal?: boolean
  useObserver?: (ref: React.RefObject<T>, initialRect?: Rect) => Rect
  useWindowObserver?: (ref: React.RefObject<Window>, initialRect?: Rect) => Rect
  initialRect?: Rect
}

declare function useDefaultScroll<T>(
  options: ScrollOptions<T>
): {
  outerSize: number
  scrollOffset: number
  scrollToFn: (offset: number, reason: ScrollReason) => void
}

type ScrollReason = 'ToIndex' | 'ToOffset' | 'SizeChanged'

export interface Options<T> extends ScrollOptions<T> {
  size: number
  estimateSize?: (index: number) => number
  overscan?: number
  scrollToFn?: (
    offset: number,
    defaultScrollToFn?: (offset: number) => void
  ) => void
  paddingStart?: number
  paddingEnd?: number
  keyExtractor?: (index: number) => Key
  rangeExtractor?: (range: Range) => number[]
  useScroll?: typeof useDefaultScroll
}

declare function useVirtual<T>(
  options: Options<T>
): {
  virtualItems: VirtualItem[]
  totalSize: number
  scrollToOffset: (index: number, options?: ScrollToOffsetOptions) => void
  scrollToIndex: (index: number, options?: ScrollToIndexOptions) => void
  measure: () => void
}

export { defaultRangeExtractor, useVirtual, useDefaultScroll }
