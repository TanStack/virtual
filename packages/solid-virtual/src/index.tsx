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
  createMemo,
  createRenderEffect,
  createSignal,
  createStore,
  merge,
  onSettled,
  untrack,
} from 'solid-js'
import type { PartialKeys, VirtualizerOptions } from '@tanstack/virtual-core'

export * from '@tanstack/virtual-core'

function createVirtualizerBase<
  TScrollElement extends Element | Window,
  TItemElement extends Element,
>(
  options: VirtualizerOptions<TScrollElement, TItemElement>,
): Virtualizer<TScrollElement, TItemElement> {
  const resolvedOptions: VirtualizerOptions<TScrollElement, TItemElement> =
    merge(options)

  // The constructor reads every option once; the options effect below is
  // what tracks them.
  const instance = untrack(
    () => new Virtualizer<TScrollElement, TItemElement>(resolvedOptions),
  )

  // The virtualizer reports changes from scroll and resize observers and from
  // inside the options effect below; each report bumps `version`, which the
  // item projection (reconciled by index) and the total size re-read.
  const [version, setVersion] = createSignal(0, {
    equals: false,
    ownedWrite: true,
  })
  const [virtualItems] = createStore(
    () => {
      version()
      return instance.getVirtualItems()
    },
    [],
    { key: 'index' },
  )
  const totalSize = createMemo(() => {
    version()
    return instance.getTotalSize()
  })

  const sync = () => setVersion(0)

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

  // Reading every option here tracks them; the effect half then applies the
  // snapshot to the core virtualizer.
  createRenderEffect(
    () => ({ ...resolvedOptions }),
    (snapshot) => {
      virtualizer.setOptions({
        ...snapshot,
        onChange: (
          instance: Virtualizer<TScrollElement, TItemElement>,
          isSync: boolean,
        ) => {
          instance._willUpdate()
          sync()
          snapshot.onChange?.(instance, isSync)
        },
      })
      virtualizer._willUpdate()
      sync()
    },
  )

  onSettled(() => {
    const cleanup = virtualizer._didMount()
    virtualizer._willUpdate()
    return cleanup
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
    merge(
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
    merge(
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
