import { expect, test } from 'vitest'
import { Virtualizer, elementScroll, observeElementOffset } from '../src/index'

test.each([
  { horizontal: true, isRtl: true, adjustments: 0 },
  { horizontal: true, isRtl: true, adjustments: 25 },
  { horizontal: true, isRtl: true, adjustments: -25 },
  { horizontal: true, isRtl: false, adjustments: 25 },
  { horizontal: false, isRtl: true, adjustments: 25 },
])(
  'element scrolling preserves logical offsets: %o',
  ({ horizontal, isRtl, adjustments }) => {
    const element = document.createElement('div')
    element.scrollTo = (offsets) => {
      if (typeof offsets === 'object') {
        element.scrollLeft = offsets.left ?? element.scrollLeft
        element.scrollTop = offsets.top ?? element.scrollTop
      }
    }
    const virtualizer = new Virtualizer<HTMLDivElement, HTMLDivElement>({
      horizontal,
      isRtl,
      count: 100,
      getScrollElement: () => element,
      estimateSize: () => 100,
      scrollToFn: elementScroll,
      observeElementRect: () => {},
      observeElementOffset,
    })
    virtualizer.scrollElement = element
    virtualizer.targetWindow = window
    let observedOffset = 0
    const cleanup = observeElementOffset(virtualizer, (offset) => {
      observedOffset = offset
    })
    try {
      elementScroll(100, { adjustments }, virtualizer)
      element.dispatchEvent(new Event('scroll'))
      expect(observedOffset).toBe(100 + adjustments)
    } finally {
      cleanup?.()
    }
  },
)
