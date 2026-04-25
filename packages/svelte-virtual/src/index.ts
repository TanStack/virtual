import {
  Virtualizer,
  elementScroll,
  observeElementOffset,
  observeElementRect,
  observeWindowOffset,
  observeWindowRect,
  windowScroll,
} from '@tanstack/virtual-core'
import { derived, writable } from 'svelte/store'
import type {
  Key,
  PartialKeys,
  VirtualizerOptions,
} from '@tanstack/virtual-core'
import type { Readable, Writable } from 'svelte/store'

export * from '@tanstack/virtual-core'

export type SvelteVirtualizer<
  TScrollElement extends Element | Window,
  TItemElement extends Element,
  TKey extends Key = Key,
> = Omit<Virtualizer<TScrollElement, TItemElement, TKey>, 'setOptions'> & {
  setOptions: (
    options: Partial<VirtualizerOptions<TScrollElement, TItemElement, TKey>>,
  ) => void
}

function createVirtualizerBase<
  TScrollElement extends Element | Window,
  TItemElement extends Element,
  TKey extends Key = Key,
>(
  initialOptions: VirtualizerOptions<TScrollElement, TItemElement, TKey>,
): Readable<SvelteVirtualizer<TScrollElement, TItemElement, TKey>> {
  const virtualizer = new Virtualizer(initialOptions)
  const originalSetOptions = virtualizer.setOptions

  // eslint-disable-next-line prefer-const
  let virtualizerWritable: Writable<Virtualizer<TScrollElement, TItemElement, TKey>>

  const setOptions = (
    options: Partial<VirtualizerOptions<TScrollElement, TItemElement, TKey>>,
  ) => {
    const resolvedOptions = {
      ...virtualizer.options,
      ...options,
      onChange: options.onChange,
    }
    originalSetOptions({
      ...resolvedOptions,
      onChange: (
        instance: Virtualizer<TScrollElement, TItemElement, TKey>,
        sync: boolean,
      ) => {
        virtualizerWritable.set(instance)
        resolvedOptions.onChange?.(instance, sync)
      },
    })
    virtualizer._willUpdate()
    // Force store update in case the range didn't change (e.g. count increased
    // but scroll position stayed the same). Without this, the store only
    // updates when onChange fires (on range change), so changes like a new
    // count that don't shift the visible range would not trigger a re-render.
    virtualizerWritable.set(virtualizer)
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
  TKey extends Key = Key,
>(
  options: PartialKeys<
    VirtualizerOptions<TScrollElement, TItemElement, TKey>,
    'observeElementRect' | 'observeElementOffset' | 'scrollToFn'
  >,
): Readable<SvelteVirtualizer<TScrollElement, TItemElement, TKey>> {
  return createVirtualizerBase<TScrollElement, TItemElement, TKey>({
    observeElementRect: observeElementRect,
    observeElementOffset: observeElementOffset,
    scrollToFn: elementScroll,
    ...options,
  })
}

export function createWindowVirtualizer<
  TItemElement extends Element,
  TKey extends Key = Key,
>(
  options: PartialKeys<
    VirtualizerOptions<Window, TItemElement, TKey>,
    | 'getScrollElement'
    | 'observeElementRect'
    | 'observeElementOffset'
    | 'scrollToFn'
  >,
): Readable<SvelteVirtualizer<Window, TItemElement, TKey>> {
  return createVirtualizerBase<Window, TItemElement, TKey>({
    getScrollElement: () => (typeof document !== 'undefined' ? window : null),
    observeElementRect: observeWindowRect,
    observeElementOffset: observeWindowOffset,
    scrollToFn: windowScroll,
    initialOffset: () => (typeof document !== 'undefined' ? window.scrollY : 0),
    ...options,
  })
}
