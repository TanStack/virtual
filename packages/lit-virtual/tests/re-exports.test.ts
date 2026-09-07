import { expect, test } from 'vitest'
import {
  Virtualizer,
  defaultKeyExtractor,
  defaultRangeExtractor,
  elementScroll,
  measureElement,
  observeElementOffset,
  observeElementRect,
  observeWindowOffset,
  observeWindowRect,
  windowScroll,
} from '../src'

// `@tanstack/lit-virtual` re-exports `@tanstack/virtual-core` so consumers can
// reach the core API without adding a second dependency, matching every other
// framework adapter in this repo.

test('re-exports the Virtualizer class from virtual-core', () => {
  expect(typeof Virtualizer).toBe('function')
})

test('re-exports the element observers and scroller from virtual-core', () => {
  expect(typeof observeElementRect).toBe('function')
  expect(typeof observeElementOffset).toBe('function')
  expect(typeof elementScroll).toBe('function')
})

test('re-exports the window observers and scroller from virtual-core', () => {
  expect(typeof observeWindowRect).toBe('function')
  expect(typeof observeWindowOffset).toBe('function')
  expect(typeof windowScroll).toBe('function')
})

test('re-exports the default extractors and measureElement from virtual-core', () => {
  expect(typeof defaultRangeExtractor).toBe('function')
  expect(typeof defaultKeyExtractor).toBe('function')
  expect(typeof measureElement).toBe('function')
})
