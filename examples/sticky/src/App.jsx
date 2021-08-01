import './App.css'
import * as React from 'react'
import faker from 'faker'
import { findIndex, groupBy } from 'lodash'
import { useVirtual, defaultRangeExtractor } from 'react-virtual'

const groupedNames = groupBy(
  Array.from({ length: 1000 })
    .map(() => faker.name.firstName())
    .sort(),
  name => name[0]
)
const groups = Object.keys(groupedNames)
const rows = groups.reduce((acc, k) => [...acc, k, ...groupedNames[k]], [])

const App = () => {
  const parentRef = React.useRef()

  const activeStickyIndexRef = React.useRef(0)

  const stickyIndexes = React.useMemo(
    () => groups.map(gn => findIndex(rows, n => n === gn)),
    []
  )

  const isSticky = index => stickyIndexes.includes(index)

  const isActiveSticky = index => activeStickyIndexRef.current === index

  const rowVirtualizer = useVirtual({
    estimateSize: React.useCallback(() => 50, []),
    size: rows.length,
    parentRef,
    rangeExtractor: React.useCallback(
      range => {
        activeStickyIndexRef.current = [...stickyIndexes]
          .reverse()
          .find(index => range.start >= index)

        const next = new Set([
          activeStickyIndexRef.current,
          ...defaultRangeExtractor(range),
        ])

        return [...next].sort((a, b) => a - b)
      },
      [stickyIndexes]
    ),
  })

  return (
    <div>
      <div
        ref={parentRef}
        className="List"
        style={{
          height: `300px`,
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
          {rowVirtualizer.virtualItems.map(virtualRow => (
            <div
              key={virtualRow.index}
              className={'ListItem'}
              style={{
                ...(isSticky(virtualRow.index)
                  ? {
                      background: '#fff',
                      borderBottom: '1px solid #ddd',
                      zIndex: 1,
                    }
                  : {}),
                ...(isActiveSticky(virtualRow.index)
                  ? {
                      position: 'sticky',
                    }
                  : {
                      position: 'absolute',
                      transform: `translateY(${virtualRow.start}px)`,
                    }),
                top: 0,
                left: 0,
                width: '100%',
                height: `${virtualRow.size}px`,
              }}
            >
              {rows[virtualRow.index]}
            </div>
          ))}
        </div>
      </div>
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

export default App
