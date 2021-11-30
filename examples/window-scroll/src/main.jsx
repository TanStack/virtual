import React from 'react'
import ReactDOM from 'react-dom'
import './index.css'

import { useVirtual } from 'react-virtual'

const rows = new Array(10000)
  .fill(true)
  .map(() => 25 + Math.round(Math.random() * 100))

function App() {
  const parentRef = React.useRef(null)

  const rowVirtualizer = useVirtual({
    size: rows.length,
    parentRef,
    windowRef: React.useRef(window),
  })

  return (
    <div>
      <h1>Window scroll - demo</h1>
      <div>
        <div ref={parentRef} style={{ width: `100%` }}>
          <div
            style={{
              height: `${rowVirtualizer.totalSize}px`,
              width: '100%',
              position: 'relative',
            }}
          >
            {rowVirtualizer.virtualItems.map(virtualRow => (
              <div
                key={virtualRow.key}
                ref={virtualRow.measureRef}
                className={
                  virtualRow.index % 2 ? 'ListItemOdd' : 'ListItemEven'
                }
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                <div style={{ height: `${rows[virtualRow.index]}px` }}>
                  Row {virtualRow.index}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

ReactDOM.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
  document.getElementById('root')
)
