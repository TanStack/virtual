---
title: Chat
---

Chat, AI streams, logs, and other reverse feeds have a different scrolling contract than a standard top-anchored list. New output usually appears at the end, older history is prepended at the start, and the viewport should only follow new output when the user is already reading the latest item.

TanStack Virtual supports this with end anchoring:

```tsx
const virtualizer = useVirtualizer({
  count: messages.length,
  getScrollElement: () => parentRef.current,
  estimateSize: () => 72,
  getItemKey: React.useCallback(
    (index: number) => messages[index]!.id,
    [messages],
  ),
  anchorTo: 'end',
  followOnAppend: true,
  scrollEndThreshold: 80,
  overscan: 6,
})
```

See the full [React chat example](framework/react/examples/chat).

## Behaviors

### Start at the latest message

Use `scrollToEnd()` once the scroll element is mounted.

```tsx
React.useLayoutEffect(() => {
  virtualizer.scrollToEnd()
}, [virtualizer])
```

For server-rendered or restored screens, you can also use `initialOffset` and `initialMeasurementsCache`, but most chat screens start by imperatively scrolling to the latest item after mount.

### Keep older-history prepends stable

When the user scrolls near the top, load older messages and prepend them to the array. With `anchorTo: 'end'`, TanStack Virtual captures the visible item before the data changes, finds the same keyed item after the prepend, and adjusts the scroll offset so the message stays in the same visual position.

```tsx
setMessages((current) => [...olderMessages, ...current])
```

Stable keys are required for this to work:

```tsx
getItemKey: React.useCallback(
  (index: number) => messages[index]!.id,
  [messages],
),
```

Wrap getItemKey in useCallback so the virtualizer maintains a stable getItemKey reference. Without it, a new function identity can cause memoized measurement options to be recomputed, leading to unnecessary measurement rebuilds/cache invalidation.

Do not use index keys for chat history. After a prepend, every existing message shifts to a new index, so index keys cannot identify the same message across the update.

### Follow appended output only when pinned

Set `followOnAppend` to keep the viewport pinned to the end when a new message arrives and the user was already at the end.

```tsx
followOnAppend: true
```

If the user has scrolled up to read history, appended messages do not pull them away. `scrollEndThreshold` controls how close to the end counts as pinned.

```tsx
scrollEndThreshold: 80
```

Use a scroll behavior when you want the follow to animate:

```tsx
followOnAppend: 'smooth'
```

### Keep streaming output pinned

Streaming chat responses usually grow the last item many times. In end-anchored mode, if the viewport is pinned to the end before the measured size changes, the virtualizer adjusts by the size delta and keeps the bottom stuck to the latest output.

This works with the normal dynamic measurement pattern:

```tsx
{virtualizer.getVirtualItems().map((virtualItem) => (
  <div
    key={virtualItem.key}
    ref={virtualizer.measureElement}
    data-index={virtualItem.index}
    style={{
      position: 'absolute',
      transform: `translateY(${virtualItem.start}px)`,
      width: '100%',
    }}
  >
    <Message message={messages[virtualItem.index]!} />
  </div>
))}
```

## Recommended Pattern

Use a normal scroll container and normal item order. You do not need `flex-direction: column-reverse`, inverted transforms, or manual `scrollTop += delta` prepend compensation.

```tsx
<div ref={parentRef} style={{ height: 600, overflow: 'auto' }}>
  <div
    style={{
      height: virtualizer.getTotalSize(),
      position: 'relative',
      width: '100%',
    }}
  >
    {virtualizer.getVirtualItems().map((virtualItem) => (
      <div
        key={virtualItem.key}
        ref={virtualizer.measureElement}
        data-index={virtualItem.index}
        style={{
          position: 'absolute',
          transform: `translateY(${virtualItem.start}px)`,
          width: '100%',
        }}
      >
        <Message message={messages[virtualItem.index]!} />
      </div>
    ))}
  </div>
</div>
```

## Production Checklist

- Use stable message ids with `getItemKey`, wrapped in `useCallback`.
- Give the scroll element a fixed height and `overflow: auto`.
- Set `overflow-anchor: none` on the scroll element. Browsers that support native scroll anchoring (Chrome, Firefox) will otherwise fight the virtualizer's own offset adjustments on prepend, causing jumps. Safari does not support `overflow-anchor`, so this has no effect there.
- Call `measureElement` for dynamic message heights.
- Use `anchorTo: 'end'` for prepend stability and streaming bottom growth.
- Use `followOnAppend` when new output should follow only from the latest position.
- Use `isAtEnd()` to show "Jump to latest" UI when the user is reading history.
- Keep network loading state outside the virtualizer; prepend or append data normally.

## iOS Safari

iOS WebKit cancels momentum (inertia) scrolling whenever JavaScript writes to `scrollTop` or calls `scrollTo()`. This is a platform limitation — there is no opt-out. Since prepend anchoring and item-resize compensation both need to adjust the scroll position, a naïve implementation would kill the scroll mid-flick, making the list feel broken on iPhones and iPads.

TanStack Virtual works around this with a **CSS offset**: when a scroll adjustment is needed during an active touch or momentum phase, the virtualizer applies a negative `marginTop` on the container element instead of writing `scrollTop`. This shifts the content visually without touching the scroll position, so momentum continues uninterrupted. Once the scroll fully settles (no touch, no momentum, no elastic overscroll), the virtualizer flushes the accumulated CSS offset into a single `scrollTop` write and clears the margin.

No extra configuration is needed — this is handled automatically on iOS.

## API Reference

- [`anchorTo`](api/virtualizer#anchorto)
- [`followOnAppend`](api/virtualizer#followonappend)
- [`scrollEndThreshold`](api/virtualizer#scrollendthreshold)
- [`scrollToEnd`](api/virtualizer#scrolltoend)
- [`getDistanceFromEnd`](api/virtualizer#getdistancefromend)
- [`isAtEnd`](api/virtualizer#isatend)
