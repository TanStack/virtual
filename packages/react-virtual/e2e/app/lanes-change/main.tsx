import React from 'react'
import ReactDOM from 'react-dom/client'
import { useVirtualizer } from '@tanstack/react-virtual'

// Port of the reproduction in TanStack/virtual#1036: a grid of square cells
// whose height follows the lane width, so a lane change resizes every item.
const itemSize = 50
const gap = 2
const items = new Array(100)

function App() {
  const [lanes, setLanes] = React.useState(10)
  const parentRef = React.useRef<HTMLDivElement>(null)

  const rowVirtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => itemSize,
    lanes,
    gap,
  })
  ;(window as any).virtualizer = rowVirtualizer

  const visibleItems = rowVirtualizer.getVirtualItems()

  return (
    <>
      <div
        ref={parentRef}
        id="scroll-container"
        style={{ width: '600px', height: '200px', overflow: 'auto' }}
      >
        <div
          style={{
            height: `${rowVirtualizer.getTotalSize()}px`,
            minHeight: 600,
            position: 'relative',
          }}
        >
          {visibleItems.map((virtualRow) => {
            const widthPrc = 100 / rowVirtualizer.options.lanes
            return (
              <div
                key={virtualRow.index}
                className="cell"
                data-lane={virtualRow.lane}
                data-start={virtualRow.start}
                style={{
                  position: 'absolute',
                  width: `${widthPrc}%`,
                  left: `${virtualRow.lane * widthPrc}%`,
                  height: `${virtualRow.size}px`,
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                <div
                  style={{ aspectRatio: '1 / 1', background: '#ddd' }}
                  data-index={virtualRow.index}
                  ref={rowVirtualizer.measureElement}
                >
                  {virtualRow.index}
                </div>
              </div>
            )
          })}
        </div>
      </div>
      <button
        data-testid="toggle"
        onClick={() => setLanes((p) => (p === 5 ? 10 : 5))}
      >
        Toggle lanes
      </button>
    </>
  )
}

ReactDOM.createRoot(document.getElementById('root')!).render(<App />)
