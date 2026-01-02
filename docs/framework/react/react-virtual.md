---
title: React Virtual
---

The `@tanstack/react-virtual` adapter is a wrapper around the core virtual logic.

## `useVirtualizer`

```tsx
function useVirtualizer<TScrollElement, TItemElement = unknown>(
  options: PartialKeys<
    ReactVirtualizerOptions<TScrollElement, TItemElement>,
    'observeElementRect' | 'observeElementOffset' | 'scrollToFn'
  >,
): Virtualizer<TScrollElement, TItemElement>
```

This function returns a standard `Virtualizer` instance configured to work with an HTML element as the scrollElement.

## `useWindowVirtualizer`

```tsx
function useWindowVirtualizer<TItemElement = unknown>(
  options: PartialKeys<
    ReactVirtualizerOptions<Window, TItemElement>,
    | 'getScrollElement'
    | 'observeElementRect'
    | 'observeElementOffset'
    | 'scrollToFn'
  >,
): Virtualizer<Window, TItemElement>
```

This function returns a window-based `Virtualizer` instance configured to work with the window as the scrollElement.

## React-Specific Options

### `useFlushSync`

```tsx
type ReactVirtualizerOptions<TScrollElement, TItemElement> = 
  VirtualizerOptions<TScrollElement, TItemElement> & {
    useFlushSync?: boolean
  }
```

Both `useVirtualizer` and `useWindowVirtualizer` accept a `useFlushSync` option that controls whether React's `flushSync` is used for synchronous updates.

- **Type**: `boolean`
- **Default**: `true`
- **Description**: When `true`, the virtualizer will use `flushSync` from `react-dom` to ensure synchronous rendering during scroll events. This provides the most accurate scrolling behavior but may impact performance in some scenarios.

#### When to disable `useFlushSync`

You may want to set `useFlushSync: false` in the following scenarios:

- **React 19 compatibility**: In React 19, you may see the following console warning when scrolling:
  ```
  flushSync was called from inside a lifecycle method. React cannot flush when React is already rendering. Consider moving this call to a scheduler task or micro task.
  ```
  Setting `useFlushSync: false` will eliminate this warning by allowing React to batch updates naturally.
- **Performance optimization**: If you experience performance issues with rapid scrolling on lower-end devices
- **Testing environments**: When running tests that don't require synchronous DOM updates
- **Non-critical lists**: When slight visual delays during scrolling are acceptable for better overall performance

#### Example

```tsx
const virtualizer = useVirtualizer({
  count: 10000,
  getScrollElement: () => parentRef.current,
  estimateSize: () => 50,
  useFlushSync: false, // Disable synchronous updates
})
```
