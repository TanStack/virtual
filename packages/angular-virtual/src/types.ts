import type { Signal } from '@angular/core'
import type { Key, Virtualizer } from '@tanstack/virtual-core'

export type AngularVirtualizer<
  TScrollElement extends Element | Window,
  TItemElement extends Element,
  TKey extends Key = Key,
> = Omit<
  Virtualizer<TScrollElement, TItemElement, TKey>,
  | 'getTotalSize'
  | 'getVirtualItems'
  | 'isScrolling'
  | 'options'
  | 'range'
  | 'scrollDirection'
  | 'scrollElement'
  | 'scrollOffset'
  | 'scrollRect'
> & {
  getTotalSize: Signal<
    ReturnType<Virtualizer<TScrollElement, TItemElement, TKey>['getTotalSize']>
  >
  getVirtualItems: Signal<
    ReturnType<Virtualizer<TScrollElement, TItemElement, TKey>['getVirtualItems']>
  >
  isScrolling: Signal<Virtualizer<TScrollElement, TItemElement, TKey>['isScrolling']>
  options: Signal<Virtualizer<TScrollElement, TItemElement, TKey>['options']>
  range: Signal<Virtualizer<TScrollElement, TItemElement, TKey>['range']>
  scrollDirection: Signal<
    Virtualizer<TScrollElement, TItemElement, TKey>['scrollDirection']
  >
  scrollElement: Signal<
    Virtualizer<TScrollElement, TItemElement, TKey>['scrollElement']
  >
  scrollOffset: Signal<
    Virtualizer<TScrollElement, TItemElement, TKey>['scrollOffset']
  >
  scrollRect: Signal<Virtualizer<TScrollElement, TItemElement, TKey>['scrollRect']>
}
