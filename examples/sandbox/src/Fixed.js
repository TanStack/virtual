import React from "react";

import { useVirtual } from "react-virtual";

export default function() {
  return (
    <div>
      <h3>Rows</h3>
      <RowVirtualizerFixed />
      <br />
      <br />
      <h3>Columns</h3>
      <ColumnVirtualizerFixed />
      <br />
      <br />
      <h3>Grid</h3>
      <GridVirtualizerFixed />
    </div>
  );
}

function RowVirtualizerFixed() {
  const parentRef = React.useRef();

  const rowVirtualizer = useVirtual({
    size: 10000,
    parentRef,
    estimateSize: React.useCallback(() => 35, []),
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

function ColumnVirtualizerFixed() {
  const parentRef = React.useRef();

  const columnVirtualizer = useVirtual({
    horizontal: true,
    size: 10000,
    parentRef,
    estimateSize: React.useCallback(() => 100, []),
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

function GridVirtualizerFixed() {
  const parentRef = React.useRef();

  const rowVirtualizer = useVirtual({
    size: 10000,
    parentRef,
    estimateSize: React.useCallback(() => 35, []),
    overscan: 5
  });

  const columnVirtualizer = useVirtual({
    horizontal: true,
    size: 10000,
    parentRef,
    estimateSize: React.useCallback(() => 100, []),
    overscan: 5
  });

  return (
    <>
      <div
        ref={parentRef}
        className="List"
        style={{
          height: `500px`,
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
