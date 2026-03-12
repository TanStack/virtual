import {
  DestroyRef,
  afterNextRender,
  computed,
  effect,
  inject,
  signal,
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
  const instance = new Virtualizer<TScrollElement, TItemElement>(options())

  const virtualItems = signal(instance.getVirtualItems(), {
    equal: () => false,
  })
  const totalSize = signal(instance.getTotalSize())
  const isScrolling = signal(instance.isScrolling)
  const range = signal(instance.range, { equal: () => false })
  const scrollDirection = signal(instance.scrollDirection)
  const scrollElement = signal(instance.scrollElement)
  const scrollOffset = signal(instance.scrollOffset)
  const scrollRect = signal(instance.scrollRect)

  const handler = {
    get(
      target: Virtualizer<TScrollElement, TItemElement>,
      prop: keyof Virtualizer<TScrollElement, TItemElement>,
    ) {
      switch (prop) {
        case 'getVirtualItems':
          return virtualItems
        case 'getTotalSize':
          return totalSize
        case 'isScrolling':
          return isScrolling
        case 'options':
          return options
        case 'range':
          return range
        case 'scrollDirection':
          return scrollDirection
        case 'scrollElement':
          return scrollElement
        case 'scrollOffset':
          return scrollOffset
        case 'scrollRect':
          return scrollRect
        default:
          return Reflect.get(target, prop)
      }
    },
  }

  const virtualizer = new Proxy(
    instance,
    handler,
  ) as unknown as AngularVirtualizer<TScrollElement, TItemElement>

  effect(
    () => {
      const _options = options()
      instance.setOptions({
        ..._options,
        onChange: (instance, sync) => {
          virtualItems.set(instance.getVirtualItems())
          totalSize.set(instance.getTotalSize())
          isScrolling.set(instance.isScrolling)
          range.set(instance.range)
          scrollDirection.set(instance.scrollDirection)
          scrollElement.set(instance.scrollElement)
          scrollOffset.set(instance.scrollOffset)
          scrollRect.set(instance.scrollRect)
          _options.onChange?.(instance, sync)
        },
      })
      instance._willUpdate()
    },
    { allowSignalWrites: true },
  )

  let cleanup: (() => void) | undefined
  afterNextRender({
    read: () => {
      cleanup = instance._didMount()
    },
  })

  inject(DestroyRef).onDestroy(() => cleanup?.())

  return virtualizer
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
