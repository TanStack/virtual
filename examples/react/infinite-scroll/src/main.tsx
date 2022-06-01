import React from 'react'
import ReactDOM from 'react-dom'
import axios from 'axios'
import { QueryClient, QueryClientProvider, useInfiniteQuery } from 'react-query'

import './index.css'

import { useVirtual } from '@tanstack/react-virtual'

const queryClient = new QueryClient()

// axios override to fake "get" a website
// delete lines 9-36 if you are reusing this code outside of this demo
Object.assign(axios, {
  ...axios,
  get: (url) => {
    if (url.includes('demoapi.com')) {
      const [d, limitStr = '0', pageStr = '0'] = url.match(
        `_limit=([0-9]+)&_page=([0-9]+)`,
      )
      const limit = parseFloat(limitStr)

      return new Promise((resolve) =>
        setTimeout(() => {
          const data = new Array(limit)
            .fill(0)
            .map(
              (e, i) => `Async loaded row #${i + parseFloat(pageStr) * limit}`,
            )

          return resolve({ data })
        }),
      )
    }

    return axios.get
  },
})

function App() {
  const {
    status,
    data,
    error,
    isFetching,
    isFetchingNextPage,
    fetchNextPage,
    hasNextPage,
  } = useInfiniteQuery(
    'projects',
    async (key, nextPage = 0) => {
      const { data } = await axios.get(
        'https://demoapi.com?_limit=10&_page=' + nextPage,
      )
      return data
    },
    {
      getNextPageParam: (lastGroup, groups) =>
        lastGroup.length ? groups.length : false,
    },
  )

  const flatPosts = data ? data.pages.flat(1) : []

  const parentRef = React.useRef()

  const rowVirtualizer = useVirtual({
    count: hasNextPage ? flatPosts.length + 1 : flatPosts.length,
    getScrollElement: () => parentRef.current,
    estimateSize: React.useCallback(() => 100, []),
  })

  React.useEffect(() => {
    const [lastItem] = [...rowVirtualizer.getVirtualItems()].reverse()

    if (!lastItem) {
      return
    }

    if (
      lastItem.index >= flatPosts.length - 1 &&
      hasNextPage &&
      !isFetchingNextPage
    ) {
      fetchNextPage()
    }
  }, [
    hasNextPage,
    fetchNextPage,
    flatPosts.length,
    isFetchingNextPage,
    rowVirtualizer.getVirtualItems(),
  ])

  return (
    <div>
      <p>
        This infinite scroll example uses React Query's useInfiniteScroll hook
        to fetch infinite data from a posts endpoint and then a rowVirtualizer
        is used along with a loader-row placed at the bottom of the list to
        trigger the next page to load.
      </p>

      <br />
      <br />

      {status === 'loading' ? (
        <p>Loading...</p>
      ) : status === 'error' ? (
        <span>Error: {(error as Error).message}</span>
      ) : (
        <div
          ref={parentRef}
          className="List"
          style={{
            height: `500px`,
            width: `100%`,
            overflow: 'auto',
          }}
        >
          <div
            style={{
              height: `${rowVirtualizer.getTotalSize()}px`,
              width: '100%',
              position: 'relative',
            }}
          >
            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
              const isLoaderRow = virtualRow.index > flatPosts.length - 1
              const post = flatPosts[virtualRow.index]

              return (
                <div
                  key={virtualRow.index}
                  className={
                    virtualRow.index % 2 ? 'ListItemOdd' : 'ListItemEven'
                  }
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: `${virtualRow.size}px`,
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                >
                  {isLoaderRow
                    ? hasNextPage
                      ? 'Loading more...'
                      : 'Nothing more to load'
                    : post}
                </div>
              )
            })}
          </div>
        </div>
      )}
      <div>
        {isFetching && !isFetchingNextPage ? 'Background Updating...' : null}
      </div>
      <br />
      <br />
      {process.env.NODE_ENV === 'development' ? (
        <p>
          <strong>Notice:</strong> You are currently running React in
          development mode. Rendering performance will be slightly degraded
          until this application is build for production.
        </p>
      ) : null}
    </div>
  )
}

ReactDOM.render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>,
  document.getElementById('root'),
)
