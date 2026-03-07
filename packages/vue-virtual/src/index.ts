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
  computed,
  onScopeDispose,
  shallowRef,
  triggerRef,
  unref,
  watch,
} from 'vue'
import type { Key, PartialKeys, VirtualizerOptions } from '@tanstack/virtual-core'
import type { Ref } from 'vue'

export * from '@tanstack/virtual-core'

type MaybeRef<T> = T | Ref<T>

function useVirtualizerBase<
  TScrollElement extends Element | Window,
  TItemElement extends Element,
  TKey extends Key = Key,
>(
  options: MaybeRef<VirtualizerOptions<TScrollElement, TItemElement, TKey>>,
): Ref<Virtualizer<TScrollElement, TItemElement, TKey>> {
  const virtualizer = new Virtualizer(unref(options))
  const state = shallowRef(virtualizer)

  const cleanup = virtualizer._didMount()

  watch(
    () => unref(options).getScrollElement(),
    (el) => {
      if (el) {
        virtualizer._willUpdate()
      }
    },
    {
      immediate: true,
    },
  )

  watch(
    () => unref(options),
    (options) => {
      virtualizer.setOptions({
        ...options,
        onChange: (instance, sync) => {
          triggerRef(state)
          options.onChange?.(instance, sync)
        },
      })

      virtualizer._willUpdate()
      triggerRef(state)
    },
    {
      immediate: true,
    },
  )

  onScopeDispose(cleanup)

  return state
}

export function useVirtualizer<
  TScrollElement extends Element,
  TItemElement extends Element,
  TKey extends Key = Key,
>(
  options: MaybeRef<
    PartialKeys<
      VirtualizerOptions<TScrollElement, TItemElement, TKey>,
      'observeElementRect' | 'observeElementOffset' | 'scrollToFn'
    >
  >,
): Ref<Virtualizer<TScrollElement, TItemElement, TKey>> {
  return useVirtualizerBase<TScrollElement, TItemElement, TKey>(
    computed(() => ({
      observeElementRect: observeElementRect,
      observeElementOffset: observeElementOffset,
      scrollToFn: elementScroll,
      ...unref(options),
    })),
  )
}

export function useWindowVirtualizer<
  TItemElement extends Element,
  TKey extends Key = Key,
>(
  options: MaybeRef<
    PartialKeys<
      VirtualizerOptions<Window, TItemElement, TKey>,
      | 'observeElementRect'
      | 'observeElementOffset'
      | 'scrollToFn'
      | 'getScrollElement'
    >
  >,
): Ref<Virtualizer<Window, TItemElement, TKey>> {
  return useVirtualizerBase<Window, TItemElement, TKey>(
    computed(() => ({
      getScrollElement: () => (typeof document !== 'undefined' ? window : null),
      observeElementRect: observeWindowRect,
      observeElementOffset: observeWindowOffset,
      scrollToFn: windowScroll,
      initialOffset: () =>
        typeof document !== 'undefined' ? window.scrollY : 0,
      ...unref(options),
    })),
  )
}
