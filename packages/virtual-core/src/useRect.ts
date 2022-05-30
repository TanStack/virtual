import React from 'react'
import observeRect from '@reach/observe-rect'
import { useIsomorphicLayoutEffect } from './useIsomorphicLayoutEffect'

export interface Rect {
  width: number
  height: number
}

function rectReducer(state: Rect, action: { rect: Rect }) {
  const rect = action.rect
  if (state.height !== rect.height || state.width !== rect.width) {
    return rect
  }
  return state
}

export const useRect = <T extends HTMLElement>(
  nodeRef: React.RefObject<T>,
  initialRect: Rect = { width: 0, height: 0 },
) => {
  const [element, setElement] = React.useState(nodeRef.current)
  const [rect, dispatch] = React.useReducer(rectReducer, initialRect)

  const initialRectSet = React.useRef(false)

  useIsomorphicLayoutEffect(() => {
    if (nodeRef.current !== element) {
      setElement(nodeRef.current)
    }
  })

  useIsomorphicLayoutEffect(() => {
    if (element && !initialRectSet.current) {
      initialRectSet.current = true
      const rect = element.getBoundingClientRect()
      dispatch({ rect })
    }
  }, [element])

  React.useEffect(() => {
    if (!element) {
      return
    }

    const observer = observeRect(element, (rect) => {
      dispatch({ rect })
    })

    observer.observe()

    return () => {
      observer.unobserve()
    }
  }, [element])

  return rect
}
