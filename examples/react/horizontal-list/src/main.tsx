import * as React from 'react'
import { createRoot } from 'react-dom/client'
import { faker } from '@faker-js/faker'
import { useVirtualizer } from '@tanstack/react-virtual'

import './index.css'

type SizingMode = 'dynamic' | 'fixed' | 'variable'

const randomNumber = (min: number, max: number) =>
  faker.number.int({ min, max })

// Generate data for the horizontal list
const items = new Array(10000)
  .fill(true)
  .map(() => faker.lorem.words(randomNumber(2, 8)))

// Pre-computed variable widths for "variable" mode
const variableWidths = new Array(10000)
  .fill(true)
  .map(() => 75 + Math.round(Math.random() * 150))

function HorizontalList() {
  const parentRef = React.useRef<HTMLDivElement>(null)
  const [sizingMode, setSizingMode] = React.useState<SizingMode>('dynamic')

  const count = items.length

  // Configure virtualizer based on sizing mode
  const virtualizer = useVirtualizer({
    horizontal: true,
    count,
    getScrollElement: () => parentRef.current,
    estimateSize: React.useCallback(
      (index: number) => {
        switch (sizingMode) {
          case 'fixed':
            return 100
          case 'variable':
            return variableWidths[index]
          case 'dynamic':
          default:
            return 120
        }
      },
      [sizingMode],
    ),
    overscan: 5,
  })

  const virtualItems = virtualizer.getVirtualItems()

  // For dynamic mode, we need to measure elements
  const measureElement = sizingMode === 'dynamic' ? virtualizer.measureElement : undefined

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
        <button onClick={() => virtualizer.scrollToIndex(0)}>
          Scroll to start
        </button>
        <button onClick={() => virtualizer.scrollToIndex(Math.floor(count / 2))}>
          Scroll to middle
        </button>
        <button onClick={() => virtualizer.scrollToIndex(count - 1)}>
          Scroll to end
        </button>
      </div>

      <p style={{ fontSize: '12px', color: '#666' }}>
        {sizingMode === 'dynamic' && (
          <>
            <strong>Dynamic mode:</strong> Each item's width is measured at render time.
            Content width varies and the virtualizer adapts automatically.
          </>
        )}
        {sizingMode === 'fixed' && (
          <>
            <strong>Fixed mode:</strong> All items have the same fixed width (100px).
            Best performance, use when all items are identical width.
          </>
        )}
        {sizingMode === 'variable' && (
          <>
            <strong>Variable mode:</strong> Each item has a known but different width.
            Widths are pre-computed, not measured at runtime.
          </>
        )}
      </p>

      <div
        ref={parentRef}
        className="List"
        style={{
          height: 150,
          width: '100%',
          maxWidth: 800,
          overflowX: 'auto',
          overflowY: 'hidden',
          contain: 'strict',
        }}
      >
        <div
          style={{
            width: virtualizer.getTotalSize(),
            height: '100%',
            position: 'relative',
          }}
        >
          {virtualItems.map((virtualColumn) => (
            <div
              key={virtualColumn.key}
              data-index={virtualColumn.index}
              ref={measureElement}
              className={
                virtualColumn.index % 2 ? 'ListItemOdd' : 'ListItemEven'
              }
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                height: '100%',
                width:
                  sizingMode === 'dynamic'
                    ? undefined
                    : sizingMode === 'fixed'
                      ? 100
                      : variableWidths[virtualColumn.index],
                transform: `translateX(${virtualColumn.start}px)`,
                padding: sizingMode === 'dynamic' ? '10px' : undefined,
                whiteSpace: sizingMode === 'dynamic' ? 'nowrap' : undefined,
              }}
            >
              {sizingMode === 'dynamic' ? (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    height: '100%',
                  }}
                >
                  <div style={{ fontWeight: 'bold' }}>Item {virtualColumn.index}</div>
                  <div>{items[virtualColumn.index]}</div>
                </div>
              ) : (
                `Column ${virtualColumn.index}`
              )}
            </div>
          ))}
        </div>
      </div>

      <p style={{ marginTop: '1rem', fontSize: '12px', color: '#666' }}>
        Rendering {virtualItems.length} of {count.toLocaleString()} items
      </p>
    </div>
  )
}

function App() {
  return (
    <div>
      <h1>Horizontal List Virtualization</h1>
      <p>
        Efficiently render large horizontal lists (carousels, timelines, etc.)
        by only rendering visible items. Try different sizing modes to see how
        they affect behavior.
      </p>
      <HorizontalList />
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
