// Why a scroll event arrived, decided from the virtualizer's state as it was
// before the event, before the scroll handler mutates anything. The first
// match in this order wins:
//   spurious         Safari/Firefox re-emit at the position we hold, nothing
//                    pending
//   readBack         our last write reporting back (within 1.5px of its
//                    target)
//   clampedReadBack  our last non-smooth write, clamped at the element's
//                    current max
//   clampedEcho      a compensation write the browser clamped (#1258)
//                    reporting at the max seen at write time
//   external         anything else: the user, a fling, a smooth animation
//                    frame
type ScrollEventKind =
  | 'spurious'
  | 'readBack'
  | 'clampedReadBack'
  | 'clampedEcho'
  | 'external'

export interface ScrollEventInput {
  // The reported position in layout coordinates (the element's offset plus
  // the held correction and a pending prepend anchor's delta).
  offset: number
  isScrolling: boolean
  // The element's own scroll max, read only while scrolling (null otherwise
  // or where it cannot be read).
  elementMax: number | null
  // How far the element sits behind the layout while a correction is held.
  holdOffset: number
  // The layout position the virtualizer holds.
  scrollOffset: number | null
  // Our last write to the element, until a scroll event reports it.
  pendingWrite: { target: number; smooth: boolean } | null
  // The element's max when a clamped compensation write was made (#1258),
  // or null when none is pending.
  clampedMaxAtWrite: number | null
}

export function classifyScrollEvent({
  offset,
  isScrolling,
  elementMax,
  holdOffset,
  scrollOffset,
  pendingWrite,
  clampedMaxAtWrite,
}: ScrollEventInput): ScrollEventKind {
  // A scroll event that reports movement but lands on the offset we already
  // hold — and isn't a self-write read-back — is a spurious no-op re-emit
  // that Safari/Firefox fire after a re-render's layout (Chrome doesn't).
  // Treating it as scrolling re-arms `isScrolling`, which forces a render
  // that triggers another such event: an infinite re-render loop.
  if (isScrolling && pendingWrite === null && offset === scrollOffset) {
    return 'spurious'
  }
  if (pendingWrite !== null && Math.abs(offset - pendingWrite.target) < 1.5) {
    return 'readBack'
  }
  // A non-smooth write past the element's max reads back at the max: ours,
  // clamped because the sizer shrank between the write and the report (rows
  // above the target measured smaller in a same-task render, #1310). The
  // element is where it says. A finger that drags to the max while such a
  // write is pending (iOS ignored it) is read the same way; the command then
  // retires at the next frame, its target clamped to the same max.
  if (
    pendingWrite !== null &&
    !pendingWrite.smooth &&
    elementMax !== null &&
    pendingWrite.target > elementMax + holdOffset + 0.5 &&
    Math.abs(offset - (elementMax + holdOffset)) < 1.5
  ) {
    return 'clampedReadBack'
  }
  if (
    clampedMaxAtWrite !== null &&
    Math.abs(offset - clampedMaxAtWrite) < 1.5
  ) {
    return 'clampedEcho'
  }
  return 'external'
}
