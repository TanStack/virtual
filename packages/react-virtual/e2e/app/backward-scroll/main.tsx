import React from 'react'
import ReactDOM from 'react-dom/client'
import { useVirtualizer } from '@tanstack/react-virtual'

const COUNT = 500

// Rows mount at one height and then grow shortly after (simulates an image
// or async content loading and pushing the row taller). This is exactly the
// scenario where backward-scroll jumps happen: a row already in the measured
// cache at size X changes to size Y after a tiny delay, the ResizeObserver
// fires while the user is still scrolling up, and resizeItem triggers a
// scroll adjustment that visually jumps the page.
const Row: React.FC<{ index: number }> = ({ index }) => {
  const [grown, setGrown] = React.useState(false)

  React.useEffect(() => {
    const t = setTimeout(() => setGrown(true), 150)
    return () => clearTimeout(t)
  }, [])

  const extra = grown ? 60 + (index % 5) * 4 : 0

  return (
    <div
      style={{
        padding: 8,
        height: 40 + extra,
        boxSizing: 'border-box',
        borderBottom: '1px solid #ccc',
      }}
    >
      Row {index}
    </div>
  )
}

const App = () => {
  const parentRef = React.useRef<HTMLDivElement>(null)

  const rowVirtualizer = useVirtualizer({
    count: COUNT,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 50,
    overscan: 5,
  })

  return (
    <div>
      <div
        ref={parentRef}
        id="scroll-container"
        data-testid="scroll-container"
        style={{ height: 400, width: 400, overflow: 'auto' }}
      >
        <div
          style={{
            height: rowVirtualizer.getTotalSize(),
            position: 'relative',
            width: '100%',
          }}
        >
          {rowVirtualizer.getVirtualItems().map((v) => (
            <div
              key={v.key}
              data-testid={`item-${v.index}`}
              data-index={v.index}
              ref={rowVirtualizer.measureElement}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${v.start}px)`,
              }}
            >
              <Row index={v.index} />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

ReactDOM.createRoot(document.getElementById('root')!).render(<App />)
