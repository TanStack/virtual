// Real benchmarks against the actual Virtualizer class.
// Run with: cd packages/virtual-core && npx vitest bench --run
//
// Compare before/after by running this script, saving output, applying a fix,
// re-running, diffing.

import { bench, describe } from 'vitest'
import { Virtualizer, defaultRangeExtractor } from '../src/index'

function makeVirt(count: number, lanes = 1): Virtualizer<any, any> {
  const v = new Virtualizer({
    count,
    lanes,
    estimateSize: () => 30,
    getScrollElement: () => null,
    scrollToFn: () => {},
    observeElementRect: () => {},
    observeElementOffset: () => {},
  })
  // Warm getMeasurements
  ;(v as any).getMeasurements()
  return v
}

// ─── Layer 1: Map clone bug — resizeItem under measure storm ─────────────────

describe('Layer 1: resizeItem measure storm — full N resizes then 1× getMeasurements', () => {
  for (const n of [100, 1000, 5000, 10000]) {
    bench(`n=${n}`, () => {
      const v = makeVirt(n)
      for (let i = 0; i < n; i++) v.resizeItem(i, 30 + (i % 7))
      ;(v as any).getMeasurements()
    })
  }
})

describe('Layer 1: resizeItem measure storm — getMeasurements per call', () => {
  for (const n of [100, 1000, 5000]) {
    bench(`n=${n}`, () => {
      const v = makeVirt(n)
      for (let i = 0; i < n; i++) {
        v.resizeItem(i, 30 + (i % 7))
        ;(v as any).getMeasurements()
      }
    })
  }
})

describe('Layer 3: pending-min lookup under heavy storms', () => {
  // Stress the "find earliest dirty index" path. Pre-Layer-3 used
  // `Math.min(...pendingMeasuredCacheIndexes)` which spreads onto the stack.
  for (const n of [10000, 50000, 100000]) {
    bench(`n=${n} resizes in reverse order (worst case for running min)`, () => {
      const v = makeVirt(n)
      // Reverse order means every push lowers the min — exercises the
      // running-min branch on every single push.
      for (let i = n - 1; i >= 0; i--) v.resizeItem(i, 30 + (i % 7))
      ;(v as any).getMeasurements()
    })
  }
})

describe('Layer 1: repeated resize at index 0', () => {
  for (const n of [1000, 10000, 50000]) {
    bench(`n=${n}, 100× resize+getMeasurements`, () => {
      const v = makeVirt(n)
      for (let i = 0; i < 100; i++) {
        v.resizeItem(0, 30 + (i % 5))
        ;(v as any).getMeasurements()
      }
    })
  }
})

// ─── Layer 2: setOptions per render ──────────────────────────────────────────

describe('Layer 2: setOptions() — simulating React render storm', () => {
  bench('setOptions × 10,000', () => {
    const v = new Virtualizer({
      count: 1000,
      estimateSize: () => 30,
      getScrollElement: () => null,
      scrollToFn: () => {},
      observeElementRect: () => {},
      observeElementOffset: () => {},
    })
    for (let i = 0; i < 10_000; i++) {
      v.setOptions({
        count: 1000,
        estimateSize: () => 30,
        getScrollElement: () => null,
        scrollToFn: () => {},
        observeElementRect: () => {},
        observeElementOffset: () => {},
        overscan: undefined as any,
        paddingStart: undefined as any,
        paddingEnd: undefined as any,
      } as any)
    }
  })
})

// ─── Layer 6: defaultRangeExtractor ──────────────────────────────────────────

describe('Layer 6: defaultRangeExtractor', () => {
  for (const visible of [50, 200, 1000]) {
    bench(`visible=${visible} × 10,000`, () => {
      for (let i = 0; i < 10_000; i++) {
        defaultRangeExtractor({
          startIndex: 0,
          endIndex: visible - 1,
          overscan: 5,
          count: 100_000,
        })
      }
    })
  }
})
