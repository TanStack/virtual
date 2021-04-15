import '@testing-library/jest-dom'
import { render, screen, fireEvent } from '@testing-library/react'
import * as React from 'react'

import { useVirtual } from '../index'

function List({
  size = 200,
  overscan,
  height = 200,
  width = 200,
  getBoundingClientRect,
  parentRef = React.createRef(),
}) {
  const rowVirtualizer = useVirtual({
    size,
    parentRef,
    overscan,
    useObserver: React.useCallback(() => ({ height, width }), [height, width]),
  })

  return (
    <>
      <div
        ref={parentRef}
        style={{
          height,
          width,
          overflow: 'auto',
        }}
      >
        <div
          style={{
            height: `${rowVirtualizer.totalSize}px`,
            width: '100%',
            position: 'relative',
          }}
        >
          {rowVirtualizer.virtualItems.map(virtualRow => (
            <div
              key={virtualRow.index}
              ref={
                getBoundingClientRect
                  ? el => {
                      if (el) {
                        el.getBoundingClientRect = getBoundingClientRect(
                          virtualRow.index
                        )
                      }
                      virtualRow.measureRef(el)
                    }
                  : undefined
              }
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${virtualRow.start}px)`,
                ...(getBoundingClientRect
                  ? {}
                  : { height: `${virtualRow.size}px` }),
              }}
            >
              Row {virtualRow.index}
            </div>
          ))}
        </div>
      </div>
    </>
  )
}

describe('useVirtual list', () => {
  it('should render', async () => {
    render(<List />)

    expect(screen.queryByText('Row 0')).toBeInTheDocument()
    expect(screen.queryByText('Row 5')).not.toBeInTheDocument()
  })
  it('should render with overscan', async () => {
    render(<List overscan={0} />)

    expect(screen.queryByText('Row 0')).toBeInTheDocument()
    expect(screen.queryByText('Row 4')).not.toBeInTheDocument()
  })
  it('should render given dynamic size', async () => {
    const getBoundingClientRect = index =>
      jest.fn(() => ({
        height: index % 2 === 0 ? 25 : 50,
      }))

    render(<List getBoundingClientRect={getBoundingClientRect} />)

    expect(screen.queryByText('Row 0')).toBeInTheDocument()
    expect(screen.queryByText('Row 6')).not.toBeInTheDocument()
  })

  it('should render given dynamic size after scroll', async () => {
    const getBoundingClientRect = index =>
      jest.fn(() => ({
        height: index % 2 === 0 ? 25 : 50,
      }))
    const parentRef = React.createRef()

    render(
      <List
        getBoundingClientRect={getBoundingClientRect}
        parentRef={parentRef}
      />
    )

    expect(screen.queryByText('Row 0')).toBeInTheDocument()
    expect(screen.queryByText('Row 6')).not.toBeInTheDocument()

    fireEvent.scroll(parentRef.current, { target: { scrollTop: 375 } })

    expect(screen.queryByText('Row 8')).toBeInTheDocument()
    expect(screen.queryByText('Row 14')).not.toBeInTheDocument()
  })
})
