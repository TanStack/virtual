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

import { derived, Readable, writable, Writable } from 'svelte/store'

export type SvelteVirtualizer<
  TScrollElement extends Element | Window,
  TItemElement extends Element,
> = Omit<Virtualizer<TScrollElement, TItemElement>, 'setOptions'> & {
  setOptions: (
    options: Partial<VirtualizerOptions<TScrollElement, TItemElement>>,
  ) => void
}

function createVirtualizerBase<
  TScrollElement extends Element | Window,
  TItemElement extends Element,
>(
  initialOptions: VirtualizerOptions<TScrollElement, TItemElement>,
): Readable<SvelteVirtualizer<TScrollElement, TItemElement>> {
  const virtualizer = new Virtualizer(initialOptions)
  const originalSetOptions = virtualizer.setOptions

  let virtualizerWritable: Writable<Virtualizer<TScrollElement, TItemElement>>

  const setOptions = (
    options: Partial<VirtualizerOptions<TScrollElement, TItemElement>>,
  ) => {
    const resolvedOptions = {
      ...virtualizer.options,
      ...options,
      onChange: options.onChange,
    }
    originalSetOptions({
      ...resolvedOptions,
      onChange: (instance: Virtualizer<TScrollElement, TItemElement>) => {
        virtualizerWritable.set(instance)
        resolvedOptions.onChange?.(instance)
      },
    })
    virtualizer._willUpdate()
  }

  virtualizerWritable = writable(virtualizer, () => {
    setOptions(initialOptions)
    return virtualizer._didMount()
  })

  return derived(virtualizerWritable, (instance) =>
    Object.assign(instance, { setOptions }),
  )
}

export function createVirtualizer<
  TScrollElement extends Element,
  TItemElement extends Element,
>(
  options: PartialKeys<
    VirtualizerOptions<TScrollElement, TItemElement>,
    'observeElementRect' | 'observeElementOffset' | 'scrollToFn'
  >,
): Readable<SvelteVirtualizer<TScrollElement, TItemElement>> {
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
): Readable<SvelteVirtualizer<Window, TItemElement>> {
  return createVirtualizerBase<Window, TItemElement>({
    getScrollElement: () => (typeof document !== 'undefined' ? window : null),
    observeElementRect: observeWindowRect,
    observeElementOffset: observeWindowOffset,
    scrollToFn: windowScroll,
    initialOffset: typeof document !== 'undefined' ? window.scrollY : undefined,
    ...options,
  })
}
