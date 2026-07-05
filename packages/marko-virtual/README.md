# @tanstack/marko-virtual

Headless UI for virtualizing scrollable elements in [Marko 6](https://markojs.com), built on top of [`@tanstack/virtual-core`](https://tanstack.com/virtual).

Part of the [TanStack Virtual](https://tanstack.com/virtual) family. Full documentation: [tanstack.com/virtual — Marko](https://tanstack.com/virtual/latest/docs/framework/marko/marko-virtual).

## Installation

```bash
npm install @tanstack/marko-virtual
# or
pnpm add @tanstack/marko-virtual
```

**Peer dependency:** `marko ^6.0.0`

## Setup

The tags are discovered automatically by the Marko compiler when the package is installed — no imports are needed in your `.marko` files. If your build setup does not pick them up (monorepo links, unusual resolution), add the taglib explicitly to your project's `marko.json`:

```json
{
  "taglib-imports": ["@tanstack/marko-virtual/marko.json"]
}
```

## Usage

Each tag is used **self-closing** and exposes a **tag variable** (`<virtualizer/v .../>`). You own the markup: read `v.virtualItems` and `v.totalSize` to render the visible rows. Declare the virtualizer **before** the markup that reads it, and pass `getScrollElement` as an **arrow thunk** (`() => scrollEl()`) so the element ref resolves at call time.

### `<virtualizer>` — scrollable container

Use when you control the scroll element (a div with `overflow: auto`).

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

No mount guard is needed: the tag renders a deterministic initial state on the server (see [SSR](#ssr-server-rendered-slices)) and the live, observing instance takes over on mount.

For columns, set `horizontal=true` and swap the width/height and `translateX` accordingly. For grids, compose two `<virtualizer>` tags (rows + columns) sharing the same scroll element — each with its own tag variable and its own `() => scrollEl()` thunk.

### `<window-virtualizer>` — full-page scrolling

Use when the page itself is the scroll container.

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

If content sits above the list (it almost always does on a real page), measure the list's `offsetTop` on mount and pass it as `scrollMargin`, then subtract it from `item.start` when positioning — see the `window` example.

## SSR: server-rendered slices

Server rendering is **opt-in per virtualizer** via `initialRect` (a viewport size hint). When set, the server paints the initial visible rows directly into the HTML; without it the server renders an empty container and the client fills it on mount — byte-for-byte identical to a client-only build. Pair with `initialOffset` (a number) to server-render at a scroll position (deep links, restore):

```marko
<virtualizer/v
  count=10000
  estimateSize=() => 35
  getScrollElement=() => scrollEl()
  initialRect=({ width: 800, height: 400 })
  initialOffset=3500
/>
```

Nothing live is serialized — the slice is computed as plain data at render time and recomputes identically on resume. See the five `ssr*` examples for the full patterns, including measurement-cache restore.

### Streaming SSR: the tag inside `<await>`

The tags compose with Marko's streaming out of the box — put a virtualizer inside an
`<await>` and the whole pattern above still holds, per streamed chunk:

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

What happens on the wire: the server flushes the page shell (with the placeholder)
**immediately**, keeps streaming, and when `fetchPeople()` resolves it flushes the
awaited subtree as a **later chunk** — including the server-painted rows when
`initialRect` is set. Each streamed chunk **resumes independently** on the client:
the live virtualizer instance for this list mounts when its chunk arrives, without
waiting for the rest of the page. Nothing extra to configure — the seed is computed
inside the awaited subtree from the resolved data, so server and resumed client
agree by construction.

Two things to know:

- Marko streams awaited content **out of order**: the chunk arrives at the end of
  the byte stream and an inline script swaps it into place. With JavaScript
  disabled that swap never runs, so an `<await>`-wrapped list renders blank without
  JS even though the row HTML is present in the source. If no-JS visibility
  matters, fetch **before** render (await the data in the route) instead of
  streaming.
- The `ssr-fetch` example shows the streamed pattern with client-rendered rows; the
  `ssr-slice` example shows it with **server-painted** rows (`initialRect`) — its
  test suite includes a wire-level assertion that the placeholder flushes first and
  the painted rows arrive in a later chunk.

## Dynamic / variable item sizes

For items with unknown heights, drive `measureElement` from a per-row `<script>`:

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

> `data-index` is required on measured elements — the virtualizer uses it to map measurements back to items. Measuring under a different attribute name requires passing that name as `indexAttribute`.

## Tag variable reference

Both tags expose the same shape. Capture it with `<virtualizer/v .../>` and read `v.property`:

| Property | Type | Description |
|---|---|---|
| `virtualItems` | `VirtualItem[]` | The currently visible virtual items (`index`, `start`, `size`, `key`, `lane`) |
| `totalSize` | `number` | Total scrollable size in px — set as the inner container's `height` (or `width` for columns). Margin-free: `scrollMargin` is already subtracted |
| `range` | `{ startIndex: number; endIndex: number } \| null` | The visible index window (excludes overscan). `null` until there is a window |
| `measureElement` | `(el: Element \| null) => void` | Ref callback for dynamic item sizing |
| `scrollToIndex` | `(index: number, options?: ScrollToOptions) => void` | Scroll to an item by index. Default `align: 'auto'` scrolls the minimum |
| `scrollToOffset` | `(offset: number, options?: ScrollToOptions) => void` | Scroll to a pixel offset |
| `measure` | `() => void` | Drop all measured sizes and re-measure everything (after a width/font change) |
| `resizeItem` | `(index: number, size: number) => void` | Set one item's size directly, without a DOM measure |
| `scrollToEnd` | `(options?: { behavior?: ScrollBehavior }) => void` | Scroll to the very end of the list |
| `isAtEnd` | `(threshold?: number) => boolean` | Whether the scroll position is at (or within `threshold` px of) the end. `false` before mount |
| `getDistanceFromEnd` | `() => number` | Pixels between the current scroll position and the end. `Infinity` before mount |

> Inside your **own** `onScroll` handler, compute end-proximity from the element (`el.scrollHeight - el.scrollTop - el.clientHeight`) rather than calling `v.isAtEnd()` — your handler runs before the virtualizer's listener during the same event, so the virtualizer's numbers are one event stale there. Everywhere else they are current.

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
| `initialOffset` | `number \| (() => number)` | — | Scroll offset (px) for the server slice — server-render at a scroll position (deep link / restore) |
| `initialRect` | `{ width: number; height: number }` | — | Viewport hint for a server-rendered slice (SSR). When set, the server paints the initial visible rows; omit for client-only fill |
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

Same as `<virtualizer>` except `getScrollElement` is not accepted — the scroll element is always `window`. Two notes:

- `horizontal` is accepted (the page scrolls sideways) and defaults to `false`.
- `initialOffset` defaults to the live window scroll position (`window.scrollY`, or `window.scrollX` when `horizontal`) on the client and `0` on the server. Pass a number to override it — e.g. to server-render a slice at a scroll position, paired with `initialRect`.

`scrollMargin` is the signature window-virtualizer option: pass the list's offset from the top of the document and subtract it from `item.start` when positioning.

## Examples

All examples use `@marko/run`. Run any with:

```bash
pnpm --filter tanstack-marko-virtual-example-<name> dev
```

| Example | Description |
| --- | --- |
| `fixed` | Fixed-size rows, columns, and grid |
| `variable` | Variable sizes via `estimateSize` |
| `dynamic` | Unknown sizes measured via `measureElement` |
| `grid` | Two virtualizers sharing one scroll element |
| `pretext` | Calculated text heights via `@chenglou/pretext` (no estimate error) |
| `padding` | `paddingStart` / `paddingEnd` |
| `scroll-padding` | `scrollPaddingStart` with `scrollToIndex` |
| `sticky` | Sticky group headers via `rangeExtractor` |
| `infinite-scroll` | Lazy data loading with a fixed total count |
| `chat` | End-anchored messaging (`anchorTo="end"`, `followOnAppend`), history prepends, a real server-streamed reply |
| `chat-pretext` | Chat rebuilt on calculated heights: zero-correction prepends, streamed reply growing via `resizeItem` |
| `smooth-scroll` | `scrollToIndex` with smooth behavior |
| `table` | Virtualized table rows |
| `window` | Full-page scrolling with `scrollMargin` measured on mount |
| `ssr` | SSR: no fetch, rows render on client |
| `ssr-fetch` | SSR: fetch on server, rows render on client |
| `ssr-slice` | SSR: fetch on server, rows render on server (`initialRect`) |
| `ssr-restore` | SSR: server slice at an offset + measurement-cache restore |
| `window-ssr-slice` | SSR window: rows render on server |

## TypeScript

The tags are fully typed. Each tag ships a committed `index.d.marko` (a types-only twin, like a `.d.ts` for a Marko template) that editors and [`@marko/type-check`](https://github.com/marko-js/language-server/tree/main/packages/type-check) prefer over the implementation file. Both tags also export a named handle interface — `VirtualizerHandle` / `WindowVirtualizerHandle` — describing the tag-variable shape, which you can use to type your own variables and functions.

### Verification (CI)

`pnpm test:types` runs `mtc` (marko-type-check) over the package: the `.ts` sources, the `.marko` tags and test fixtures, the tests, and the committed `.d.marko` files. This is what CI runs — CI only ever **verifies**, it never generates. If a tag's surface changes and the `.d.marko` files were not regenerated, this check fails instead of letting the types drift silently. The project file is `tsconfig.typecheck.json`.

### Generating `.d.marko` (manual, on demand)

The `.d.marko` files are **generated, committed artifacts** — regenerate them whenever a tag's `Input` or return surface changes:

```bash
pnpm types:generate
```

The script (`scripts/generate-d-marko.mjs`) verifies the sources type-check, deletes the old `.d.marko` (mtc prefers them as input when present), emits fresh ones via `tsconfig.emit.json`, copies them back beside the sources, and re-verifies. Review the diff and commit. Two notes: `TS6059` rootDir warnings during the emit step are a known benign artifact of the cross-package `virtual-core` paths mapping (the script accounts for them), and generation relies on the tags' **named** return interfaces — mtc's emitter truncates wide anonymous inline types, so keep returns cast to the exported handle types.

### Running all e2e Tests
To run all the e2e tests under each of `examples/marko/<example-name>/e2e` use the command

```bash
pnpm -r --workspace-concurrency=1 --filter "./examples/marko/*" run test:e2e
```
_Note:_ This has to be run sequentially as they all start the same port.

_Note:_ All suites run against **dev servers**; production builds are not exercised by
any test. After bumping `marko` (or other build-path dependencies), sanity-check a
production build manually: `pnpm --filter <example> build` then `preview`, and click
through the chat example's Stream reply.

### Running all unit tests
To run all the unit tests specifically for `marko-virtual/tests` use the command

```bash
pnpm --filter @tanstack/marko-virtual exec vitest run --reporter=verbose 
```

### Pre-requisite before running tests

```bash
pnpm install
pnpm --filter @tanstack/virtual-core build
pnpm --filter @tanstack/marko-virtual build
```

## Author & license

Authored and maintained as part of [TanStack Virtual](https://tanstack.com/virtual) by [Tanner Linsley](https://github.com/tannerlinsley) and contributors; Marko adapter contributed by `defunkt-dev` (`@DSz340`). If this library helps you, consider [sponsoring TanStack](https://github.com/sponsors/tannerlinsley).

[MIT](https://github.com/TanStack/virtual/blob/main/LICENSE) © Tanner Linsley
