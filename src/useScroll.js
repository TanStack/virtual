import React from 'react'

import useIsomorphicLayoutEffect from './useIsomorphicLayoutEffect'

export default function useScroll(nodeRef, onChange) {
  const [element, setElement] = React.useState(nodeRef.current)
  const onChangeRef = React.useRef()
  onChangeRef.current = onChange

  useIsomorphicLayoutEffect(() => {
    if (nodeRef.current !== element) {
      setElement(nodeRef.current)
    }
  })

  useIsomorphicLayoutEffect(() => {
    if (element) {
      onChangeRef.current({
        scrollLeft: element.scrollLeft,
        scrollTop: element.scrollTop,
      })
    }
  }, [element])

  React.useEffect(() => {
    if (!element) {
      return
    }

    const handler = e => {
      onChangeRef.current({
        scrollLeft: e.target.scrollLeft,
        scrollTop: e.target.scrollTop,
      })
    }

    element.addEventListener('scroll', handler, {
      capture: false,
      passive: true,
    })

    return () => {
      element.removeEventListener('scroll', handler)
    }
  }, [element])
}
