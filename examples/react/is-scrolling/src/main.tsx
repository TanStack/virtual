import React from 'react'
import { createRoot } from 'react-dom/client'

import './index.css'

import { ScrollInfo, useVirtualizer } from '@tanstack/react-virtual'

function App() {
  return (
    <div>
      <p>
        we change the background to yellow when scrolling, and back to white when not.
      </p>
      <br />
      <br />
      <RowVirtualizerFixed />
      {process.env.NODE_ENV === 'development' ? (
        <p>
          <strong>Notice:</strong> You are currently running React in
          development mode. Rendering performance will be slightly degraded
          until this application is build for production.
        </p>
      ) : null}
    </div>
  )
}

function RowVirtualizerFixed() {
  const parentRef = React.useRef<null | HTMLDivElement>(null)

  //this should be memoized to prevernt register / unregister on every render
  const onIsScrollingChange = React.useCallback((scrollInfo: ScrollInfo) => {
    if (!parentRef.current) return
    if (scrollInfo.isScrolling) {
      parentRef.current.style.backgroundColor = 'yellow'
    } else {
      parentRef.current.style.backgroundColor = 'white'
    }
  }, []);

  const rowVirtualizer = useVirtualizer({
    count: 10000,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 35,
    overscan: 5,
    onIsScrollingChange,
  })

  return (
    <>
      <div
        ref={parentRef}
        className="List"
        style={{
          height: `200px`,
          width: `400px`,
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
          {rowVirtualizer.virtualItems.map((virtualRow) => (
            <div
              key={virtualRow.index}
              className={virtualRow.index % 2 ? 'ListItemOdd' : 'ListItemEven'}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: `${virtualRow.size}px`,
                transform: `translateY(${virtualRow.start}px)`,
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

const root = createRoot(document.getElementById('root')!);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
