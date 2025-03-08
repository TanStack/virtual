import type { Signal } from '@angular/core'
import type { Virtualizer } from '@tanstack/virtual-core'

export type AngularVirtualizer<
  TScrollElement extends Element | Window,
  TItemElement extends Element,
> = Omit<
  Virtualizer<TScrollElement, TItemElement>,
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
    ReturnType<Virtualizer<TScrollElement, TItemElement>['getTotalSize']>
  >
  getVirtualItems: Signal<
    ReturnType<Virtualizer<TScrollElement, TItemElement>['getVirtualItems']>
  >
  isScrolling: Signal<Virtualizer<TScrollElement, TItemElement>['isScrolling']>
  options: Signal<Virtualizer<TScrollElement, TItemElement>['options']>
  range: Signal<Virtualizer<TScrollElement, TItemElement>['range']>
  scrollDirection: Signal<
    Virtualizer<TScrollElement, TItemElement>['scrollDirection']
  >
  scrollElement: Signal<
    Virtualizer<TScrollElement, TItemElement>['scrollElement']
  >
  scrollOffset: Signal<
    Virtualizer<TScrollElement, TItemElement>['scrollOffset']
  >
  scrollRect: Signal<Virtualizer<TScrollElement, TItemElement>['scrollRect']>
}
