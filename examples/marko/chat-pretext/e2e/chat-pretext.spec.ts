import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

// Browser gate for the Chat + Pretext example. Carries the Chat example's seven
// scroll-behavior gates (calculated heights must not regress any of them) plus the two
// assertions that are this example's reason to exist: prepends land with NO
// measurement-correction kick, and the streamed reply's growth is delivered through
// v.resizeItem with calculated heights that match the rendered DOM.

const AT_END_PX = 80

const consoleErrors: string[] = []

test.beforeEach(({ page }) => {
  consoleErrors.length = 0
  page.on('console', (message) => {
    if (message.type() !== 'error') return
    const text = message.text()
    // Vite dev-server websocket noise only; everything else counts.
    if (text.includes('WebSocket') || text.includes('[vite]')) return
    // Chromium requests /favicon.ico unconditionally; the example ships none.
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

async function distanceFromEnd(page: Page): Promise<number> {
  return page
    .locator('.messages')
    .evaluate((el) => el.scrollHeight - el.scrollTop - el.clientHeight)
}

async function waitForPin(page: Page) {
  await expect
    .poll(() => distanceFromEnd(page), { timeout: 5000 })
    .toBeLessThanOrEqual(AT_END_PX)
}

test('loads pinned to the newest message with status At latest', async ({
  page,
}) => {
  await page.goto('/')
  await waitForPin(page)
  await expect(page.locator('[data-key="message-44"]')).toBeVisible()
  await expect(page.locator('[data-testid="status"]')).toHaveText('At latest')
  await expect(page.locator('[data-key="message-0"]')).toHaveCount(0)
})

test('followOnAppend keeps the view pinned when a message is added at the end', async ({
  page,
}) => {
  await page.goto('/')
  await waitForPin(page)
  await page.locator('[data-testid="add-message"]').click()
  await expect(page.locator('[data-key="message-45"]')).toBeVisible()
  await waitForPin(page)
  await expect(page.locator('[data-testid="status"]')).toHaveText('At latest')
})

test('does NOT follow appends while reading history', async ({ page }) => {
  await page.goto('/')
  await waitForPin(page)
  await page.locator('.messages').evaluate((el) => {
    el.scrollTop = Math.floor(el.scrollHeight / 2)
  })
  await expect(page.locator('[data-testid="status"]')).toHaveText(
    'Reading history',
  )
  const before = await page.locator('.messages').evaluate((el) => el.scrollTop)
  await page.locator('[data-testid="add-message"]').click()
  await page.waitForTimeout(400)
  const after = await page.locator('.messages').evaluate((el) => el.scrollTop)
  expect(Math.abs(after - before)).toBeLessThanOrEqual(1)
  await expect(page.locator('[data-key="message-45"]')).toHaveCount(0)
})

test('prepending history keeps the visible message anchored in place', async ({
  page,
}) => {
  await page.goto('/')
  await waitForPin(page)
  // Move to the middle of the thread: well away from the bottom ("reading
  // history") AND outside the load-ahead auto-trigger zone near the top, so the
  // prepend below is driven by the click alone.
  await page.locator('.messages').evaluate((el) => {
    el.scrollTop = Math.floor(el.scrollHeight / 2)
  })
  await expect(page.locator('[data-testid="status"]')).toHaveText(
    'Reading history',
  )

  // pick whatever message is currently visible near the viewport top and record it
  const anchorKey = await page.evaluate(() => {
    const el = document.querySelector('.messages')!
    const top = el.getBoundingClientRect().top
    const rows = Array.from(
      document.querySelectorAll<HTMLElement>('.message-row'),
    )
    const visible = rows.find((row) => {
      const box = row.getBoundingClientRect()
      return box.top >= top && box.top < top + 200
    })
    return visible?.dataset.key ?? null
  })
  expect(anchorKey).not.toBeNull()
  const anchor = page.locator(`[data-key="${anchorKey}"]`)
  await expect(anchor).toBeVisible()
  const beforeBox = await anchor.boundingBox()

  const heightBefore = await page
    .locator('.messages')
    .evaluate((el) => el.scrollHeight)

  await page.locator('[data-testid="load-older"]').click()
  await expect(page.locator('[data-testid="status"]')).toHaveText(
    'Loading history',
  )
  // The prepended rows are far above the render window here, so they are
  // (correctly) virtualized away — DOM attachment is the wrong signal. The prepend
  // landing is observable as total content growth.
  await expect
    .poll(() => page.locator('.messages').evaluate((el) => el.scrollHeight), {
      timeout: 3000,
    })
    .toBeGreaterThan(heightBefore)

  const afterBox = await anchor.boundingBox()
  expect(afterBox).not.toBeNull()
  expect(Math.abs(afterBox!.y - beforeBox!.y)).toBeLessThanOrEqual(2)
})

test('scrolling near the top auto-loads older history', async ({ page }) => {
  await page.goto('/')
  await waitForPin(page)
  await page.waitForTimeout(400)
  const heightBefore = await page
    .locator('.messages')
    .evaluate((el) => el.scrollHeight)
  // 700px is INSIDE the ~1.5-viewport load-ahead zone but far above the old
  // hard-stop trigger: history must load while there is still runway. The loaded
  // rows land above the (compensated) viewport and are virtualized away, so the
  // signal is content growth, not DOM attachment.
  await page.locator('.messages').evaluate((el) => {
    el.scrollTop = 700
  })
  await expect
    .poll(() => page.locator('.messages').evaluate((el) => el.scrollHeight), {
      timeout: 3000,
    })
    .toBeGreaterThan(heightBefore)
})

test('Latest returns to the bottom and status flips back to At latest', async ({
  page,
}) => {
  await page.goto('/')
  await waitForPin(page)
  await page.locator('.messages').evaluate((el) => {
    el.scrollTop = 0
  })
  await expect(page.locator('[data-testid="status"]')).toHaveText(
    /Reading history|Loading history/,
  )
  await page.locator('[data-testid="latest"]').click()
  await waitForPin(page)
  await expect(page.locator('[data-testid="status"]')).toHaveText('At latest')
  await expect(page.locator('[data-key^="message-4"]').last()).toBeVisible()
})

test('a reply streamed from the server grows progressively and stays pinned', async ({
  page,
}) => {
  await page.goto('/')
  await waitForPin(page)
  const replyResponse = page.waitForResponse(
    (response) =>
      response.url().endsWith('/api/reply') && response.status() === 200,
  )
  await page.locator('[data-testid="stream-reply"]').click()
  await replyResponse
  const streamed = page.locator('[data-key^="stream-"]')
  await expect(streamed).toBeVisible()
  await expect(streamed).toContainText('Thinking through the failure mode.')
  const early = (await streamed.textContent()) ?? ''
  expect(early).not.toContain('drifting off the bottom')
  await expect(streamed).toContainText('drifting off the bottom', {
    timeout: 5000,
  })
  await waitForPin(page)
  await expect(page.locator('[data-testid="status"]')).toHaveText('At latest')
})

// ---- The two assertions this example exists for ----

test('prepending history causes NO measurement-correction kick', async ({
  page,
}) => {
  await page.goto('/')
  await waitForPin(page)
  // Park just OUTSIDE the load-ahead auto-trigger zone (~720px = 1.5 viewport
  // heights) so the prepend below is click-driven, close enough to the top that a
  // measurement pipeline (if one were ever reintroduced) would have rows in reach.
  await page.locator('.messages').evaluate((el) => {
    el.scrollTop = 800
  })
  await page.waitForTimeout(200)
  // Sample scrollTop at 8ms around a load-older click. With EXACT calculated heights
  // the only positive jump allowed is the single intended anchor compensation; any
  // second positive jump is a measurement correction — the artifact this example
  // eliminates (the flat-estimate Chat example shows a per-batch correction here).
  const heightBefore = await page
    .locator('.messages')
    .evaluate((el) => el.scrollHeight)
  const jumps = await page.evaluate(async () => {
    const el = document.querySelector('.messages') as HTMLElement
    const samples: number[] = []
    const id = setInterval(() => samples.push(el.scrollTop), 8)
    ;(
      document.querySelector('[data-testid="load-older"]') as HTMLElement
    ).click()
    await new Promise((resolve) => setTimeout(resolve, 1200))
    clearInterval(id)
    const positive: number[] = []
    for (let i = 1; i < samples.length; i++) {
      const delta = samples[i]! - samples[i - 1]!
      if (delta > 4) positive.push(Math.round(delta))
    }
    return positive
  })
  // Guard against a vacuous pass: the prepend must actually have landed
  // (content grew) — only then does the jump count mean anything.
  await expect
    .poll(() => page.locator('.messages').evaluate((el) => el.scrollHeight), {
      timeout: 3000,
    })
    .toBeGreaterThan(heightBefore)
  // Exactly one positive jump: the compensation. Zero corrections after it.
  expect(jumps.length).toBeLessThanOrEqual(1)
})

test('the streamed reply grows through v.resizeItem and calculated height matches the DOM', async ({
  page,
}) => {
  await page.goto('/')
  await waitForPin(page)
  await page.locator('[data-testid="stream-reply"]').click()
  const streamed = page.locator('[data-key^="stream-"]')
  await expect(streamed).toBeVisible()
  // Row height comes from item.size (set inline). Capture it early, then after the
  // full reply: it must have GROWN — that growth is delivered by v.resizeItem per
  // chunk, since this example has no measureElement to observe the DOM.
  await expect(streamed).toContainText('Thinking through the failure mode.')
  const earlyHeight = await streamed.evaluate((el) =>
    parseFloat((el as HTMLElement).style.height),
  )
  await expect(streamed).toContainText('drifting off the bottom', {
    timeout: 5000,
  })
  const finalHeight = await streamed.evaluate((el) =>
    parseFloat((el as HTMLElement).style.height),
  )
  expect(finalHeight).toBeGreaterThan(earlyHeight)
  // Calculated height is REAL height: the bubble's rendered box must fit the row
  // exactly (content height == calculated row height, within a pixel).
  const contentHeight = await streamed.evaluate((el) => {
    const row = el as HTMLElement
    const bubble = row.querySelector('.bubble') as HTMLElement
    const rowPadding = 12 // .message-row 6 top + 6 bottom
    return bubble.offsetHeight + rowPadding
  })
  expect(Math.abs(contentHeight - finalHeight)).toBeLessThanOrEqual(1)
})
