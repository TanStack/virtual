export type ScrollAlignment = 'start' | 'center' | 'end' | 'auto'

export interface ScrollToOptions {
  align: ScrollAlignment
}

export interface ScrollToOffsetOptions extends ScrollToOptions {}
export interface ScrollToIndexOptions extends ScrollToOptions {}

export type Key = number | string

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

export interface Rect {
  width: number
  height: number
}

export type Observer<T> = (ref: React.RefObject<T>, initialRect?: Rect) => Rect

export interface ScrollOptions<T> {
  parentRef: React.RefObject<T>
  windowRef?: React.RefObject<Window>
  horizontal?: boolean
  useObserver?: Observer<T>
  useWindowObserver?: Observer<Window>
  initialRect?: Rect
}

export interface Scroller {
  outerSize: number
  scrollOffset: number
  scrollToFn: (offset: number, reason: ScrollReason) => void
}

declare function useDefaultScroll<T>(
  options: ScrollOptions<T>
): Scroller

export type ScrollReason = 'ToIndex' | 'ToOffset' | 'SizeChanged'

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
  useScroll?: Scroller
}

export interface Virtualizer {
  virtualItems: VirtualItem[]
  totalSize: number
  scrollToOffset: (index: number, options?: ScrollToOffsetOptions) => void
  scrollToIndex: (index: number, options?: ScrollToIndexOptions) => void
  measure: () => void
}

declare function useVirtual<T>(
  options: Options<T>
): Virtualizer

export { defaultRangeExtractor, useVirtual, useDefaultScroll }
