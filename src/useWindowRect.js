import * as React from 'react'
import useIsomorphicLayoutEffect from './useIsomorphicLayoutEffect'

export default function useWindowRect(windowRef) {
  const [rect, setRect] = React.useState({ height: undefined, width: undefined })

  const element = windowRef.current

  useIsomorphicLayoutEffect(() => {
    const resizeHandler = () => {
      const next = {
        height: element.innerHeight,
        width: element.innerWidth,
      }
      setRect(prev => (prev.height !== next.height || prev.width !== next.width ? next : prev))
    }
    resizeHandler()

    element.addEventListener('resize', resizeHandler)
    return () => {
      element.removeEventListener('resize', resizeHandler)
    }
  }, [element])

  return rect
}