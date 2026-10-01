import * as React from 'react'
import { createRoot } from 'react-dom/client'
import { faker } from '@faker-js/faker'

import { useVirtualizer, useVirtualizerState } from '@tanstack/react-virtual'
import type { ReactVirtualizer, VirtualItem } from '@tanstack/react-virtual'

import './index.css'

type Row = { id: string; text: string }

let nextId = 0
const createRows = (count: number): Array<Row> =>
  Array.from({ length: count }, () => ({
    id: String(nextId++),
    text: faker.lorem.sentence(faker.number.int({ min: 5, max: 60 })),
  }))

type ListVirtualizer = ReactVirtualizer<HTMLDivElement, HTMLDivElement>

// This example is built with the React Compiler (see vite.config.js).
//
// The `Virtualizer` instance is stable across renders, so the compiler can
// memoise reads like `virtualizer.getVirtualItems()` on it and render stale
// rows. Values used during render are read through `useVirtualizerState`
// instead, and the instance is kept for imperative calls (`scrollToIndex`,
// `measure`, ...).
function App() {
  const parentRef = React.useRef<HTMLDivElement>(null)
  const [rows, setRows] = React.useState(() => createRows(10000))

  const virtualizer = useVirtualizer<HTMLDivElement, HTMLDivElement>({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 45,
    // Stable keys keep each row's measured size when rows are prepended or
    // reordered.
    getItemKey: React.useCallback((index: number) => rows[index]!.id, [rows]),
    // Row positions and the list height are written straight to the DOM, so
    // scrolling and re-measuring rows do not re-render React.
    directDomUpdates: true,
  })

  return (
    <div>
      <div className="Toolbar">
        <button onClick={() => virtualizer.scrollToIndex(0)}>
          scroll to the top
        </button>
        <button
          onClick={() =>
            virtualizer.scrollToIndex(rows.length / 2, { behavior: 'smooth' })
          }
        >
          scroll to the middle
        </button>
        <button onClick={() => virtualizer.scrollToIndex(rows.length - 1)}>
          scroll to the end
        </button>
        <button onClick={() => setRows((prev) => [...createRows(10), ...prev])}>
          prepend 10 rows
        </button>
        <button
          onClick={() => setRows((prev) => faker.helpers.shuffle([...prev]))}
        >
          shuffle
        </button>
      </div>
      <p className="Status">
        <ScrollStatus virtualizer={virtualizer} />
      </p>
      <div
        ref={parentRef}
        className="List"
        style={{
          height: 400,
          width: 400,
          overflowY: 'auto',
          contain: 'strict',
        }}
      >
        <Rows virtualizer={virtualizer} rows={rows} />
      </div>
    </div>
  )
}

// With `directDomUpdates` the virtualizer positions the rows itself, so this
// component only cares about which rows are visible — not where they are.
// Comparing keys and indexes skips re-renders when rows are only re-measured.
const sameRows = (a: Array<VirtualItem>, b: Array<VirtualItem>) =>
  a.length === b.length &&
  a.every((item, i) => item.key === b[i]!.key && item.index === b[i]!.index)

function Rows({
  virtualizer,
  rows,
}: {
  virtualizer: ListVirtualizer
  rows: Array<Row>
}) {
  const virtualItems = useVirtualizerState(
    virtualizer,
    (state) => state.virtualItems,
    sameRows,
  )

  return (
    // The virtualizer sets this container's height through `containerRef`.
    <div
      ref={virtualizer.containerRef}
      style={{ width: '100%', position: 'relative' }}
    >
      {virtualItems.map((item) => (
        <div
          key={item.key}
          data-index={item.index}
          ref={virtualizer.measureElement}
          className={item.index % 2 ? 'ListItemOdd' : 'ListItemEven'}
          // Anchored at the top; the virtualizer writes `transform`.
          style={{ position: 'absolute', top: 0, left: 0, width: '100%' }}
        >
          <div style={{ padding: '10px 0' }}>
            <div>
              Row {item.index} <small>(id {rows[item.index]?.id})</small>
            </div>
            <div>{rows[item.index]?.text}</div>
          </div>
        </div>
      ))}
    </div>
  )
}

// Selectors re-render only when the selected value changes: this component
// ignores size changes and only follows the visible range and scrolling.
function ScrollStatus({ virtualizer }: { virtualizer: ListVirtualizer }) {
  const range = useVirtualizerState(virtualizer, (state) => state.range)
  const isScrolling = useVirtualizerState(
    virtualizer,
    (state) => state.isScrolling,
  )

  return (
    <>
      Visible rows {range ? `${range.startIndex}–${range.endIndex}` : '–'}
      {isScrolling ? ' · scrolling…' : ''}
    </>
  )
}

const container = document.getElementById('root')!
const root = createRoot(container)
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
