import React from 'react'
import ReactDOM from 'react-dom'

import './index.css'

import { useVirtual } from 'react-virtual'

function App() {
  const rows = new Array(10000)
    .fill(true)
    .map(() => 25 + Math.round(Math.random() * 100))

  const columns = new Array(10000)
    .fill(true)
    .map(() => 75 + Math.round(Math.random() * 100))

  return (
    <div>
      <p>
        These components are using <strong>dynamic</strong> sizes. This means
        that each element's exact dimensions are unknown when rendered. An
        estimated dimension is used to get an a initial measurement, then this
        measurement is readjusted on the fly as each element is rendered.
      </p>
      <br />
      <br />

      <h3>Rows</h3>
      <RowVirtualizerDynamic rows={rows} columns={columns} />
      <br />
      <br />
      <h3>Columns</h3>
      <ColumnVirtualizerDynamic rows={rows} columns={columns} />
      <br />
      <br />
      <h3>Grid</h3>
      <GridVirtualizerDynamic rows={rows} columns={columns} />
    </div>
  )
}

function RowVirtualizerDynamic({ rows }) {
  const parentRef = React.useRef()

  const rowVirtualizer = useVirtual({
    size: rows.length,
    parentRef,
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
            height: rowVirtualizer.totalSize,
            width: '100%',
            position: 'relative',
          }}
        >
          {rowVirtualizer.virtualItems.map(virtualRow => (
            <div
              key={virtualRow.index}
              ref={virtualRow.measureRef}
              className={virtualRow.index % 2 ? 'ListItemOdd' : 'ListItemEven'}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              <div style={{ height: rows[virtualRow.index] }}>
                Row {virtualRow.index}
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}

function ColumnVirtualizerDynamic({ columns }) {
  const parentRef = React.useRef()

  const columnVirtualizer = useVirtual({
    horizontal: true,
    size: columns.length,
    parentRef,
  })

  return (
    <>
      <div
        ref={parentRef}
        className="List"
        style={{
          width: `400px`,
          height: `100px`,
          overflow: 'auto',
        }}
      >
        <div
          style={{
            width: columnVirtualizer.totalSize,
            height: '100%',
            position: 'relative',
          }}
        >
          {columnVirtualizer.virtualItems.map(virtualColumn => (
            <div
              key={virtualColumn.key}
              ref={virtualColumn.measureRef}
              className={
                virtualColumn.index % 2 ? 'ListItemOdd' : 'ListItemEven'
              }
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                height: '100%',
                transform: `translateX(${virtualColumn.start}px)`,
              }}
            >
              <div style={{ width: columns[virtualColumn.index] }}>
                Column {virtualColumn.index}
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}

function GridVirtualizerDynamic({ rows, columns }) {
  const parentRef = React.useRef()

  const rowVirtualizer = useVirtual({
    size: rows.length,
    parentRef,
  })

  const columnVirtualizer = useVirtual({
    horizontal: true,
    size: columns.length,
    parentRef,
  })

  const [show, setShow] = React.useState(true)

  const halfWay = Math.floor(rows.length / 2)

  return (
    <>
      <button onClick={() => setShow(old => !old)}>Toggle</button>
      <button onClick={() => rowVirtualizer.scrollToIndex(halfWay)}>
        Scroll to index {halfWay}
      </button>
      <button onClick={() => rowVirtualizer.scrollToIndex(rows.length - 1)}>
        Scroll to index {rows.length - 1}
      </button>
      {show ? (
        <div
          ref={parentRef}
          className="List"
          style={{
            height: `400px`,
            width: `500px`,
            overflow: 'auto',
          }}
        >
          <div
            style={{
              height: rowVirtualizer.totalSize,
              width: columnVirtualizer.totalSize,
              position: 'relative',
            }}
          >
            {rowVirtualizer.virtualItems.map(virtualRow => (
              <React.Fragment key={virtualRow.key}>
                {columnVirtualizer.virtualItems.map(virtualColumn => (
                  <div
                    key={virtualColumn.key}
                    ref={el => {
                      virtualRow.measureRef(el)
                      virtualColumn.measureRef(el)
                    }}
                    className={
                      virtualColumn.index % 2
                        ? virtualRow.index % 2 === 0
                          ? 'ListItemOdd'
                          : 'ListItemEven'
                        : virtualRow.index % 2
                        ? 'ListItemOdd'
                        : 'ListItemEven'
                    }
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      transform: `translateX(${virtualColumn.start}px) translateY(${virtualRow.start}px)`,
                    }}
                  >
                    <div
                      style={{
                        height: rows[virtualRow.index],
                        width: columns[virtualColumn.index],
                      }}
                    >
                      Cell {virtualRow.index}, {virtualColumn.index}
                    </div>
                  </div>
                ))}
              </React.Fragment>
            ))}
          </div>
        </div>
      ) : null}
      <br />
      <br />
      {process.env.NODE_ENV === 'development' ? (
        <p>
          <strong>Notice:</strong> You are currently running React in
          development mode. Rendering performance will be slightly degraded
          until this application is build for production.
        </p>
      ) : null}
    </>
  )
}

ReactDOM.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
  document.getElementById('root')
)
