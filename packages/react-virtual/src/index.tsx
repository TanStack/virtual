import * as React from 'react'
import { useSyncExternalStore as useSyncExternalStoreShim } from 'use-sync-external-store/shim';
import {
  elementScroll,
  observeElementOffset,
  observeElementRect,
  observeWindowOffset,
  observeWindowRect,
  PartialKeys,
  Virtualizer,
  VirtualItem,
  VirtualizerOptions,
  windowScroll,
  ScrollDirection
} from '@tanstack/virtual-core'

const useSyncExternalStore = React.useSyncExternalStore || useSyncExternalStoreShim;

export * from '@tanstack/virtual-core'
export type { VirtualItem, Range, ScrollToOptions, ScrollDirection } from '@tanstack/virtual-core'

type Filter<Obj extends Object, ValueType> = {
  [Key in keyof Obj as Obj[Key] extends ValueType ? Key : never]: Obj[Key]
}

function getObjectFuntions<T extends Object>(
  obj: T,
  exclude: { [key in keyof T]?: true },
) {
  return Object.getOwnPropertyNames(obj).reduce((acc, key) => {
    const typedKey = key as keyof T
    const property = obj[typedKey]
    if (typeof property === 'function' && !exclude[typedKey]) {
      acc[typedKey as keyof Filter<T, Function>] = property.bind(obj)
    }
    return acc
  }, {} as Filter<T, Function>)
}

export type ScrollInfo = {
  isScrolling: boolean;
  scrollOffset: number;
  direction: ScrollDirection | null;
}

export type ReactVirtualizer<
  TScrollElement extends Element | Window,
  TItemElement extends Element,
> = Omit<
  Filter<Virtualizer<TScrollElement, TItemElement>, Function>,
  'getTotalSize' | 'getVirtualItems'
> & {
  totalSize: number
  virtualItems: VirtualItem[]
  getMeasurements: () => Virtualizer<TScrollElement, TItemElement>['measureElementCache']
  getOptions: () => Virtualizer<TScrollElement, TItemElement>['options']
  getScrollInfo: () => ScrollInfo
  setScrollOffset: (offset: number) => void
}

export type ReactVirtualizerOptions<TScrollElement extends Element | Window, TItemElement extends Element> =
  VirtualizerOptions<TScrollElement, TItemElement> & {
    onIsScrollingChange?: (scrollInfo: ScrollInfo) => void
  }

const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? React.useLayoutEffect : React.useEffect

function useVirtualizerBase<
  TScrollElement extends Element | Window,
  TItemElement extends Element,
>(
  options: ReactVirtualizerOptions<TScrollElement, TItemElement>,
): ReactVirtualizer<TScrollElement, TItemElement> {

  const [instance] = React.useState(
    () => new Virtualizer<TScrollElement, TItemElement>(options),
  )

  instance.setOptions(options)

  const lastValue = React.useRef<null | ReactVirtualizer<
    TScrollElement,
    TItemElement
  >>(null)

  const getScrollInfo = React.useCallback(() => ({
    isScrolling: instance.isScrolling,
    scrollOffset: instance.scrollOffset,
    direction: instance.scrollDirection,
  }), [instance]);

  const getValue = React.useCallback(() => {
    const lastItems = lastValue.current?.virtualItems
    const newItems = instance.getVirtualItems()
    const changed = !lastItems || newItems.some((item, index) => item !== lastItems[index])
    if (!changed && lastValue.current) {
      return lastValue.current
    }

    const newValue = {
      ...getObjectFuntions(instance, {
        getTotalSize: true,
        getVirtualItems: true,
      }),
      totalSize: instance.getTotalSize(),
      virtualItems: newItems,
      getMeasurements: () => instance.measureElementCache,
      getOptions: () => instance.options,
      getScrollInfo: getScrollInfo,
      setScrollOffset: (offset: number) => instance.scrollOffset = offset,
    }

    lastValue.current = newValue
    return newValue
  }, [instance, getScrollInfo])

  const instanceState = useSyncExternalStore(
    instance.subscribeToChanges,
    getValue,
  )

  const isScrolling = React.useRef(false);
  React.useEffect(function notifyIsScrolling() {
    const cb = options.onIsScrollingChange;
    if (!cb) return;

    const unsubscribe = instance.subscribeToChanges(() => {
      if (isScrolling.current !== instance.isScrolling) {
        isScrolling.current = instance.isScrolling;
        cb(getScrollInfo())
      }
    });
    return () => {
      unsubscribe();
    }
  }, [instance, options.onIsScrollingChange, getScrollInfo])

  React.useEffect(() => {
    return instance._didMount()
  }, [])

  useIsomorphicLayoutEffect(() => {
    return instance._willUpdate()
  })

  return instanceState
}

export function useVirtualizer<
  TScrollElement extends Element,
  TItemElement extends Element,
>(
  options: PartialKeys<
    ReactVirtualizerOptions<TScrollElement, TItemElement>,
    'observeElementRect' | 'observeElementOffset' | 'scrollToFn'
  >,
): ReactVirtualizer<TScrollElement, TItemElement> {
  return useVirtualizerBase<TScrollElement, TItemElement>({
    observeElementRect: observeElementRect,
    observeElementOffset: observeElementOffset,
    scrollToFn: elementScroll,
    ...options,
  })
}

export function useWindowVirtualizer<TItemElement extends Element>(
  options: PartialKeys<
    ReactVirtualizerOptions<Window, TItemElement>,
    | 'getScrollElement'
    | 'observeElementRect'
    | 'observeElementOffset'
    | 'scrollToFn'
  >,
): ReactVirtualizer<Window, TItemElement> {
  return useVirtualizerBase<Window, TItemElement>({
    getScrollElement: () => (typeof window !== 'undefined' ? window : null!),
    observeElementRect: observeWindowRect,
    observeElementOffset: observeWindowOffset,
    scrollToFn: windowScroll,
    ...options,
  })
}
