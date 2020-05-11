import React from 'react'

import observeRect from '@reach/observe-rect'

import useIsomorphicLayoutEffect from './useIsomorphicLayoutEffect'

export default function useRect(nodeRef) {
  const [element, setElement] = React.useState(nodeRef.current)
  const [rect, setRect] = React.useState(null)
  const initialRectSet = React.useRef(false)

  useIsomorphicLayoutEffect(() => {
    if (nodeRef.current !== element) {
      setElement(nodeRef.current)
    }
  })

  useIsomorphicLayoutEffect(() => {
    if (element && !initialRectSet.current) {
      initialRectSet.current = true
      setRect(element.getBoundingClientRect())
    }
  }, [element])

  React.useEffect(() => {
    if (!element) {
      return
    }

    const observer = observeRect(element, setRect)

    observer.observe()

    return () => {
      observer.unobserve()
    }
  }, [element])

  return rect
}
