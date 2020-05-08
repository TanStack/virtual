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
      <h3>Rows</h3>
      <RowVirtualizerVariable rows={rows} columns={columns} />
      <br />
      <br />
      <h3>Columns</h3>
      <ColumnVirtualizerVariable rows={rows} columns={columns} />
      <br />
      <br />
      <h3>Grid</h3>
      <GridVirtualizerVariable rows={rows} columns={columns} />
    </div>
  );
}

function RowVirtualizerVariable({ rows }) {
  const parentRef = React.useRef();

  const rowVirtualizer = useVirtual({
    size: rows.length,
    parentRef,
    estimateSize: React.useCallback(i => rows[i], [rows]),
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
          {rowVirtualizer.items.map(virtualRow => (
            <div
              key={virtualRow.index}
              className={virtualRow.index % 2 ? "ListItemOdd" : "ListItemEven"}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: `${virtualRow.size}px`,
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

function ColumnVirtualizerVariable({ columns }) {
  const parentRef = React.useRef();

  const columnVirtualizer = useVirtual({
    horizontal: true,
    size: columns.length,
    parentRef,
    estimateSize: React.useCallback(i => columns[i], [columns]),
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
          {columnVirtualizer.items.map(virtualColumn => (
            <div
              key={virtualColumn.index}
              className={
                virtualColumn.index % 2 ? "ListItemOdd" : "ListItemEven"
              }
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                height: "100%",
                width: `${virtualColumn.size}px`,
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

function GridVirtualizerVariable({ rows, columns }) {
  const parentRef = React.useRef();

  const rowVirtualizer = useVirtual({
    size: rows.length,
    parentRef,
    estimateSize: React.useCallback(i => rows[i], [rows]),
    overscan: 5
  });

  const columnVirtualizer = useVirtual({
    horizontal: true,
    size: columns.length,
    parentRef,
    estimateSize: React.useCallback(i => columns[i], [columns]),
    overscan: 5
  });

  return (
    <>
      <div
        ref={parentRef}
        className="Grid"
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
          {rowVirtualizer.items.map(virtualRow => (
            <React.Fragment key={virtualRow.index}>
              {columnVirtualizer.items.map(virtualColumn => (
                <div
                  key={virtualColumn.index}
                  className={
                    virtualColumn.index % 2
                      ? virtualRow.index % 2 === 0
                        ? "GridItemOdd"
                        : "GridItemEven"
                      : virtualRow.index % 2
                      ? "GridItemOdd"
                      : "GridItemEven"
                  }
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: `${virtualColumn.size}px`,
                    height: `${virtualRow.size}px`,
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
    </>
  );
}
