import {
  DestroyRef,
  afterNextRender,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core'
import {
  Virtualizer,
  elementScroll,
  observeElementOffset,
  observeElementRect,
  observeWindowOffset,
  observeWindowRect,
  windowScroll,
} from '@tanstack/virtual-core'
import { proxyVirtualizer } from './proxy'
import type { ElementRef, Signal } from '@angular/core'
import type { PartialKeys, VirtualizerOptions } from '@tanstack/virtual-core'
import type { AngularVirtualizer } from './types'

export * from '@tanstack/virtual-core'
export * from './types'

function createVirtualizerBase<
  TScrollElement extends Element | Window,
  TItemElement extends Element,
>(
  options: Signal<VirtualizerOptions<TScrollElement, TItemElement>>,
): AngularVirtualizer<TScrollElement, TItemElement> {
  let virtualizer: Virtualizer<TScrollElement, TItemElement>
  function lazyInit() {
    virtualizer ??= new Virtualizer(options())
    return virtualizer
  }

  const virtualizerSignal = signal(virtualizer!, { equal: () => false })

  // two-way sync options
  effect(
    () => {
      const _options = options()
      lazyInit()
      virtualizerSignal.set(virtualizer)
      virtualizer.setOptions({
        ..._options,
        onChange: (instance, sync) => {
          // update virtualizerSignal so that dependent computeds recompute.
          virtualizerSignal.set(instance)
          _options.onChange?.(instance, sync)
        },
      })
      // update virtualizerSignal so that dependent computeds recompute.
      virtualizerSignal.set(virtualizer)
    },
    { allowSignalWrites: true },
  )

  const scrollElement = computed(() => options().getScrollElement())
  // let the virtualizer know when the scroll element is changed
  effect(
    () => {
      const el = scrollElement()
      if (el) {
        untracked(virtualizerSignal)._willUpdate()
      }
    },
    { allowSignalWrites: true },
  )

  let cleanup: () => void | undefined
  afterNextRender({ read: () => (virtualizer ?? lazyInit())._didMount() })

  inject(DestroyRef).onDestroy(() => cleanup?.())

  return proxyVirtualizer(virtualizerSignal, lazyInit)
}

export function injectVirtualizer<
  TScrollElement extends Element,
  TItemElement extends Element,
>(
  options: () => PartialKeys<
    Omit<VirtualizerOptions<TScrollElement, TItemElement>, 'getScrollElement'>,
    'observeElementRect' | 'observeElementOffset' | 'scrollToFn'
  > & {
    scrollElement: ElementRef<TScrollElement> | TScrollElement | undefined
  },
): AngularVirtualizer<TScrollElement, TItemElement> {
  const resolvedOptions = computed(() => {
    return {
      observeElementRect: observeElementRect,
      observeElementOffset: observeElementOffset,
      scrollToFn: elementScroll,
      getScrollElement: () => {
        const elementOrRef = options().scrollElement
        return (
          (isElementRef(elementOrRef)
            ? elementOrRef.nativeElement
            : elementOrRef) ?? null
        )
      },
      ...options(),
    }
  })
  return createVirtualizerBase<TScrollElement, TItemElement>(resolvedOptions)
}

function isElementRef<T extends Element>(
  elementOrRef: ElementRef<T> | T | undefined,
): elementOrRef is ElementRef<T> {
  return elementOrRef != null && 'nativeElement' in elementOrRef
}

export function injectWindowVirtualizer<TItemElement extends Element>(
  options: () => PartialKeys<
    VirtualizerOptions<Window, TItemElement>,
    | 'getScrollElement'
    | 'observeElementRect'
    | 'observeElementOffset'
    | 'scrollToFn'
  >,
): AngularVirtualizer<Window, TItemElement> {
  const resolvedOptions = computed(() => {
    return {
      getScrollElement: () => (typeof document !== 'undefined' ? window : null),
      observeElementRect: observeWindowRect,
      observeElementOffset: observeWindowOffset,
      scrollToFn: windowScroll,
      initialOffset: () =>
        typeof document !== 'undefined' ? window.scrollY : 0,
      ...options(),
    }
  })
  return createVirtualizerBase<Window, TItemElement>(resolvedOptions)
}
