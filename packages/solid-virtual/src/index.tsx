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
  createEffect,
  createSignal,
  mergeProps,
  onCleanup,
  onMount,
} from 'solid-js'
import { createStore, reconcile } from 'solid-js/store'
import type { PartialKeys, VirtualizerOptions } from '@tanstack/virtual-core'

export * from '@tanstack/virtual-core'

function createVirtualizerBase<
  TScrollElement extends Element | Window,
  TItemElement extends Element,
>(
  options: VirtualizerOptions<TScrollElement, TItemElement>,
): Virtualizer<TScrollElement, TItemElement> {
  const resolvedOptions: VirtualizerOptions<TScrollElement, TItemElement> =
    mergeProps(options)

  const instance = new Virtualizer<TScrollElement, TItemElement>(
    resolvedOptions,
  )

  const [virtualItems, setVirtualItems] = createStore(
    instance.getVirtualItems(),
  )
  const [totalSize, setTotalSize] = createSignal(instance.getTotalSize())

  const handler = {
    get(
      target: Virtualizer<TScrollElement, TItemElement>,
      prop: keyof Virtualizer<TScrollElement, TItemElement>,
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

  onMount(() => {
    const cleanup = virtualizer._didMount()
    onCleanup(cleanup)
  })

  createEffect(() => {
    virtualizer.setOptions(
      mergeProps(resolvedOptions, options, {
        onChange: (
          instance: Virtualizer<TScrollElement, TItemElement>,
          sync: boolean,
        ) => {
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
    setVirtualItems([])
    virtualizer._willUpdate()
    virtualizer.measure()
  })

  return virtualizer
}

export function createVirtualizer<
  TScrollElement extends Element,
  TItemElement extends Element,
>(
  options: PartialKeys<
    VirtualizerOptions<TScrollElement, TItemElement>,
    'observeElementRect' | 'observeElementOffset' | 'scrollToFn'
  >,
): Virtualizer<TScrollElement, TItemElement> {
  return createVirtualizerBase<TScrollElement, TItemElement>(
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

export function createWindowVirtualizer<TItemElement extends Element>(
  options: PartialKeys<
    VirtualizerOptions<Window, TItemElement>,
    | 'getScrollElement'
    | 'observeElementRect'
    | 'observeElementOffset'
    | 'scrollToFn'
  >,
): Virtualizer<Window, TItemElement> {
  return createVirtualizerBase<Window, TItemElement>(
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
