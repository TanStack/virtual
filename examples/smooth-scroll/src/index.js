import React from "react";
import ReactDOM from "react-dom";

import "./styles.css";

import { useVirtual } from "react-virtual";

function easeInOutQuint(t) {
  return t < 0.5 ? 16 * t * t * t * t * t : 1 + 16 * --t * t * t * t * t;
}

function App() {
  const parentRef = React.useRef();
  const scrollingRef = React.useRef();

  const scrollToFn = React.useCallback((offset, defaultScrollTo) => {
    const duration = 1000;
    const start = parentRef.current.scrollTop;
    const startTime = (scrollingRef.current = Date.now());

    const run = () => {
      if (scrollingRef.current !== startTime) return;
      const now = Date.now();
      const elapsed = now - startTime;
      const progress = easeInOutQuint(Math.min(elapsed / duration, 1));
      const interpolated = start + (offset - start) * progress;

      if (elapsed < duration) {
        defaultScrollTo(interpolated);
        requestAnimationFrame(run);
      } else {
        defaultScrollTo(interpolated);
      }
    };

    requestAnimationFrame(run);
  }, []);

  const rowVirtualizer = useVirtual({
    size: 10000,
    parentRef,
    estimateSize: React.useCallback(() => 35, []),
    overscan: 5,
    scrollToFn
  });

  return (
    <div>
      <p>
        This smooth scroll example uses the <code>`scrollToFn`</code> to
        implement a custom scrolling function for the methods like{" "}
        <code>`scrollToIndex`</code> and <code>`scrollToOffset`</code>
      </p>

      <br />
      <br />

      <div>
        <button
          onClick={() =>
            rowVirtualizer.scrollToIndex(Math.floor(Math.random() * 10000))
          }
        >
          Scroll To Random Index
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
      </div>
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

const rootElement = document.getElementById("root");
ReactDOM.render(<App />, rootElement);
