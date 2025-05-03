import * as React from 'react'
import * as ReactDOM from 'react-dom/client'

import './index.css'

import { useVirtualizer } from '@tanstack/react-virtual'

function App() {
  return (
    <div>
      <p>
        <strong>Lanes</strong> are useful when you are trying to draw a grid of items, where
        each row is split into multiple columns.
      </p>
      <br />
      <br />

      <h3>Lanes</h3>
      <LanesVirtualizer />
      <br />
      <br />
      {process.env.NODE_ENV === 'development' ? (
        <p>
          <strong>Notice:</strong> You are currently running React in
          development mode. Rendering performance will be slightly degraded
          until this application is built for production.
        </p>
      ) : null}
    </div>
  )
}

const NUM_LANES = 5

function LanesVirtualizer() {
  const parentRef = React.useRef(null)

  const rowVirtualizer = useVirtualizer({
    count: 10000,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 35,
    overscan: 5,
    lanes: NUM_LANES,
  })

  return (
    <>
      <div
        ref={parentRef}
        className="List"
        style={{
          height: "200px",
          width: "400px",
          overflow: "auto",
        }}
      >
        <div
          style={{
            height: `${rowVirtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative',
          }}
        >
          {rowVirtualizer.getVirtualItems().map((virtualRow) => (
            <div
              key={virtualRow.index}
              className={virtualRow.index % 2 ? 'ListItemOdd' : 'ListItemEven'}
              style={{
                position: 'absolute',
                top: 0,
                left: `calc(${virtualRow.index % NUM_LANES} * 100% / ${NUM_LANES})`,
                width: `calc(100% / ${NUM_LANES})`,
                height: `${virtualRow.size}px`,
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              Cell {virtualRow.index}
            </div>
          ))}
        </div>
      </div>
    </>
  )
}

// eslint-disable-next-line
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
