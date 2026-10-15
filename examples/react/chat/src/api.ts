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
  'Plan a weekend in Kraków',
  'Explain React Suspense',
  'Sourdough starter schedule',
  'Postgres index for a slow query',
  'Rewrite a cover letter',
  'Compare Vite and webpack',
  'Beginner running plan',
  'Virtualize a 10k row table',
  'Name ideas for a bakery',
  'CSS grid vs flexbox',
  'Summarize a research paper',
  'Fix a flaky Playwright test',
  'Budget for a home office',
  'Explain TypeScript generics',
  'Birthday party games for kids',
  'Migrate from Redux to Zustand',
  'Learn basic Spanish phrases',
  'Design a REST pagination API',
  'Houseplants for low light',
  'Write a git commit message',
  'Explain event loop microtasks',
  'Meal prep for the week',
  'Accessible modal dialog',
  'Pick a mechanical keyboard',
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

const openers = [
  'Good question.',
  'Sure, here is how I would approach it.',
  'Short answer: it depends on your constraints.',
  'Let me break it down.',
  'Here is a practical way to think about it.',
  'There are a few options.',
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

const bullets = [
  'Keep the scope small',
  'Measure before and after the change',
  'Prefer boring, well-known tools',
  'Write one test for the happy path and one for an edge case',
  'Document the decision in one sentence',
  'Remove what you do not use',
  'Ask for feedback early',
  'Automate the step you repeat most often',
]

const snippets = [
  '```ts\nfunction debounce<T extends unknown[]>(fn: (...args: T) => void, ms: number) {\n  let id: ReturnType<typeof setTimeout>\n  return (...args: T) => {\n    clearTimeout(id)\n    id = setTimeout(() => fn(...args), ms)\n  }\n}\n```',
  '```tsx\nconst virtualizer = useVirtualizer({\n  count: rows.length,\n  getScrollElement: () => parentRef.current,\n  estimateSize: () => 35,\n})\n```',
  '```sql\nCREATE INDEX CONCURRENTLY orders_customer_created_idx\n  ON orders (customer_id, created_at DESC);\n```',
  '```css\n.layout {\n  display: grid;\n  grid-template-columns: 260px 1fr;\n  height: 100vh;\n}\n```',
  '```bash\npnpm add @tanstack/react-query\npnpm dev\n```',
]

const closers = [
  'Let me know if you want me to go deeper on any of these.',
  'Want me to turn this into a checklist?',
  'I can also show a full example if that helps.',
  'Does that match what you had in mind?',
]

function generateReply(random: Random, prompt: string): string {
  const parts: string[] = []
  const quote = prompt.length > 48 ? `${prompt.slice(0, 48).trim()}…` : prompt
  parts.push(`${pick(random, openers)} You asked: “${quote}”`)

  const paragraphs = between(random, 0, 3)
  for (let i = 0; i < paragraphs; i++) {
    const count = between(random, 2, 4)
    parts.push(
      Array.from({ length: count }, () => pick(random, sentences)).join(' '),
    )
  }
  if (random() < 0.3) {
    const count = between(random, 3, 5)
    parts.push(
      Array.from({ length: count }, () => `- ${pick(random, bullets)}`).join(
        '\n',
      ),
    )
  }
  if (random() < 0.25) {
    parts.push(pick(random, snippets))
  }
  if (random() < 0.5) {
    parts.push(pick(random, closers))
  }
  return parts.join('\n\n')
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
// so far on every chunk, starting with an empty one. Returns a stop function
// that keeps the partial reply.
export function streamReply(
  chatId: string,
  prompt: string,
  onUpdate: (message: Message) => void,
  onDone: () => void,
): () => void {
  const messages = getMessages(chatId)
  const index = messages.length
  let message: Message = { id: `m-${nextId++}`, author: 'assistant', text: '' }
  messages.push(message)
  onUpdate(message)

  const words = generateReply(Math.random, prompt).match(/\s*\S+/g) ?? []
  let position = 0
  let intervalId: ReturnType<typeof setInterval> | undefined

  const timeoutId = setTimeout(() => {
    intervalId = setInterval(() => {
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
  }, 600)

  return () => {
    clearTimeout(timeoutId)
    clearInterval(intervalId)
  }
}
