---
title: Vue Virtual (Coming Soon)
---

> ⚠️ This module has not yet been developed. It requires an adapter similiar to `@tanstack/react-virtual` to work. We estimate the amount of code to do this is very minimal, but does require familiarity with the Vue framework. If you would like to contribute this adapter, please open a PR!

The `@tanstack/vue-virtual` adapter is a wrapper around the core virtual logic.

## `useVirtualizer`

```tsx
function useVirtualizer<TScrollElement, TItemElement = unknown>(
  options: PartialKeys<
    VirtualizerOptions<TScrollElement, TItemElement>,
    'observeElementRect' | 'observeElementOffset' | 'scrollToFn'
  >,
): Virtualizer<TScrollElement, TItemElement>
```

This function returns a standard `Virtualizer` instance configured to work with an HTML element as the scrollElement.

## `useWindowVirtualizer`

```tsx
function useWindowVirtualizer<TItemElement = unknown>(
  options: PartialKeys<
    VirtualizerOptions<Window, TItemElement>,
    | 'getScrollElement'
    | 'observeElementRect'
    | 'observeElementOffset'
    | 'scrollToFn'
  >,
): Virtualizer<Window, TItemElement>
```

This function returns a window-based `Virtualizer` instance configured to work with the window as the scrollElement.
