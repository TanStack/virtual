import * as React from 'react'
import { flushSync } from 'react-dom'
import {
  Virtualizer,
  elementScroll,
  observeElementOffset,
  observeElementRect,
  observeWindowOffset,
  observeWindowRect,
  windowScroll,
} from '@tanstack/virtual-core'
import type { Key, PartialKeys, VirtualizerOptions } from '@tanstack/virtual-core'

export * from '@tanstack/virtual-core'

const useIsomorphicLayoutEffect =
  typeof document !== 'undefined' ? React.useLayoutEffect : React.useEffect

export type ReactVirtualizerOptions<
  TScrollElement extends Element | Window,
  TItemElement extends Element,
  TKey extends Key = Key,
> = VirtualizerOptions<TScrollElement, TItemElement, TKey> & {
  useFlushSync?: boolean
}

function useVirtualizerBase<
  TScrollElement extends Element | Window,
  TItemElement extends Element,
  TKey extends Key = Key,
>({
  useFlushSync = true,
  ...options
}: ReactVirtualizerOptions<TScrollElement, TItemElement, TKey>): Virtualizer<
  TScrollElement,
  TItemElement,
  TKey
> {
  const rerender = React.useReducer(() => ({}), {})[1]

  const resolvedOptions: VirtualizerOptions<TScrollElement, TItemElement, TKey> = {
    ...options,
    onChange: (instance, sync) => {
      if (useFlushSync && sync) {
        flushSync(rerender)
      } else {
        rerender()
      }
      options.onChange?.(instance, sync)
    },
  }

  const [instance] = React.useState(
    () => new Virtualizer<TScrollElement, TItemElement, TKey>(resolvedOptions),
  )

  instance.setOptions(resolvedOptions)

  useIsomorphicLayoutEffect(() => {
    return instance._didMount()
  }, [])

  useIsomorphicLayoutEffect(() => {
    return instance._willUpdate()
  })

  return instance
}

export function useVirtualizer<
  TScrollElement extends Element,
  TItemElement extends Element,
  TKey extends Key = Key,
>(
  options: PartialKeys<
    ReactVirtualizerOptions<TScrollElement, TItemElement, TKey>,
    'observeElementRect' | 'observeElementOffset' | 'scrollToFn'
  >,
): Virtualizer<TScrollElement, TItemElement, TKey> {
  return useVirtualizerBase<TScrollElement, TItemElement, TKey>({
    observeElementRect: observeElementRect,
    observeElementOffset: observeElementOffset,
    scrollToFn: elementScroll,
    ...options,
  })
}

export function useWindowVirtualizer<
  TItemElement extends Element,
  TKey extends Key = Key,
>(
  options: PartialKeys<
    ReactVirtualizerOptions<Window, TItemElement, TKey>,
    | 'getScrollElement'
    | 'observeElementRect'
    | 'observeElementOffset'
    | 'scrollToFn'
  >,
): Virtualizer<Window, TItemElement, TKey> {
  return useVirtualizerBase<Window, TItemElement, TKey>({
    getScrollElement: () => (typeof document !== 'undefined' ? window : null),
    observeElementRect: observeWindowRect,
    observeElementOffset: observeWindowOffset,
    scrollToFn: windowScroll,
    initialOffset: () => (typeof document !== 'undefined' ? window.scrollY : 0),
    ...options,
  })
}
