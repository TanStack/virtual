---
title: Vanilla JS
---

Every framework adapter wraps the `Virtualizer` class from `@tanstack/virtual-core`. You can use that class directly, without a framework, as long as you do the three things an adapter does for you:

- pass the scroll and observer functions for your scroll element,
- render the virtual items whenever `onChange` fires,
- call the lifecycle methods `_didMount` and `_willUpdate`.

```bash
npm install @tanstack/virtual-core
```

## Creating a virtualizer

The adapters fill in `scrollToFn`, `observeElementRect` and `observeElementOffset`. Without an adapter they are required, and `@tanstack/virtual-core` exports the built-in implementations:

```ts
import {
  Virtualizer,
  elementScroll,
  observeElementOffset,
  observeElementRect,
} from '@tanstack/virtual-core'

const scrollElement = document.querySelector<HTMLDivElement>('#list')!

const virtualizer = new Virtualizer<HTMLDivElement, HTMLDivElement>({
  count: 10000,
  getScrollElement: () => scrollElement,
  estimateSize: () => 35,
  scrollToFn: elementScroll,
  observeElementRect: observeElementRect,
  observeElementOffset: observeElementOffset,
  onChange: () => render(),
})
```

## Lifecycle

Creating a `Virtualizer` does not touch the DOM. Until it is attached, `getVirtualItems()` returns an empty array, because the virtualizer has not read the size or the scroll position of the scroll element yet.

- [`_didMount()`](api/virtualizer#_didmount) marks the start of the virtualizer's life in the page. Call it once and keep the function it returns: calling that function detaches the virtualizer from the scroll element and disconnects its observers, so call it when you remove the list.
- [`_willUpdate()`](api/virtualizer#_willupdate) attaches the virtualizer to the element returned by `getScrollElement`. The first call reads the element's size, writes `initialOffset` to it, and starts observing its size and scroll position, which fires `onChange` with the first range to render. Later calls attach to a new element if `getScrollElement` returns a different one, and apply the scroll corrections that wait for the DOM to have the new total size. Call it once the scroll element is in the document, after every [`setOptions`](api/virtualizer#setoptions) call, and after every render.

```ts
const cleanup = virtualizer._didMount()
virtualizer._willUpdate()

// When the list is removed:
cleanup()
```

## Rendering

`onChange` fires when the rendered range, `isScrolling`, or the item sizes change. It does not fire on every scroll event, so each time it fires, render every item's position from `getVirtualItems()` and the total size from `getTotalSize()`.

The example below keeps one element per item key, so a row that stays in the range is updated instead of recreated, and measures every row so items can have dynamic sizes:

```html
<div id="list" style="height: 400px; overflow: auto">
  <div id="sizer" style="position: relative; width: 100%"></div>
</div>
```

```ts
import {
  Virtualizer,
  elementScroll,
  observeElementOffset,
  observeElementRect,
} from '@tanstack/virtual-core'
import type { VirtualItem } from '@tanstack/virtual-core'

const rows = Array.from({ length: 10000 }, (_, i) => `Row ${i}`)

const scrollElement = document.querySelector<HTMLDivElement>('#list')!
const sizer = document.querySelector<HTMLDivElement>('#sizer')!
const rendered = new Map<VirtualItem['key'], HTMLDivElement>()

const virtualizer = new Virtualizer<HTMLDivElement, HTMLDivElement>({
  count: rows.length,
  getScrollElement: () => scrollElement,
  estimateSize: () => 35,
  scrollToFn: elementScroll,
  observeElementRect: observeElementRect,
  observeElementOffset: observeElementOffset,
  onChange: () => render(),
})

let rendering = false
let renderAgain = false

function render() {
  // `measureElement` fires `onChange`, and so calls `render`, synchronously
  // when a row's size differs from its estimate. Finish the current pass,
  // then render again with the new sizes.
  if (rendering) {
    renderAgain = true
    return
  }
  rendering = true
  do {
    renderAgain = false
    renderRows()
  } while (renderAgain)
  rendering = false

  virtualizer._willUpdate()
}

function renderRows() {
  sizer.style.height = `${virtualizer.getTotalSize()}px`

  const items = virtualizer.getVirtualItems()
  const keys = new Set(items.map((item) => item.key))

  for (const [key, row] of rendered) {
    if (!keys.has(key)) {
      row.remove()
      rendered.delete(key)
    }
  }

  for (const item of items) {
    let row = rendered.get(item.key)
    if (!row) {
      row = document.createElement('div')
      row.style.position = 'absolute'
      row.style.top = '0'
      row.style.left = '0'
      row.style.width = '100%'
      rendered.set(item.key, row)
      sizer.append(row)
    }
    row.dataset.index = String(item.index)
    row.textContent = rows[item.index]!
    row.style.transform = `translateY(${item.start}px)`
    virtualizer.measureElement(row)
  }

  // Stop observing the rows removed above.
  virtualizer.measureElement(null)
}

const cleanup = virtualizer._didMount()
virtualizer._willUpdate()
```

Each measured element needs the `data-index` attribute (or the attribute set by [`indexAttribute`](api/virtualizer#indexattribute)) before it is passed to `measureElement`, and it must be in the document so it can be measured. The virtualizer keeps observing measured elements, so items that change size later are re-measured automatically. Calling `measureElement(null)` drops the elements that are no longer in the document.

For items with a known size, skip `measureElement` and give the rows `height: ${item.size}px` instead.

## Updating options

`setOptions` replaces all options at once: an option you leave out goes back to its default rather than keeping its previous value. Keep the options in one object and pass all of them again with your changes, then call `_willUpdate()` and render:

```ts
const options = {
  count: rows.length,
  getScrollElement: () => scrollElement,
  estimateSize: () => 35,
  scrollToFn: elementScroll,
  observeElementRect: observeElementRect,
  observeElementOffset: observeElementOffset,
  onChange: () => render(),
}

const virtualizer = new Virtualizer<HTMLDivElement, HTMLDivElement>(options)

function appendRows(newRows: Array<string>) {
  rows.push(...newRows)
  virtualizer.setOptions({ ...options, count: rows.length })
  render()
}
```

`render()` calls `_willUpdate()` itself in the example above.

## Window scrolling

To virtualize a list that scrolls with the page, use the window variants of the observer and scroll functions, and start from the page's current scroll position. With the markup and `render` function from the example above, minus the fixed height and `overflow` on `#list`:

```ts
import {
  Virtualizer,
  observeWindowOffset,
  observeWindowRect,
  windowScroll,
} from '@tanstack/virtual-core'

const virtualizer = new Virtualizer<Window, HTMLDivElement>({
  count: 10000,
  getScrollElement: () => window,
  estimateSize: () => 35,
  scrollToFn: windowScroll,
  observeElementRect: observeWindowRect,
  observeElementOffset: observeWindowOffset,
  initialOffset: () => window.scrollY,
  scrollMargin: sizer.offsetTop,
  onChange: () => render(),
})
```

With `scrollMargin`, the items' `start` values are measured from the top of the page, so position the rows at `item.start - virtualizer.options.scrollMargin` inside the sizer.
