import * as React from 'react'
import { Virtual, VirtualOptions } from '@tanstack/virtual-core'
export * from '@tanstack/virtual-core'

//

const useIsomorphicLayoutEffect =
  typeof window !== 'undefined' ? React.useLayoutEffect : React.useEffect

export function useVirtual<TScrollElement, TItemElement = unknown>(
  options: VirtualOptions<TScrollElement, TItemElement>,
): Virtual<TScrollElement, TItemElement> {
  const [instance] = React.useState(
    () => new Virtual<TScrollElement, TItemElement>(options),
  )

  instance.setOptions(options)

  useIsomorphicLayoutEffect(() => {
    return instance._willUpdate()
  })

  return instance
}
