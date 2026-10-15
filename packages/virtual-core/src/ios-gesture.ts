// Browser-aware iOS detection. Programmatic `scrollTo`/`scrollTop` writes
// during a momentum-scroll cancel the momentum on iOS WebKit, so we defer
// scroll-position adjustments triggered by mid-scroll resizes until the
// scroll settles. SSR-safe (returns false when navigator is unavailable).
let _isIOSResult: boolean | undefined
export const isIOSWebKit = (): boolean => {
  if (_isIOSResult !== undefined) return _isIOSResult
  if (typeof navigator === 'undefined') return (_isIOSResult = false)
  if (/iP(hone|od|ad)/.test(navigator.userAgent)) return (_isIOSResult = true)
  // iPadOS 13+ reports as MacIntel; touch-points distinguishes it from desktop.
  const mtp = (navigator as Navigator & { maxTouchPoints?: number })
    .maxTouchPoints
  return (_isIOSResult =
    navigator.platform === 'MacIntel' && mtp !== undefined && mtp > 0)
}

// iOS 27 changed what a scrollTop write does to a fling: it no longer stops
// the momentum, the fling carries on along its own path and the write shows
// for one frame (measured on the 27.0 simulator in #1307, device check still
// open). WebKit shipped `overflow-anchor` in the same release, so that is
// the feature check; iOS 26 and earlier report false. Cached like the iOS
// check; SSR-safe.
let _iosMomentumOverridesWritesResult: boolean | undefined
export const iosMomentumOverridesWrites = (): boolean => {
  if (_iosMomentumOverridesWritesResult !== undefined) {
    return _iosMomentumOverridesWritesResult
  }
  return (_iosMomentumOverridesWritesResult =
    isIOSWebKit() &&
    typeof CSS !== 'undefined' &&
    typeof CSS.supports === 'function' &&
    CSS.supports('overflow-anchor: auto'))
}

// Test hook: reset the iOS detection caches. Not exported.
export const _resetIOSDetectionForTests = () => {
  _isIOSResult = undefined
  _iosMomentumOverridesWritesResult = undefined
}

// Touch listeners on the scroll element run in the capture phase, so a row
// that stops a touch event's propagation cannot hide the gesture from the
// iOS deferral.
const touchListenerOptions = {
  capture: true,
  passive: true,
}

// The touch gesture in progress. iOS WebKit ignores a scrollTop write while
// a finger drags the content (one resting on it does not stop the write)
// and cancels momentum on one after it, so adjustments are deferred through
// the whole gesture: `down` from touchstart to touchend/touchcancel, then
// `tail` while momentum runs. iOS fires no touch events during momentum, so
// every scroll event re-arms the tail and it closes ~150ms after the last
// one. Null between gestures, and after touchend on non-iOS, which arms no
// tail. The tail record owns its timer: every replacement of the state goes
// through `end`, which clears it, so a live timer always has its record.
//
// `moved`: the content moved under or after the finger other than by our
// own write's read-back. While `down`, a scroll event that changed the
// position sets it: the finger is dragging. The tail inherits it from the
// drag, and any other scroll event re-arming the tail sets it: a fling can
// be running. A tap's tail has it unset.
//
// `awaitingFling`: the tail follows a drag whose fling has not reported
// yet. The first frame of a fling can come 150–250ms after touchend when
// the main thread is busy (27.0 simulator, #1307); if the tail closes
// first, `lateFling` waits until `until` for that frame to reopen it. It
// defers nothing: other scroll events with no touch before them must not
// defer corrections (#1250).
type IosTouch =
  | { phase: 'down'; moved: boolean }
  | { phase: 'tail'; moved: boolean; awaitingFling: boolean; timerId: number }
  | { phase: 'lateFling'; until: number }
  | null

type TimerWindow = Pick<Window, 'setTimeout' | 'clearTimeout'>

export class IosGesture {
  private _touch: IosTouch = null

  constructor(
    private readonly host: {
      // The scroll element's window, which runs the tail timer; null when
      // there is no element.
      getWindow: () => TimerWindow | null
      now: () => number
      // Asked when the tail's timer fires: true keeps it open another
      // 150ms (the fling still moves between scroll events).
      tailStillMoving: () => boolean
      // The tail closed on its own: a write is possible again.
      onTailClosed: () => void
    },
  ) {}

  get touch(): IosTouch {
    return this._touch
  }

  // A touch gesture owns the scroll: on iOS a write now would be ignored or
  // would cancel the momentum, so adjustments wait for the tail to close.
  // `isScrolling` is not part of it: any scroll event sets it, including
  // the read-back of our own write, and a programmatic scroll has no
  // momentum to protect (#1250).
  inMotion = () => this._touch !== null && this._touch.phase !== 'lateFling'

  // A finger is dragging the content, so iOS ignores our writes and no
  // read-back will come. A resting finger does not: the write lands.
  dragging = () => this._touch?.phase === 'down' && this._touch.moved

  // The open tail, if any: after a tap, or after a drag or fling. On iOS 27
  // a fling's momentum overrides a write within a frame (see
  // `iosMomentumOverridesWrites`).
  tail = (): 'tap' | 'fling' | null =>
    this._touch?.phase === 'tail' ? (this._touch.moved ? 'fling' : 'tap') : null

  // A scroll event reached the handler. `ownReadBack`: it is our own
  // write's read-back; `moved`: it changed the layout position; `external`:
  // the user or a fling moved it (not our write nor our smooth animation).
  // Returns whether it shows a finger dragging the content.
  onScroll = ({
    isScrolling,
    ownReadBack,
    moved,
    external,
  }: {
    isScrolling: boolean
    ownReadBack: boolean
    moved: boolean
    external: boolean
  }): boolean => {
    // Momentum after touchend fires a scroll event per frame but no touch
    // events, so each one re-arms the tail to span the fling. Only an open
    // tail is extended: a scroll event with no touch before it (our own
    // write's read-back) never opens one.
    if (isScrolling && this._touch?.phase === 'tail') {
      this._openTail(this._touch.moved || !ownReadBack, false)
    } else if (this._touch?.phase === 'lateFling') {
      // A drag's fling reporting after its tail closed reopens it.
      if (this.host.now() > this._touch.until) {
        this._touch = null
      } else if (external && isScrolling && moved) {
        this._openTail(true, false)
      }
    }
    // A finger that moved the content is dragging. Our own write landing
    // under a resting finger is not, and neither is a report at rest that
    // leaves the position where it was.
    if (!ownReadBack && isScrolling && moved && this._touch?.phase === 'down') {
      this._touch.moved = true
      return true
    }
    return false
  }

  touchStart = () => {
    // A finger back down inside the grace window cancels its tail.
    this.end()
    this._touch = { phase: 'down', moved: false }
  }

  touchEnd = () => {
    const moved = this._touch?.phase === 'down' && this._touch.moved
    this.end()
    this._openTail(moved, moved)
  }

  // Drop the gesture, and the tail's timer with it.
  end = () => {
    const win = this.host.getWindow()
    if (this._touch?.phase === 'tail' && win != null) {
      win.clearTimeout(this._touch.timerId)
    }
    this._touch = null
  }

  // Follow the touch events on `target`; the returned function stops and
  // drops the gesture. Listening is unconditional: the listeners are
  // passive and cheap, and on non-touch devices they never fire. The gating
  // by `isIOSWebKit()` lives where a write is decided.
  listen = (target: EventTarget) => {
    const onTouchStart = () => this.touchStart()
    const onTouchEnd = () => this.touchEnd()
    target.addEventListener('touchstart', onTouchStart, touchListenerOptions)
    target.addEventListener('touchend', onTouchEnd, touchListenerOptions)
    // Same handler as touchend: iOS can end a touch with touchcancel (system
    // gesture, interrupted scroll) and never fire touchend.
    target.addEventListener('touchcancel', onTouchEnd, touchListenerOptions)
    return () => {
      target.removeEventListener(
        'touchstart',
        onTouchStart,
        touchListenerOptions,
      )
      target.removeEventListener('touchend', onTouchEnd, touchListenerOptions)
      target.removeEventListener(
        'touchcancel',
        onTouchEnd,
        touchListenerOptions,
      )
      this.end()
    }
  }

  // (Re)open the tail after the finger lifts, closing ~150ms after the last
  // touchend or momentum frame. On non-iOS there is nothing to protect.
  private _openTail = (moved: boolean, awaitingFling: boolean) => {
    const win = this.host.getWindow()
    if (!isIOSWebKit() || win == null) return
    this.end()
    const tail = {
      phase: 'tail' as const,
      moved,
      awaitingFling,
      // Only fires while this tail is current: `end` clears it otherwise.
      timerId: win.setTimeout(() => {
        if (this.host.tailStillMoving()) {
          this._openTail(tail.moved, tail.awaitingFling)
          return
        }
        this._touch = tail.awaitingFling
          ? { phase: 'lateFling', until: this.host.now() + 1000 }
          : null
        this.host.onTailClosed()
      }, 150),
    }
    this._touch = tail
  }
}
