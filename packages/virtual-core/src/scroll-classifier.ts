import { approxEqual } from './utils'

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

// Where an in-flight scroll command is in its lifecycle, which decides how
// its scroll events and measurements are read:
//   queued           the first write waits for the momentum tail to close
//                    (iOS 27, see `_startScroll`). Nothing has been written:
//                    the fling's scroll events do not retire the command, a
//                    drag does, and reconcile only keeps the safety valve
//   smooth           a smooth animation is travelling to the target
//   smoothLanded     a smooth scroll is at its target, waiting to retire
//   smoothFinishing  a smooth scroll switched to instant writes for the
//                    final approach; its animation can still report positions
//   instant          instant writes
export type ScrollPhase =
  | 'queued'
  | 'smooth'
  | 'smoothLanded'
  | 'smoothFinishing'
  | 'instant'

// The smooth animation may still be reporting positions, so a scroll event
// that isn't the read-back of our own write may not be the user.
const isAnimating = (phase: ScrollPhase) =>
  phase === 'smooth' || phase === 'smoothFinishing'

export interface RetireInput {
  kind: ScrollEventKind
  // The reported position in layout coordinates, as classified.
  offset: number
  // The in-flight scroll command, or null.
  command: {
    index: number | null
    phase: ScrollPhase
    lastTargetOffset: number
  } | null
  // The command's target recomputed against the current layout. Called
  // only once every cheaper clause has passed, and at most once.
  target: () => number
}

// Whether a scroll event that is not the read-back of our own write retires
// the in-flight index command: an external scroll moved away from its
// target. Our own measurement updates (including clamped writes) still need
// to reconcile.
export function externalRetiresCommand({
  kind,
  offset,
  command,
  target,
}: RetireInput): boolean {
  return (
    kind !== 'spurious' &&
    kind !== 'readBack' &&
    // Our own write, clamped (`clampedReadBack`, #1310): the command is not
    // retired by it, and reconcile retargets below the new max.
    kind !== 'clampedReadBack' &&
    command?.index != null &&
    // Nothing has been written for a command waiting for the tail; these
    // are the fling's events.
    command.phase !== 'queued' &&
    // A non-smooth write lands at once, so any other scroll event is the
    // user's, even before reconcile saw the target reached (the target may
    // keep moving, or iOS ignored the write under a finger). A write the
    // browser clamped because the sizer hasn't grown yet reads back at the
    // max, which is also where the fresh target clamps, so the check below
    // keeps it reconciling (#1294). While a smooth scroll's animation may
    // still report, its events look like a user's, so it yields only once it
    // has landed.
    !isAnimating(command.phase) &&
    !approxEqual(offset, command.lastTargetOffset) &&
    !approxEqual(offset, target()) &&
    // A compensation write's clamped echo (#1258) keeps the command. The
    // order is deliberate, not tidiness: this clause stays after `target()`
    // (and `clampedReadBack` before it) because `target()` can rebuild the
    // measurements, so it must run for exactly the events it always did.
    kind !== 'clampedEcho'
  )
}
