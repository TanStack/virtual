import { describe, expect, it } from 'vitest'
import { Virtualizer } from '../src/index'

// Minimal no-op options that satisfy the framework-adapter slots without
// touching the DOM, so this test runs in a plain node environment.
const noopAdapter = {
  observeElementRect: () => () => {},
  observeElementOffset: () => () => {},
  scrollToFn: () => {},
  getScrollElement: () => null,
}

describe('getItemKey identity stability', () => {
  it('does not rebuild measurements when getItemKey identity changes', () => {
    const data = ['a', 'b', 'c', 'd', 'e']

    const v = new Virtualizer({
      ...noopAdapter,
      count: data.length,
      estimateSize: () => 50,
      getItemKey: (i) => data[i]!,
    })

    // @ts-expect-error private — reaching in to assert memo behavior directly.
    const before = v.getMeasurements()

    // Simulate a React re-render: setOptions called with a fresh inline
    // closure for getItemKey that returns the same values.
    v.setOptions({
      ...noopAdapter,
      count: data.length,
      estimateSize: () => 50,
      getItemKey: (i) => data[i]!,
    })

    // @ts-expect-error private
    const after = v.getMeasurements()

    // Same reference ⇒ memo hit ⇒ no O(n) rebuild.
    expect(after).toBe(before)
  })

  it('still rebuilds when count changes', () => {
    const v = new Virtualizer({
      ...noopAdapter,
      count: 5,
      estimateSize: () => 50,
      getItemKey: (i) => i,
    })

    // @ts-expect-error private
    const before = v.getMeasurements()

    v.setOptions({
      ...noopAdapter,
      count: 6,
      estimateSize: () => 50,
      getItemKey: (i) => i,
    })

    // @ts-expect-error private
    const after = v.getMeasurements()

    expect(after).not.toBe(before)
    expect(after.length).toBe(6)
  })

  it('lazy view reads the latest getItemKey across renders', () => {
    let data = ['a', 'b', 'c']
    const v = new Virtualizer({
      ...noopAdapter,
      count: data.length,
      estimateSize: () => 50,
      getItemKey: (i) => data[i]!,
    })

    // @ts-expect-error private
    const measurements = v.getMeasurements()

    // Re-render with new closure over mutated-contents data (same length).
    // No rebuild — but the Proxy must still surface the *current* keys.
    data = ['x', 'y', 'z']
    v.setOptions({
      ...noopAdapter,
      count: data.length,
      estimateSize: () => 50,
      getItemKey: (i) => data[i]!,
    })

    // @ts-expect-error private
    expect(v.getMeasurements()).toBe(measurements)
    expect(measurements[0]!.key).toBe('x')
    expect(measurements[2]!.key).toBe('z')
  })
})
