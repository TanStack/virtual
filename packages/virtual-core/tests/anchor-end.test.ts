import { expect, test, vi } from 'vitest'
import {
  Virtualizer,
  observeElementOffset,
  observeElementRect,
} from '../src/index'

// ─── end anchoring / chat-style reverse virtualization ──────────────────────

function createChatVirtualizer({
  messages,
  offset,
  viewportSize = 200,
  itemSize = 50,
  followOnAppend = false,
  threshold = 1,
  paddingEnd = 0,
}: {
  messages: Array<{ id: string }>
  offset: number
  viewportSize?: number
  itemSize?: number
  followOnAppend?: boolean | 'auto' | 'smooth' | 'instant'
  threshold?: number
  paddingEnd?: number
}) {
  let currentMessages = messages
  const scrollToFn = vi.fn()
  let offsetCb: ((offset: number, isScrolling: boolean) => void) | null = null
  const scrollElement = {
    scrollTop: offset,
    scrollLeft: 0,
    // The sizer is `getTotalSize()`, which includes paddingEnd.
    scrollHeight: messages.length * itemSize + paddingEnd,
    scrollWidth: 1000,
    clientHeight: viewportSize,
    clientWidth: 400,
    offsetHeight: viewportSize,
    ownerDocument: {
      defaultView: {
        requestAnimationFrame: (_cb: FrameRequestCallback) => {
          return 1
        },
        cancelAnimationFrame: vi.fn(),
        performance: { now: () => Date.now() },
        ResizeObserver: vi.fn(function () {
          return {
            observe: vi.fn(),
            unobserve: vi.fn(),
            disconnect: vi.fn(),
          }
        }),
      },
    },
  } as unknown as HTMLDivElement

  const makeOptions = () => {
    const messagesSnapshot = currentMessages

    return {
      count: messagesSnapshot.length,
      estimateSize: () => itemSize,
      getItemKey: (index: number) => messagesSnapshot[index]!.id,
      getScrollElement: () => scrollElement,
      scrollToFn,
      observeElementRect: (
        _instance: any,
        cb: (rect: { width: number; height: number }) => void,
      ) => {
        cb({ width: 400, height: viewportSize })
        return () => {}
      },
      observeElementOffset: (
        _instance: any,
        cb: (offset: number, isScrolling: boolean) => void,
      ) => {
        offsetCb = cb
        cb(scrollElement.scrollTop, false)
        return () => {}
      },
      anchorTo: 'end' as const,
      followOnAppend,
      scrollEndThreshold: threshold,
      paddingEnd,
    }
  }

  const virtualizer = new Virtualizer(makeOptions())
  virtualizer._willUpdate()
  virtualizer['getMeasurements']()
  scrollToFn.mockClear()

  return {
    virtualizer,
    scrollElement,
    scrollToFn,
    setMessages(nextMessages: Array<{ id: string }>) {
      currentMessages = nextMessages
      virtualizer.setOptions(makeOptions())
      ;(scrollElement as any).scrollHeight =
        nextMessages.length * itemSize + paddingEnd
      virtualizer._willUpdate()
    },
    // Simulate the browser's scroll event after a write (or a gesture).
    emitScroll(nextOffset: number, isScrolling = false) {
      scrollElement.scrollTop = nextOffset
      offsetCb?.(nextOffset, isScrolling)
    },
  }
}

test('anchorTo:end keeps visible content stable when older items are prepended', () => {
  const messages = Array.from({ length: 5 }, (_, i) => ({ id: `m-${i}` }))
  const { setMessages, scrollToFn } = createChatVirtualizer({
    messages,
    offset: 100,
  })

  setMessages([{ id: 'm--2' }, { id: 'm--1' }, ...messages])

  expect(scrollToFn).toHaveBeenCalledTimes(1)
  const [offset, options] = scrollToFn.mock.calls[0]!
  expect(offset).toBe(200)
  expect(options.adjustments).toBeUndefined()
})

test('anchorTo:end does not yank a scrolled-up user when items append', () => {
  const messages = Array.from({ length: 8 }, (_, i) => ({ id: `m-${i}` }))
  const { setMessages, scrollToFn } = createChatVirtualizer({
    messages,
    offset: 100,
    followOnAppend: true,
  })

  setMessages([...messages, { id: 'm-8' }])

  expect(scrollToFn).not.toHaveBeenCalled()
})

test('anchorTo:end preserves a reading anchor with a stable key callback', () => {
  const messages = Array.from({ length: 20 }, (_, i) => ({ id: `m-${i}` }))
  const { virtualizer, scrollToFn, emitScroll } = createChatVirtualizer({
    messages,
    offset: 400,
    followOnAppend: false,
  })
  const readingKey = virtualizer.getVirtualItemForOffset(400)!.key
  virtualizer.getVirtualItems()

  for (let step = 1; step <= 2; step++) {
    scrollToFn.mockClear()
    messages.splice(0, 1)
    messages.push({ id: `m-${19 + step}` })
    // Keep the same callback; the old edge keys have not been read yet.
    virtualizer.setOptions(virtualizer.options)
    virtualizer._willUpdate()

    const target = 400 - step * 50
    expect(scrollToFn.mock.calls.at(-1)?.[0]).toBe(target)
    emitScroll(target)
    expect(virtualizer.getVirtualItemForOffset(target)?.key).toBe(readingKey)
    for (const item of virtualizer.getVirtualItems()) {
      expect(item.key).toBe(messages[item.index]!.id)
    }
  }
})

test('followOnAppend keeps an end-pinned user at the end when items append', () => {
  const messages = Array.from({ length: 5 }, (_, i) => ({ id: `m-${i}` }))
  const { setMessages, scrollToFn } = createChatVirtualizer({
    messages,
    offset: 50,
    followOnAppend: true,
  })

  setMessages([...messages, { id: 'm-5' }])

  expect(scrollToFn).toHaveBeenCalledTimes(1)
  const [offset, options] = scrollToFn.mock.calls[0]!
  expect(offset).toBe(100)
  expect(options.behavior).toBe('auto')
})

test('followOnAppend accepts smooth behavior', () => {
  const messages = Array.from({ length: 5 }, (_, i) => ({ id: `m-${i}` }))
  const { setMessages, scrollToFn } = createChatVirtualizer({
    messages,
    offset: 50,
    followOnAppend: 'smooth',
  })

  setMessages([...messages, { id: 'm-5' }])

  expect(scrollToFn).toHaveBeenCalledTimes(1)
  expect(scrollToFn.mock.calls[0]![1].behavior).toBe('smooth')
})

test.each([
  { removed: 1, appended: 1, behavior: true as const },
  { removed: 1, appended: 2, behavior: true as const },
  { removed: 3, appended: 3, behavior: true as const },
  { removed: 3, appended: 1, behavior: true as const },
  { removed: 1, appended: 1, behavior: 'smooth' as const },
])(
  'followOnAppend follows a sliding window removing $removed and appending $appended with $behavior',
  ({ removed, appended, behavior }) => {
    const messages = Array.from({ length: 8 }, (_, i) => ({ id: `m-${i}` }))
    const { setMessages, scrollToFn } = createChatVirtualizer({
      messages,
      offset: 200,
      followOnAppend: behavior,
    })
    const nextMessages = [
      ...messages.slice(removed),
      ...Array.from({ length: appended }, (_, i) => ({ id: `m-${8 + i}` })),
    ]

    setMessages(nextMessages)

    expect(scrollToFn).toHaveBeenCalledTimes(1)
    expect(scrollToFn.mock.calls[0]![0]).toBe(nextMessages.length * 50 - 200)
    expect(scrollToFn.mock.calls[0]![1].behavior).toBe(
      behavior === true ? 'auto' : behavior,
    )
  },
)

test.each([
  { offset: 100, followOnAppend: true, threshold: 1, target: 50 },
  { offset: 200, followOnAppend: false, threshold: 1, target: 150 },
  { offset: 195, followOnAppend: true, threshold: 4, target: 145 },
  { offset: 196, followOnAppend: true, threshold: 4, target: 200 },
])(
  'followOnAppend respects offset $offset, enabled $followOnAppend and threshold $threshold for a sliding window',
  ({ offset, followOnAppend, threshold, target }) => {
    const messages = Array.from({ length: 8 }, (_, i) => ({ id: `m-${i}` }))
    const { setMessages, scrollToFn } = createChatVirtualizer({
      messages,
      offset,
      followOnAppend,
      threshold,
    })

    setMessages([...messages.slice(1), { id: 'm-8' }])

    expect(scrollToFn).toHaveBeenCalledTimes(1)
    expect(scrollToFn.mock.calls[0]![0]).toBe(target)
  },
)

test('followOnAppend stays pinned across sliding updates without scroll events', () => {
  const messages = Array.from({ length: 8 }, (_, i) => ({ id: `m-${i}` }))
  const { virtualizer, setMessages, scrollToFn } = createChatVirtualizer({
    messages,
    offset: 200,
    followOnAppend: true,
  })

  // Equal-size append + trim leaves the DOM offset unchanged, so no scroll event fires.
  setMessages([...messages.slice(1), { id: 'm-8' }])
  expect(virtualizer.isAtEnd()).toBe(true)

  setMessages([...messages.slice(2), { id: 'm-8' }, { id: 'm-9' }])
  expect(virtualizer.isAtEnd()).toBe(true)
  expect(scrollToFn.mock.calls.at(-1)![0]).toBe(200)
})

test('followOnAppend stays pinned with a stable key callback', () => {
  const messages = Array.from({ length: 20 }, (_, i) => ({ id: `m-${i}` }))
  const { virtualizer, scrollToFn } = createChatVirtualizer({
    messages,
    offset: 800,
    followOnAppend: true,
  })
  virtualizer.getVirtualItems()

  for (let step = 1; step <= 2; step++) {
    scrollToFn.mockClear()
    messages.splice(0, 1)
    messages.push({ id: `m-${19 + step}` })
    virtualizer.setOptions(virtualizer.options)
    virtualizer._willUpdate()

    expect(scrollToFn.mock.calls.at(-1)?.[0]).toBe(800)
    // A no-op end scroll produces no browser scroll event.
    expect(virtualizer.isAtEnd()).toBe(true)
    virtualizer.getVirtualItems()
  }
})

test.each([
  { name: 'replacement', ids: [8, 9, 10, 11, 12, 13, 14, 15], target: null },
  { name: 'reorder', ids: [1, 0, 2, 3, 4, 5, 7, 6], target: null },
  { name: 'rotation', ids: [1, 2, 3, 4, 5, 6, 7, 0], target: 150 },
  { name: 'rotation with append', ids: [2, 3, 4, 5, 6, 7, 0, 8], target: 100 },
  { name: 'reordered overlap', ids: [1, 3, 2, 4, 5, 6, 7, 8], target: 150 },
  { name: 'trim only', ids: [1, 2, 3, 4, 5, 6, 7], target: 150 },
  {
    name: 'prepend and trim tail',
    ids: [-1, 0, 1, 2, 3, 4, 5, 6],
    target: 250,
  },
])('followOnAppend does not follow $name', ({ ids, target }) => {
  const messages = Array.from({ length: 8 }, (_, i) => ({ id: `m-${i}` }))
  const { setMessages, scrollToFn } = createChatVirtualizer({
    messages,
    offset: 200,
    followOnAppend: true,
  })

  setMessages(ids.map((id) => ({ id: `m-${id}` })))

  if (target === null) {
    expect(scrollToFn).not.toHaveBeenCalled()
  } else {
    expect(scrollToFn).toHaveBeenCalledTimes(1)
    expect(scrollToFn.mock.calls[0]![0]).toBe(target)
    expect(scrollToFn.mock.calls[0]![1].behavior).toBeUndefined()
  }
})

test('anchorTo:end keeps a pinned streaming message pinned as it grows', () => {
  const messages = Array.from({ length: 5 }, (_, i) => ({ id: `m-${i}` }))
  const { virtualizer, scrollElement, scrollToFn } = createChatVirtualizer({
    messages,
    offset: 50,
  })

  ;(scrollElement as any).scrollHeight = 320
  virtualizer.resizeItem(4, 120)

  expect(scrollToFn).toHaveBeenCalledTimes(1)
  const [offset, options] = scrollToFn.mock.calls[0]!
  expect(offset).toBe(50)
  expect(options.adjustments).toBe(70)
})

test('anchorTo:end stays pinned across consecutive resizes when the scrollTop write is clamped', () => {
  const messages = Array.from({ length: 5 }, (_, i) => ({ id: `m-${i}` }))
  const { virtualizer, scrollToFn } = createChatVirtualizer({
    messages,
    offset: 50,
  })

  // First growth tick. The DOM `scrollTop` write may be clamped because the
  // consumer hasn't grown the sizer yet (`notify()` runs after the
  // adjustment in `resizeItem`), so no scroll event fires — `scrollToFn`
  // here is a no-op mock, mirroring that.
  virtualizer.resizeItem(4, 120)
  expect(scrollToFn).toHaveBeenCalledTimes(1)
  expect(scrollToFn.mock.calls[0]![1].adjustments).toBe(70)
  scrollToFn.mockClear()

  // Second growth tick with no scroll event in between. Before the fix,
  // `getVirtualDistanceFromEnd()` would compute against the stale
  // `scrollOffset` (50) and a grown `getTotalSize()` (320), conclude we had
  // drifted 70 px from the end (> `scrollEndThreshold: 1`), and skip the
  // adjustment — drifting forever from tick 2 onward.
  virtualizer.resizeItem(4, 200)
  expect(scrollToFn).toHaveBeenCalledTimes(1)
  expect(scrollToFn.mock.calls[0]![0]).toBe(120)
  expect(scrollToFn.mock.calls[0]![1].adjustments).toBe(80)
})

test('anchorTo:end does not follow streaming growth when user is away from end', () => {
  const messages = Array.from({ length: 8 }, (_, i) => ({ id: `m-${i}` }))
  const { virtualizer, scrollToFn } = createChatVirtualizer({
    messages,
    offset: 50,
  })

  virtualizer.resizeItem(7, 120)

  expect(scrollToFn).not.toHaveBeenCalled()
})

test('isAtEnd and getDistanceFromEnd use the scroll element max offset', () => {
  const messages = Array.from({ length: 5 }, (_, i) => ({ id: `m-${i}` }))
  const { virtualizer } = createChatVirtualizer({
    messages,
    offset: 40,
    threshold: 15,
  })

  expect(virtualizer.getDistanceFromEnd()).toBe(10)
  expect(virtualizer.isAtEnd()).toBe(true)
  expect(virtualizer.isAtEnd(5)).toBe(false)
})

// ─── #1229: negative tracked scrollOffset must not survive compensation ─────
// anchorTo: 'end' + element scrolling + items measuring smaller than their
// estimates + content shorter than the viewport. The end-anchor compensation
// applies a negative delta; the DOM clamps the scrollTop write to 0 and an
// unscrollable element never fires a scroll event, so an unclamped tracked
// offset would stay negative forever — phantom getDistanceFromEnd(), wedged
// _flushIosDeferredIfReady.

const makeUnscrollableElement = () => {
  // Content fits the viewport: the browser clamps scrollHeight to
  // clientHeight, so maxScrollOffset = 0 and no scroll event can fire.
  const el = {
    scrollTop: 0,
    scrollLeft: 0,
    scrollWidth: 400,
    scrollHeight: 600,
    clientWidth: 400,
    clientHeight: 600,
    scrollTo: ({ top }: { top: number }) => {
      el.scrollTop = Math.max(0, Math.min(top, 0))
    },
  }
  return el as unknown as HTMLDivElement
}

const unscrollableOptions = (
  scrollElement: HTMLDivElement,
  offsetCbRef: {
    current: ((offset: number, isScrolling: boolean) => void) | null
  },
) => ({
  count: 5,
  // Estimates larger than the real measured sizes
  estimateSize: () => 100,
  anchorTo: 'end' as const,
  getScrollElement: () => scrollElement,
  scrollToFn: (
    offset: number,
    {
      adjustments = 0,
      behavior,
    }: { adjustments?: number; behavior?: ScrollBehavior },
    instance: Virtualizer<HTMLDivElement, any>,
  ) => {
    instance.scrollElement?.scrollTo?.({ top: offset + adjustments, behavior })
  },
  observeElementRect: (
    _instance: unknown,
    cb: (rect: { width: number; height: number }) => void,
  ) => {
    cb({ width: 400, height: 600 })
    return () => {}
  },
  observeElementOffset: (
    _instance: unknown,
    cb: (offset: number, isScrolling: boolean) => void,
  ) => {
    offsetCbRef.current = cb
    cb(0, false)
    return () => {}
  },
})

test('anchorTo end: shrink compensation clamps tracked scrollOffset at 0 when content fits the viewport (#1229)', () => {
  const scrollElement = makeUnscrollableElement()
  const offsetCbRef = { current: null as any }
  const virtualizer = new Virtualizer(
    unscrollableOptions(scrollElement, offsetCbRef),
  )

  virtualizer._willUpdate()
  virtualizer.getVirtualItems()

  // Real sizes come in smaller than the estimates (98 vs 100)
  for (let i = 0; i < 5; i++) {
    virtualizer.resizeItem(i, 98)
  }

  // The element is trivially at its end: 490px of content in a 600px
  // viewport, pinned at scrollTop 0.
  expect(scrollElement.scrollTop).toBe(0)
  expect(virtualizer.scrollOffset).toBe(0)
  expect(virtualizer.getDistanceFromEnd()).toBe(0)
  expect(virtualizer.isAtEnd()).toBe(true)
})

test('anchorTo end: setOptions re-anchor clamps tracked scrollOffset at 0 (#1229)', () => {
  const scrollElement = makeUnscrollableElement()
  const offsetCbRef = { current: null as any }
  const options = unscrollableOptions(scrollElement, offsetCbRef)
  const virtualizer = new Virtualizer(options)

  virtualizer._willUpdate()
  virtualizer.getVirtualItems()

  // Simulate a transiently negative offset reported by a real scroll event
  // (elastic overscroll) landing right before an options update.
  offsetCbRef.current!(-10, false)
  expect(virtualizer.scrollOffset).toBe(-10)

  // Trim the last item: edge keys change, triggering the end-anchor
  // re-resolution in setOptions. The anchor item (index 0) still starts at
  // 0, so the unclamped offset would be written back as -10.
  virtualizer.setOptions({ ...options, count: 4 })

  expect(virtualizer.scrollOffset).toBe(0)
})

// ─── #1258: compensation write clamped by a not-yet-grown sizer ─────────────
// 5 items × 50px + paddingEnd 80 = 330px sizer, 200px viewport → the bottom is
// scrollTop 130. When the last item grows by 70, resizeItem writes 200, but
// the consumer has not committed the 400px sizer yet, so the browser clamps
// the write to the current max (130) — exactly paddingEnd short once the
// overflowing item alone has extended scrollHeight. The write must be
// re-issued once the sizer has grown.

function clampedGrowthSetup() {
  const messages = Array.from({ length: 5 }, (_, i) => ({ id: `m-${i}` }))
  const setup = createChatVirtualizer({
    messages,
    offset: 130,
    paddingEnd: 80,
    threshold: 0,
  })
  setup.virtualizer.resizeItem(4, 120)
  // The end-anchor compensation fired against the not-yet-grown sizer.
  expect(setup.scrollToFn).toHaveBeenCalledTimes(1)
  expect(setup.scrollToFn.mock.calls[0]![1].adjustments).toBe(70)
  return setup
}

test('#1258: clamped end-anchor write is re-issued after the read-back once the sizer grows', () => {
  const { virtualizer, scrollElement, scrollToFn, emitScroll } =
    clampedGrowthSetup()

  // Browser read-back of the clamped write: it landed on the old max.
  emitScroll(130)
  // Consumer commits the grown sizer, then the layout effect runs.
  ;(scrollElement as any).scrollHeight = 400
  virtualizer._willUpdate()

  expect(scrollToFn).toHaveBeenCalledTimes(2)
  expect(scrollToFn.mock.calls[1]![0]).toBe(200)
})

test('#1258: clamped end-anchor write is re-issued in a sync render before the read-back', () => {
  const { virtualizer, scrollElement, scrollToFn } = clampedGrowthSetup()

  // flushSync path: the layout effect runs before the scroll event arrives.
  ;(scrollElement as any).scrollHeight = 400
  virtualizer._willUpdate()

  expect(scrollToFn).toHaveBeenCalledTimes(2)
  expect(scrollToFn.mock.calls[1]![0]).toBe(200)
})

test('#1258: a render without sizer growth does not re-issue; a later one does', () => {
  const { virtualizer, scrollElement, scrollToFn, emitScroll } =
    clampedGrowthSetup()

  emitScroll(130)
  virtualizer._willUpdate()
  expect(scrollToFn).toHaveBeenCalledTimes(1)
  ;(scrollElement as any).scrollHeight = 400
  virtualizer._willUpdate()
  expect(scrollToFn).toHaveBeenCalledTimes(2)
})

test('#1258: a real gesture after the clamp cancels the pending re-issue', () => {
  const { virtualizer, scrollElement, scrollToFn, emitScroll } =
    clampedGrowthSetup()

  emitScroll(130)
  // The user scrolls up to read history.
  emitScroll(60, true)
  ;(scrollElement as any).scrollHeight = 400
  virtualizer._willUpdate()

  expect(scrollToFn).toHaveBeenCalledTimes(1)
})

test('#1258: an unclamped compensation write is not re-issued when the sizer later grows', () => {
  // 8 × 50 = 400px, viewport 200, user reading at 100. Item 0 (above the
  // fold) re-measures +10 → compensation writes 110, well within max 200.
  const messages = Array.from({ length: 8 }, (_, i) => ({ id: `m-${i}` }))
  const { virtualizer, scrollElement, scrollToFn, emitScroll } =
    createChatVirtualizer({ messages, offset: 100 })

  virtualizer.resizeItem(0, 60)
  expect(scrollToFn).toHaveBeenCalledTimes(1)
  emitScroll(110)
  ;(scrollElement as any).scrollHeight = 450
  virtualizer._willUpdate()

  expect(scrollToFn).toHaveBeenCalledTimes(1)
})

test('#1266: a consumer that grows the sizer synchronously in onChange gets the clamped write re-issued without a re-render', () => {
  // Direct DOM updates: the adapter sets the container height inside
  // onChange, and with an unchanged range nothing re-renders afterwards.
  const messages = Array.from({ length: 5 }, (_, i) => ({ id: `m-${i}` }))
  const { virtualizer, scrollElement, scrollToFn } = createChatVirtualizer({
    messages,
    offset: 130,
    paddingEnd: 80,
    threshold: 0,
  })
  virtualizer.options.onChange = (instance) => {
    ;(scrollElement as any).scrollHeight = instance.getTotalSize()
  }

  virtualizer.resizeItem(4, 120)

  expect(scrollToFn).toHaveBeenCalledTimes(2)
  expect(scrollToFn.mock.calls[0]![1].adjustments).toBe(70)
  expect(scrollToFn.mock.calls[1]![0]).toBe(200)
  expect(virtualizer['_clampedAdjustment']).toBeNull()
})

test('#1258: both retry sites firing in one sync pass write exactly once', () => {
  // flushSync consumer: onChange grows the sizer AND runs the layout effect
  // (_willUpdate) synchronously inside notify. The retry after notify must then
  // find nothing pending — no double write.
  const messages = Array.from({ length: 5 }, (_, i) => ({ id: `m-${i}` }))
  const { virtualizer, scrollElement, scrollToFn } = createChatVirtualizer({
    messages,
    offset: 130,
    paddingEnd: 80,
    threshold: 0,
  })
  virtualizer.options.onChange = (instance) => {
    ;(scrollElement as any).scrollHeight = instance.getTotalSize()
    instance._willUpdate()
  }

  virtualizer.resizeItem(4, 120)

  expect(scrollToFn).toHaveBeenCalledTimes(2)
  expect(scrollToFn.mock.calls[1]![0]).toBe(200)
  expect(virtualizer['_clampedAdjustment']).toBeNull()
})

test('#1258: a partially grown sizer re-issues and stays pending until the target fits', () => {
  const { virtualizer, scrollElement, scrollToFn, emitScroll } =
    clampedGrowthSetup()
  emitScroll(130)

  // Sizer grew only to 360 → max 160, still short of the 200 target.
  ;(scrollElement as any).scrollHeight = 360
  virtualizer._willUpdate()
  expect(scrollToFn).toHaveBeenCalledTimes(2)
  expect(scrollToFn.mock.calls[1]![0]).toBe(200)
  expect(virtualizer['_clampedAdjustment']).toEqual({
    target: 200,
    maxAtWrite: 160,
  })

  // The browser clamps that write to the new max; its read-back keeps it pending.
  emitScroll(160)
  expect(virtualizer['_clampedAdjustment']).not.toBeNull()
  ;(scrollElement as any).scrollHeight = 400
  virtualizer._willUpdate()
  expect(scrollToFn).toHaveBeenCalledTimes(3)
  expect(scrollToFn.mock.calls[2]![0]).toBe(200)
  expect(virtualizer['_clampedAdjustment']).toBeNull()
})

test('#1258: cleanup drops a pending clamped write', () => {
  const { virtualizer } = clampedGrowthSetup()
  expect(virtualizer['_clampedAdjustment']).not.toBeNull()

  virtualizer['cleanup']()

  expect(virtualizer['_clampedAdjustment']).toBeNull()
})
