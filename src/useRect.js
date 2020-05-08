import React from 'react'

import observeRect from '@reach/observe-rect'

import useIsomorphicLayoutEffect from './useIsomorphicLayoutEffect'

export default function useRect(nodeRef, observe = true, onChange) {
  const [, rerender] = React.useState()
  const [rect, setRect] = React.useState(null)
  const initialRectSet = React.useRef(false)
  const onChangeRef = React.useRef(null)
  onChangeRef.current = onChange

  const element = nodeRef.current

  useIsomorphicLayoutEffect(() => {
    if (!element) {
      requestAnimationFrame(() => {
        rerender({})
      })
    }

    let observer

    if (element) {
      observer = observeRect(element, function (rect) {
        onChangeRef.current && onChangeRef.current(rect)
        setRect(rect)
      })
    }

    if (element && !initialRectSet.current) {
      initialRectSet.current = true
      setRect(element.getBoundingClientRect())
    }

    observer && observer.observe()

    return () => {
      observer && observer.unobserve()
    }
  }, [element, observe, onChange])
  return rect
}
