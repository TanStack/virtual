import { describe, expect, it } from 'vitest'
import { renderSlice as renderSliceElement } from '../src/tags/virtualizer/options'
import { renderSlice as renderSliceWindow } from '../src/tags/window-virtualizer/options'

// renderSlice is the render-time (server / pre-mount) seed: it builds a transient virtual-core
// instance, reads the initial window as plain data, and discards it. These tests pin its two
// contracts — the opt-in gate (no initialRect => trivial window, so non-SSR examples are
// unaffected) and the slice it produces when a viewport hint is given.

describe('renderSlice — element virtualizer', () => {
  const base = {
    count: 1000,
    estimateSize: () => 48,
    getScrollElement: () => null,
  }

  it('without initialRect returns the trivial window (client-only build parity)', () => {
    const { items, size } = renderSliceElement(base)
    expect(items).toEqual([])
    expect(size).toBe(0)
  })

  it('with initialRect paints a contiguous slice from index 0 and the full total size', () => {
    const { items, size } = renderSliceElement({
      ...base,
      initialRect: { width: 800, height: 400 },
    })
    expect(items.length).toBeGreaterThan(0)
    expect(items[0]?.index).toBe(0)
    expect(items[items.length - 1]?.index).toBe(items.length - 1)
    expect(size).toBe(1000 * 48)
  })

  it('initialOffset shifts the slice away from the top', () => {
    const rect = { width: 800, height: 400 }
    const top = renderSliceElement({ ...base, initialRect: rect })
    const scrolled = renderSliceElement({
      ...base,
      initialRect: rect,
      initialOffset: 4800,
    })
    expect(top.items[0]?.index).toBe(0)
    expect(scrolled.items[0]?.index).toBeGreaterThan(0)
    expect(scrolled.size).toBe(top.size)
  })

  it('range is null without initialRect and spans the slice with it', () => {
    expect(renderSliceElement(base).range).toBeNull()
    const { items, range } = renderSliceElement({
      ...base,
      initialRect: { width: 800, height: 400 },
    })
    expect(range).not.toBeNull()
    // The slice includes overscan beyond the visible range, so the range sits inside it.
    expect(range!.startIndex).toBeGreaterThanOrEqual(items[0]!.index)
    expect(range!.endIndex).toBeLessThanOrEqual(items[items.length - 1]!.index)
    expect(range!.endIndex).toBeGreaterThanOrEqual(range!.startIndex)
  })

  it('rangeExtractor in the seed forces extra indexes into the slice (sticky pattern)', () => {
    const { items } = renderSliceElement({
      ...base,
      initialRect: { width: 800, height: 400 },
      initialOffset: 4800, // window starts around index 100, far from 0
      rangeExtractor: (r) => {
        const next = new Set([0]) // the pinned index
        for (
          let i = r.startIndex - r.overscan;
          i <= r.endIndex + r.overscan;
          i++
        ) {
          if (i >= 0 && i < r.count) next.add(i)
        }
        return [...next].sort((a, b) => a - b)
      },
    })
    expect(items[0]?.index).toBe(0) // forced in even though scrolled away
    expect(items[1]!.index).toBeGreaterThan(1) // the rest is the scrolled window
  })

  it('getItemKey flows into the seeded items', () => {
    const { items } = renderSliceElement({
      ...base,
      initialRect: { width: 800, height: 400 },
      getItemKey: (i) => `row-${i}`,
    })
    expect(items[0]?.key).toBe('row-0')
  })

  it('anchorTo end alone does NOT move the seed; initialOffset paints the end (chat SSR)', () => {
    // anchorTo is client-behavioral (follow-on-append, resize adjustment) and requires a live
    // scroll element — it never positions the initial window. A chat page that wants the END
    // painted into the server HTML passes initialOffset = totalSize - viewport.
    const rect = { width: 800, height: 400 }
    const anchoredOnly = renderSliceElement({
      ...base,
      initialRect: rect,
      anchorTo: 'end',
    })
    expect(anchoredOnly.items[0]?.index).toBe(0) // still at the top

    const atEnd = renderSliceElement({
      ...base,
      initialRect: rect,
      anchorTo: 'end',
      initialOffset: 1000 * 48 - 400,
    })
    expect(atEnd.items[atEnd.items.length - 1]?.index).toBe(999)
    expect(atEnd.size).toBe(1000 * 48)
  })
})

describe('renderSlice — window virtualizer', () => {
  const base = {
    count: 1000,
    estimateSize: () => 48,
  }

  it('without initialRect returns the trivial window', () => {
    const { items, size } = renderSliceWindow(base)
    expect(items).toEqual([])
    expect(size).toBe(0)
  })

  it('with initialRect paints a contiguous slice from index 0 and the full total size', () => {
    const { items, size, range } = renderSliceWindow({
      ...base,
      initialRect: { width: 1280, height: 800 },
    })
    expect(items.length).toBeGreaterThan(0)
    expect(items[0]?.index).toBe(0)
    expect(items[items.length - 1]?.index).toBe(items.length - 1)
    expect(size).toBe(1000 * 48)
    expect(range).not.toBeNull()
    expect(range!.startIndex).toBe(0)
  })

  it('range is null without initialRect', () => {
    expect(renderSliceWindow(base).range).toBeNull()
  })
})
