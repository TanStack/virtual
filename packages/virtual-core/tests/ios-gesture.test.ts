import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import {
  IosGesture,
  _resetIOSDetectionForTests,
  iosMomentumOverridesWrites,
  momentumOverridesWrites,
} from '../src/ios-gesture'

const setUserAgent = (ios: boolean, ios27 = false) => {
  if (ios) {
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)',
      configurable: true,
    })
  } else {
    delete (navigator as any).userAgent
  }
  if (ios27) {
    ;(globalThis as any).CSS = {
      supports: (query: string) => query === 'overflow-anchor: auto',
    }
  }
  _resetIOSDetectionForTests()
}

const make = () => {
  const onTailClosed = vi.fn()
  const tailStillMoving = vi.fn(() => false)
  let win: Window | null = window
  const gesture = new IosGesture({
    getWindow: () => win,
    now: () => Date.now(),
    tailStillMoving,
    onTailClosed,
  })
  return {
    gesture,
    onTailClosed,
    tailStillMoving,
    detachWindow: () => {
      win = null
    },
  }
}

const scroll = (
  gesture: IosGesture,
  {
    isScrolling = true,
    ownReadBack = false,
    moved = true,
    external = !ownReadBack,
  } = {},
) => gesture.onScroll({ isScrolling, ownReadBack, moved, external })

beforeEach(() => {
  vi.useFakeTimers()
  setUserAgent(true)
})

afterEach(() => {
  vi.useRealTimers()
  delete (navigator as any).userAgent
  delete (globalThis as any).CSS
  _resetIOSDetectionForTests()
})

describe('IosGesture', () => {
  test('a tap: down, then a tail that closes 150ms after touchend', () => {
    const { gesture, onTailClosed } = make()
    expect(gesture.touch).toBeNull()
    expect(gesture.inMotion()).toBe(false)

    gesture.touchStart()
    expect(gesture.touch).toEqual({ phase: 'down', moved: false })
    expect(gesture.inMotion()).toBe(true)
    expect(gesture.dragging()).toBe(false)

    gesture.touchEnd()
    expect(gesture.touch).toMatchObject({ phase: 'tail', moved: false })
    expect(gesture.tail()).toBe('tap')

    vi.advanceTimersByTime(149)
    expect(onTailClosed).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(gesture.touch).toBeNull()
    expect(onTailClosed).toHaveBeenCalledTimes(1)
  })

  test('a drag: a scroll event that moves the position under the finger', () => {
    const { gesture } = make()
    gesture.touchStart()
    expect(scroll(gesture)).toBe(true)
    expect(gesture.dragging()).toBe(true)
    // Already dragging: still reported.
    expect(scroll(gesture)).toBe(true)

    gesture.touchEnd()
    expect(gesture.touch).toMatchObject({ phase: 'tail', moved: true })
    expect(gesture.dragging()).toBe(false)
  })

  test.each([
    ['our own read-back', { ownReadBack: true }],
    ['a report at rest', { isScrolling: false }],
    ['an event that leaves the position', { moved: false }],
  ])('%s under the finger is not a drag', (_, event) => {
    const { gesture } = make()
    gesture.touchStart()
    expect(scroll(gesture, event)).toBe(false)
    expect(gesture.touch).toEqual({ phase: 'down', moved: false })
  })

  test('a scroll event in the tail re-arms it; a read-back keeps a tap a tap', () => {
    const { gesture, onTailClosed } = make()
    gesture.touchStart()
    gesture.touchEnd()

    vi.advanceTimersByTime(100)
    expect(scroll(gesture, { ownReadBack: true, moved: false })).toBe(false)
    expect(gesture.touch).toMatchObject({ phase: 'tail', moved: false })

    vi.advanceTimersByTime(100)
    expect(onTailClosed).not.toHaveBeenCalled()
    // A momentum frame: the tail now has a fling.
    expect(scroll(gesture, { moved: false })).toBe(false)
    expect(gesture.touch).toMatchObject({ phase: 'tail', moved: true })

    vi.advanceTimersByTime(149)
    expect(onTailClosed).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(onTailClosed).toHaveBeenCalledTimes(1)
  })

  test('a report at rest does not re-arm the tail', () => {
    const { gesture, onTailClosed } = make()
    gesture.touchStart()
    gesture.touchEnd()
    vi.advanceTimersByTime(100)
    scroll(gesture, { isScrolling: false })
    vi.advanceTimersByTime(50)
    expect(onTailClosed).toHaveBeenCalledTimes(1)
  })

  test('a finger back down inside the tail cancels its timer', () => {
    const { gesture, onTailClosed } = make()
    gesture.touchStart()
    gesture.touchEnd()
    gesture.touchStart()
    vi.advanceTimersByTime(1000)
    expect(onTailClosed).not.toHaveBeenCalled()
    expect(gesture.touch).toEqual({ phase: 'down', moved: false })
  })

  test('end drops the gesture and its timer', () => {
    const { gesture, onTailClosed } = make()
    gesture.touchStart()
    gesture.touchEnd()
    gesture.end()
    expect(gesture.touch).toBeNull()
    expect(vi.getTimerCount()).toBe(0)
    vi.advanceTimersByTime(1000)
    expect(onTailClosed).not.toHaveBeenCalled()
  })

  test('a second touchend restarts the tail with one timer', () => {
    const { gesture, onTailClosed } = make()
    gesture.touchStart()
    gesture.touchEnd()
    vi.advanceTimersByTime(100)
    gesture.touchEnd()
    expect(vi.getTimerCount()).toBe(1)
    vi.advanceTimersByTime(100)
    expect(onTailClosed).not.toHaveBeenCalled()
    vi.advanceTimersByTime(50)
    expect(onTailClosed).toHaveBeenCalledTimes(1)
  })

  test('a tail on non-iOS too, but none without a window', () => {
    setUserAgent(false)
    const { gesture } = make()
    gesture.touchStart()
    scroll(gesture)
    gesture.touchEnd()
    expect(gesture.tail()).toBe('fling')

    setUserAgent(true)
    const other = make()
    other.detachWindow()
    other.gesture.touchStart()
    other.gesture.touchEnd()
    expect(other.gesture.touch).toBeNull()
  })

  test('tail: none while down, a tap, then a fling once a momentum frame comes', () => {
    const { gesture } = make()
    gesture.touchStart()
    expect(gesture.tail()).toBeNull()
    gesture.touchEnd()
    expect(gesture.tail()).toBe('tap')
    scroll(gesture)
    expect(gesture.tail()).toBe('fling')

    const drag = make()
    drag.gesture.touchStart()
    scroll(drag.gesture)
    drag.gesture.touchEnd()
    expect(drag.gesture.tail()).toBe('fling')
  })

  test('iosMomentumOverridesWrites: only on iOS 27', () => {
    expect(iosMomentumOverridesWrites()).toBe(false)
    setUserAgent(true, true)
    expect(iosMomentumOverridesWrites()).toBe(true)
    setUserAgent(false, true)
    expect(iosMomentumOverridesWrites()).toBe(false)
  })

  test('momentumOverridesWrites: everywhere but iOS 26 and earlier', () => {
    expect(momentumOverridesWrites()).toBe(false)
    setUserAgent(true, true)
    expect(momentumOverridesWrites()).toBe(true)
    setUserAgent(false)
    expect(momentumOverridesWrites()).toBe(true)
  })

  describe('listen', () => {
    test('follows touch events in the capture phase and stops on detach', () => {
      const { gesture, onTailClosed } = make()
      const el = document.createElement('div')
      const add = vi.spyOn(el, 'addEventListener')
      const remove = vi.spyOn(el, 'removeEventListener')
      const stop = gesture.listen(el)

      const options = { capture: true, passive: true }
      expect(add.mock.calls.map(([type, , opts]) => [type, opts])).toEqual([
        ['touchstart', options],
        ['touchend', options],
        ['touchcancel', options],
      ])

      el.dispatchEvent(new Event('touchstart'))
      expect(gesture.touch).toEqual({ phase: 'down', moved: false })
      el.dispatchEvent(new Event('touchcancel'))
      expect(gesture.tail()).toBe('tap')

      stop()
      expect(remove.mock.calls.map(([type]) => type)).toEqual([
        'touchstart',
        'touchend',
        'touchcancel',
      ])
      // Detaching drops the gesture and its timer.
      expect(gesture.touch).toBeNull()
      vi.advanceTimersByTime(1000)
      expect(onTailClosed).not.toHaveBeenCalled()

      el.dispatchEvent(new Event('touchstart'))
      expect(gesture.touch).toBeNull()
    })
  })

  test('a tail whose fling still moves stays open another 150ms', () => {
    const { gesture, onTailClosed, tailStillMoving } = make()
    gesture.touchStart()
    scroll(gesture)
    gesture.touchEnd()
    tailStillMoving.mockReturnValueOnce(true)
    vi.advanceTimersByTime(150)
    expect(tailStillMoving).toHaveBeenCalledTimes(1)
    expect(onTailClosed).not.toHaveBeenCalled()
    expect(gesture.touch).toMatchObject({ phase: 'tail', moved: true })
    vi.advanceTimersByTime(150)
    expect(onTailClosed).toHaveBeenCalledTimes(1)
    // A drag's tail closed before its fling reported: the late-fling window.
    expect(gesture.touch).toMatchObject({ phase: 'lateFling' })
    expect(gesture.inMotion()).toBe(false)
  })

  test('a drag whose fling reports after the tail closed reopens it, within 1s', () => {
    const { gesture } = make()
    gesture.touchStart()
    scroll(gesture)
    gesture.touchEnd()
    vi.advanceTimersByTime(150)
    // Waiting for the fling's first frame defers nothing.
    expect(gesture.touch).toMatchObject({ phase: 'lateFling' })
    expect(gesture.inMotion()).toBe(false)
    vi.advanceTimersByTime(100)
    scroll(gesture)
    expect(gesture.touch).toMatchObject({ phase: 'tail', moved: true })
  })

  test('a momentum frame in time leaves no late-fling window', () => {
    const { gesture } = make()
    gesture.touchStart()
    scroll(gesture)
    gesture.touchEnd()
    vi.advanceTimersByTime(50)
    scroll(gesture)
    vi.advanceTimersByTime(150)
    expect(gesture.touch).toBeNull()
  })

  test('a finger down or end() drops the late-fling window', () => {
    const { gesture } = make()
    gesture.touchStart()
    scroll(gesture)
    gesture.touchEnd()
    vi.advanceTimersByTime(150)
    gesture.touchStart()
    // A drag under the new finger, not a late fling.
    expect(scroll(gesture)).toBe(true)
    expect(gesture.touch).toEqual({ phase: 'down', moved: true })

    const swapped = make()
    swapped.gesture.touchStart()
    scroll(swapped.gesture)
    swapped.gesture.touchEnd()
    vi.advanceTimersByTime(150)
    // The scroll element changed (cleanup): nothing carries over.
    swapped.gesture.end()
    scroll(swapped.gesture)
    expect(swapped.gesture.touch).toBeNull()
  })

  test('the late-fling window closes after 1s and never follows a tap', () => {
    const late = make()
    late.gesture.touchStart()
    scroll(late.gesture)
    late.gesture.touchEnd()
    vi.advanceTimersByTime(150 + 1001)
    scroll(late.gesture)
    expect(late.gesture.touch).toBeNull()

    const tap = make()
    tap.gesture.touchStart()
    tap.gesture.touchEnd()
    vi.advanceTimersByTime(250)
    scroll(tap.gesture)
    expect(tap.gesture.touch).toBeNull()
  })

  test('our own write or animation does not reopen it', () => {
    const { gesture } = make()
    gesture.touchStart()
    scroll(gesture)
    gesture.touchEnd()
    vi.advanceTimersByTime(250)
    scroll(gesture, { external: false })
    expect(gesture.tail()).toBeNull()
  })
})
