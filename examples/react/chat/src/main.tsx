import * as React from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { useVirtualizer } from '@tanstack/react-virtual'
import { queryClient, useChats, useMessages, useSendMessage } from './queries'
import type { Message } from './api'
import './index.css'

// Feather-style 24×24 stroke paths.
const icons = {
  menu: 'M3 6h18M3 12h18M3 18h18',
  close: 'M15 18l-6-6 6-6',
  newChat: 'M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z',
  up: 'M12 19V5M5 12l7-7 7 7',
  down: 'M12 5v14M19 12l-7 7-7-7',
  stop: 'M7 7h10v10H7Z',
}

function Icon({ path }: { path: string }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={path} />
    </svg>
  )
}

const isNarrow = () => window.matchMedia('(max-width: 768px)').matches

function App() {
  const [activeChatId, setActiveChatId] = React.useState<string | null>(null)
  const [sidebarOpen, setSidebarOpen] = React.useState(() => !isNarrow())
  const chats = useChats()
  const { send, sending, streaming, stop } = useSendMessage()
  const activeChat = chats.data?.find((chat) => chat.id === activeChatId)

  const openChat = (chatId: string | null) => {
    setActiveChatId(chatId)
    if (isNarrow()) setSidebarOpen(false)
  }

  const onSend = (text: string) => {
    send(
      { chatId: activeChatId, text },
      { onSuccess: ({ chatId }) => setActiveChatId(chatId) },
    )
  }

  const composer = (
    <Composer
      disabled={sending}
      streaming={streaming}
      onSend={onSend}
      onStop={stop}
    />
  )

  return (
    <div className="App" data-sidebar-open={sidebarOpen}>
      <aside className="Sidebar">
        <div className="SidebarHeader">
          <span className="Brand">TanStack Chat</span>
          <button
            type="button"
            className="IconButton"
            aria-label="Close sidebar"
            onClick={() => setSidebarOpen(false)}
          >
            <Icon path={icons.close} />
          </button>
        </div>
        <button
          type="button"
          className="NewChat"
          aria-current={activeChatId === null ? 'page' : undefined}
          onClick={() => openChat(null)}
        >
          <Icon path={icons.newChat} />
          New chat
        </button>
        <div className="SidebarLabel">Chats</div>
        <nav className="ChatList" aria-label="Chat history">
          {chats.isPending ? (
            <div className="SidebarHint">Loading chats…</div>
          ) : (
            chats.data?.map((chat) => (
              <button
                key={chat.id}
                type="button"
                className="ChatLink"
                aria-current={chat.id === activeChatId ? 'page' : undefined}
                onClick={() => openChat(chat.id)}
              >
                {chat.title}
              </button>
            ))
          )}
        </nav>
      </aside>
      <div
        className="Backdrop"
        aria-hidden="true"
        onClick={() => setSidebarOpen(false)}
      />

      <main className="Main">
        <header className="MainHeader">
          {!sidebarOpen && (
            <button
              type="button"
              className="IconButton"
              aria-label="Open sidebar"
              onClick={() => setSidebarOpen(true)}
            >
              <Icon path={icons.menu} />
            </button>
          )}
          <span className="MainTitle">
            {activeChatId ? (activeChat?.title ?? '') : 'New chat'}
          </span>
        </header>

        {activeChatId ? (
          <>
            <ChatPane key={activeChatId} chatId={activeChatId} />
            <div className="ComposerDock">{composer}</div>
          </>
        ) : (
          <div className="Empty">
            <h1>What can I help with?</h1>
            {composer}
          </div>
        )}
      </main>
    </div>
  )
}

function ChatPane({ chatId }: { chatId: string }) {
  const query = useMessages(chatId)

  if (query.isPending) {
    return <div className="PaneHint">Loading messages…</div>
  }
  if (query.isError) {
    return <div className="PaneHint">Could not load messages.</div>
  }

  return (
    <MessageList
      messages={query.data.pages.flatMap((page) => page.messages)}
      loadingOlder={query.isFetchingPreviousPage}
      onLoadOlder={() => {
        if (query.hasPreviousPage) {
          query.fetchPreviousPage({ cancelRefetch: false })
        }
      }}
    />
  )
}

function MessageList({
  messages,
  loadingOlder,
  onLoadOlder,
}: {
  messages: Message[]
  loadingOlder: boolean
  onLoadOlder: () => void
}) {
  const parentRef = React.useRef<HTMLDivElement>(null)
  const lastScrollTopRef = React.useRef(0)
  const [didInitialScroll, setDidInitialScroll] = React.useState(false)
  const [autoHistoryEnabled, setAutoHistoryEnabled] = React.useState(false)
  const [atEnd, setAtEnd] = React.useState(true)

  const virtualizer = useVirtualizer({
    count: messages.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 120,
    getItemKey: React.useCallback(
      (index: number) => messages[index]!.id,
      [messages],
    ),
    anchorTo: 'end',
    followOnAppend: true,
    scrollEndThreshold: 80,
    overscan: 6,
    directDomUpdates: true,
  })

  React.useLayoutEffect(() => {
    if (didInitialScroll) return
    virtualizer.scrollToEnd()
    setDidInitialScroll(true)
  }, [didInitialScroll, virtualizer])

  // Sending a message jumps to it, like in most chat apps. Assistant output
  // follows only when the reader is already at the latest message.
  const lastMessage = messages[messages.length - 1]
  const lastUserMessageId =
    lastMessage?.author === 'user' ? lastMessage.id : null
  React.useEffect(() => {
    if (lastUserMessageId) virtualizer.scrollToEnd()
  }, [lastUserMessageId, virtualizer])

  React.useEffect(() => {
    const id = window.setTimeout(() => {
      setAutoHistoryEnabled(true)
    }, 250)

    return () => window.clearTimeout(id)
  }, [])

  return (
    <div className="Pane">
      <div
        ref={parentRef}
        className="Messages"
        onScroll={(event) => {
          const isAtEnd = virtualizer.isAtEnd(80)
          setAtEnd(isAtEnd)
          if (!autoHistoryEnabled || isAtEnd) return
          const { scrollTop } = event.currentTarget
          const movingUp = scrollTop < lastScrollTopRef.current
          lastScrollTopRef.current = scrollTop
          // Load only while the reader scrolls up into the top. Safari's
          // rubber band reports negative positions past the top and then
          // settles back down to 0; neither is the reader asking for more
          // history, and loading on the settle would load twice per bounce.
          if (movingUp && scrollTop >= 0 && scrollTop < 400) {
            onLoadOlder()
          }
        }}
      >
        <div
          ref={virtualizer.containerRef}
          style={{
            position: 'relative',
            width: '100%',
          }}
        >
          {virtualizer.getVirtualItems().map((virtualItem) => {
            const message = messages[virtualItem.index]!

            return (
              <div
                key={virtualItem.key}
                ref={virtualizer.measureElement}
                data-index={virtualItem.index}
                className="MessageRow"
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                }}
              >
                <MessageView message={message} />
              </div>
            )
          })}
        </div>
      </div>

      {loadingOlder && <div className="HistoryLoader">Loading older…</div>}
      {!atEnd && (
        <button
          type="button"
          className="JumpToLatest"
          aria-label="Jump to latest message"
          onClick={() => virtualizer.scrollToEnd({ behavior: 'smooth' })}
        >
          <Icon path={icons.down} />
        </button>
      )}
    </div>
  )
}

function MessageView({ message }: { message: Message }) {
  if (message.author === 'user') {
    return (
      <div className="Message Message-user">
        <div className="UserBubble">{message.text}</div>
      </div>
    )
  }

  return (
    <div className="Message Message-assistant">
      {message.text ? (
        message.text.split(/(```[\s\S]*?(?:```|$))/).map((part, index) =>
          part.startsWith('```') ? (
            <pre key={index} className="Code">
              {part.replace(/^```\w*\n?/, '').replace(/```$/, '')}
            </pre>
          ) : (
            part.trim() && (
              <p key={index} className="Prose">
                {part.trim()}
              </p>
            )
          ),
        )
      ) : (
        <span className="Typing" aria-label="Assistant is typing">
          <span />
          <span />
          <span />
        </span>
      )}
    </div>
  )
}

function Composer({
  disabled,
  streaming,
  onSend,
  onStop,
}: {
  disabled: boolean
  streaming: boolean
  onSend: (text: string) => void
  onStop: () => void
}) {
  const [text, setText] = React.useState('')
  const textareaRef = React.useRef<HTMLTextAreaElement>(null)

  React.useLayoutEffect(() => {
    const textarea = textareaRef.current!
    textarea.style.height = 'auto'
    if (text) {
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`
    }
  }, [text])

  const submit = () => {
    const value = text.trim()
    if (!value || disabled || streaming) return
    onSend(value)
    setText('')
  }

  return (
    <form
      className="Composer"
      onSubmit={(event) => {
        event.preventDefault()
        submit()
      }}
    >
      <textarea
        ref={textareaRef}
        rows={1}
        value={text}
        placeholder="Ask anything"
        aria-label="Message"
        autoFocus
        onChange={(event) => setText(event.target.value)}
        onKeyDown={(event) => {
          if (
            event.key === 'Enter' &&
            !event.shiftKey &&
            !event.nativeEvent.isComposing
          ) {
            event.preventDefault()
            submit()
          }
        }}
      />
      {streaming ? (
        <button
          type="button"
          className="SendButton"
          aria-label="Stop"
          onClick={onStop}
        >
          <Icon path={icons.stop} />
        </button>
      ) : (
        <button
          type="submit"
          className="SendButton"
          aria-label="Send"
          disabled={disabled || !text.trim()}
        >
          <Icon path={icons.up} />
        </button>
      )}
    </form>
  )
}

createRoot(document.getElementById('root')!).render(
  <QueryClientProvider client={queryClient}>
    <App />
  </QueryClientProvider>,
)
