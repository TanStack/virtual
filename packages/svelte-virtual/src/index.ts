import {
  elementScroll,
  observeElementOffset,
  observeElementRect,
  observeWindowOffset,
  observeWindowRect,
  PartialKeys,
  Virtualizer,
  VirtualizerOptions,
  windowScroll,
} from '@tanstack/virtual-core'
export * from '@tanstack/virtual-core'

import { readable, Readable } from 'svelte/store'

function createVirtualizerBase<TScrollElement, TItemElement extends Element>(
  options: VirtualizerOptions<TScrollElement, TItemElement>,
): Readable<Virtualizer<TScrollElement, TItemElement>> {
  const virtualizer = new Virtualizer(options)

  return readable(virtualizer, (set) => {
    const cleanup = virtualizer._didMount()
    virtualizer._willUpdate()
    virtualizer.setOptions({
      ...options,
      onChange: (instance: Virtualizer<TScrollElement, TItemElement>) => {
        set(instance)
        options.onChange?.(instance)
      },
    })

    return () => cleanup()
  })
}

export function createVirtualizer<TScrollElement, TItemElement extends Element>(
  options: PartialKeys<
    VirtualizerOptions<TScrollElement, TItemElement>,
    'observeElementRect' | 'observeElementOffset' | 'scrollToFn'
  >,
): Readable<Virtualizer<TScrollElement, TItemElement>> {
  return createVirtualizerBase<TScrollElement, TItemElement>({
    observeElementRect: observeElementRect,
    observeElementOffset: observeElementOffset,
    scrollToFn: elementScroll,
    ...options,
  })
}

export function createWindowVirtualizer<TItemElement extends Element>(
  options: PartialKeys<
    VirtualizerOptions<Window, TItemElement>,
    | 'getScrollElement'
    | 'observeElementRect'
    | 'observeElementOffset'
    | 'scrollToFn'
  >,
): Readable<Virtualizer<Window, TItemElement>> {
  return createVirtualizerBase<Window, TItemElement>({
    getScrollElement: () => (typeof window !== 'undefined' ? window : null!),
    observeElementRect: observeWindowRect,
    observeElementOffset: observeWindowOffset,
    scrollToFn: windowScroll,
    ...options,
  })
}
