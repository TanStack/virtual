import { Virtualizer } from '../src/index'

test('should export the Virtualizer class', () => {
  expect(Virtualizer).toBeDefined()
})

test('should return empty items for empty scroll element', () => {
  const virtualizer = new Virtualizer({
    count: 100,
    getScrollElement: () => null,
    estimateSize: () => 50,
    scrollToFn: jest.fn(),
    observeElementRect: jest.fn(),
    observeElementOffset: jest.fn(),
  })
  expect(virtualizer.getVirtualItems()).toEqual([])
})
