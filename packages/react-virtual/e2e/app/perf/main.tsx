import React from 'react'
import ReactDOM from 'react-dom/client'
import { useHook as useVirtualizer } from '../useHook'

const ITEM_COUNT = 10_000

const randomHeight = (() => {
  const cache = new Map<string, number>()
  return (id: string) => {
    const value = cache.get(id)
    if (value !== undefined) return value
    const v = 25 + Math.floor(Math.random() * 76) // 25–100
    cache.set(id, v)
    return v
  }
})()

const App = () => {
  const parentRef = React.useRef<HTMLDivElement>(null)
  const renderCount = React.useRef(0)

  const rowVirtualizer = useVirtualizer({
    count: ITEM_COUNT,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 50,
  })

  renderCount.current++

  // Expose render count to Playwright
  React.useEffect(() => {
    ;(window as any).__RENDER_COUNT__ = renderCount
  })

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        <button
          id="scroll-to-5000"
          onClick={() => rowVirtualizer.scrollToIndex(5000)}
        >
          Scroll to 5000
        </button>
        <button
          id="scroll-to-9999"
          onClick={() => rowVirtualizer.scrollToIndex(ITEM_COUNT - 1)}
        >
          Scroll to last
        </button>
        <button
          id="scroll-to-0"
          onClick={() => rowVirtualizer.scrollToIndex(0)}
        >
          Scroll to 0
        </button>
      </div>

      <div id="render-count" data-renders={renderCount.current} />

      <div
        ref={parentRef}
        id="scroll-container"
        style={{
          height: 400,
          overflow: 'auto',
          contain: 'strict',
          overflowAnchor: 'none',
        }}
      >
        <div
          style={{
            height: rowVirtualizer.getTotalSize(),
            position: 'relative',
          }}
        >
          {rowVirtualizer.getVirtualItems().map((v) => (
            <div
              key={v.key}
              data-testid={`item-${v.index}`}
              ref={rowVirtualizer.measureElement}
              data-index={v.index}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                transform: `translateY(${v.start}px)`,
                width: '100%',
              }}
            >
              <div style={{ height: randomHeight(String(v.key)) }}>
                Row {v.index}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// Mark initial render timing
performance.mark('app-start')
const root = ReactDOM.createRoot(document.getElementById('root')!)
root.render(<App />)
requestAnimationFrame(() => {
  requestAnimationFrame(() => {
    performance.mark('app-rendered')
    performance.measure('initial-render', 'app-start', 'app-rendered')
  })
})
