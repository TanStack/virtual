import * as React from 'react'
import observeRect from '@reach/observe-rect'

export interface Rect {
  width: number
  height: number
}

export const useRect = <T extends HTMLElement>(
  ref: React.RefObject<T> | React.RefObject<Window>,
  initialRect: Rect = { width: 0, height: 0 },
) => {
  const [rect, setRect] = React.useState<Rect>(initialRect)

  const updateRect = React.useCallback((next: Rect) => {
    setRect((prev) =>
      prev.height !== next.height || prev.width !== next.width ? next : prev,
    )
  }, [])

  React.useEffect(() => {
    const element =
      ref.current && 'getBoundingClientRect' in ref.current ? ref.current : null

    if (!element) {
      return
    }

    const observer = observeRect(element, updateRect)

    observer.observe()

    updateRect(element.getBoundingClientRect())

    return () => {
      observer.unobserve()
    }
  }, [ref, updateRect])

  React.useEffect(() => {
    const window =
      ref.current && !('getBoundingClientRect' in ref.current)
        ? ref.current
        : null

    if (!window) {
      return
    }

    function resizeHandler() {
      if (!window) {
        return
      }

      updateRect({
        width: window.innerWidth,
        height: window.innerHeight,
      })
    }
    resizeHandler()

    window.addEventListener('resize', resizeHandler)

    return () => {
      window.removeEventListener('resize', resizeHandler)
    }
  }, [ref, updateRect])

  return rect
}
