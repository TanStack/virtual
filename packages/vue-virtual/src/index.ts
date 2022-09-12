import {
  elementScroll,
  observeElementOffset,
  observeElementRect,
  observeWindowOffset,
  observeWindowRect,
  Virtualizer,
  windowScroll,
  type PartialKeys,
  type VirtualizerOptions,
} from '@tanstack/virtual-core'
import {
  computed,
  nextTick,
  shallowRef,
  triggerRef,
  unref,
  watchEffect,
  type Ref,
} from 'vue'

type MaybeRef<T> = T | Ref<T>

function useVirtualizerBase<TScrollElement, TItemElement = unknown>(
  options: MaybeRef<VirtualizerOptions<TScrollElement, TItemElement>>,
): Ref<Virtualizer<TScrollElement, TItemElement>> {
  const virtualizer = new Virtualizer(unref(options))
  const state = shallowRef(virtualizer)

  watchEffect((onCleanup) => {
    const opts = unref(options)

    // If those functions use refs, we need to track them.
    opts.getScrollElement()
    opts.estimateSize(0)

    // We don't want to track state here
    nextTick(() => {
      virtualizer.setOptions({
        ...opts,
        onChange: (instance: Virtualizer<TScrollElement, TItemElement>) => {
          // Force an update event
          triggerRef(state)
          opts.onChange?.(instance)
        },
      })

      virtualizer._willUpdate()
    })

    onCleanup(virtualizer._didMount())
  })

  return state
}

export function useVirtualizer<TScrollElement, TItemElement = unknown>(
  options: MaybeRef<
    PartialKeys<
      VirtualizerOptions<TScrollElement, TItemElement>,
      'observeElementRect' | 'observeElementOffset' | 'scrollToFn'
    >
  >,
): Ref<Virtualizer<TScrollElement, TItemElement>> {
  return useVirtualizerBase<TScrollElement, TItemElement>(
    computed(() => ({
      observeElementRect: observeElementRect,
      observeElementOffset: observeElementOffset,
      scrollToFn: elementScroll,
      ...unref(options),
    })),
  )
}

export function useWindowVirtualizer<TItemElement = unknown>(
  options: MaybeRef<
    PartialKeys<
      VirtualizerOptions<Window, TItemElement>,
      | 'observeElementRect'
      | 'observeElementOffset'
      | 'scrollToFn'
      | 'getScrollElement'
    >
  >,
): Ref<Virtualizer<Window, TItemElement>> {
  return useVirtualizerBase<Window, TItemElement>(
    computed(() => ({
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      getScrollElement: () => (typeof Window !== 'undefined' ? window : null!),
      observeElementRect: observeWindowRect,
      observeElementOffset: observeWindowOffset,
      scrollToFn: windowScroll,
      ...unref(options),
    })),
  )
}
