import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

async function waitForEnd(page: Page) {
  await expect
    .poll(async () =>
      page.evaluate(() => {
        const container = document.querySelector('#scroll-container')
        if (!container) throw new Error('Container not found')
        return Math.abs(
          container.scrollHeight - container.scrollTop - container.clientHeight,
        )
      }),
    )
    .toBeLessThan(1.01)
}

async function maybeFirstVisibleMessage(page: Page) {
  return page.evaluate(() => {
    const container = document.querySelector('#scroll-container')
    if (!container) throw new Error('Container not found')

    const containerRect = container.getBoundingClientRect()
    const items = Array.from(
      container.querySelectorAll<HTMLElement>('[data-message-id]'),
    )

    const item = items.find((node) => {
      const rect = node.getBoundingClientRect()
      return (
        rect.bottom > containerRect.top + 1 &&
        rect.top < containerRect.bottom - 1
      )
    })

    if (!item) return null

    return {
      id: item.dataset.messageId,
      top: item.getBoundingClientRect().top - containerRect.top,
      scrollTop: container.scrollTop,
    }
  })
}

async function firstVisibleMessage(page: Page) {
  const item = await maybeFirstVisibleMessage(page)
  if (!item) throw new Error('No visible message found')
  return item
}

async function getScrollState(page: Page) {
  return page.evaluate(() => {
    const container = document.querySelector('#scroll-container')
    if (!container) throw new Error('Container not found')

    return {
      scrollTop: container.scrollTop,
      scrollHeight: container.scrollHeight,
    }
  })
}

async function waitForFirstVisibleAtOffset(page: Page, scrollTop: number) {
  await expect
    .poll(async () => {
      const item = await maybeFirstVisibleMessage(page)
      return item?.scrollTop
    })
    .toBe(scrollTop)
}

test('chat mode keeps visible messages stable when history is prepended', async ({
  page,
}) => {
  await page.goto('/chat/')
  await waitForEnd(page)

  await page.evaluate(() => {
    const container = document.querySelector('#scroll-container')
    if (!container) throw new Error('Container not found')
    container.scrollTop = 350
  })
  await waitForFirstVisibleAtOffset(page, 350)

  const before = await firstVisibleMessage(page)

  await page.click('#prepend')
  await expect
    .poll(async () => {
      const after = await maybeFirstVisibleMessage(page)
      return (
        after !== null &&
        after.id === before.id &&
        Math.abs(after.top - before.top) < 1.01 &&
        after.scrollTop - before.scrollTop > 249
      )
    })
    .toBe(true)

  const after = await firstVisibleMessage(page)

  expect(after.id).toBe(before.id)
  expect(Math.abs(after.top - before.top)).toBeLessThan(1.01)
  expect(after.scrollTop - before.scrollTop).toBeGreaterThan(249)
})

test('chat mode does not follow appended messages while reading history', async ({
  page,
}) => {
  await page.goto('/chat/')
  await waitForEnd(page)

  await page.evaluate(() => {
    const container = document.querySelector('#scroll-container')
    if (!container) throw new Error('Container not found')
    container.scrollTop = 350
  })
  await waitForFirstVisibleAtOffset(page, 350)

  const before = await getScrollState(page)

  await page.click('#append')
  await expect
    .poll(async () => {
      const after = await getScrollState(page)
      return (
        after.scrollHeight > before.scrollHeight &&
        Math.abs(after.scrollTop - before.scrollTop) < 1.01
      )
    })
    .toBe(true)

  const after = await getScrollState(page)

  expect(Math.abs(after.scrollTop - before.scrollTop)).toBeLessThan(1.01)
  await expect(page.locator('[data-testid="message-m-30"]')).not.toBeVisible()
})

test('chat mode follows appended messages from the end', async ({ page }) => {
  await page.goto('/chat/')
  await waitForEnd(page)

  await page.click('#append')
  await waitForEnd(page)

  await expect(page.locator('[data-testid="message-m-30"]')).toBeVisible()
})

test('chat mode keeps streaming bottom message pinned as it grows', async ({
  page,
}) => {
  await page.goto('/chat/')
  await waitForEnd(page)

  await page.click('#grow-last')
  await waitForEnd(page)

  await expect(page.locator('[data-testid="message-m-29"]')).toBeVisible()
})

test('chat mode keeps streaming bottom message pinned as it grows with paddingEnd', async ({
  page,
}) => {
  await page.goto('/chat/?paddingEnd=80')
  await waitForEnd(page)

  await page.click('#grow-last')
  await waitForEnd(page)

  await expect(page.locator('[data-testid="message-m-29"]')).toBeVisible()
})

// #1266 — adapted from PR #1265 by @tigerBeA. Direct DOM updates, no flushSync,
// and a row ABOVE the last one grows: the compensation write is clamped against
// the old scroll range, and with an unchanged range nothing re-renders afterwards,
// so only the post-notify retry in core can recover the lost distance.
test('direct DOM chat stays pinned when a previous message grows without a re-render', async ({
  page,
}) => {
  await page.goto('/chat-resize/')
  await waitForEnd(page)
  // Let the initial scrollToEnd's isScrolling debounce settle first. Its reset
  // triggers a re-render that would run _willUpdate and mask a missing retry.
  await page.waitForTimeout(300)
  const before = await getScrollState(page)

  await page.click('#grow-previous')
  await expect
    .poll(async () => (await getScrollState(page)).scrollHeight)
    .toBe(before.scrollHeight + 24)
  await waitForEnd(page)
  expect((await getScrollState(page)).scrollTop).toBe(before.scrollTop + 24)
})
