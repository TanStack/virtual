import React from "react";
import axios from "axios";
import { useInfiniteQuery } from "react-query";

import { useVirtual } from "react-virtual";

//

export default () => {
  const {
    status,
    data,
    error,
    isFetching,
    isFetchingMore,
    fetchMore,
    canFetchMore
  } = useInfiniteQuery(
    "projects",
    async (key, nextPage = 0) => {
      await new Promise(r => setTimeout(r, 250));
      const { data } = await axios.get(
        "http://jsonplaceholder.typicode.com/posts?_limit=10&_page=" + nextPage
      );
      return data;
    },
    {
      getFetchMore: (lastGroup, groups) =>
        lastGroup.length ? groups.length : false
    }
  );

  const flatPosts = data ? data.flat(1) : [];

  const parentRef = React.useRef();

  const rowVirtualizer = useVirtual({
    size: canFetchMore ? flatPosts.length + 1 : flatPosts.length,
    parentRef,
    estimateSize: React.useCallback(() => 100, [])
  });

  React.useEffect(() => {
    const [lastItem] = [...rowVirtualizer.virtualItems].reverse();

    if (!lastItem) {
      return;
    }

    if (lastItem.index === flatPosts.length - 1 && canFetchMore) {
      fetchMore();
    }
  }, [canFetchMore, fetchMore, flatPosts.length, rowVirtualizer.virtualItems]);

  return (
    <>
      <p>
        This infite scroll example uses React Query's useInfiniteScroll hook to
        fetch infinite data from a posts endpoint and then a rowVirtualizer is
        used along with a loader-row placed at the bottom of the list to trigger
        the next page to load.
      </p>

      <br />
      <br />

      {status === "loading" ? (
        <p>Loading...</p>
      ) : status === "error" ? (
        <span>Error: {error.message}</span>
      ) : null}

      <div
        ref={parentRef}
        className="List"
        style={{
          height: `500px`,
          width: `100%`,
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
          {rowVirtualizer.virtualItems.map(virtualRow => {
            const isLoaderRow = virtualRow.index > flatPosts.length - 1;
            const post = flatPosts[virtualRow.index];

            return (
              <div
                key={virtualRow.index}
                className={
                  virtualRow.index % 2 ? "ListItemOdd" : "ListItemEven"
                }
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  height: `${virtualRow.size}px`,
                  transform: `translateY(${virtualRow.start}px)`
                }}
              >
                {isLoaderRow
                  ? canFetchMore
                    ? "Loading more..."
                    : "Nothing more to load"
                  : post.title}
              </div>
            );
          })}
        </div>
      </div>
      <div>
        {isFetching && !isFetchingMore ? "Background Updating..." : null}
      </div>
    </>
  );
};
