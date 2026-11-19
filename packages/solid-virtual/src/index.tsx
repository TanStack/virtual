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

  // Built in a memo, so it waits under `Loading` while an option (such as a
  // `count` from a query) is still loading, instead of throwing. Once built
  // the memo returns it without reading; the options effect below applies
  // later changes.
  let built: Virtualizer<TScrollElement, TItemElement> | undefined
  const core = createMemo(
    () =>
      (built ??= new Virtualizer<TScrollElement, TItemElement>(
        resolvedOptions,
      )),
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
      return core().getVirtualItems()
    },
    [],
    { key: 'index' },
  )
  const totalSize = createMemo(() => {
    version()
    return core().getTotalSize()
  })

  const sync = () => setVersion(0)

  // Once built the virtualizer is read directly, so `ref={v.measureElement}`
  // and other reads in a component body stay plain; before that a read goes
  // through the memo and waits like any other pending value.
  const current = () => built ?? core()

  const handler = {
    get(_: object, prop: keyof Virtualizer<TScrollElement, TItemElement>) {
      switch (prop) {
        case 'getVirtualItems':
          return () => virtualItems
        case 'getTotalSize':
          return () => totalSize()
        default:
          return Reflect.get(current(), prop)
      }
    },
    set: (_: object, prop: PropertyKey, value: unknown) =>
      Reflect.set(current(), prop, value),
  }

  const virtualizer = new Proxy({}, handler) as Virtualizer<
    TScrollElement,
    TItemElement
  >

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
