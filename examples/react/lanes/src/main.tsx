import * as React from 'react'
import * as ReactDOM from 'react-dom/client'

import './index.css'

import { useVirtualizer } from '@tanstack/react-virtual'
import { debounce } from '@tanstack/react-pacer'

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
      <LanesGapVirtualizer  />
      <br />
      <br />
      <h3>Lanes Gaps</h3>
      <GapVirtualizer />
      <br />
      <br />
      <h3>Resizable Container Lanes</h3>
      <ResizeVirtualizer />
      <br />
      <br />
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

function LanesGapVirtualizer() {
  const [numLanes, setNumLanes] = React.useState(4)
  const parentRef = React.useRef(null)

  const rowVirtualizer = useVirtualizer({
    count: 10000,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 35,
    overscan: 5,
    lanes: numLanes,
  })

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: '80px 200px', gap: '10px' }}>
        <label htmlFor="numLanes1">Num Lanes</label>
        <input type="number" id="numLanes1" value={numLanes} onChange={(e) => {setNumLanes(Number(e.target.value)); rowVirtualizer.measure()}} />
      </div>
      <br />
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
                left: `calc(${virtualRow.index % numLanes} * 100% / ${numLanes})`,
                width: `calc(100% / ${numLanes})`,
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

function GapVirtualizer() {
  const parentRef = React.useRef<HTMLDivElement>(null)
  const [numLanes, setNumLanes] = React.useState(4)
  const [rowGap, setRowGap] = React.useState(10)
  const [columnGap, setColumnGap] = React.useState(10)

  const rowVirtualizer = useVirtualizer({
    count: 10000,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 35,
    overscan: 5,
    lanes: numLanes,
    gap: rowGap,
  })

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: '80px 200px', gap: '10px' }}>
        <label htmlFor="numLanes2">Num Lanes</label>
        <input type="number" id="numLanes2" value={numLanes} onChange={(e) => {setNumLanes(Number(e.target.value)); rowVirtualizer.measure()}} />
        <label htmlFor="rowGap" >Row Gap</label>
        <input type="number" id="rowGap" value={rowGap} onChange={(e) => {setRowGap(Number(e.target.value)); rowVirtualizer.measure()}} />
        <label htmlFor="columnGap">Column Gap</label>
        <input type="number" id="columnGap" value={columnGap} onChange={(e) => {setColumnGap(Number(e.target.value)); rowVirtualizer.measure()}} />
      </div>
      <br />
      
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
          {rowVirtualizer.getVirtualItems().map((virtualRow) => {
            return (
            <div
              key={virtualRow.index}
              className={virtualRow.index % 2 ? 'ListItemOdd' : 'ListItemEven'}
              style={{
                position: 'absolute',
                top: 0,
                left: `calc((${virtualRow.index % numLanes} * 100% / ${numLanes}) + (${columnGap}px * (${virtualRow.index % numLanes}) / ${numLanes}))`,
                width: `calc((100% / ${numLanes}) - (${columnGap}px * (${numLanes} - 1) / ${numLanes}))`,
                height: `${virtualRow.size}px`,
                transform: `translateY(${virtualRow.start}px)`,
                outline: '1px solid red',
              }}
            >
              Cell {virtualRow.index}
            </div>
            )
          })}
        </div>
      </div>
    </>
  )
}

const CELL_WIDTH = 100
function ResizeVirtualizer() {
  const parentRef = React.useRef<HTMLDivElement>(null)
  const [numLanes, setNumLanes] = React.useState(4)
  const [rowGap, setRowGap] = React.useState(10)
  const [columnGap, setColumnGap] = React.useState(10)

  const rowVirtualizer = useVirtualizer({
    count: 10000,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 35,
    overscan: 5,
    lanes: numLanes,
    gap: rowGap,
  })

  React.useEffect(() => {
     if (!parentRef.current) return
     // debounce not necessary
     const debouncedOnResize = debounce((entries:  Array<ResizeObserverEntry>) => {
      const rect = entries.at(0)?.contentRect
      if (!rect) return
      const { width } = rect
      setNumLanes(Math.floor(width / CELL_WIDTH))
      rowVirtualizer.measure()
     }, {
      wait: 50,
      
     })
     const resizeObserver = new ResizeObserver((entries) => {
       debouncedOnResize(entries)
     })
     resizeObserver.observe(parentRef.current)
     return () => {
       resizeObserver.disconnect()
     }
  }, [rowVirtualizer])



  return (
    <>
    <div style={{ display: 'grid', gridTemplateColumns: '80px 200px', gap: '10px' }}>
      <label htmlFor="numLanes2">Num Lanes</label>
      <input type="number" id="numLanes2" value={numLanes}  readOnly disabled/>
      <label htmlFor="rowGap" >Row Gap</label>
      <input type="number" id="rowGap" value={rowGap} onChange={(e) => {setRowGap(Number(e.target.value)); rowVirtualizer.measure()}} />
      <label htmlFor="columnGap">Column Gap</label>
      <input type="number" id="columnGap" value={columnGap} onChange={(e) => {setColumnGap(Number(e.target.value)); rowVirtualizer.measure()}} />
    </div>
    <br />
    
    <div
      ref={parentRef}
      className="List"
      style={{
        height: "200px",
        width: "400px",
        overflow: "auto",
        minWidth: CELL_WIDTH,
        minHeight: "35px",
        resize: 'horizontal',
      }}
    >
      <div
        style={{
          height: `${rowVirtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {rowVirtualizer.getVirtualItems().map((virtualRow) => {
          return (
          <div
            key={virtualRow.index}
            className={virtualRow.index % 2 ? 'ListItemOdd' : 'ListItemEven'}
            style={{
              position: 'absolute',
              top: 0,
              left: `calc((${virtualRow.index % numLanes} * 100% / ${numLanes}) + (${columnGap}px * (${virtualRow.index % numLanes}) / ${numLanes}))`,
              width: `calc((100% / ${numLanes}) - (${columnGap}px * (${numLanes} - 1) / ${numLanes}))`,
              height: `${virtualRow.size}px`,
              transform: `translateY(${virtualRow.start}px)`,
              outline: '1px solid red',
            }}
          >
            Cell {virtualRow.index}
          </div>
          )
        })}
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
