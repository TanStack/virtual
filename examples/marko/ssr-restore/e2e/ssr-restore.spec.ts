import { expect, test } from '@playwright/test'

// Browser gate for the ssr-restore example: initialRect + initialOffset=4800 make the
// server paint the slice AROUND ITEM 100 (48px rows), and an onMount restores
// scrollTop to the same offset so the painted rows line up instead of snapping to top.
//
// Raw-HTML rules: emails are contiguous; 'person1@' cannot false-match 'person101@'
// (the @ terminates). Offset 4800 -> first visible index 100 -> overscan 5 -> first
// painted id 96.

const JUMP_OFFSET = 100 * 48

const consoleErrors: string[] = []

test.beforeEach(({ page }) => {
  consoleErrors.length = 0
  page.on('console', (message) => {
    if (message.type() !== 'error') return
    const text = message.text()
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

test('server HTML paints the slice AT THE OFFSET: rows ~#101 present, top rows absent from the markup', async ({
  request,
}) => {
  const res = await request.get('/')
  expect(res.ok()).toBe(true)
  const html = await res.text()
  // Rows around the jump target are painted...
  expect(html).toContain('person101@example.com')
  expect(html).toContain('person105@example.com')
  // ...and the top of the list is NOT in the painted rows (unpainted people live
  // only in the serialized payload, so absence is asserted on row markup, with a
  // positive control proving the pattern matches painted rows).
  expect(html).toMatch(/class="?email"?[^<]*>[^<]*person101@example\.com/)
  expect(html).not.toMatch(/class="?email"?[^<]*>[^<]*person1@example\.com/)
  expect(html).toContain('item-even') // rows really are in the HTML
  expect(html).toContain('height: 48000px') // real total size
})

test('on mount the scroll position is restored to the offset and the painted rows line up', async ({
  page,
}) => {
  await page.goto('/')
  // The jump-target row is VISIBLE (not just present): scroll restore worked.
  await expect(
    page.locator('.email', { hasText: 'person101@example.com' }),
  ).toBeVisible()
  const scrollTop = await page
    .locator('.scroll-container')
    .evaluate((el) => el.scrollTop)
  expect(scrollTop).toBe(JUMP_OFFSET)
})

test('the restored list is live: scrolling up re-windows to earlier rows', async ({
  page,
}) => {
  await page.goto('/')
  await expect(
    page.locator('.email', { hasText: 'person101@example.com' }),
  ).toBeVisible()
  await page.locator('.scroll-container').evaluate((el) => {
    el.scrollTop = 0
  })
  await expect(
    page.locator('.email', { hasText: 'person1@example.com' }),
  ).toBeVisible()
  await expect(
    page.locator('.email', { hasText: 'person101@example.com' }),
  ).toHaveCount(0)
})

test('with JavaScript disabled the offset rows exist in the DOM (positioned deep, unrestored)', async ({
  browser,
}) => {
  const context = await browser.newContext({ javaScriptEnabled: false })
  const page = await context.newPage()
  await page.goto('/')
  // Two reasons the rows are present but not visible without JS: the out-of-order
  // <await> stream sits in a hidden wrapper until an inline script swaps it in
  // (see the ssr-slice spec — the page renders visibly blank without JS), and no
  // onMount ran so scrollTop stays 0 with the rows ~4800px down. Assert presence.
  expect(
    await page.locator('.email', { hasText: 'person101@example.com' }).count(),
  ).toBe(1)
  expect(await page.locator('.item').count()).toBeGreaterThan(5)
  await context.close()
})
