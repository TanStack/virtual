import { approxEqual } from './utils'

// Why a scroll event arrived, decided from the virtualizer's state as it was
// before the event, before the scroll handler mutates anything. The first
// match in this order wins:
//   spurious         Safari/Firefox re-emit at the position we hold, nothing
//                    pending
//   readBack         our last write reporting back (within 1.5px of its
//                    target)
//   clampedReadBack  our last non-smooth write, clamped at the element's
//                    current max or at a smaller max the layout passed
//                    through since the write
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
  // Our last write to the element, until a scroll event reports it, with
  // the scroll maxima below its target the element had since (see
  // `lowMaxes` on `pendingWrite` in the virtualizer).
  pendingWrite: {
    target: number
    smooth: boolean
    lowMaxes?: Array<number>
  } | null
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
  // The same, clamped to a smaller max than the element's current one: the
  // sizer shrank below the target after the write (rows measured smaller,
  // a count change) and the browser clamped there, then it grew back, all
  // before the report. The clamp lands on one of those maxima; a position
  // between them is not one.
  if (
    pendingWrite !== null &&
    !pendingWrite.smooth &&
    pendingWrite.lowMaxes?.some((max) => Math.abs(offset - max) < 1.5)
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

// A scroll position reported at a time, in the element's own coordinates.
export interface ScrollSample {
  t: number
  offset: number
}

const FLING_WINDOW_MS = 40

// Whether the scroll sped up: a finger flicked again or dragged on during a
// fling. iOS fires no touch events for a touch that lands on a fling
// (#1307), so this, and a turn against the fling, is all that shows it.
// Momentum only slows down. Scroll events arrive 7–26ms apart and some
// carry two frames, so one event can read 2–3× faster than its neighbours;
// the speed is taken over the last 40ms and compared with the 40ms before.
// On an iPhone (27.0.1) the flicks read 2.4–6× faster than the window before
// and at least 1.5px/ms more, momentum alone at most 1.7× (#1307).
export function flingSpedUp(samples: ReadonlyArray<ScrollSample>): boolean {
  const last = samples[samples.length - 1]
  if (last === undefined) return false
  let j = samples.length - 2
  while (j >= 0 && last.t - samples[j]!.t < FLING_WINDOW_MS) j--
  if (j < 0) return false
  const mid = samples[j]!
  let k = j - 1
  while (k >= 0 && mid.t - samples[k]!.t < FLING_WINDOW_MS) k--
  if (k < 0) return false
  const first = samples[k]!
  const recent = (last.offset - mid.offset) / (last.t - mid.t)
  const before = (mid.offset - first.offset) / (mid.t - first.t)
  return (
    recent * before >= 0 &&
    Math.abs(recent) >= 2 * Math.abs(before) &&
    Math.abs(recent) - Math.abs(before) >= 0.8
  )
}

// Whether a fling that sent its last scroll event was still going at
// 0.05px/ms or more over its last 40ms: a finger caught it. A fling that
// ends on its own fades to at most 0.015px/ms first; taps stopped one at
// 0.21–1.43px/ms (iPhones on 27.0.1, #1307). The finger stays down with no
// touch events, and iOS undoes a write made under it. A tap in the last
// pixels of a fling reads as its end.
export function flingCaught(samples: ReadonlyArray<ScrollSample>): boolean {
  const last = samples[samples.length - 1]
  if (last === undefined) return false
  let j = samples.length - 2
  while (j >= 0 && last.t - samples[j]!.t < FLING_WINDOW_MS) j--
  if (j < 0) return false
  const from = samples[j]!
  return Math.abs(last.offset - from.offset) / (last.t - from.t) >= 0.05
}
