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
  shallowRef,
  triggerRef,
  unref,
  watch,
  type Ref,
} from 'vue'

type MaybeRef<T> = T | Ref<T>

function useVirtualizerBase<TScrollElement, TItemElement = unknown>(
  options: MaybeRef<VirtualizerOptions<TScrollElement, TItemElement>>,
): Ref<Virtualizer<TScrollElement, TItemElement>> {
  const opts = unref(options)
  const virtualizer = new Virtualizer(opts)
  const state = shallowRef(virtualizer)

  const applyOptions = (() => {
    let doClean: (() => void) | undefined
    return (options: VirtualizerOptions<TScrollElement, TItemElement>) => {
      doClean?.()
      virtualizer.setOptions({
        ...options,
        onChange: (instance) => {
          // Force an update event
          triggerRef(state)
          options.onChange?.(instance)
        }
      })

      virtualizer._willUpdate()
      doClean = virtualizer._didMount()
    }
  })()

  applyOptions(opts);
  watch(
    () => {
      const opts = unref(options)
      // If those functions use refs, we need to track them.
      opts.getScrollElement()
      opts.estimateSize(0)
      return opts
    },
    applyOptions,
    {
      flush: "pre"
    }
  )

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
