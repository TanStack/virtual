import {
  Virtualizer,
  elementScroll,
  observeElementOffset,
  observeElementRect,
  observeWindowOffset,
  observeWindowRect,
  windowScroll,
} from '@tanstack/virtual-core'

import {
  createComputed,
  createSignal,
  mergeProps,
  onCleanup,
  onMount,
} from 'solid-js'
import { createStore, reconcile } from 'solid-js/store'
import type {
  Key,
  PartialKeys,
  VirtualizerInputOptions,
  VirtualizerOptions,
} from '@tanstack/virtual-core'

export * from '@tanstack/virtual-core'

function createVirtualizerBase<
  TScrollElement extends Element | Window,
  TItemElement extends Element,
  TKey extends Key = Key,
>(
  options: VirtualizerOptions<TScrollElement, TItemElement, TKey>,
): Virtualizer<TScrollElement, TItemElement, TKey> {
  const resolvedOptions: VirtualizerOptions<TScrollElement, TItemElement, TKey> =
    mergeProps(options)

  const instance = new Virtualizer<TScrollElement, TItemElement, TKey>(
    resolvedOptions as VirtualizerInputOptions<TScrollElement, TItemElement, TKey>,
  )

  const [virtualItems, setVirtualItems] = createStore(
    instance.getVirtualItems(),
  )
  const [totalSize, setTotalSize] = createSignal(instance.getTotalSize())

  const handler = {
    get(
      target: Virtualizer<TScrollElement, TItemElement, TKey>,
      prop: keyof Virtualizer<TScrollElement, TItemElement, TKey>,
    ) {
      switch (prop) {
        case 'getVirtualItems':
          return () => virtualItems
        case 'getTotalSize':
          return () => totalSize()
        default:
          return Reflect.get(target, prop)
      }
    },
  }

  const virtualizer = new Proxy(instance, handler)
  virtualizer.setOptions(resolvedOptions)

  onMount(() => {
    const cleanup = virtualizer._didMount()
    virtualizer._willUpdate()
    onCleanup(cleanup)
  })

  createComputed(() => {
    virtualizer.setOptions(
      mergeProps(resolvedOptions, options, {
        onChange: (
          instance: Virtualizer<TScrollElement, TItemElement, TKey>,
          sync: boolean,
        ) => {
          instance._willUpdate()
          setVirtualItems(
            reconcile(instance.getVirtualItems(), {
              key: 'index',
            }),
          )
          setTotalSize(instance.getTotalSize())
          options.onChange?.(instance, sync)
        },
      }),
    )
    virtualizer.measure()
  })

  return virtualizer
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
): Virtualizer<TScrollElement, TItemElement, TKey> {
  return createVirtualizerBase<TScrollElement, TItemElement, TKey>(
    mergeProps(
      {
        observeElementRect: observeElementRect,
        observeElementOffset: observeElementOffset,
        scrollToFn: elementScroll,
      },
      options,
    ),
  )
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
): Virtualizer<Window, TItemElement, TKey> {
  return createVirtualizerBase<Window, TItemElement, TKey>(
    mergeProps(
      {
        getScrollElement: () =>
          typeof document !== 'undefined' ? window : null,
        observeElementRect: observeWindowRect,
        observeElementOffset: observeWindowOffset,
        scrollToFn: windowScroll,
        initialOffset: () =>
          typeof document !== 'undefined' ? window.scrollY : 0,
      },
      options,
    ),
  )
}
