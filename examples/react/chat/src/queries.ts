import * as React from 'react'
import {
  QueryClient,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import type { InfiniteData } from '@tanstack/react-query'
import {
  createChat,
  fetchChats,
  fetchMessages,
  postMessage,
  streamReply,
} from './api'
import type { Message, MessagePage } from './api'

// The cache is the source of truth while the page is open: new messages are
// written into it directly, so a background refetch would only fight them.
export const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: Infinity } },
})

const chatsKey = ['chats'] as const
const messagesKey = (chatId: string) => ['messages', chatId] as const

type MessagesData = InfiniteData<MessagePage, number | null>

export function useChats() {
  return useQuery({ queryKey: chatsKey, queryFn: fetchChats })
}

// Pages are kept oldest first: older history is loaded with
// `fetchPreviousPage`, which prepends a page.
export function useMessages(chatId: string) {
  return useInfiniteQuery({
    queryKey: messagesKey(chatId),
    queryFn: ({ pageParam }) => fetchMessages(chatId, pageParam),
    initialPageParam: null as number | null,
    getPreviousPageParam: (firstPage) =>
      firstPage.start > 0 ? firstPage.start : undefined,
    getNextPageParam: () => undefined,
  })
}

function upsertMessage(client: QueryClient, chatId: string, message: Message) {
  client.setQueryData<MessagesData>(messagesKey(chatId), (data) => {
    if (!data) {
      return { pages: [{ messages: [message], start: 0 }], pageParams: [null] }
    }
    const pages = [...data.pages]
    const last = pages[pages.length - 1]!
    const exists = last.messages.some((item) => item.id === message.id)
    pages[pages.length - 1] = {
      ...last,
      messages: exists
        ? last.messages.map((item) => (item.id === message.id ? message : item))
        : [...last.messages, message],
    }
    return { ...data, pages }
  })
}

// Sends a user message (creating the chat when `chatId` is null) and then
// streams the assistant reply into the messages cache.
export function useSendMessage() {
  const client = useQueryClient()
  const stopRef = React.useRef<(() => void) | null>(null)
  const [streaming, setStreaming] = React.useState(false)

  const mutation = useMutation({
    mutationFn: async ({
      chatId,
      text,
    }: {
      chatId: string | null
      text: string
    }) => {
      const id = chatId ?? (await createChat(text)).id
      const message = await postMessage(id, text)
      return { chatId: id, message }
    },
    onSuccess: ({ chatId, message }) => {
      upsertMessage(client, chatId, message)
      client.invalidateQueries({ queryKey: chatsKey })
      setStreaming(true)
      stopRef.current = streamReply(
        chatId,
        message.text,
        (reply) => upsertMessage(client, chatId, reply),
        () => {
          stopRef.current = null
          setStreaming(false)
          client.invalidateQueries({ queryKey: chatsKey })
        },
      )
    },
  })

  const stop = () => {
    stopRef.current?.()
    stopRef.current = null
    setStreaming(false)
  }

  return {
    send: mutation.mutate,
    sending: mutation.isPending,
    streaming,
    stop,
  }
}
