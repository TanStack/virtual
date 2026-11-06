import * as React from 'react'
import { createRoot } from 'react-dom/client'
import { faker } from '@faker-js/faker'
import { useVirtualizer } from '@tanstack/react-virtual'

import './index.css'

type SizingMode = 'dynamic' | 'fixed' | 'variable'

const randomNumber = (min: number, max: number) =>
  faker.number.int({ min, max })

const rowCount = 10000
const columnCount = 10000

// Generate cell content for dynamic mode
const generateCellContent = (row: number, col: number) => {
  // Use a deterministic seed based on position
  faker.seed(row * columnCount + col)
  return faker.lorem.words(randomNumber(1, 4))
}

// Pre-computed variable sizes for "variable" mode
const variableRowHeights = new Array(rowCount)
  .fill(true)
  .map(() => 25 + Math.round(Math.random() * 75))

const variableColumnWidths = new Array(columnCount)
  .fill(true)
  .map(() => 75 + Math.round(Math.random() * 125))

function Grid() {
  const parentRef = React.useRef<HTMLDivElement>(null)
  const [sizingMode, setSizingMode] = React.useState<SizingMode>('dynamic')

  // Row virtualizer
  const rowVirtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => parentRef.current,
    estimateSize: React.useCallback(
      (index: number) => {
        switch (sizingMode) {
          case 'fixed':
            return 35
          case 'variable':
            return variableRowHeights[index]
          case 'dynamic':
          default:
            return 50
        }
      },
      [sizingMode],
    ),
    overscan: 5,
  })

  // Column virtualizer
  const columnVirtualizer = useVirtualizer({
    horizontal: true,
    count: columnCount,
    getScrollElement: () => parentRef.current,
    estimateSize: React.useCallback(
      (index: number) => {
        switch (sizingMode) {
          case 'fixed':
            return 100
          case 'variable':
            return variableColumnWidths[index]
          case 'dynamic':
          default:
            return 120
        }
      },
      [sizingMode],
    ),
    overscan: 5,
  })

  const virtualRows = rowVirtualizer.getVirtualItems()
  const virtualColumns = columnVirtualizer.getVirtualItems()

  return (
    <div>
      <div className="controls">
        <div className="mode-selector">
          <strong>Sizing Mode:</strong>
          {(['dynamic', 'fixed', 'variable'] as const).map((mode) => (
            <label key={mode}>
              <input
                type="radio"
                name="sizingMode"
                value={mode}
                checked={sizingMode === mode}
                onChange={() => setSizingMode(mode)}
                style={{ display: 'none' }}
              />
              <span>{mode.charAt(0).toUpperCase() + mode.slice(1)}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="controls">
        <button
          onClick={() => {
            rowVirtualizer.scrollToIndex(0)
            columnVirtualizer.scrollToIndex(0)
          }}
        >
          Scroll to top-left
        </button>
        <button
          onClick={() => {
            rowVirtualizer.scrollToIndex(Math.floor(rowCount / 2))
            columnVirtualizer.scrollToIndex(Math.floor(columnCount / 2))
          }}
        >
          Scroll to center
        </button>
        <button
          onClick={() => {
            rowVirtualizer.scrollToIndex(rowCount - 1)
            columnVirtualizer.scrollToIndex(columnCount - 1)
          }}
        >
          Scroll to bottom-right
        </button>
      </div>

      <p style={{ fontSize: '12px', color: '#666' }}>
        {sizingMode === 'dynamic' && (
          <>
            <strong>Dynamic mode:</strong> Cell sizes are estimated and can vary
            based on content. Best for unknown or variable content.
          </>
        )}
        {sizingMode === 'fixed' && (
          <>
            <strong>Fixed mode:</strong> All cells have the same dimensions
            (35px height, 100px width). Best performance for uniform grids.
          </>
        )}
        {sizingMode === 'variable' && (
          <>
            <strong>Variable mode:</strong> Each row/column has pre-computed
            dimensions. Use when sizes are known but vary per row/column.
          </>
        )}
      </p>

      <div
        ref={parentRef}
        className="List"
        style={{
          height: 500,
          width: '100%',
          maxWidth: 800,
          overflow: 'auto',
          contain: 'strict',
        }}
      >
        <div
          style={{
            height: rowVirtualizer.getTotalSize(),
            width: columnVirtualizer.getTotalSize(),
            position: 'relative',
          }}
        >
          {virtualRows.map((virtualRow) => (
            <React.Fragment key={virtualRow.key}>
              {virtualColumns.map((virtualColumn) => {
                const isEven =
                  (virtualRow.index + virtualColumn.index) % 2 === 0
                return (
                  <div
                    key={virtualColumn.key}
                    className={isEven ? 'ListItemEven' : 'ListItemOdd'}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width:
                        sizingMode === 'fixed'
                          ? 100
                          : sizingMode === 'variable'
                            ? variableColumnWidths[virtualColumn.index]
                            : virtualColumn.size,
                      height:
                        sizingMode === 'fixed'
                          ? 35
                          : sizingMode === 'variable'
                            ? variableRowHeights[virtualRow.index]
                            : virtualRow.size,
                      transform: `translateX(${virtualColumn.start}px) translateY(${virtualRow.start}px)`,
                      padding: '4px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      fontSize: '12px',
                    }}
                  >
                    {sizingMode === 'dynamic' ? (
                      <div>
                        <div style={{ fontWeight: 'bold', fontSize: '10px' }}>
                          {virtualRow.index},{virtualColumn.index}
                        </div>
                        <div style={{ fontSize: '11px' }}>
                          {generateCellContent(
                            virtualRow.index,
                            virtualColumn.index,
                          )}
                        </div>
                      </div>
                    ) : (
                      `${virtualRow.index}, ${virtualColumn.index}`
                    )}
                  </div>
                )
              })}
            </React.Fragment>
          ))}
        </div>
      </div>

      <p style={{ marginTop: '1rem', fontSize: '12px', color: '#666' }}>
        Rendering {virtualRows.length * virtualColumns.length} of{' '}
        {(rowCount * columnCount).toLocaleString()} cells (
        {virtualRows.length} rows x {virtualColumns.length} columns)
      </p>
    </div>
  )
}

function App() {
  return (
    <div>
      <h1>Grid Virtualization</h1>
      <p>
        Efficiently render large 2D grids (spreadsheets, data tables, game
        boards) by only rendering visible cells. Both rows and columns are
        virtualized simultaneously.
      </p>
      <Grid />
      {process.env.NODE_ENV === 'development' && (
        <p style={{ marginTop: '2rem', fontSize: '12px', color: '#999' }}>
          <strong>Note:</strong> Running in development mode. Performance will
          improve in production builds.
        </p>
      )}
    </div>
  )
}

const container = document.getElementById('root')!
const root = createRoot(container)

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
