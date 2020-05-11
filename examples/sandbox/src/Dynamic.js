import React from "react";

import { useVirtual } from "react-virtual";

export default function() {
  const rows = new Array(10000)
    .fill(true)
    .map(() => 25 + Math.round(Math.random() * 100));

  const columns = new Array(10000)
    .fill(true)
    .map(() => 75 + Math.round(Math.random() * 100));

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
  );
}

function RowVirtualizerDynamic({ rows }) {
  const parentRef = React.useRef();

  const rowVirtualizer = useVirtual({
    size: rows.length,
    parentRef,
    estimateSize: React.useCallback(() => 35, []), // This is just a best guess
    overscan: 5
  });

  return (
    <>
      <div
        ref={parentRef}
        className="List"
        style={{
          height: `200px`,
          width: `400px`,
          overflow: "auto"
        }}
      >
        <div
          style={{
            height: `${rowVirtualizer.totalSize}px`,
            width: "100%",
            position: "relative"
          }}
        >
          {rowVirtualizer.virtualItems.map(virtualRow => (
            <div
              key={virtualRow.index}
              ref={virtualRow.measureRef}
              className={virtualRow.index % 2 ? "ListItemOdd" : "ListItemEven"}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: `${rows[virtualRow.index]}px`,
                transform: `translateY(${virtualRow.start}px)`
              }}
            >
              Row {virtualRow.index}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

function ColumnVirtualizerDynamic({ columns }) {
  const parentRef = React.useRef();

  const columnVirtualizer = useVirtual({
    horizontal: true,
    size: columns.length,
    parentRef,
    estimateSize: React.useCallback(() => 100, []), // This is just a best guess
    overscan: 5
  });

  return (
    <>
      <div
        ref={parentRef}
        className="List"
        style={{
          width: `400px`,
          height: `100px`,
          overflow: "auto"
        }}
      >
        <div
          style={{
            width: `${columnVirtualizer.totalSize}px`,
            height: "100%",
            position: "relative"
          }}
        >
          {columnVirtualizer.virtualItems.map(virtualColumn => (
            <div
              key={virtualColumn.index}
              ref={virtualColumn.measureRef}
              className={
                virtualColumn.index % 2 ? "ListItemOdd" : "ListItemEven"
              }
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                height: "100%",
                width: `${columns[virtualColumn.index]}px`,
                transform: `translateX(${virtualColumn.start}px)`
              }}
            >
              Column {virtualColumn.index}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

function GridVirtualizerDynamic({ rows, columns }) {
  const parentRef = React.useRef();

  const rowVirtualizer = useVirtual({
    size: rows.length,
    parentRef,
    overscan: 0
  });

  const columnVirtualizer = useVirtual({
    horizontal: true,
    size: columns.length,
    parentRef,
    overscan: 5
  });

  const [show, setShow] = React.useState(true);

  return (
    <>
      <button onClick={() => setShow(old => !old)}>Toggle</button>
      <button onClick={() => rowVirtualizer.scrollToIndex(5000)}>
        Scroll to 5000
      </button>
      {show ? (
        <div
          ref={parentRef}
          className="List"
          style={{
            height: `400px`,
            width: `500px`,
            overflow: "auto"
          }}
        >
          <div
            style={{
              height: `${rowVirtualizer.totalSize}px`,
              width: `${columnVirtualizer.totalSize}px`,
              position: "relative"
            }}
          >
            {rowVirtualizer.virtualItems.map(virtualRow => (
              <React.Fragment key={virtualRow.index}>
                {columnVirtualizer.virtualItems.map(virtualColumn => (
                  <div
                    key={virtualColumn.index}
                    ref={el => {
                      virtualRow.measureRef(el);
                      virtualColumn.measureRef(el);
                    }}
                    className={
                      virtualColumn.index % 2
                        ? virtualRow.index % 2 === 0
                          ? "ListItemOdd"
                          : "ListItemEven"
                        : virtualRow.index % 2
                        ? "ListItemOdd"
                        : "ListItemEven"
                    }
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: `${columns[virtualColumn.index]}px`,
                      height: `${rows[virtualRow.index]}px`,
                      transform: `translateX(${virtualColumn.start}px) translateY(${virtualRow.start}px)`
                    }}
                  >
                    Cell {virtualRow.index}, {virtualColumn.index}
                  </div>
                ))}
              </React.Fragment>
            ))}
          </div>
        </div>
      ) : null}
    </>
  );
}
