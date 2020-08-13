import { render, act, waitForElement, fireEvent } from '@testing-library/react'
import * as React from 'react'

import { useVirtual } from '../index'

const sleep = (time = 1000) => new Promise(r => setTimeout(r, time))

const Container = React.forwardRef((props, ref) => (
  <div
    {...props}
    data-testid="container"
    ref={ref}
    style={{
      height: `200px`,
      width: `200px`,
      overflow: 'auto',
    }}
  />
))

const Inner = React.forwardRef(({ style = {}, ...rest }, ref) => (
  <div
    {...rest}
    data-testid="inner"
    ref={ref}
    style={{
      width: '100%',
      position: 'relative',
      ...style,
    }}
  />
))

const Row = React.forwardRef(({ style = {}, ...rest }, ref) => (
  <div
    {...rest}
    ref={ref}
    style={{
      position: 'absolute',
      top: 0,
      left: 0,
      width: '100%',
      ...style,
    }}
  />
))

describe('useVirtual', () => {
  it('should render', async () => {
    function App() {
      const parentRef = React.useRef()

      const rowVirtualizer = useVirtual({
        size: 10000,
        parentRef,
        estimateSize: React.useCallback(() => 35, []),
        overscan: 5,
      })

      return (
        <>
          <Container ref={parentRef}>
            <Inner
              style={{
                height: `${rowVirtualizer.totalSize}px`,
              }}
            >
              {rowVirtualizer.virtualItems.map(virtualRow => (
                <Row
                  key={virtualRow.index}
                  style={{
                    height: `${virtualRow.size}px`,
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                >
                  Row {virtualRow.index}
                </Row>
              ))}
            </Inner>
          </Container>
        </>
      )
    }

    const rendered = render(<App />)

    rendered.getByText('Row 1')
  })

  it('should render given dynamic size', async () => {
    function App() {
      const parentRef = React.useRef()

      const rowVirtualizer = useVirtual({
        size: 20,
        parentRef,
        overscan: 5,
      })

      return (
        <>
          <Container ref={parentRef}>
            <Inner
              style={{
                height: `${rowVirtualizer.totalSize}px`,
              }}
            >
              {rowVirtualizer.virtualItems.map(virtualRow => (
                <Row
                  key={virtualRow.index}
                  ref={virtualRow.measureRef}
                  style={{
                    height: `${virtualRow.size}px`,
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                >
                  Row {virtualRow.index}
                </Row>
              ))}
            </Inner>
          </Container>
        </>
      )
    }

    const rendered = render(<App />)

    rendered.getByText('Row 1')
  })

  // it('scrolling utilities should work', async () => {
  //   function App() {
  //     const parentRef = React.useRef()

  //     const rowVirtualizer = useVirtual({
  //       size: 10000,
  //       parentRef,
  //       estimateSize: React.useCallback(() => 35, []),
  //       overscan: 5,
  //     })

  //     return (
  //       <>
  //         <Container ref={parentRef}>
  //           <Inner
  //             style={{
  //               height: `${rowVirtualizer.totalSize}px`,
  //             }}
  //           >
  //             {rowVirtualizer.virtualItems.map(virtualRow => (
  //               <Row
  //                 key={virtualRow.index}
  //                 style={{
  //                   height: `${virtualRow.size}px`,
  //                   transform: `translateY(${virtualRow.start}px)`,
  //                 }}
  //               >
  //                 Row {virtualRow.index}
  //               </Row>
  //             ))}
  //           </Inner>
  //         </Container>
  //         <button
  //           onClick={() => {
  //             rowVirtualizer.scrollToOffset(500)
  //           }}
  //         >
  //           scrollToOffset500
  //         </button>
  //         <button
  //           onClick={() => {
  //             rowVirtualizer.scrollToIndex(50)
  //           }}
  //         >
  //           scrollToIndex50
  //         </button>
  //       </>
  //     )
  //   }

  //   const rendered = render(<App />)

  //   await rendered.getByText('Row 1')

  //   act(() => {
  //     fireEvent.click(rendered.getByText('scrollToOffset500'))
  //     fireEvent.scroll(rendered.getByTestId('container'), {
  //       target: rendered.getByTestId('container'),
  //     })
  //     // await sleep()
  //   })

  //   await rendered.findByText('Row 20')
  //   await rendered.findByText('Row 8')

  //   act(() => {
  //     fireEvent.click(rendered.getByText('scrollToIndex50'))
  //     fireEvent.scroll(rendered.getByTestId('container'), {
  //       target: rendered.getByTestId('container'),
  //     })
  //     // await sleep()
  //   })

  //   await rendered.findByText('Row 62')
  //   await rendered.findByText('Row 50')

  //   // expect(rendered.getByTestId('container').scrollTop).toEqual(500)
  // })
})

// fireEvent.scroll(scrollContainer, { target: { scrollY: 100 } });
