import React from 'react'
import ReactDOM from 'react-dom/client'
import { useVirtualizer } from '@tanstack/react-virtual'

const ITEM_SIZE = 40
const COUNT = 1000

const App = () => {
  const parentRef = React.useRef<HTMLDivElement>(null)

  const params = new URLSearchParams(window.location.search)
  const mode = (params.get('mode') ?? 'transform') as 'position' | 'transform'

  const renderCount = React.useRef(0)
  renderCount.current += 1

  const rowVirtualizer = useVirtualizer({
    count: COUNT,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ITEM_SIZE,
    overscan: 2,
    directDomUpdates: true,
    directDomUpdatesMode: mode,
  })

  return (
    <div>
      <div data-testid="render-count">{renderCount.current}</div>
      <div data-testid="mode">{mode}</div>
      <button
        id="scroll-to-500"
        onClick={() => rowVirtualizer.scrollToIndex(500)}
      >
        Scroll to 500
      </button>

      <div
        ref={parentRef}
        id="scroll-container"
        style={{ height: 400, overflow: 'auto' }}
      >
        <div
          ref={rowVirtualizer.containerRef}
          id="inner"
          style={{ position: 'relative', width: '100%' }}
        >
          {rowVirtualizer.getVirtualItems().map((v) => (
            <div
              key={v.key}
              data-testid={`item-${v.index}`}
              ref={rowVirtualizer.measureElement}
              data-index={v.index}
              style={{
                position: 'absolute',
                left: 0,
                width: '100%',
                height: ITEM_SIZE,
                ...(mode === 'transform' ? { top: 0 } : null),
              }}
            >
              Row {v.index}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

ReactDOM.createRoot(document.getElementById('root')!).render(<App />)
