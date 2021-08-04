---
id: overview
title: Overview
---

[![](https://badgen.net/bundlephobia/minzip/react-virtual)](https://bundlephobia.com/result?p=react-virtual)

<br />

React Virtual is a single headless React hook that is exported as a utility to help you build virtualizers. It is not a component and does not render any markup or styles for you. At a bare minimum, it requires a size, a parent element ref to get the job done.

React Virtual virtualizers do not have an orientation, which makes it possible to use the same hook for both vertical and horizontal virtualizers.

Here is just a quick example of what it looks like to use React Virtual.

```js
function RowVirtualizerFixed() {
  const parentRef = React.useRef()

  const rowVirtualizer = useVirtual({
    size: 10000,
    parentRef,
    estimateSize: React.useCallback(() => 35, []),
  })

  return (
    <>
      <div
        ref={parentRef}
        className="List"
        style={{
          height: `150px`,
          width: `300px`,
          overflow: 'auto',
        }}
      >
        <div
          className="ListInner"
          style={{
            height: `${rowVirtualizer.totalSize}px`,
            width: '100%',
            position: 'relative',
          }}
        >
          {rowVirtualizer.virtualItems.map(virtualRow => (
            <div
              key={virtualRow.index}
              className={virtualRow.index % 2 ? 'ListItemOdd' : 'ListItemEven'}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: `${virtualRow.size}px`,
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              Row {virtualRow.index}
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
```

Keep moving to dive deeper and see more!
