// An in-memory stand-in for a chat backend. Seeded chats are generated on
// first read from a fixed seed, so the history is the same after a reload.

export type Author = 'user' | 'assistant'

export type Message = {
  id: string
  author: Author
  text: string
}

export type Chat = {
  id: string
  title: string
  updatedAt: number
}

export type MessagePage = {
  messages: Message[]
  // Index of the first message of this page in the full chat history.
  start: number
}

const PAGE_SIZE = 30
const READ_LATENCY = 300
const WRITE_LATENCY = 50

type Random = () => number

function seededRandom(seed: number): Random {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const pick = <T>(random: Random, items: ReadonlyArray<T>): T =>
  items[Math.floor(random() * items.length)]!

const between = (random: Random, min: number, max: number) =>
  min + Math.floor(random() * (max - min + 1))

const delay = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms))

const titles = [
  'Debounce a search input',
  'Virtualize a 10k row table',
  'Explain React Suspense',
  'Plan a weekend in Rzeszów',
  'Beginner running plan',
]

const followUps = [
  'Can you explain that in more detail?',
  'Show me an example.',
  'What are the trade-offs?',
  'How would I test this?',
  'Can you make it shorter?',
  'Why does that work?',
  'What if the list has 10,000 items?',
  'Is there a simpler way?',
  'What would you do differently in production?',
  'Ok, and what is the next step?',
  'Can you put that in a table or a list?',
  'Thanks! One more question about the last point.',
]

const sentences = [
  'Start with the smallest version that works and measure it before you optimize.',
  'The main cost is usually not the code itself but the coordination around it.',
  'If the input changes often, keep the derived values out of state and compute them on render.',
  'A good default is to keep the data close to where it is used.',
  'You can always add a cache later, but removing one is much harder.',
  'Most of the time the simple solution is fast enough.',
  'Try to make the common case fast and the rare case correct.',
  'Write down the assumptions first, because they tend to change.',
  'This also makes the behavior easier to test in isolation.',
  'Watch out for edge cases at the boundaries, such as empty lists and very long values.',
  'Keep each step small enough that you can undo it without losing much.',
  'In practice, people tend to overestimate how much flexibility they need.',
  'The trade-off is a bit more setup in exchange for fewer surprises later.',
  'When in doubt, pick the option that is easier to change.',
  'It helps to look at a real example before you generalize.',
  'Consistency matters more than the exact choice.',
]

// One to three paragraphs of random sentences, so rows have different heights.
function generateReply(random: Random, prompt: string): string {
  const paragraphs = Array.from({ length: between(random, 1, 3) }, () =>
    Array.from({ length: between(random, 1, 4) }, () =>
      pick(random, sentences),
    ).join(' '),
  )
  return [`You asked: “${prompt}”`, ...paragraphs].join('\n\n')
}

// Fixed replies for prompts that deserve a real answer.
const cannedReplies: Record<string, string> = {
  'How do I virtualize a chat list?': [
    'You asked: “How do I virtualize a chat list?”',
    'A chat is a virtual list anchored to the end: new messages arrive at the bottom, older history loads at the top, and replies grow while they stream. This example uses anchorTo: "end" with stable keys from getItemKey, followOnAppend with scrollEndThreshold, and scrollToEnd() with isAtEnd() for the jump button.',
    "Tanner Linsley explains it in “Chat UIs Are Lists Until They Aren't”: https://tanstack.com/blog/tanstack-virtual-chat",
  ].join('\n\n'),
}

const now = Date.now()
const chats: Chat[] = titles.map((title, index) => ({
  id: `chat-${index}`,
  title,
  updatedAt: now - index * 5 * 60 * 60 * 1000,
}))
const messagesByChat = new Map<string, Message[]>()
let nextId = 0

function seedMessages(chatId: string): Message[] {
  const chatIndex = chats.findIndex((chat) => chat.id === chatId)
  const random = seededRandom(chatIndex + 1)
  const title = chats[chatIndex]!.title
  const turns = between(random, 20, 150)
  const messages: Message[] = []
  for (let turn = 0; turn < turns; turn++) {
    const prompt =
      turn === 0 ? `${title}. Where should I start?` : pick(random, followUps)
    messages.push({ id: `${chatId}-${turn}-q`, author: 'user', text: prompt })
    messages.push({
      id: `${chatId}-${turn}-a`,
      author: 'assistant',
      text: generateReply(random, prompt),
    })
  }
  return messages
}

function getMessages(chatId: string): Message[] {
  let messages = messagesByChat.get(chatId)
  if (!messages) {
    messages = seedMessages(chatId)
    messagesByChat.set(chatId, messages)
  }
  return messages
}

function touchChat(chatId: string) {
  const chat = chats.find((item) => item.id === chatId)!
  chat.updatedAt = Date.now()
}

export async function fetchChats(): Promise<Chat[]> {
  await delay(READ_LATENCY)
  return [...chats].sort((a, b) => b.updatedAt - a.updatedAt)
}

// Returns the page of messages that ends right before `before`, or the
// latest page when `before` is null.
export async function fetchMessages(
  chatId: string,
  before: number | null,
): Promise<MessagePage> {
  await delay(READ_LATENCY)
  const messages = getMessages(chatId)
  const end = before ?? messages.length
  const start = Math.max(0, end - PAGE_SIZE)
  return { messages: messages.slice(start, end), start }
}

export async function createChat(firstMessage: string): Promise<Chat> {
  await delay(WRITE_LATENCY)
  const title =
    firstMessage.length > 40
      ? `${firstMessage.slice(0, 40).trim()}…`
      : firstMessage
  const chat: Chat = { id: `chat-new-${nextId++}`, title, updatedAt: 0 }
  chats.push(chat)
  messagesByChat.set(chat.id, [])
  return chat
}

export async function postMessage(
  chatId: string,
  text: string,
): Promise<Message> {
  await delay(WRITE_LATENCY)
  const message: Message = { id: `m-${nextId++}`, author: 'user', text }
  getMessages(chatId).push(message)
  touchChat(chatId)
  return message
}

// Streams a generated reply word by word. `onUpdate` gets the whole message
// so far on every chunk. Returns a stop function that keeps the partial reply.
export function streamReply(
  chatId: string,
  prompt: string,
  onUpdate: (message: Message) => void,
  onDone: () => void,
): () => void {
  const messages = getMessages(chatId)
  const index = messages.length
  const reply = cannedReplies[prompt] ?? generateReply(Math.random, prompt)
  const words = reply.match(/\s*\S+/g) ?? []
  let message: Message = { id: `m-${nextId++}`, author: 'assistant', text: '' }
  let position = 0

  const intervalId = setInterval(() => {
    const count = 1 + Math.floor(Math.random() * 3)
    message = {
      ...message,
      text: message.text + words.slice(position, position + count).join(''),
    }
    position += count
    messages[index] = message
    onUpdate(message)
    if (position >= words.length) {
      clearInterval(intervalId)
      touchChat(chatId)
      onDone()
    }
  }, 40)

  return () => clearInterval(intervalId)
}
