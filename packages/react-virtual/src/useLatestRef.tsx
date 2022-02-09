import * as React from 'react'
import { useIsomorphicLayoutEffect } from './useIsomorphicLayoutEffect'

export function useLatestRef<T>(value: T) {
  const ref = React.useRef(value)

  useIsomorphicLayoutEffect(() => {
    ref.current = value
  })

  return ref
}
