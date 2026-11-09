import { expect, test, vi } from 'vitest'
import {
  Virtualizer,
  defaultRangeExtractor,
  observeElementOffset,
  observeElementRect,
} from '../src/index'

// ─── defaultRangeExtractor ───────────────────────────────────────────────────

test('defaultRangeExtractor: simple range with no overscan', () => {
  const result = defaultRangeExtractor({
    startIndex: 5,
    endIndex: 10,
    overscan: 0,
    count: 100,
  })
  expect(result).toEqual([5, 6, 7, 8, 9, 10])
})

test('defaultRangeExtractor: range with overscan', () => {
  const result = defaultRangeExtractor({
    startIndex: 5,
    endIndex: 10,
    overscan: 2,
    count: 100,
  })
  expect(result).toEqual([3, 4, 5, 6, 7, 8, 9, 10, 11, 12])
})

test('defaultRangeExtractor: clamps start to 0 when overscan would go negative', () => {
  const result = defaultRangeExtractor({
    startIndex: 1,
    endIndex: 5,
    overscan: 5,
    count: 100,
  })
  expect(result).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
  expect(result[0]).toBe(0)
})

test('defaultRangeExtractor: clamps end to count-1 when overscan would go past', () => {
  const result = defaultRangeExtractor({
    startIndex: 95,
    endIndex: 99,
    overscan: 5,
    count: 100,
  })
  expect(result).toEqual([90, 91, 92, 93, 94, 95, 96, 97, 98, 99])
  expect(result[result.length - 1]).toBe(99)
})

test('defaultRangeExtractor: overscan expands by whole rows when lanes > 1', () => {
  const result = defaultRangeExtractor({
    startIndex: 35,
    endIndex: 54,
    overscan: 1,
    count: 100,
    lanes: 5,
  })
  expect(result[0]).toBe(30)
  expect(result[result.length - 1]).toBe(59)
  expect(result.length).toBe(30)
})

test('defaultRangeExtractor: row overscan clamps to the list bounds', () => {
  const result = defaultRangeExtractor({
    startIndex: 0,
    endIndex: 98,
    overscan: 2,
    count: 100,
    lanes: 5,
  })
  expect(result[0]).toBe(0)
  expect(result[result.length - 1]).toBe(99)
})

test('multi-lane virtualizer renders whole rows with overscan (#1036)', () => {
  const virtualizer = new Virtualizer({
    count: 100,
    lanes: 5,
    gap: 2,
    overscan: 1,
    estimateSize: () => 50,
    initialRect: { width: 600, height: 200 },
    initialOffset: 418,
    getScrollElement: () => null,
    scrollToFn: vi.fn(),
    observeElementRect: vi.fn(),
    observeElementOffset: vi.fn(),
  })
  const indexes = virtualizer.getVirtualIndexes()
  // Every rendered row is complete, so every lane gets the same number of
  // items measured. A partial row lets one lane drift from the others.
  expect(indexes[0]! % 5).toBe(0)
  expect(indexes[indexes.length - 1]! % 5).toBe(4)
})

test('defaultRangeExtractor: single item range', () => {
  const result = defaultRangeExtractor({
    startIndex: 5,
    endIndex: 5,
    overscan: 0,
    count: 100,
  })
  expect(result).toEqual([5])
})

test('defaultRangeExtractor: returns a plain Array (not iterable proxy)', () => {
  const result = defaultRangeExtractor({
    startIndex: 0,
    endIndex: 3,
    overscan: 0,
    count: 100,
  })
  expect(Array.isArray(result)).toBe(true)
  expect(result.length).toBe(4)
})

test('defaultRangeExtractor: large range produces correct length', () => {
  const result = defaultRangeExtractor({
    startIndex: 0,
    endIndex: 999,
    overscan: 0,
    count: 1000,
  })
  expect(result.length).toBe(1000)
  expect(result[0]).toBe(0)
  expect(result[999]).toBe(999)
})

// ─── Lazy fast path (lanes === 1) edge cases ─────────────────────────────────
// Pins down behavior of the typed-array-backed lazy measurements view.

test('lazy fast path: empty list (count=0)', () => {
  const v = new Virtualizer({
    count: 0,
    estimateSize: () => 50,
    getScrollElement: () => null,
    scrollToFn: vi.fn(),
    observeElementRect: vi.fn(),
    observeElementOffset: vi.fn(),
  })
  const m = v['getMeasurements']()
  expect(m.length).toBe(0)
  expect(v.getTotalSize()).toBe(0)
})

test('lazy fast path: respects paddingStart + scrollMargin + gap', () => {
  const v = new Virtualizer({
    count: 5,
    estimateSize: () => 40,
    paddingStart: 10,
    scrollMargin: 20,
    gap: 8,
    getScrollElement: () => null,
    scrollToFn: vi.fn(),
    observeElementRect: vi.fn(),
    observeElementOffset: vi.fn(),
  })
  const m = v['getMeasurements']()
  // First item starts at paddingStart + scrollMargin = 30
  expect(m[0]!.start).toBe(30)
  expect(m[0]!.size).toBe(40)
  expect(m[0]!.end).toBe(70)
  // Subsequent items separated by gap
  expect(m[1]!.start).toBe(70 + 8) // prev.end + gap
  expect(m[1]!.size).toBe(40)
})

test('lazy fast path: VirtualItem fields are correct', () => {
  const v = new Virtualizer({
    count: 3,
    estimateSize: () => 50,
    getItemKey: (i) => `item-${i}`,
    getScrollElement: () => null,
    scrollToFn: vi.fn(),
    observeElementRect: vi.fn(),
    observeElementOffset: vi.fn(),
  })
  const m = v['getMeasurements']()
  expect(m[0]!.index).toBe(0)
  expect(m[0]!.key).toBe('item-0')
  expect(m[0]!.start).toBe(0)
  expect(m[0]!.size).toBe(50)
  expect(m[0]!.end).toBe(50)
  expect(m[0]!.lane).toBe(0)
  expect(m[1]!.index).toBe(1)
  expect(m[1]!.key).toBe('item-1')
  expect(m[2]!.key).toBe('item-2')
})

test('lazy fast path: same item read twice returns identical reference (cache works)', () => {
  const v = new Virtualizer({
    count: 10,
    estimateSize: () => 30,
    getScrollElement: () => null,
    scrollToFn: vi.fn(),
    observeElementRect: vi.fn(),
    observeElementOffset: vi.fn(),
  })
  const m = v['getMeasurements']()
  const a = m[5]
  const b = m[5]
  expect(a).toBe(b)
})

test.each([
  { name: 'initial build', resizeIndex: null },
  { name: 'partial rebuild', resizeIndex: 2 },
])(
  'lazy fast path: preserves unread item keys after $name',
  ({ resizeIndex }) => {
    const messages = ['a', 'b', 'c', 'd']
    const v = new Virtualizer({
      count: messages.length,
      estimateSize: () => 50,
      getItemKey: (index) => messages[index]!,
      getScrollElement: () => null,
      scrollToFn: vi.fn(),
      observeElementRect: vi.fn(),
      observeElementOffset: vi.fn(),
    })
    expect(v.getTotalSize()).toBe(200)

    if (resizeIndex !== null) {
      v.resizeItem(resizeIndex, 80)
      expect(v.getTotalSize()).toBe(230)
    }

    // The old layout is still needed while setOptions compares the two lists.
    messages.splice(0, 1)
    messages.push('e')

    expect(v.getVirtualItemForOffset(50)).toEqual({
      index: 1,
      key: 'b',
      start: 50,
      size: 50,
      end: 100,
      lane: 0,
    })
  },
)

test('lazy fast path: out-of-range access returns undefined', () => {
  const v = new Virtualizer({
    count: 5,
    estimateSize: () => 30,
    getScrollElement: () => null,
    scrollToFn: vi.fn(),
    observeElementRect: vi.fn(),
    observeElementOffset: vi.fn(),
  })
  const m = v['getMeasurements']()
  expect(m[10]).toBeUndefined()
  expect(m[-1]).toBeUndefined()
  expect(m[5]).toBeUndefined()
})

test('lazy fast path: getTotalSize after resizeItem reflects new size', () => {
  const v = new Virtualizer({
    count: 5,
    estimateSize: () => 30,
    getScrollElement: () => null,
    scrollToFn: vi.fn(),
    observeElementRect: vi.fn(),
    observeElementOffset: vi.fn(),
  })
  expect(v.getTotalSize()).toBe(150)
  v.resizeItem(2, 100)
  expect(v.getTotalSize()).toBe(120 + 100) // 4 * 30 + 100
})

test('lazy fast path: getVirtualItemForOffset binary search returns correct item', () => {
  const v = new Virtualizer({
    count: 100,
    estimateSize: () => 30,
    getScrollElement: () => null,
    scrollToFn: vi.fn(),
    observeElementRect: vi.fn(),
    observeElementOffset: vi.fn(),
  })
  const found = v.getVirtualItemForOffset(500)
  // Item at offset 500 should be index 16 (500/30 = 16.67)
  expect(found?.index).toBe(16)
  expect(found?.start).toBe(480)
  expect(found?.end).toBe(510)
})

test('lazy fast path: 1M-item list returns a sparse view, not an eagerly-allocated array', () => {
  // Functional contract for the lazy fast path: a 1M-item virtualizer
  // returns measurements that report the correct total length and produce
  // exact start/size/end values on indexed access without requiring the
  // whole array to be materialized. Sparse spot-checks across the range
  // would fail if the fast path were silently allocating N VirtualItems
  // (or if the typed-array backing computed offsets incorrectly).
  const v = new Virtualizer({
    count: 1_000_000,
    estimateSize: () => 30,
    getScrollElement: () => null,
    scrollToFn: vi.fn(),
    observeElementRect: vi.fn(),
    observeElementOffset: vi.fn(),
  })
  const m = v['getMeasurements']()
  expect(m.length).toBe(1_000_000)
  expect(m[0]!.start).toBe(0)
  expect(m[0]!.size).toBe(30)
  expect(m[0]!.end).toBe(30)
  expect(m[500_000]!.start).toBe(15_000_000)
  expect(m[500_000]!.end).toBe(15_000_030)
  expect(m[999_999]!.start).toBe(29_999_970)
  expect(m[999_999]!.end).toBe(30_000_000)
})

test('lazy fast path: lanes>1 still uses eager path (regression guard)', () => {
  const v = new Virtualizer({
    count: 10,
    lanes: 2,
    estimateSize: () => 50,
    getScrollElement: () => null,
    scrollToFn: vi.fn(),
    observeElementRect: vi.fn(),
    observeElementOffset: vi.fn(),
  })
  const m = v['getMeasurements']()
  // Eager array, so m is a real Array; both lanes present
  const lanes = new Set(m.map((x) => x.lane))
  expect(lanes.has(0)).toBe(true)
  expect(lanes.has(1)).toBe(true)
})

// A list that shrinks while scrolled to its end (filtering, rows re-measured
// smaller) keeps the old scroll offset until the scroll element reports the
// clamped one. The range should still cover the rows the viewport can show.
const shrinkWhileAtEnd = (scrollMargin: number) => {
  const options = {
    estimateSize: () => 30,
    overscan: 0,
    scrollMargin,
    initialRect: { width: 300, height: 300 },
    // Scrolled to the end of 50 rows: 50 × 30 - 300
    initialOffset: scrollMargin + 1200,
    getScrollElement: () => null,
    scrollToFn: vi.fn(),
    observeElementRect: vi.fn(),
    observeElementOffset: vi.fn(),
  }
  const virtualizer = new Virtualizer({ ...options, count: 50 })
  const before = virtualizer.getVirtualIndexes()
  virtualizer.setOptions({ ...options, count: 20 })
  return { before, after: virtualizer.getVirtualIndexes() }
}

test('a stale offset past the end of a shrunk list renders the last viewport of rows', () => {
  const { before, after } = shrinkWhileAtEnd(0)
  expect(before).toEqual([40, 41, 42, 43, 44, 45, 46, 47, 48, 49])
  expect(after).toEqual([10, 11, 12, 13, 14, 15, 16, 17, 18, 19])
})

test('a stale offset past the end renders the last viewport of rows with a scrollMargin', () => {
  // scrollOffset is measured in the scroll element, getTotalSize() from the
  // start of the list, so the end of the list sits at scrollMargin + total.
  const { before, after } = shrinkWhileAtEnd(1000)
  expect(before).toEqual([40, 41, 42, 43, 44, 45, 46, 47, 48, 49])
  expect(after).toEqual([10, 11, 12, 13, 14, 15, 16, 17, 18, 19])
})

// Two lists share one scroll element: the first starts 100px down and is
// 81 × 25 = 2025px tall, so it ends at 2125px; the second extends the element
// to 6000px. A position past the first list's end is real there.
const sharedScroller = (initialOffset = 0) => {
  let report: ((offset: number, isScrolling: boolean) => void) | null = null
  const onChange = vi.fn()
  const element = {
    scrollTop: initialOffset,
    scrollHeight: 6000,
    clientHeight: 600,
  }
  const virtualizer = new Virtualizer({
    count: 81,
    estimateSize: () => 25,
    overscan: 6,
    scrollMargin: 100,
    initialOffset,
    initialRect: { width: 300, height: 600 },
    getScrollElement: () => element as any,
    scrollToFn: vi.fn(),
    observeElementRect: vi.fn(),
    observeElementOffset: (_: unknown, cb: typeof report) => {
      report = cb
      return () => {}
    },
    onChange,
  })
  // What an adapter does on its first render: read the rows and draw the
  // sizer, then run the update hook, which attaches the element.
  const firstRender = virtualizer.getVirtualIndexes()
  virtualizer.getTotalSize()
  virtualizer._willUpdate()
  return { virtualizer, report: report!, firstRender, onChange }
}

const lastRows = [74, 75, 76, 77, 78, 79, 80]

test('a list above the viewport in a shared scroll element keeps only its last rows', () => {
  const { virtualizer, report } = sharedScroller()
  report(2500, true)
  expect(virtualizer.getVirtualIndexes()).toEqual(lastRows)
})

test('a shared scroll element already past the list when it attaches keeps only its last rows', () => {
  // No scroll event comes: the element is where the initial offset says. The
  // first render has no element to read the content after the list from, so
  // attaching changes the range and has to tell the adapter.
  const { virtualizer, firstRender, onChange } = sharedScroller(2500)
  expect(firstRender).toEqual(Array.from({ length: 30 }, (_, i) => i + 51))
  expect(virtualizer.getVirtualIndexes()).toEqual(lastRows)
  expect(onChange).toHaveBeenCalled()
})

test('a list measured smaller after it was drawn still renders its last viewport of rows', () => {
  // The list has the element to itself. Its rows shrink from 30 to 20 before
  // the next draw, and the element, still drawn 1500px tall, reports 1200.
  let report: ((offset: number, isScrolling: boolean) => void) | null = null
  const element = { scrollTop: 1200, scrollHeight: 1500, clientHeight: 300 }
  const virtualizer = new Virtualizer({
    count: 50,
    estimateSize: () => 30,
    overscan: 0,
    initialOffset: 1200,
    initialRect: { width: 300, height: 300 },
    getScrollElement: () => element as any,
    scrollToFn: vi.fn(),
    observeElementRect: vi.fn(),
    observeElementOffset: (_: unknown, cb: typeof report) => {
      report = cb
      return () => {}
    },
  })
  virtualizer.getTotalSize()
  virtualizer._willUpdate()
  for (let i = 0; i < 50; i++) virtualizer.resizeItem(i, 20)
  report!(1200, true)
  // 50 rows of 20 end at 1000: 1200 is stale, so the range is the last 300px.
  expect(virtualizer.getVirtualIndexes()).toEqual([
    35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49,
  ])
})
