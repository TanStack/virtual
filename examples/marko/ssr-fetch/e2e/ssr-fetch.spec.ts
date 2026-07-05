import { expect, test } from '@playwright/test'

// Browser gate for the ssr-fetch example (Mode B): fetchPeople() runs on the SERVER;
// the resolved rows serialize into the page and resume on the client with NO client
// re-fetch. There is still no seed (no initialRect), so the server container is empty
// and the client fills it on mount — it's the DATA that crosses in the payload.
//
// Raw-HTML rules: attributes render unquoted; text interpolations are split by
// markers. Whole-string interpolations (person emails built server-side) survive as
// contiguous chunks, so emails are the robust view-source probe for serialized data.

const consoleErrors: string[] = []
const consoleLogs: string[] = []

test.beforeEach(({ page }) => {
  consoleErrors.length = 0
  consoleLogs.length = 0
  page.on('console', (message) => {
    const text = message.text()
    if (message.type() === 'log') {
      consoleLogs.push(text)
      return
    }
    if (message.type() !== 'error') return
    if (text.includes('WebSocket') || text.includes('[vite]')) return
    if (message.location().url.endsWith('/favicon.ico')) return
    consoleErrors.push(text)
  })
  page.on('pageerror', (error) => {
    consoleErrors.push(String(error))
  })
})

test.afterEach(() => {
  expect(consoleErrors).toEqual([])
})

test('server HTML: empty container, but the fetched rows ARE in the serialized payload', async ({
  request,
}) => {
  const res = await request.get('/')
  expect(res.ok()).toBe(true)
  const html = await res.text()
  // No rows painted (Mode B has no seed)...
  expect(html).not.toContain('item-even')
  expect(html).toContain('height: 0px')
  // ...but the server-fetched data crossed: serialized people are in the page.
  expect(html).toContain('person1@example.com')
  expect(html).toContain('person1000@example.com')
})

test('rows render on the client from the serialized data — no client re-fetch — and the list is live', async ({
  page,
}) => {
  await page.goto('/')
  // Mount fills the container with the SERVER-fetched people.
  await expect(page.locator('.email', { hasText: 'person1@example.com' })).toBeVisible()
  expect(await page.locator('.item').count()).toBeGreaterThan(5)

  // No client re-fetch: fetchPeople logs "fetchPeople ran" when it executes; that
  // log belongs to the server console, never the browser's.
  expect(consoleLogs.filter((t) => t.includes('fetchPeople ran'))).toEqual([])

  // Liveness after resume: scroll deep, the window advances into data that only
  // exists via the serialized payload.
  await page.locator('.scroll-container').evaluate((el) => {
    el.scrollTop = 500 * 48
  })
  await expect(page.locator('.email', { hasText: 'person501@example.com' })).toBeVisible()
  await expect(page.locator('.email', { hasText: 'person1@example.com' })).toHaveCount(0)
})
