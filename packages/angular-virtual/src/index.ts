import {
  afterRenderEffect,
  computed,
  linkedSignal,
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
import { signalProxy } from './proxy'
import type { ElementRef } from '@angular/core'
import type { PartialKeys, VirtualizerOptions } from '@tanstack/virtual-core'
import type { AngularVirtualizer } from './types'

export * from '@tanstack/virtual-core'
export * from './types'

function createVirtualizerBase<
  TScrollElement extends Element | Window,
  TItemElement extends Element,
>(
  options: () => VirtualizerOptions<TScrollElement, TItemElement>,
) {
  const resolvedOptions = computed<VirtualizerOptions<TScrollElement, TItemElement>>(() => {
    const _options = options()
    return {
      ..._options,
      onChange: (instance, sync) => {
        // Update the main signal to trigger a re-render
        reactiveVirtualizer.set(instance)
        _options.onChange?.(instance, sync)
      },
    }
  })

  const lazyVirtualizer = computed(() => new Virtualizer(untracked(options)))

  const reactiveVirtualizer = linkedSignal(() => {
    const virtualizer = lazyVirtualizer()
    // If setOptions does not call onChange, it's safe to call it here
    virtualizer.setOptions(resolvedOptions())
    return virtualizer
  }, { equal: () => false })

  afterRenderEffect((cleanup) => {
    cleanup(lazyVirtualizer()._didMount())
  })

  afterRenderEffect(() => {
    reactiveVirtualizer()._willUpdate()
  })

  return signalProxy(
    reactiveVirtualizer,
    // Methods that pass through: call on the instance without tracking the signal read
    [
      '_didMount',
      '_willUpdate',
      'calculateRange',
      'getVirtualIndexes',
      'measure',
      'measureElement',
      'resizeItem',
      'scrollBy',
      'scrollToIndex',
      'scrollToOffset',
      'setOptions',
    ],
    // Attributes that will be transformed to signals
    [
      'isScrolling',
      'measurementsCache',
      'options',
      'range',
      'scrollDirection',
      'scrollElement',
      'scrollOffset',
      'scrollRect',
    ],
    // Methods that will be tracked to the virtualizer signal
    [
      'getOffsetForAlignment',
      'getOffsetForIndex',
      'getVirtualItemForOffset',
      'indexFromElement',
    ],
    // Zero-arg methods exposed as computed signals
    [
      'getTotalSize',
      'getVirtualItems'
    ],
    // The rest is passed as is, and can be accessed or called before initialization
  ) as unknown as AngularVirtualizer<TScrollElement, TItemElement>
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
  return createVirtualizerBase<TScrollElement, TItemElement>(() => {
    const _options = options()
    return {
      observeElementRect: observeElementRect,
      observeElementOffset: observeElementOffset,
      scrollToFn: elementScroll,
      getScrollElement: () => {
        const elementOrRef = _options.scrollElement
        return (
          (isElementRef(elementOrRef)
            ? elementOrRef.nativeElement
            : elementOrRef) ?? null
        )
      },
      ..._options,
    }
  })
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
  return createVirtualizerBase<Window, TItemElement>(() => ({
    getScrollElement: () => (typeof document !== 'undefined' ? window : null),
    observeElementRect: observeWindowRect,
    observeElementOffset: observeWindowOffset,
    scrollToFn: windowScroll,
    initialOffset: () =>
      typeof document !== 'undefined' ? window.scrollY : 0,
    ...options(),
  }))
}
