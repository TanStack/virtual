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
    let observer

    if (element) {
      observer = observeRect(element, setRect)
    }

    observer && observer.observe()

    return () => {
      observer && observer.unobserve()
    }
  }, [element])

  return rect
}
