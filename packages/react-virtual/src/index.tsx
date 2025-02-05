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
import type {
  NotifySource,
  PartialKeys,
  VirtualizerOptions,
} from '@tanstack/virtual-core'

export * from '@tanstack/virtual-core'

const useIsomorphicLayoutEffect =
  typeof document !== 'undefined' ? React.useLayoutEffect : React.useEffect

function useVirtualizerBase<
  TScrollElement extends Element | Window,
  TItemElement extends Element,
>(
  options: VirtualizerOptions<TScrollElement, TItemElement> & {
    _experimental_subscribeToEvents?: boolean | Array<NotifySource>
  },
): Virtualizer<TScrollElement, TItemElement> {
  const rerender = React.useReducer(() => ({}), {})[1]

  const resolvedOptions: VirtualizerOptions<TScrollElement, TItemElement> = {
    ...options,
    onChange: (instance, sync, source) => {
      const subscribeToEvents = options._experimental_subscribeToEvents ?? true

      if (
        subscribeToEvents === false ||
        (Array.isArray(subscribeToEvents) &&
          !subscribeToEvents.includes(source))
      ) {
        return
      }

      if (sync) {
        flushSync(rerender)
      } else {
        rerender()
      }
      options.onChange?.(instance, sync, source)
    },
  }

  const [instance] = React.useState(
    () => new Virtualizer<TScrollElement, TItemElement>(resolvedOptions),
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
>(
  options: PartialKeys<
    VirtualizerOptions<TScrollElement, TItemElement>,
    'observeElementRect' | 'observeElementOffset' | 'scrollToFn'
  >,
): Virtualizer<TScrollElement, TItemElement> {
  return useVirtualizerBase<TScrollElement, TItemElement>({
    observeElementRect: observeElementRect,
    observeElementOffset: observeElementOffset,
    scrollToFn: elementScroll,
    ...options,
  })
}

export function useWindowVirtualizer<TItemElement extends Element>(
  options: PartialKeys<
    VirtualizerOptions<Window, TItemElement>,
    | 'getScrollElement'
    | 'observeElementRect'
    | 'observeElementOffset'
    | 'scrollToFn'
  >,
): Virtualizer<Window, TItemElement> {
  return useVirtualizerBase<Window, TItemElement>({
    getScrollElement: () => (typeof document !== 'undefined' ? window : null),
    observeElementRect: observeWindowRect,
    observeElementOffset: observeWindowOffset,
    scrollToFn: windowScroll,
    initialOffset: () => (typeof document !== 'undefined' ? window.scrollY : 0),
    ...options,
  })
}
