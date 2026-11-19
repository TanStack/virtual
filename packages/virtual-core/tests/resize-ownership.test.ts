import { describe, expect, test } from 'vitest';
import { Virtualizer } from '../src/index';

// Requires the patched core resize-veto contract. No hook, browser, scheduler or DOM is faked
// into a claim of acceptance: this deterministic writer records real resizeItem decisions.
const setup = (following: boolean, installPolicy = true) => {
  const lock = { isAtBottom: following };
  const writes: number[] = [];
  let actual = 27813;
  const instance = new Virtualizer<HTMLElement, Element>({
    count: 242,
    getScrollElement: () => null,
    estimateSize: () => 150,
    initialRect: { width: 800, height: 720 },
    initialOffset: 22537,
    anchorTo: following ? 'start' : 'end',
    observeElementRect: () => () => {},
    observeElementOffset: () => () => {},
    scrollToFn: (offset, { adjustments = 0 }) => {
      actual = offset + adjustments;
      writes.push(actual);
    },
  });
  instance.getTotalSize();
  instance.scrollOffset = 22537;
  if (installPolicy)
    instance.shouldAdjustScrollPositionOnItemSizeChange = () =>
      lock.isAtBottom ? false : undefined;
  return { instance, lock, writes, actual: () => actual };
};

describe('timeline resize ownership across live lock transitions', () => {
  test('control reproduces the observed stale-cache backward write', () => {
    const { instance, writes } = setup(true, false);
    instance.resizeItem(150, 272);
    expect(writes).toEqual([22659]);
  });

  test.each([272, 114])('locked resize to %s updates layout without moving viewport', (size) => {
    const { instance, writes, actual } = setup(true);
    const before = instance.getTotalSize();
    instance.resizeItem(150, size);
    expect(instance.getTotalSize()).toBe(before + size - 150);
    expect(instance.itemSizeCache.get(150)).toBe(size);
    expect(instance.scrollOffset).toBe(22537);
    expect(writes).toEqual([]);
    expect(actual()).toBe(27813);
  });

  // Exact R1 countermodel: end option and cache at end were committed BEFORE acquiring the
  // mutable hook lock. No render, setOptions, callback replacement or flushSync closes the gap.
  test.each([272, 114])('live acquisition vetoes stale-end resize to %s', (size) => {
    const { instance, lock, writes } = setup(false);
    instance.scrollOffset = instance.getTotalSize() - 720;
    expect(instance.scrollOffset).toBe(35580);
    const callback = instance.shouldAdjustScrollPositionOnItemSizeChange;
    lock.isAtBottom = true;
    instance.resizeItem(10, size);
    expect(instance.options.anchorTo).toBe('end');
    expect(instance.shouldAdjustScrollPositionOnItemSizeChange).toBe(callback);
    expect(instance.scrollOffset).toBe(35580);
    expect(writes).toEqual([]);
  });

  test('live release delegates to defaults without waiting for a render', () => {
    const { instance, lock, writes } = setup(true);
    const callback = instance.shouldAdjustScrollPositionOnItemSizeChange;
    lock.isAtBottom = false;
    instance.resizeItem(150, 272);
    expect(instance.shouldAdjustScrollPositionOnItemSizeChange).toBe(callback);
    expect(writes).toEqual([22659]);
  });

  test.each([272, 114])('unlocked end mode retains default tail resize to %s', (size) => {
    const { instance, writes } = setup(false);
    instance.scrollOffset = instance.getTotalSize() - 720;
    // The last row is below the fold, so defaultShouldAdjust is false. wasAtEnd must still win
    // when our callback returns undefined. False and undefined must not be conflated.
    instance.resizeItem(241, size);
    expect(writes).toEqual([35580 + size - 150]);
  });

  test.each(['forward', 'backward'] as const)('first measure while %s retains defaults', (dir) => {
    const { instance, writes } = setup(false);
    instance.scrollDirection = dir;
    instance.resizeItem(150, 272);
    expect(writes).toEqual([22659]);
  });

  test.each(['forward', 'backward'] as const)('remeasure while %s retains defaults', (dir) => {
    const { instance, writes } = setup(false);
    instance.itemSizeCache.set(10, 150);
    instance.scrollDirection = dir;
    instance.resizeItem(10, 186);
    expect(writes).toEqual(dir === 'forward' ? [22573] : []);
  });

  test('unlocked spanning-fold growth retains the default no-correction decision', () => {
    const { instance, writes } = setup(false);
    instance.itemSizeCache.set(150, 150);
    instance.resizeItem(150, 272);
    expect(writes).toEqual([]);
  });

  test('unlocked above-fold shrink retains the anchor', () => {
    const { instance, writes } = setup(false);
    instance.itemSizeCache.set(10, 150);
    instance.scrollDirection = 'forward';
    instance.resizeItem(10, 114);
    expect(writes).toEqual([22501]);
  });
});


test('unlocked keyed prepend retains both structural and measured anchor offsets', () => {
  const keys = Array.from({ length: 20 }, (_, index) => String(index));
  const viewport = {} as HTMLElement; // Identity only; no DOM methods used by this core path.
  let actual = 200;
  const options = {
    count: keys.length,
    getItemKey: (index: number) => keys[index]!,
    getScrollElement: () => viewport,
    estimateSize: () => 50,
    initialRect: { width: 800, height: 200 },
    initialOffset: 200,
    anchorTo: 'end' as const,
    observeElementRect: () => () => {},
    observeElementOffset: () => () => {},
    scrollToFn: (offset: number, { adjustments = 0 }: { adjustments?: number }) => {
      actual = offset + adjustments;
    },
  };
  const instance = new Virtualizer<HTMLElement, Element>(options);
  instance.shouldAdjustScrollPositionOnItemSizeChange = () => undefined;
  instance.getTotalSize();
  instance.scrollOffset = 200;
  instance.scrollElement = viewport;
  const anchorBefore = instance.getVirtualItems().find((row) => row.key === '4');
  expect(anchorBefore?.key).toBe('4');
  const before = anchorBefore!.start - 200;
  const prepended = ['older', ...keys];
  instance.setOptions({
    ...options,
    count: prepended.length,
    getItemKey: (index) => prepended[index]!,
  });
  expect(instance.scrollOffset).toBe(250);
  instance.resizeItem(0, 80);
  instance._willUpdate();
  expect(actual).toBe(280);
  const anchorAfter = instance.getVirtualItems().find((row) => row.key === '4');
  expect(anchorAfter?.key).toBe('4');
  expect(anchorAfter!.start - actual).toBe(before);
});


type Decision = 'absent' | 'undefined' | 'true' | 'false';
const decisions: Decision[] = ['absent', 'undefined', 'true', 'false'];
const installDecision = (instance: Virtualizer<HTMLElement, Element>, mode: Decision) => {
  let calls = 0;
  if (mode !== 'absent')
    instance.shouldAdjustScrollPositionOnItemSizeChange = () => {
      calls++;
      return mode === 'undefined' ? undefined : mode === 'true';
    };
  return () => calls;
};

describe('resize decision contract', () => {
  for (const mode of decisions) {
    test.each(['end', 'above-fold', 'below-fold'] as const)(`${mode}: %s correction policy`, (position) => {
      const { instance, writes } = setup(false, false);
      if (position === 'end') instance.scrollOffset = instance.getTotalSize() - 720;
      const offset = instance.scrollOffset!;
      const index = position === 'above-fold' ? 10 : 241;
      const calls = installDecision(instance, mode);
      const before = instance.getTotalSize();
      instance.resizeItem(index, 272);
      const adjusts = mode !== 'false' && (position !== 'below-fold' || mode === 'true');
      expect(writes).toEqual(adjusts ? [offset + 122] : []);
      expect(instance.scrollOffset).toBe(adjusts ? offset + 122 : offset);
      expect(instance.getTotalSize()).toBe(before + 122);
      expect(instance.itemSizeCache.get(index)).toBe(272);
      expect(calls()).toBe(mode === 'absent' ? 0 : 1);
    });

    test(`${mode}: smooth scroll does not call predicate or issue resize correction`, () => {
      const { instance, writes } = setup(false, false);
      // Public scrollToOffset creates smooth state. This inert public-window harness records
      // the scheduled frame without delivering it; no private state is read or changed.
      instance.targetWindow = {
        requestAnimationFrame: (_callback: FrameRequestCallback) => 1,
        cancelAnimationFrame: (_handle: number) => {},
        performance: { now: () => 0 },
      } as Window & typeof globalThis;
      instance.scrollToOffset(22537, { behavior: 'smooth' });
      writes.length = 0;
      const calls = installDecision(instance, mode);
      const before = instance.getTotalSize();
      instance.resizeItem(10, 272);
      expect(calls()).toBe(0);
      expect(writes).toEqual([]);
      expect(instance.getTotalSize()).toBe(before + 122);
      expect(instance.itemSizeCache.get(10)).toBe(272);
    });

    test(`${mode}: zero delta does not call predicate, write or populate measured cache`, () => {
      const { instance, writes } = setup(false, false);
      const calls = installDecision(instance, mode);
      const cache = new Map(instance.itemSizeCache);
      const before = instance.getTotalSize();
      instance.resizeItem(10, 150);
      expect(calls()).toBe(0);
      expect(writes).toEqual([]);
      expect(instance.itemSizeCache).toEqual(cache);
      expect(instance.getTotalSize()).toBe(before);
    });
  }
});
