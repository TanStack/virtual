import { describe, expect, test } from 'vitest'
import { classifyScrollEvent } from '../src/scroll-classifier'
import type { ScrollEventInput } from '../src/scroll-classifier'

const at = (input: Partial<ScrollEventInput>) =>
  classifyScrollEvent({
    offset: 1000,
    isScrolling: true,
    elementMax: null,
    holdOffset: 0,
    scrollOffset: 500,
    pendingWrite: null,
    clampedMaxAtWrite: null,
    ...input,
  })

describe('classifyScrollEvent', () => {
  test('a scroll event with nothing pending is external', () => {
    expect(at({})).toBe('external')
    expect(at({ isScrolling: false })).toBe('external')
  })

  describe('spurious', () => {
    test('scrolling at the held offset with no write pending', () => {
      expect(at({ offset: 500, scrollOffset: 500 })).toBe('spurious')
    })

    test('needs an exact match', () => {
      expect(at({ offset: 500.5, scrollOffset: 500 })).toBe('external')
    })

    test('a report at rest is not spurious', () => {
      expect(at({ offset: 500, scrollOffset: 500, isScrolling: false })).toBe(
        'external',
      )
    })

    test('a pending write makes it a read-back instead', () => {
      expect(
        at({
          offset: 500,
          scrollOffset: 500,
          pendingWrite: { target: 500, smooth: false },
        }),
      ).toBe('readBack')
    })

    test('beats a clamped echo at the same position', () => {
      expect(
        at({ offset: 500, scrollOffset: 500, clampedMaxAtWrite: 500 }),
      ).toBe('spurious')
    })
  })

  describe('readBack', () => {
    test('within 1.5px of the pending target, either side', () => {
      const pendingWrite = { target: 1000, smooth: false }
      expect(at({ offset: 1001.4, pendingWrite })).toBe('readBack')
      expect(at({ offset: 998.6, pendingWrite })).toBe('readBack')
      expect(at({ offset: 1001.5, pendingWrite })).toBe('external')
    })

    test('a smooth write reads back the same way', () => {
      expect(
        at({ offset: 1000, pendingWrite: { target: 1000, smooth: true } }),
      ).toBe('readBack')
    })

    test('reported at rest', () => {
      expect(
        at({
          offset: 1000,
          isScrolling: false,
          pendingWrite: { target: 1000, smooth: false },
        }),
      ).toBe('readBack')
    })

    test('beats a clamped read-back when the target is just past the max', () => {
      expect(
        at({
          offset: 1000.5,
          elementMax: 1000,
          pendingWrite: { target: 1001, smooth: false },
        }),
      ).toBe('readBack')
    })

    test('beats a clamped echo near the max at write time', () => {
      expect(
        at({
          offset: 1000.4,
          pendingWrite: { target: 1000, smooth: false },
          clampedMaxAtWrite: 1000,
        }),
      ).toBe('readBack')
    })
  })

  describe('clampedReadBack', () => {
    const pendingWrite = { target: 1200, smooth: false }

    test('a non-smooth write past the max reporting at the max', () => {
      expect(at({ offset: 1000, elementMax: 1000, pendingWrite })).toBe(
        'clampedReadBack',
      )
      expect(at({ offset: 1001.4, elementMax: 1000, pendingWrite })).toBe(
        'clampedReadBack',
      )
      expect(at({ offset: 1001.5, elementMax: 1000, pendingWrite })).toBe(
        'external',
      )
    })

    test('the max is shifted by a held correction', () => {
      expect(
        at({ offset: 1000, elementMax: 950, holdOffset: 50, pendingWrite }),
      ).toBe('clampedReadBack')
      expect(
        at({ offset: 950, elementMax: 950, holdOffset: 50, pendingWrite }),
      ).toBe('external')
    })

    test('the target must exceed the max by more than 0.5px', () => {
      expect(
        at({
          offset: 998.6,
          elementMax: 1000,
          pendingWrite: { target: 1000.5, smooth: false },
        }),
      ).toBe('external')
    })

    test('not for a smooth write', () => {
      expect(
        at({
          offset: 1000,
          elementMax: 1000,
          pendingWrite: { target: 1200, smooth: true },
        }),
      ).toBe('external')
    })

    test('not without the element max (a report at rest)', () => {
      expect(at({ offset: 1000, elementMax: null, pendingWrite })).toBe(
        'external',
      )
    })

    test('beats a clamped echo at the same max', () => {
      expect(
        at({
          offset: 1000,
          elementMax: 1000,
          pendingWrite,
          clampedMaxAtWrite: 1000,
        }),
      ).toBe('clampedReadBack')
    })
  })

  describe('clampedEcho', () => {
    test('within 1.5px of the max at write time', () => {
      expect(at({ offset: 1000, clampedMaxAtWrite: 1000 })).toBe('clampedEcho')
      expect(at({ offset: 1001.4, clampedMaxAtWrite: 1000 })).toBe(
        'clampedEcho',
      )
      expect(at({ offset: 1001.5, clampedMaxAtWrite: 1000 })).toBe('external')
    })

    test('with an unrelated write pending', () => {
      expect(
        at({
          offset: 1000,
          pendingWrite: { target: 2000, smooth: true },
          clampedMaxAtWrite: 1000,
        }),
      ).toBe('clampedEcho')
    })

    test('reported at rest', () => {
      expect(
        at({ offset: 1000, isScrolling: false, clampedMaxAtWrite: 1000 }),
      ).toBe('clampedEcho')
    })
  })
})
