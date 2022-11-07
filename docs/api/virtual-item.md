---
title: VirtualItem
---

The `VirtualItem` object represents a single item returned by the virtualizer. It contains information you need to render the item in the cooredinate space within your virtualizer's scrollElement and other helpful properties/functions.

```tsx
export interface VirtualItem {
  key: string | number
  index: number
  start: number
  end: number
  size: number
}
```

The following properties and methods are available on each VirtualItem object:

### `key`

```tsx
key: string | number
```

The unique key for the item. By default this is the item index, but should be configured via the `getItemKey` Virtualizer option.

### `index`

```tsx
index: number
```

The index of the item.

### `start`

```tsx
start: number
```

The starting pixel offset for the item. This is usually mapped to a css property or transform like `top/left` or `translateX/translateY`.

### `end`

```tsx
end: number
```

The ending pixel offset for the item. This value is not necessary for most layouts, but can be helpful so we've provided it anyway.

### `size`

```tsx
size: number
```

The size of the item. This is usually mapped to a css property like `width/height`. Before an item is measured vit the `VirtualItem.measureElement` method, this will be the estimated size returned from your `estimateSize` virtualizer option. After an item is measured (if you choose to measure it at all), this value will be the number returned by your `measureElement` virtualizer option (which by default is configured to measure elements with `getBoundingClientRect()`).
