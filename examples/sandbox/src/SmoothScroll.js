import React from "react";

import { useVirtual } from "react-virtual";

function easeInOutQuint(t) {
  return t < 0.5 ? 16 * t * t * t * t * t : 1 + 16 * --t * t * t * t * t;
}

export default function() {
  const parentRef = React.useRef();

  const scrollToFn = React.useCallback(offset => {
    const duration = 1000;
    const start = parentRef.current.scrollTop;
    const startTime = Date.now();

    const run = () => {
      const now = Date.now();
      const elapsed = now - startTime;
      const progress = easeInOutQuint(Math.min(elapsed / duration, 1));
      const interpolated = start + (offset - start) * progress;

      if (elapsed < duration) {
        parentRef.current.scrollTop = interpolated;
        setTimeout(run, 16);
      } else {
        parentRef.current.scrollTop = interpolated;
      }
    };

    setTimeout(run, 16);
  }, []);

  const rowVirtualizer = useVirtual({
    size: 10000,
    parentRef,
    estimateSize: React.useCallback(() => 35, []),
    overscan: 5,
    scrollToFn
  });

  return (
    <>
      <button
        onClick={() =>
          rowVirtualizer.scrollToIndex(Math.floor(Math.random() * 10000))
        }
      >
        Scroll To Random Index
      </button>

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
    </>
  );
}
