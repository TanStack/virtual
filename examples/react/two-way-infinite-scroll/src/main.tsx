import React, { useCallback, useState } from 'react'
import ReactDOM from 'react-dom'
import { InfiniteData, QueryClient, QueryClientProvider, UseInfiniteQueryResult, useInfiniteQuery } from '@tanstack/react-query'
import './index.css'
import { useWindowVirtualizer } from '@tanstack/react-virtual'

const queryClient = new QueryClient()

interface Page {
  rows:string[],
  nextOffset: number
}
async function fetchServerPage(
  limit: number,
  offset: number = 0,
): Promise<Page> {
  const rows = new Array(limit)
    .fill(0)
    .map((e, i) => `Async loaded row #${i + offset * limit}`)

  await new Promise((r) => setTimeout(r, 500))

  return { rows, nextOffset: offset + 1 }
}

function App() {
  const SCROLL_MARGIN = 200;
  const MAX_PAGE_LENGTH = 5;
  const ITEM_HEIGHT = 100;
  const [dataPerPagePrefixSum, setDataPerPagePrefixSum] = useState<number[]>([0]);
  const {
    status,
    data,
    error,
    isFetchingNextPage,
    fetchNextPage,
    hasNextPage,
    isFetchingPreviousPage,
    fetchPreviousPage,
    hasPreviousPage,
  } : UseInfiniteQueryResult<InfiniteData<Page,  number>, Error>= useInfiniteQuery(
    {
      queryKey:['projects'],
      queryFn:async ({pageParam}) => {
        const res = await fetchServerPage(10, pageParam)
        if(dataPerPagePrefixSum.length <= pageParam + 1){
          setDataPerPagePrefixSum((prev) => [...prev,(prev.slice(-1)[0] ?? 0) + res.rows.length])
        }
        return res
      },
      initialPageParam:0,
      getNextPageParam: (_, __, lastPageParam) => {
        return lastPageParam + 1;
      },
      getPreviousPageParam: (_, __, firstPageParam) => {
        if (firstPageParam <= 0) {
          return null;
        }
        return firstPageParam - 1;
      },
      maxPages: MAX_PAGE_LENGTH,
    },
  )

  const allRows = data ? data.pages.flatMap((d) => d.rows) : [];
  const minPageParam = data?.pageParams[0] ?? 0;
  // 메모리 최적화를 위해 없어진 데이터의 갯수
  const minPageDataLength = (dataPerPagePrefixSum[minPageParam] ?? 0);
  const maxDataLength = dataPerPagePrefixSum.slice(-1)[0] ?? 0;
  const rowVirtualizer = useWindowVirtualizer({
    count: maxDataLength,
    estimateSize: () => ITEM_HEIGHT,
    overscan: 5,
    scrollMargin: SCROLL_MARGIN
  })
  const virtualItems = rowVirtualizer.getVirtualItems()

  const handleScroll = useCallback((): void => {
    // 전체 문서의 높이
    const scrollHeight = document.documentElement.scrollHeight;
    // 현재 스크롤 위치
    const scrollTop = document.documentElement.scrollTop;
    // 뷰포트 높이
    const clientHeight = document.documentElement.clientHeight;
    // 남은 스크롤 높이 계산
    const scrollRemaining = scrollHeight - scrollTop - clientHeight;
    // 남은 스크롤이 아이템 2개 미만이면 다음 데이터 fetch
    if (scrollRemaining < ITEM_HEIGHT * 2 && hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
    // 남은 스크롤이 아이템 2개 미만이면 이전 데이터 fetch
    if (scrollTop-SCROLL_MARGIN < (minPageDataLength - 2) * ITEM_HEIGHT && hasPreviousPage && !isFetchingPreviousPage) {
      fetchPreviousPage();
    }
    
  }, [hasPreviousPage,isFetchingPreviousPage,hasNextPage,isFetchingNextPage,minPageDataLength])
  React.useEffect(() => {
    document.addEventListener('scroll',handleScroll);
    return ()=>{
      document.removeEventListener('scroll',handleScroll)
    }
  }, [handleScroll])
  return (
    <div>
      <p style={{
        height:SCROLL_MARGIN,
      }}>
        This infinite scroll example uses React Query's useInfiniteScroll hook
        to fetch infinite data from a posts endpoint and then a rowVirtualizer
        is used along with a loader-row placed at the bottom of the list to
        trigger the next page to load.
      </p>

      {status === 'pending' ? (
        <p>Loading...</p>
      ) : status === 'error' ? (
        <span>Error: {(error as Error).message}</span>
      ) : (

          <div
            style={{
              height: `${rowVirtualizer.getTotalSize()}px`,
              width: '100%',
              display:'flex',
              flexDirection:'column',
              gap:'16px'
            }}
          >
            {virtualItems.map((virtualRow) => {
              const post = allRows[virtualRow.index - minPageDataLength]

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
                  {post == null ? 'loading' : post}
                </div>
              )
            })}
          </div>
      )}
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
