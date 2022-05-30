import * as React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'

import { useVirtual, Range } from '../../virtual-core/src/index'

let renderer: jest.Mock<undefined, []>
let useDynamic = false

interface ListProps {
  size?: number
  overscan?: number
  height?: number
  width?: number
  rangeExtractor?: (range: Range) => number[]
}

function List({
  size = 200,
  overscan,
  height = 200,
  width = 200,
  rangeExtractor,
}: ListProps) {
  renderer()

  const parentRef = React.useRef<HTMLDivElement>(null)

  const rowVirtualizer = useVirtual({
    size,
    parentRef,
    overscan,
    useObserver: React.useCallback(() => ({ height, width }), [height, width]),
    rangeExtractor,
  })

  return (
    <div
      ref={parentRef}
      style={{ height, width, overflow: 'auto' }}
      data-testid="scroller"
    >
      <div
        style={{
          height: rowVirtualizer.totalSize,
          width: '100%',
          position: 'relative',
        }}
      >
        {rowVirtualizer.virtualItems.map((virtualRow) => (
          <div
            data-testid={`item-${virtualRow.key}`}
            key={virtualRow.key}
            ref={useDynamic ? virtualRow.measureRef : undefined}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              transform: `translateY(${virtualRow.start}px)`,
              height: virtualRow.size,
            }}
          >
            Row {virtualRow.index}
          </div>
        ))}
      </div>
    </div>
  )
}

beforeEach(() => {
  useDynamic = false
  renderer = jest.fn(() => undefined)
})

test('should render', () => {
  render(<List />)

  expect(screen.queryByText('Row 0')).toBeInTheDocument()
  expect(screen.queryByText('Row 4')).toBeInTheDocument()
  expect(screen.queryByText('Row 5')).not.toBeInTheDocument()

  expect(renderer).toHaveBeenCalledTimes(1)
})

test('should render with overscan', () => {
  render(<List overscan={0} />)

  expect(screen.queryByText('Row 0')).toBeInTheDocument()
  expect(screen.queryByText('Row 3')).toBeInTheDocument()
  expect(screen.queryByText('Row 4')).not.toBeInTheDocument()

  expect(renderer).toHaveBeenCalledTimes(1)
})

test('should render given dynamic size', () => {
  useDynamic = true
  // can we mock elements based on data-testid?
  const mock = jest
    .spyOn(HTMLElement.prototype, 'offsetHeight', 'get')
    .mockImplementation(() => 25)

  render(<List />)
  expect(screen.queryByText('Row 0')).toBeInTheDocument()
  expect(screen.queryByText('Row 8')).toBeInTheDocument()
  expect(screen.queryByText('Row 9')).not.toBeInTheDocument()

  expect(renderer).toHaveBeenCalledTimes(4)
  mock.mockRestore()
})

test('should render given dynamic size after scroll', () => {
  useDynamic = true
  // can we mock elements based on data-testid?
  const mock = jest
    .spyOn(HTMLElement.prototype, 'offsetHeight', 'get')
    .mockImplementation(() => 25)

  render(<List />)

  expect(screen.queryByText('Row 0')).toBeInTheDocument()
  expect(screen.queryByText('Row 8')).toBeInTheDocument()
  expect(screen.queryByText('Row 9')).not.toBeInTheDocument()

  expect(renderer).toHaveBeenCalledTimes(4)
  renderer.mockReset()

  fireEvent.scroll(screen.getByTestId('scroller'), {
    target: { scrollTop: 75 },
  })

  expect(screen.queryByText('Row 1')).not.toBeInTheDocument()
  expect(screen.queryByText('Row 2')).toBeInTheDocument()
  expect(screen.queryByText('Row 11')).toBeInTheDocument()
  expect(screen.queryByText('Row 12')).not.toBeInTheDocument()

  expect(renderer).toHaveBeenCalledTimes(3)
  mock.mockRestore()
})

test('should use rangeExtractor', () => {
  render(<List rangeExtractor={() => [0, 1]} />)

  expect(screen.queryByText('Row 0')).toBeInTheDocument()
  expect(screen.queryByText('Row 1')).toBeInTheDocument()
  expect(screen.queryByText('Row 2')).not.toBeInTheDocument()
})
