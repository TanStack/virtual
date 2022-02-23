import React from "react";
import ReactDOM from "react-dom";

import "./styles.css";

import { useVirtual } from "react-virtual";

function App() {
  return (
    <div>
      <p>
        These components are using <strong>fixed</strong> sizes. This means that
        every element's dimensions are hard-coded to the same value and never
        change.
      </p>
      <br />
      <br />

      <RowVirtualizerFixed />
      <br />
      <br />
      {process.env.NODE_ENV === "development" ? (
        <p>
          <strong>Notice:</strong> You are currently running React in
          development mode. Rendering performance will be slightly degraded
          until this application is build for production.
        </p>
      ) : null}
    </div>
  );
}

function RowVirtualizerFixed() {
  const parentRef = React.useRef();

  const rowVirtualizer = useVirtual({
    size: 10000,
    parentRef,
    estimateSize: React.useCallback(() => 35, []),
    overscan: 5,
    paddingStart: 70,
    paddingEnd: 35,
    scrollPaddingStart: 70,
    scrollPaddingEnd: 35
  });

  return (
    <>
      <div>
        <button onClick={() => rowVirtualizer.scrollToIndex(1000)}>
          Scroll To Row 1000 (auto)
        </button>
        <button onClick={() => rowVirtualizer.scrollToIndex(5000)}>
          Scroll To Row 5000 (auto)
        </button>
        <button
          onClick={() => rowVirtualizer.scrollToIndex(1000, { align: "start" })}
        >
          Scroll To Row 1000 (start)
        </button>
        <button
          onClick={() => rowVirtualizer.scrollToIndex(1000, { align: "end" })}
        >
          Scroll To Row 1000 (end)
        </button>
        <button
          onClick={() =>
            rowVirtualizer.scrollToIndex(1000, { align: "center" })
          }
        >
          Scroll To Row 1000 (center)
        </button>
      </div>

      <br />
      <br />

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
          <div className="FloatingHeader">Floating Header</div>
          {rowVirtualizer.virtualItems.map(virtualRow => (
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
        <div className="FloatingFooter">Floating Footer</div>
      </div>
    </>
  );
}

const rootElement = document.getElementById("root");
ReactDOM.render(<App />, rootElement);
