---
title: Marko Virtual
---

# Marko Virtual

`@tanstack/marko-virtual` is the Marko 6 adapter for TanStack Virtual. It provides
row, column, and grid virtualisation via two auto-discovered Marko tags:

- **`<virtualizer>`** — element-based scrolling (rows, columns, grids)
- **`<window-virtualizer>`** — full-page/window scrolling

Tags are discovered automatically by the Marko compiler when the package is
installed. No imports are needed in your `.marko` files.

Each tag is used **self-closing** and exposes a **tag variable** (written `<virtualizer/v/>`).
You then own the markup, reading `v.virtualItems` and `v.totalSize` to render the visible rows.

## Installation

```sh
npm install @tanstack/marko-virtual
```

## Row virtualisation

```marko
<div/scrollEl
  style="height: 400px; width: 400px; overflow-y: auto; position: relative;"
>
  <virtualizer/v
    count=10000
    estimateSize=() => 35
    getScrollElement=() => scrollEl()
  />
  <div style=`height: ${v.totalSize}px; width: 100%; position: relative`>
    <for|item| of=v.virtualItems>
      <div
        style=`
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: ${item.size}px;
          transform: translateY(${item.start}px);
        `
      >
        Row ${item.index}
      </div>
    </for>
  </div>
</div>
```

## Column virtualisation

Same tag, `horizontal=true`:

```marko
<div/scrollEl
  style="width: 400px; height: 100px; overflow-x: auto; position: relative;"
>
  <virtualizer/v
    count=10000
    estimateSize=() => 100
    horizontal=true
    getScrollElement=() => scrollEl()
  />
  <div style=`width: ${v.totalSize}px; height: 100%; position: relative`>
    <for|item| of=v.virtualItems>
      <div
        style=`
          position: absolute;
          top: 0;
          left: 0;
          height: 100%;
          width: ${item.size}px;
          transform: translateX(${item.start}px);
        `
      >
        Column ${item.index}
      </div>
    </for>
  </div>
</div>
```

## Grid virtualisation

Compose two `<virtualizer>` tags — one for rows, one for columns — sharing the
same scroll element. Each returns its own tag variable. Pass `getScrollElement` as an
arrow (`() => ref()`) so each virtualizer resolves its own element:

```marko
<div/scrollEl
  style="height: 500px; width: 500px; overflow: auto; position: relative;"
>
  <virtualizer/rowV
    count=10000
    estimateSize=() => 35
    getScrollElement=() => scrollEl()
  />
  <virtualizer/colV
    count=200
    estimateSize=() => 100
    horizontal=true
    getScrollElement=() => scrollEl()
  />
  <div style=`height: ${rowV.totalSize}px; width: ${colV.totalSize}px; position: relative`>
    <for|row| of=rowV.virtualItems>
      <for|col| of=colV.virtualItems>
        <div
          style=`
            position: absolute;
            top: 0;
            left: 0;
            width: ${col.size}px;
            height: ${row.size}px;
            transform: translateX(${col.start}px) translateY(${row.start}px);
          `
        >
          Cell ${row.index}, ${col.index}
        </div>
      </for>
    </for>
  </div>
</div>
```

## Window virtualisation

Use `<window-virtualizer>` when the entire page scrolls rather than a container:

```marko
<window-virtualizer/v
  count=10000
  estimateSize=() => 35
/>
<div style=`height: ${v.totalSize}px; position: relative`>
  <for|item| of=v.virtualItems>
    <div
      style=`
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: ${item.size}px;
        transform: translateY(${item.start}px);
      `
    >
      Row ${item.index}
    </div>
  </for>
</div>
```

## Dynamic / variable item sizes

For items with unknown heights, use `measureElement` as a `<script>`-driven ref
to measure each element after render:

```marko
<div/scrollEl style="height: 400px; overflow-y: auto">
  <virtualizer/v
    count=data.length
    estimateSize=() => 50
    getScrollElement=() => scrollEl()
  />
  <div style=`height: ${v.totalSize}px; position: relative`>
    <for|item| of=v.virtualItems>
      <div/el
        data-index=item.index
        style=`position: absolute; top: 0; width: 100%; transform: translateY(${item.start}px)`>
        <script() {
          // re-run when the item changes; measureElement reads the rendered
          // height and feeds it back to the virtualizer
          const _key = item.key
          if (el() && v.measureElement) v.measureElement(el())
        }/>
        ${data[item.index].text}
      </div>
    </for>
  </div>
</div>
```

## Tag variable reference

Both tags are self-closing and expose the same tag-variable shape. Capture it with
`<virtualizer/v/>` (or any name) and read its properties as `v.property`:

| Property | Type | Description |
|---|---|---|
| `virtualItems` | `VirtualItem[]` | The currently visible virtual items |
| `totalSize` | `number` | Total scrollable size in px — set as the inner container's `height` (or `width` for columns) |
| `range` | `{ startIndex: number; endIndex: number } \| null` | The visible index window (excludes overscan). `null` until there is a window. Useful for deriving things like the active sticky header |
| `measureElement` | `(el: Element \| null) => void` | Ref callback for dynamic item sizing |
| `scrollToIndex` | `(index: number, options?: ScrollToOptions) => void` | Imperatively scroll to an item by index. Default `align: 'auto'` scrolls the MINIMUM: downward jumps land the item at the viewport end, upward jumps align it to the start (below `scrollPaddingStart`), and an already fully visible item does not move. Pass `{ align: 'start' }` to always align to the start |
| `scrollToOffset` | `(offset: number, options?: ScrollToOptions) => void` | Imperatively scroll to a pixel offset |
| `measure` | `() => void` | Drop all measured sizes and re-measure everything (after a width/font change) |
| `resizeItem` | `(index: number, size: number) => void` | Set one item's size directly, without a DOM measure |
| `scrollToEnd` | `(options?: { behavior?: ScrollBehavior }) => void` | Scroll to the very end of the list |
| `isAtEnd` | `(threshold?: number) => boolean` | Whether the scroll position is at (or within `threshold` px of) the end. `false` before mount |
| `getDistanceFromEnd` | `() => number` | Pixels between the current scroll position and the end. `Infinity` before mount |

## `<virtualizer>` input reference

| Prop | Type | Default | Description |
|---|---|---|---|
| `count` | `number` | required | Number of items |
| `getScrollElement` | `() => Element \| null` | required | Returns the scroll container |
| `estimateSize` | `(index: number) => number` | `() => 50` | Estimated item size in px |
| `overscan` | `number` | `5` | Items to render beyond the visible area |
| `horizontal` | `boolean` | `false` | Virtualise horizontally (columns) |
| `paddingStart` | `number` | — | Padding before first item |
| `paddingEnd` | `number` | — | Padding after last item |
| `scrollPaddingStart` | `number` | — | Scroll padding for `scrollToIndex` |
| `scrollPaddingEnd` | `number` | — | Scroll padding for `scrollToIndex` |
| `gap` | `number` | — | Gap between items in px |
| `lanes` | `number` | `1` | Lanes for masonry layouts |
| `initialOffset` | `number \| (() => number)` | — | Scroll offset (px) for the server slice — server-render at a scroll position (deep link / restore). Element only; see [SSR](#ssr) |
| `initialRect` | `{ width: number; height: number }` | — | Viewport hint for a server-rendered slice (SSR). When set, the server paints the initial visible rows; omit for client-only fill. See [SSR](#ssr). |
| `getItemKey` | `(index: number) => number \| string \| bigint` | the index | Stable per-item identity so cached measurements survive reorder |
| `rangeExtractor` | `(range: Range) => number[]` | `defaultRangeExtractor` | Hook over the visible range: force extra indexes (e.g. a pinned sticky header) into the rendered window. Compose with `defaultRangeExtractor` from `@tanstack/virtual-core` |
| `indexAttribute` | `string` | `'data-index'` | DOM attribute carrying the item index for `measureElement`. Give two instances measuring the same element (a grid cell) distinct attributes |
| `initialMeasurementsCache` | `VirtualItem[]` | — | Pre-measured items (plain data) to seed the measurement cache |
| `anchorTo` | `'start' \| 'end'` | `'start'` | Anchor the window to the list end (a chat pinned to newest). Client-behavioral: it does not position the server slice — use `initialOffset` for that |
| `followOnAppend` | `boolean \| ScrollBehavior` | `false` | With `anchorTo="end"`: stay pinned to the end as items append |
| `scrollEndThreshold` | `number` | `1` | How close (px) to the end still counts as "at the end" |
| `scrollMargin` | `number` | `0` | The list's offset (px) from the top of its scroll area, when other content sits above it in the same scroller. `item.start` values then INCLUDE this margin — subtract it when positioning items relative to the list (see the window example) |
| `enabled` | `boolean` | `true` | Disable switch. `false` is not a freeze: the virtualizer unobserves, clears its measurements, and renders an empty window until re-enabled |
| `isRtl` | `boolean` | `false` | Right-to-left horizontal lists |
| `isScrollingResetDelay` | `number` | `150` | ms after the last scroll event before "user is scrolling" ends |
| `useScrollendEvent` | `boolean` | `false` | Use the native `scrollend` event instead of the `isScrollingResetDelay` timer |
| `useAnimationFrameWithResizeObserver` | `boolean` | `false` | Batch ResizeObserver measurements into animation frames (avoids "ResizeObserver loop" console errors under heavy resize load) |
| `laneAssignmentMode` | `'estimate' \| 'measured'` | `'estimate'` | Masonry/multi-lane: assign items to lanes by estimated or measured sizes |
| `useCachedMeasurements` | `boolean` | `false` | Make the default measurer return the cached (or estimated) size instead of reading the DOM — freezes item sizes when they are already known |
| `debug` | `boolean` | `false` | Verbose engine logging |
| `measureElement` | `(element, entry, instance) => number` | border-box measurer | Replace HOW an item's size is read from its element (e.g. include margins, or measure a child) |

## `<window-virtualizer>` input reference

Same as `<virtualizer>` except `getScrollElement` is not accepted — the scroll element is
always `window`. Unlike `<virtualizer>` there are two changed defaults:

- `horizontal` is accepted (the page scrolls sideways) and defaults to `false`.
- `initialOffset` defaults to the live window scroll position (`window.scrollY`, or
  `window.scrollX` when `horizontal`) on the client and `0` on the server. Pass a number to
  override it — e.g. to server-render a slice at a scroll position, paired with
  `initialRect` (see [SSR](#ssr)).

`scrollMargin` is the signature window-virtualizer option: a window-scrolled list almost never
starts at the very top of the page, so pass the list's offset from the top of the document and
subtract it from `item.start` when positioning (the window example measures it with
`offsetTop` on mount).

## Inside your own scroll handler, read the element — not the virtualizer

The virtualizer attaches its scroll listener in `onMount`; a handler in your markup attaches
at hydrate, earlier. During any single scroll event your handler therefore runs FIRST, while
the virtualizer still holds the PREVIOUS event's offset — so `v.isAtEnd()` and
`v.getDistanceFromEnd()` called inside your `onScroll` are one event stale (a jump to the top
can still report "at end"). Compute from the element instead; the arithmetic is identical:

```marko
<div/scrollEl onScroll() {
  const el = scrollEl()
  if (!el) return
  const atEnd = el.scrollHeight - el.scrollTop - el.clientHeight <= 80
}>
```

Everywhere else — click handlers, effects, `<script>` blocks — `v.isAtEnd()` and friends are
current and safe to use.

## The virtualizer's lifetime must match its scroll element's

Declare the `<virtualizer>` in the same conditional scope as its scroll element. If the
scroll container can be unmounted and remounted (an `<if>`, a route transition), put the
tag inside that same conditional:

```marko
<if=show>
  <virtualizer/v count=1000 estimateSize=() => 35 getScrollElement=() => scrollEl()/>
  <div/scrollEl class="list">...</div>
</if>
```

The tag builds its live virtualizer in `onMount` and re-reads `getScrollElement` only when
one of its inputs changes. A scroll element replaced WITHOUT any input change is invisible
to the tag — Marko's compile-time reactivity cannot track through the `getScrollElement`
thunk into your template's scope — so a tag left mounted outside the conditional would stay
bound to the removed element and render nothing after the remount. Co-locating the tag makes
its lifecycle follow the element's: unmount tears the instance down, remount builds a fresh
one. (Note: scroll position resets on remount, as a fresh element starts at offset 0.)

## SSR

Both tags render on the server **without an `<if=mounted>` guard** and build their live, observing
virtualizer client-side in `onMount`. There are two modes.

**Client-fill (default).** Without `initialRect` the server renders an empty container; on mount the
client measures the scroll element and fills in the visible rows:

```marko
<div/scrollEl style="height: 400px; overflow-y: auto; position: relative;">
  <virtualizer/v
    count=10000
    estimateSize=() => 35
    getScrollElement=() => scrollEl()
  />
  <div style=`height: ${v.totalSize}px; position: relative`>
    <for|item| of=v.virtualItems>
      <div style=`position: absolute; top: 0; width: 100%; height: ${item.size}px; transform: translateY(${item.start}px)`>
        Row ${item.index}
      </div>
    </for>
  </div>
</div>
```

**Server slice (`initialRect`).** Pass a viewport hint and the server paints the initial visible
rows into the HTML, so there is real content on first paint before the client resumes:

```marko
<virtualizer/v
  count=people.length
  estimateSize=() => 48
  getScrollElement=() => scrollEl()
  initialRect=({ width: 800, height: 400 })
/>
```

`initialRect` is a hint, not a measurement: the server has no real viewport, so it uses this size to
compute the slice, and the client re-measures the actual scroll element on mount and takes over. The
instance built for the slice is transient — nothing live is serialized; only plain data (the item
positions and total size) crosses and recomputes identically on resume. The full
fetch → serialize → resume → slice flow is shown in the SSR data-fetching example.

> **Note (no-JS):** a server slice does not by itself make a no-JavaScript page. If the virtualizer
> sits inside an `<await>` with a placeholder (as in the data-fetching examples), Marko streams the
> awaited content out of order and reveals it with a small inline script — with JavaScript disabled
> the painted rows are in the HTML but the page renders blank. Script-free visibility requires
> in-order rendering (no placeholder).

**Scroll restore (`initialOffset`, element only).** To server-render the list at a scroll position
instead of the top — a deep link, or a restored scroll — pass `initialOffset` alongside `initialRect`.
The server paints the slice around that offset (it includes `overscan`, so the first *painted* row
sits a few rows above the first *visible* one). A scroll container's `scrollTop` can't be set
declaratively in HTML, so restore it on the client on mount to line the rows up:

```marko
<div/scrollEl class="list">
  <virtualizer/v
    count=people.length
    estimateSize=() => 48
    getScrollElement=() => scrollEl()
    initialRect=({ width: 800, height: 400 })
    initialOffset=(100 * 48)
  />
  <!-- rows … -->
</div>
<lifecycle onMount() { const el = scrollEl(); if (el) el.scrollTop = 100 * 48 }/>
```

For `<window-virtualizer>` the offset comes from `window.scrollY` (browser scroll restoration), so
`initialOffset` is not a separate prop there.

### Streaming: the tag inside `<await>`

The SSR modes above compose with Marko's streaming as-is — place the virtualizer inside an
`<await>` and everything holds *per streamed chunk*:

```marko
<try>
  <@placeholder>
    <p>Loading people…</p>
  </@placeholder>
  <@catch|err|>
    <p>Failed to load: ${(err as Error).message}</p>
  </@catch>

  <await|people| value=fetchPeople()>
    <div/scrollEl class="scroll-container">
      <virtualizer/v
        count=people.length
        estimateSize=() => 48
        getScrollElement=() => scrollEl()
        initialRect=({ width: 800, height: 400 })
      />
      <!-- sizer + rows exactly as usual -->
    </div>
  </await>
</try>
```

On the wire, the server flushes the page shell (with the placeholder) immediately and streams the
awaited subtree as a **later chunk** once `fetchPeople()` resolves — including the server-painted
rows when `initialRect` is set. Each streamed chunk **resumes independently**: this list's live
virtualizer mounts when its chunk arrives, without waiting for the rest of the page. No extra
configuration — the slice is computed inside the awaited subtree from the resolved data, so the
server and the resumed client agree by construction. (The no-JS note above applies: streamed
content is revealed by script.)

The SSR data-fetching example shows the streamed pattern with client-rendered rows; the
server-slice example shows it with server-painted rows — its test suite includes a wire-level
assertion that the placeholder flushes first and the painted rows arrive in a later chunk.
