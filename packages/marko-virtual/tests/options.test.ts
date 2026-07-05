// Unit tests for the input -> virtual-core option mapping (buildOptions).
// Verifies the SSR knobs (initialRect, initialOffset) are plumbed through. Combined with
// the Node-level proof that virtual-core turns initialRect/initialOffset into a correct
// pre-mount slice, this covers the render-time seed's inputs without needing a DOM.
// The full-parity batch (scrollMargin, enabled, isRtl, isScrollingResetDelay,
// useScrollendEvent, useAnimationFrameWithResizeObserver, laneAssignmentMode,
// useCachedMeasurements, debug, custom measureElement — plus horizontal and an
// initialOffset override on the window tag) is Tier-1 forwarding-tested here; the
// behaviorally-observable subset has real-browser gates (see the session record).
import { describe, expect, test } from 'vitest'
import { Virtualizer, observeWindowRect, windowScroll } from '@tanstack/virtual-core'
import { buildOptions } from '../src/tags/virtualizer/options'
import { buildOptions as buildWindowOptions } from '../src/tags/window-virtualizer/options'

describe('buildOptions — input to virtual-core option mapping', () => {
  const noop = () => {}

  test('maps initialRect through (the SSR slice knob)', () => {
    const opts = buildOptions(
      {
        count: 1000,
        estimateSize: () => 40,
        getScrollElement: () => null,
        initialRect: { width: 800, height: 400 },
      },
      noop,
    )
    expect(opts.initialRect).toEqual({ width: 800, height: 400 })
    expect(opts.count).toBe(1000)
    expect(opts.onChange).toBe(noop)
  })

  test('maps initialOffset through (the SSR start-position knob)', () => {
    const opts = buildOptions(
      { count: 10, getScrollElement: () => null, initialOffset: 1200 },
      noop,
    )
    expect(opts.initialOffset).toBe(1200)
  })

  test('initialRect is undefined when omitted (core applies its 0x0 default)', () => {
    const opts = buildOptions({ count: 10, getScrollElement: () => null }, noop)
    expect(opts.initialRect).toBeUndefined()
  })

  test('defaults: estimateSize 50, overscan 5, horizontal false', () => {
    const opts = buildOptions({ count: 10, getScrollElement: () => null }, noop)
    expect(opts.estimateSize(0)).toBe(50)
    expect(opts.overscan).toBe(5)
    expect(opts.horizontal).toBe(false)
  })

  test('maps every optional prop through when provided', () => {
    const getItemKey = (i: number) => `k${i}`
    const rangeExtractor = () => [0]
    const cache = [
      { index: 0, start: 0, size: 32, end: 32, key: 0, lane: 0 },
    ]
    const opts = buildOptions(
      {
        count: 500,
        estimateSize: () => 32,
        getScrollElement: () => null,
        overscan: 10,
        horizontal: true,
        paddingStart: 8,
        paddingEnd: 16,
        scrollPaddingStart: 4,
        scrollPaddingEnd: 12,
        gap: 6,
        lanes: 3,
        initialOffset: 1200,
        initialRect: { width: 640, height: 480 },
        getItemKey,
        rangeExtractor,
        indexAttribute: 'data-row-index',
        initialMeasurementsCache: cache,
        anchorTo: 'end',
        followOnAppend: 'smooth',
        scrollEndThreshold: 24,
      },
      noop,
    )
    expect(opts.estimateSize(0)).toBe(32)
    expect(opts.overscan).toBe(10)
    expect(opts.horizontal).toBe(true)
    expect(opts.paddingStart).toBe(8)
    expect(opts.paddingEnd).toBe(16)
    expect(opts.scrollPaddingStart).toBe(4)
    expect(opts.scrollPaddingEnd).toBe(12)
    expect(opts.gap).toBe(6)
    expect(opts.lanes).toBe(3)
    expect(opts.initialOffset).toBe(1200)
    expect(opts.initialRect).toEqual({ width: 640, height: 480 })
    expect(opts.getItemKey).toBe(getItemKey)
    expect(opts.rangeExtractor).toBe(rangeExtractor)
    expect(opts.indexAttribute).toBe('data-row-index')
    expect(opts.initialMeasurementsCache).toBe(cache)
    expect(opts.anchorTo).toBe('end')
    expect(opts.followOnAppend).toBe('smooth')
    expect(opts.scrollEndThreshold).toBe(24)
  })

  test('new optional props stay undefined when omitted (core applies its defaults)', () => {
    const opts = buildOptions({ count: 10, getScrollElement: () => null }, noop)
    expect(opts.getItemKey).toBeUndefined()
    expect(opts.rangeExtractor).toBeUndefined()
    expect(opts.indexAttribute).toBeUndefined()
    expect(opts.initialMeasurementsCache).toBeUndefined()
    expect(opts.anchorTo).toBeUndefined()
    expect(opts.followOnAppend).toBeUndefined()
    expect(opts.scrollEndThreshold).toBeUndefined()
  })

  test('maps the full-parity batch through when provided', () => {
    const measurer = () => 99
    const opts = buildOptions(
      {
        count: 100,
        getScrollElement: () => null,
        scrollMargin: 40,
        enabled: false,
        isRtl: true,
        isScrollingResetDelay: 300,
        useScrollendEvent: true,
        useAnimationFrameWithResizeObserver: true,
        laneAssignmentMode: 'measured',
        useCachedMeasurements: true,
        debug: true,
        measureElement: measurer,
      },
      noop,
    )
    expect(opts.scrollMargin).toBe(40)
    expect(opts.enabled).toBe(false)
    expect(opts.isRtl).toBe(true)
    expect(opts.isScrollingResetDelay).toBe(300)
    expect(opts.useScrollendEvent).toBe(true)
    expect(opts.useAnimationFrameWithResizeObserver).toBe(true)
    expect(opts.laneAssignmentMode).toBe('measured')
    expect(opts.useCachedMeasurements).toBe(true)
    expect(opts.debug).toBe(true)
    expect(opts.measureElement).toBe(measurer)
  })

  test('full-parity batch stays undefined when omitted (core applies its defaults)', () => {
    const opts = buildOptions({ count: 10, getScrollElement: () => null }, noop)
    expect(opts.scrollMargin).toBeUndefined()
    expect(opts.enabled).toBeUndefined()
    expect(opts.isRtl).toBeUndefined()
    expect(opts.isScrollingResetDelay).toBeUndefined()
    expect(opts.useScrollendEvent).toBeUndefined()
    expect(opts.useAnimationFrameWithResizeObserver).toBeUndefined()
    expect(opts.laneAssignmentMode).toBeUndefined()
    expect(opts.useCachedMeasurements).toBeUndefined()
    expect(opts.debug).toBeUndefined()
    expect(opts.measureElement).toBeUndefined()
  })

  test('core merge contract: undefined forwards land on core defaults; provided values stick', () => {
    // The whole undefined-forwarding design leans on core's setOptions skipping
    // undefined keys. Characterize that contract against a REAL core instance so a
    // core-side change to the merge loop fails here, not in an example.
    const bare = new Virtualizer<Element, Element>(
      buildOptions({ count: 10, getScrollElement: () => null }, noop),
    )
    expect(bare.options.scrollMargin).toBe(0)
    expect(bare.options.enabled).toBe(true)
    expect(bare.options.isRtl).toBe(false)
    expect(bare.options.isScrollingResetDelay).toBe(150)
    expect(bare.options.useScrollendEvent).toBe(false)
    expect(bare.options.useAnimationFrameWithResizeObserver).toBe(false)
    expect(bare.options.laneAssignmentMode).toBe('estimate')
    expect(bare.options.useCachedMeasurements).toBe(false)
    expect(bare.options.debug).toBe(false)
    expect(typeof bare.options.measureElement).toBe('function') // core's default measurer

    const measurer = () => 99
    const tuned = new Virtualizer<Element, Element>(
      buildOptions(
        {
          count: 10,
          getScrollElement: () => null,
          scrollMargin: 40,
          enabled: false,
          laneAssignmentMode: 'measured',
          measureElement: measurer,
        },
        noop,
      ),
    )
    expect(tuned.options.scrollMargin).toBe(40)
    expect(tuned.options.enabled).toBe(false)
    expect(tuned.options.laneAssignmentMode).toBe('measured')
    expect(tuned.options.measureElement).toBe(measurer)
  })

  test('scrollMargin shifts the pre-mount slice positions (item.start includes the margin)', () => {
    // Same transient-instance path renderSlice uses; proves the margin reaches the math.
    const flat = new Virtualizer<Element, Element>(
      buildOptions(
        {
          count: 100,
          estimateSize: () => 50,
          getScrollElement: () => null,
          initialRect: { width: 800, height: 400 },
        },
        noop,
      ),
    )
    const shifted = new Virtualizer<Element, Element>(
      buildOptions(
        {
          count: 100,
          estimateSize: () => 50,
          getScrollElement: () => null,
          initialRect: { width: 800, height: 400 },
          scrollMargin: 200,
        },
        noop,
      ),
    )
    expect(flat.getVirtualItems()[0]!.start).toBe(0)
    expect(shifted.getVirtualItems()[0]!.start).toBe(200)
    // getTotalSize subtracts scrollMargin (it is the LIST's own height, margin-free)
    expect(shifted.getTotalSize()).toBe(flat.getTotalSize())
  })
})

describe('buildOptions (window) — input to virtual-core option mapping', () => {
  const noop = () => {}

  test('wires the window observers and scroll fn', () => {
    const opts = buildWindowOptions({ count: 10 }, noop)
    expect(opts.observeElementRect).toBe(observeWindowRect)
    expect(opts.scrollToFn).toBe(windowScroll)
    // window offset is derived internally (window.scrollY / 0), so it is a function, not a number
    expect(typeof opts.initialOffset).toBe('function')
  })

  test('initialOffset override wins over the window.scrollY default', () => {
    expect(buildWindowOptions({ count: 10, initialOffset: 4800 }, noop).initialOffset).toBe(4800)
    const thunk = () => 1234
    expect(buildWindowOptions({ count: 10, initialOffset: thunk }, noop).initialOffset).toBe(thunk)
  })

  test('horizontal forwards; undefined when omitted (core defaults false)', () => {
    expect(buildWindowOptions({ count: 10, horizontal: true }, noop).horizontal).toBe(true)
    expect(buildWindowOptions({ count: 10 }, noop).horizontal).toBeUndefined()
  })

  test('maps every optional prop through when provided', () => {
    const getItemKey = (i: number) => `k${i}`
    const rangeExtractor = () => [0]
    const cache = [
      { index: 0, start: 0, size: 32, end: 32, key: 0, lane: 0 },
    ]
    const opts = buildWindowOptions(
      {
        count: 500,
        estimateSize: () => 32,
        overscan: 10,
        paddingStart: 8,
        paddingEnd: 16,
        scrollPaddingStart: 4,
        scrollPaddingEnd: 12,
        gap: 6,
        lanes: 3,
        initialRect: { width: 1280, height: 800 },
        getItemKey,
        rangeExtractor,
        indexAttribute: 'data-col-index',
        initialMeasurementsCache: cache,
        anchorTo: 'end',
        followOnAppend: true,
        scrollEndThreshold: 24,
      },
      noop,
    )
    expect(opts.estimateSize(0)).toBe(32)
    expect(opts.overscan).toBe(10)
    expect(opts.paddingStart).toBe(8)
    expect(opts.paddingEnd).toBe(16)
    expect(opts.scrollPaddingStart).toBe(4)
    expect(opts.scrollPaddingEnd).toBe(12)
    expect(opts.gap).toBe(6)
    expect(opts.lanes).toBe(3)
    expect(opts.initialRect).toEqual({ width: 1280, height: 800 })
    expect(opts.getItemKey).toBe(getItemKey)
    expect(opts.rangeExtractor).toBe(rangeExtractor)
    expect(opts.indexAttribute).toBe('data-col-index')
    expect(opts.initialMeasurementsCache).toBe(cache)
    expect(opts.anchorTo).toBe('end')
    expect(opts.followOnAppend).toBe(true)
    expect(opts.scrollEndThreshold).toBe(24)
  })

  test('maps the full-parity batch through when provided', () => {
    const measurer = () => 99
    const opts = buildWindowOptions(
      {
        count: 100,
        scrollMargin: 40,
        enabled: false,
        isRtl: true,
        isScrollingResetDelay: 300,
        useScrollendEvent: true,
        useAnimationFrameWithResizeObserver: true,
        laneAssignmentMode: 'measured',
        useCachedMeasurements: true,
        debug: true,
        measureElement: measurer,
      },
      noop,
    )
    expect(opts.scrollMargin).toBe(40)
    expect(opts.enabled).toBe(false)
    expect(opts.isRtl).toBe(true)
    expect(opts.isScrollingResetDelay).toBe(300)
    expect(opts.useScrollendEvent).toBe(true)
    expect(opts.useAnimationFrameWithResizeObserver).toBe(true)
    expect(opts.laneAssignmentMode).toBe('measured')
    expect(opts.useCachedMeasurements).toBe(true)
    expect(opts.debug).toBe(true)
    expect(opts.measureElement).toBe(measurer)
  })

  test('full-parity batch stays undefined when omitted (core applies its defaults)', () => {
    const opts = buildWindowOptions({ count: 10 }, noop)
    expect(opts.scrollMargin).toBeUndefined()
    expect(opts.enabled).toBeUndefined()
    expect(opts.isRtl).toBeUndefined()
    expect(opts.isScrollingResetDelay).toBeUndefined()
    expect(opts.useScrollendEvent).toBeUndefined()
    expect(opts.useAnimationFrameWithResizeObserver).toBeUndefined()
    expect(opts.laneAssignmentMode).toBeUndefined()
    expect(opts.useCachedMeasurements).toBeUndefined()
    expect(opts.debug).toBeUndefined()
    expect(opts.measureElement).toBeUndefined()
  })
})
