# @tanstack/marko-virtual

Marko 6 adapter for [TanStack Virtual](https://tanstack.com/virtual). Provides
row, column, and grid virtualisation via two auto-discovered Marko tags.

## Installation

```sh
npm install @tanstack/marko-virtual
```

Tags are auto-discovered by the Marko compiler — no imports needed in your
`.marko` files. Just use `<virtualizer>` or `<window-virtualizer>` directly.

## Quick start

```marko
<let/mounted = false/>
<script() { mounted = true }/>

<if=mounted>
  <div/$scrollEl style="height: 400px; overflow-y: auto">
    <virtualizer|{ virtualItems, totalSize }|
      count=10000
      estimateSize=() => 35
      getScrollElement=scrollEl
    >
      <div style=`height: ${totalSize}px; position: relative`>
        <for|item| of=virtualItems>
          <div style=`
            position: absolute; top: 0; left: 0; width: 100%;
            height: ${item.size}px;
            transform: translateY(${item.start}px);
          `>
            Row ${item.index}
          </div>
        </for>
      </div>
    </virtualizer>
  </div>
</if>
```

## Tags

### `<virtualizer>`

Element-based virtualisation. Covers:

- **Rows** — default (`horizontal` not set)
- **Columns** — `horizontal=true`
- **Grid** — compose two `<virtualizer>` tags sharing the same scroll element

| Prop | Type | Default | Description |
|---|---|---|---|
| `count` | `number` | required | Number of items |
| `getScrollElement` | `() => Element \| null` | required | Scroll container |
| `estimateSize` | `(index: number) => number` | `() => 50` | Estimated item size in px |
| `overscan` | `number` | `5` | Items to render beyond the visible area |
| `horizontal` | `boolean` | `false` | Virtualise horizontally |
| `paddingStart` | `number` | — | Padding before first item |
| `paddingEnd` | `number` | — | Padding after last item |
| `gap` | `number` | — | Gap between items |
| `lanes` | `number` | `1` | Lanes for masonry layouts |
| `initialOffset` | `number \| (() => number)` | — | Initial scroll offset |

### `<window-virtualizer>`

Window-based virtualisation — the entire page scrolls. Same props as
`<virtualizer>` except `getScrollElement` and `horizontal` are not accepted.

### Tag variable

Both tags expose the same shape via `<tag|{ ... }|>`:

| Property | Type | Description |
|---|---|---|
| `virtualItems` | `VirtualItem[]` | Currently visible items |
| `totalSize` | `number` | Total scrollable size in px |
| `measureElement` | `(el: Element \| null) => void` | For dynamic/variable sizes |
| `scrollToIndex` | `(index: number, options?) => void` | Scroll to item by index |
| `scrollToOffset` | `(offset: number, options?) => void` | Scroll to pixel offset |

## SSR

`<virtualizer>` and `<window-virtualizer>` are client-only — the
`<lifecycle>` tag inside them never runs during SSR. Always wrap in
`<if=mounted>` where `mounted` is set by `<script>`.

## Examples

- [Fixed sizes](https://tanstack.com/virtual/latest/docs/framework/marko/examples/fixed)
- [Variable sizes](https://tanstack.com/virtual/latest/docs/framework/marko/examples/variable)
- [Dynamic sizes](https://tanstack.com/virtual/latest/docs/framework/marko/examples/dynamic)
- [Grid](https://tanstack.com/virtual/latest/docs/framework/marko/examples/grid)
- [Smooth scroll](https://tanstack.com/virtual/latest/docs/framework/marko/examples/smooth-scroll)
- [Infinite scroll](https://tanstack.com/virtual/latest/docs/framework/marko/examples/infinite-scroll)
- [Window](https://tanstack.com/virtual/latest/docs/framework/marko/examples/window)

## License

MIT
