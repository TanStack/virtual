---
title: Lit Virtual
---

The `@tanstack/lit-virtual` adapter is a wrapper around the core virtual logic.

## `createVirtualizer`

```tsx

private virtualizerController = new VirtualizerController<TScrollElement, TItemElement = unknown>(
    options: PartialKeys< VirtualizerOptions<TScrollElement, TItemElement>,
    'observeElementRect' | 'observeElementOffset' | 'scrollToFn'
)
```

This class stands for a standard `Virtualizer` instance configured to work with an HTML element as the scrollElement.
This will create a Lit Controller which can be accessed in the element render method.

```tsx
render() {
    const virtualizer = this.virtualizerController.getVirtualizer();
    const virtualItems = virtualizer.getVirtualItems();
} 
)
```

## `createWindowVirtualizer`

```tsx
private windowVirtualizerController = new WindowVirtualizerController<TItemElement = unknown>(
    options: PartialKeys< VirtualizerOptions<TItemElement>,
    'getScrollElement' | 'observeElementRect' | 'observeElementOffset' | 'scrollToFn'
```

This class stands of window-based `Virtualizer` instance configured to work with an HTML element as the scrollElement.

## Updating options

The controller reads options once, in its constructor. When a reactive property changes, pass the new values to `setOptions` from `willUpdate` (before render). `VirtualizerController` and `WindowVirtualizerController` both implement it.

`setOptions` merges that partial over the options the controller already holds, including its defaults, and keeps the `onChange` wrapper that re-renders the host. Keys set to `undefined` are ignored, so a partial update does not erase an option from an earlier call.

```ts
@property({ type: Number })
count = 1000

private virtualizerController = new VirtualizerController(this, {
  getScrollElement: () => this.scrollElementRef.value,
  count: this.count,
  estimateSize: () => 35,
})

protected willUpdate(changed: PropertyValues<this>) {
  if (changed.has('count')) {
    this.virtualizerController.setOptions({ count: this.count })
  }
}
```

Call `setOptions` on the controller. `getVirtualizer().setOptions(...)` replaces options wholesale, drops the host `onChange` wrapper, and leaves the controller's stored options stale.
