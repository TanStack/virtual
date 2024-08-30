import { computed, untracked } from '@angular/core'
import type { Signal, WritableSignal } from '@angular/core'
import type { Virtualizer } from '@tanstack/virtual-core'
import type { AngularVirtualizer } from './types'

export function proxyVirtualizer<
  V extends Virtualizer<any, any>,
  S extends Element | Window = V extends Virtualizer<infer U, any> ? U : never,
  I extends Element = V extends Virtualizer<any, infer U> ? U : never,
>(
  virtualizerSignal: WritableSignal<V>,
  lazyInit: () => V,
): AngularVirtualizer<S, I> {
  return new Proxy(virtualizerSignal, {
    apply() {
      return virtualizerSignal()
    },
    get(target, property) {
      const untypedTarget = target as any
      if (untypedTarget[property]) {
        return untypedTarget[property]
      }
      let virtualizer = untracked(virtualizerSignal)
      if (virtualizer == null) {
        virtualizer = lazyInit()
        untracked(() => virtualizerSignal.set(virtualizer))
      }

      // Create computed signals for each property that represents a reactive value
      if (
        typeof property === 'string' &&
        [
          'getTotalSize',
          'getVirtualItems',
          'isScrolling',
          'options',
          'range',
          'scrollDirection',
          'scrollElement',
          'scrollOffset',
          'scrollRect',
          'measureElementCache',
          'measurementsCache',
        ].includes(property)
      ) {
        const isFunction =
          typeof virtualizer[property as keyof V] === 'function'
        Object.defineProperty(untypedTarget, property, {
          value: isFunction
            ? computed(() => (target()[property as keyof V] as Function)())
            : computed(() => target()[property as keyof V]),
          configurable: true,
          enumerable: true,
        })
      }

      // Create plain signals for functions that accept arguments and return reactive values
      if (
        typeof property === 'string' &&
        [
          'getOffsetForAlignment',
          'getOffsetForIndex',
          'getVirtualItemForOffset',
          'indexFromElement',
        ].includes(property)
      ) {
        const fn = virtualizer[property as keyof V] as Function
        Object.defineProperty(untypedTarget, property, {
          value: toComputed(virtualizerSignal, fn),
          configurable: true,
          enumerable: true,
        })
      }

      return untypedTarget[property] || virtualizer[property as keyof V]
    },
    has(_, property: string) {
      return !!untracked(virtualizerSignal)[property as keyof V]
    },
    ownKeys() {
      return Reflect.ownKeys(untracked(virtualizerSignal))
    },
    getOwnPropertyDescriptor() {
      return {
        enumerable: true,
        configurable: true,
      }
    },
  }) as unknown as AngularVirtualizer<S, I>
}

function toComputed<V extends Virtualizer<any, any>>(
  signal: Signal<V>,
  fn: Function,
) {
  const computedCache: Record<string, Signal<unknown>> = {}

  return (...args: Array<any>) => {
    // Cache computeds by their arguments to avoid re-creating the computed on each call
    const serializedArgs = serializeArgs(...args)
    if (computedCache.hasOwnProperty(serializedArgs)) {
      return computedCache[serializedArgs]?.()
    }
    const computedSignal = computed(() => {
      void signal()
      return fn(...args)
    })

    computedCache[serializedArgs] = computedSignal

    return computedSignal()
  }
}

function serializeArgs(...args: Array<any>) {
  return JSON.stringify(args)
}
