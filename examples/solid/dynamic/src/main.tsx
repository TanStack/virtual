import { faker } from '@faker-js/faker'

import { createVirtualizer, createWindowVirtualizer } from '@tanstack/solid-virtual'
import { createEffect, For, Show, createSignal } from 'solid-js'
import { render } from 'solid-js/web'

import './index.css'

const randomNumber = (min: number, max: number) =>
  faker.datatype.number({ min, max })

const sentences = new Array(10000)
  .fill(true)
  .map(() => faker.lorem.sentence(randomNumber(20, 70)))

function RowVirtualizerDynamic() {
  let parentRef!: HTMLDivElement;

  const virtualizer = createVirtualizer({
    count: sentences.length,
    getScrollElement: () => parentRef,
    estimateSize: () => 45,
  })

  const items = virtualizer.getVirtualItems()

  return (
    <div
      ref={parentRef}
      class="List"
      style={{ height: '400px', width: '400px', 'overflow-y': 'auto' }}
    >
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            transform: `translateY(${items[0]!.start}px)`,
          }}
        >
          {items.map((virtualRow) => (
            <div
              data-index={virtualRow.index}
              ref={(el) => queueMicrotask(() => virtualizer.measureElement(el))}
              class={virtualRow.index % 2 ? 'ListItemOdd' : 'ListItemEven'}
            >
              <div style={{ padding: '10px 0' }}>
                <div>Row {virtualRow.index}</div>
                <div>{sentences[virtualRow.index]}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

const RowVirtualizerDynamicWindow = () => {
  let parentRef!: HTMLDivElement;

  const [parentOffset, setParentOffset] = createSignal(0)

  createEffect(() => {
    setParentOffset(parentRef?.offsetTop ?? 0);
  });

  const virtualizer = createWindowVirtualizer({
    count: sentences.length,
    estimateSize: () => 45,
    get scrollMargin() {return parentOffset()},
  })
  const items = virtualizer.getVirtualItems()

  return (
    <div ref={parentRef} class="List">
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            transform: `translateY(${
              items[0]!.start - virtualizer.options.scrollMargin
            }px)`,
          }}
        >
          {items.map((virtualRow) => (
            <div
              data-index={virtualRow.index}
              ref={(el) => queueMicrotask(() => virtualizer.measureElement(el))}
              class={virtualRow.index % 2 ? 'ListItemOdd' : 'ListItemEven'}
            >
              <div style={{ padding: '10px 0' }}>
                <div>Row {virtualRow.index}</div>
                <div>{sentences[virtualRow.index]}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function ColumnVirtualizerDynamic() {
  const [parentRef, setParentRef] = createSignal<HTMLDivElement>(null as unknown as HTMLDivElement);

  const virtualizer = createVirtualizer({
    horizontal: true,
    count: sentences.length,
    getScrollElement: parentRef,
    estimateSize: () => 45,
  })

  return (
    <>
      <div
        ref={setParentRef}
        class="List"
        style={{ width: '400px', height: '400px', 'overflow-y': 'auto' }}
      >
        <div
          style={{
            width: `${virtualizer.getTotalSize()}px`,
            height: '100%',
            position: 'relative',
          }}
        >
          <For each={virtualizer.getVirtualItems()}>
            {(virtualColumn) => (
              <div
                data-index={virtualColumn.index}
                ref={(el) => queueMicrotask(() => virtualizer.measureElement(el))}
                class={
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
                <div style={{ width: `${sentences[virtualColumn.index]!.length}px` }}>
                  <div>Column {virtualColumn.index}</div>
                  <div>{sentences[virtualColumn.index]}</div>
                </div>
              </div>
            )}
          </For>
        </div>
      </div>
    </>
  )
}

interface Column {
  key: string
  name: string
  width: number
}

function GridVirtualizerDynamic(props: {
  data: string[][]
  columns: Column[]
}) {
  let parentRef!: HTMLDivElement;

  const [parentOffset, setParentOffset] = createSignal(0);

  createEffect(() => {
    setParentOffset(parentRef?.offsetTop ?? 0);
  });

  const getColumnWidth = (index: number) => props.columns[index]!.width

  const virtualizer = createWindowVirtualizer({
    get count() {return props.data.length},
    estimateSize: () => 350,
    overscan: 5,
    get scrollMargin() {return parentOffset()},
  })

  const columnVirtualizer = createVirtualizer({
    horizontal: true,
    get count() {return props.columns.length},
    getScrollElement: () => parentRef,
    estimateSize: getColumnWidth,
    overscan: 5,
  })
  const columnItems = () => columnVirtualizer.getVirtualItems()
  const [before, after] =
    columnItems.length > 0
      ? [
        () => columnItems()[0]!.start,
        () => columnVirtualizer.getTotalSize() -
            columnItems()[columnItems.length - 1]!.end,
        ]
      : [() => 0, () => 0]

  return (
    <div
      ref={parentRef}
      style={{ 'overflow-y': 'auto', border: '1px solid #c8c8c8' }}
    >
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          position: 'relative',
        }}
      >
        <For each={virtualizer.getVirtualItems()}>
          {(row) => {
            return (
              <div
                data-index={row.index}
                ref={(el) => queueMicrotask(() => virtualizer.measureElement(el))}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  transform: `translateY(${
                    row.start - virtualizer.options.scrollMargin
                  }px)`,
                  display: 'flex',
                }}
              >
                <div style={{ width: `${before}px` }} />
                <For each={columnItems()}>
                  {(column) => {
                    return (
                      <div
                        style={{
                          'min-height': `${row.index === 0 ? 50 : row.size}px`,
                          width: `${getColumnWidth(column.index)}px`,
                          'border-bottom': '1px solid #c8c8c8',
                          'border-right': '1px solid #c8c8c8',
                          padding: '7px 12px',
                        }}
                      >
                        <Show when={row.index === 0} fallback={<div>{props.data[row.index]![column.index]}</div>}>
                          <div>{props.columns[column.index]!.name}</div>
                        </Show>
                      </div>
                    )
                  }}
                </For>
                <div style={{ width: `${after}px` }} />
              </div>
            )
          }}
        </For>
      </div>
    </div>
  )
}

const generateColumns = (count: number) => {
  return new Array(count).fill(0).map((_, i) => {
    const key: string = i.toString()
    return {
      key,
      name: `Column ${i}`,
      width: randomNumber(75, 300),
    }
  })
}

const generateData = (columns: Column[], count = 300) => {
  return new Array(count).fill(0).map((_, rowIndex) =>
    columns.reduce<string[]>((acc, _curr, colIndex) => {
      // simulate dynamic size cells
      const val = faker.lorem.lines(((rowIndex + colIndex) % 10) + 1)

      acc.push(val)

      return acc
    }, []),
  )
}

function App() {
  const pathname = location.pathname
  return (
    <div>
      <p>
        These components are using <strong>dynamic</strong> sizes. This means
        that each element's exact dimensions are unknown when rendered. An
        estimated dimension is used to get an a initial measurement, then this
        measurement is readjusted on the fly as each element is rendered.
      </p>
      <nav>
        <ul>
          <li>
            <a href="/">List</a>
          </li>
          <li>
            <a href="/window-list">List - window as scroller</a>
          </li>
          <li>
            <a href="/columns">Column</a>
          </li>
          <li>
            <a href="/grid">Grid</a>
          </li>
        </ul>
      </nav>
      {(() => {
        switch (pathname) {
          case '/':
            return <RowVirtualizerDynamic />
          case '/columns':
            return <ColumnVirtualizerDynamic />
          case '/window-list':
            return <RowVirtualizerDynamicWindow />
          case '/grid': {
            const columns = generateColumns(30)
            const data = generateData(columns)
            return <GridVirtualizerDynamic columns={columns} data={data} />
          }
          default:
            return <div>Not found</div>
        }
      })()}
      <br />
      <br />
      {process.env.NODE_ENV === 'development' ? (
        <p>
          <strong>Notice:</strong> You are currently running SolidJS in
          development mode. Rendering performance will be slightly degraded
          until this application is build for production.
        </p>
      ) : null}
    </div>
  )
}

const container = document.getElementById('root')

render(() => <App />, container!)
