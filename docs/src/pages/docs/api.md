---
id: api
title: API
---

## `useVirtual`

```js
const {
  virtualItems: [
    { key, index, start, size, end, measureRef },
    /* ... */
  ],
  totalSize,
  scrollToIndex,
  scrollToOffset,
} = useVirtual({
  size,
  parentRef,
  estimateSize,
  overscan,
  horizontal,
  scrollToFn,
  useObserver,
})
```

### Options

- `size: Integer`
  - **Required**
  - The total count of elements
- `parentRef: React.useRef(DOMElement)`
  - **Required**
  - The parent element whose inner-content is scrollable
- `estimateSize: Function(index) => Integer`
  - Defaults to `() => 50`
  - **Required**
  - **Must be memoized using `React.useCallback()`**
  - This function receives the index of each item and should return either:
    - A fixed size
    - A variable size per-item
    - A best-guess size (when using dynamic measurement rendering)
  - When this function's memoization changes, the entire list is recalculated
- `overscan: Integer`
  - Defaults to `1`
  - The amount of items to load both behind and ahead of the current window range
- `horizontal: Boolean`
  - Defaults to `false`
  - When `true`, this virtualizer will use `width` and `scrollLeft` instead of `height` and `scrollTop` to determine size and offset of virtualized items.
- `scrollToFn: Function(offset, defaultScrollToFn) => void 0`
  - Optional
  - This function, if passed, is responsible for implementing the scrollTo logic for the parentRef which is used when methods like `scrollToOffset` and `scrollToIndex` are called.
  - Eg. You can use this function to implement smooth scrolling by using the supplied offset and the `defaultScrollToFn` as seen in the sandbox's **Smooth Scroll** example.
- `initialRect: Object({ width: number; height: number })`
  - Optional
  - Defines initial rect size of list. Can be used for server-side rendering
- `useObserver: Function(parentRef: React.useRef(DOMElement), initialRect?: { width: number; height: number }) => ({ width: number; height: number })`
  - Optional
  - This hook, if passed, is responsible for getting `parentRef`'s dimensions
  - Eg. You can use this hook to replace [@reach/observe-rect](https://github.com/reach/observe-rect) that `react-virtual` uses by default with [ResizeObserver API](https://developer.mozilla.org/en-US/docs/Web/API/ResizeObserver)
    - Caution! Depending on your bundling target, you might need to add [resize-observer-polyfill](https://www.npmjs.com/package/resize-observer-polyfill)
- `paddingStart: Integer`
  - Defaults to `0`
  - The amount of padding in pixels to add to the start of the virtual list
- `paddingEnd: Integer`
  - Defaults to `0`
  - The amount of padding in pixels to add to the end of the virtual list
  - `onScrollElement: React.useRef(DOMElement)`
  - Optional
  - Allows using a different element to bind the `onScroll` event to
- `scrollOffsetFn: Function(event?: Event) => number`
  - Optional
  - This function, if passed, is called on scroll to get the scroll offset rather than using `parentRef`'s `width` or `height`
- `keyExtractor: Function(index) => String | Integer`
  - Optional
  - This function receives the index of each item and should return the item's unique ID.
  - This function should be passed whenever dynamic measurement rendering is enabled and the size or order of items in the list changes.
- `rangeExtractor: Function(range: {start: number; end: number; overscan: number; size: number}) => number[]`
  - Optional
  - Defaults to `defaultRangeExtractor`, is exported
  - **Must be memoized using `React.useCallback()`**
  - This function receives visible range parameters and should return array of indexes to render

### Returns

- `virtualItems: Array<item>`
  - `item: Object`
    - `key: String | Integer`
      - The key of the item
      - Defaults to `index`
    - `index: Integer`
      - The index of the item
    - `start: Integer`
      - The starting measurement of the item
      - Most commonly used for positioning elements
    - `size: Integer`
      - The static/variable or, if dynamically rendered, the measured size of the item
    - `end: Integer`
      - The ending measurement of the item
    - `measureRef: React.useRef | Function(el: DOMElement) => void 0`
      - The ref/function to place on the rendered element to enable dynamic measurement rendering
- `totalSize: Integer`
  - The total size of the entire virtualizer
  - When using dynamic measurement refs, this number may change as items are measured after they are rendered.
- `scrollToIndex: Function(index: Integer, { align: String }) => void 0`
  - Call this function to scroll the top/left of the parentRef element to the start of the item located at the passed index.
  - `align: 'start' | 'center' | 'end' | 'auto'`
    - Defaults to `auto`
    - `start` places the item at the top/left of the visible scroll area
    - `center` places the item in the center of the visible scroll area
    - `end` places the item at the bottom/right of the visible scroll area
    - `auto` brings the item into the visible scroll area either at the start or end, depending on which is closer. If the item is already in view, it is placed at the `top/left` of the visible scroll area.
- `scrollToOffset: Function(offsetInPixels: Integer, { align: String }) => void 0`
  - Call this function to scroll the top/left of the parentRef element to the passed pixel offset.
  - `align: 'start' | 'center' | 'end' | 'auto'`
    - Defaults to `start`
    - `start` places the offset at the top/left of the visible scroll area
    - `center` places the offset in the center of the visible scroll area
    - `end` places the offset at the bottom/right of the visible scroll area
    - `auto` brings the offset into the visible scroll area either at the start or end, depending on which is closer. If the offset is already in view, it is placed at the `top/left` of the visible scroll area.
