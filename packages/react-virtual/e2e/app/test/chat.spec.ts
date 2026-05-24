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

async function firstVisibleMessage(page: Page) {
  return page.evaluate(() => {
    const container = document.querySelector('#scroll-container')
    if (!container) throw new Error('Container not found')

    const containerRect = container.getBoundingClientRect()
    const items = Array.from(
      container.querySelectorAll<HTMLElement>('[data-message-id]'),
    )

    const item = items.find(
      (node) => node.getBoundingClientRect().bottom > containerRect.top + 1,
    )

    if (!item) throw new Error('No visible message found')

    return {
      id: item.dataset.messageId,
      top: item.getBoundingClientRect().top - containerRect.top,
      scrollTop: container.scrollTop,
    }
  })
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
  await page.waitForTimeout(100)

  const before = await firstVisibleMessage(page)

  await page.click('#prepend')
  await page.waitForTimeout(100)

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
  await page.waitForTimeout(100)

  const before = await page.evaluate(() => {
    const container = document.querySelector('#scroll-container')
    if (!container) throw new Error('Container not found')
    return container.scrollTop
  })

  await page.click('#append')
  await page.waitForTimeout(100)

  const after = await page.evaluate(() => {
    const container = document.querySelector('#scroll-container')
    if (!container) throw new Error('Container not found')
    return container.scrollTop
  })

  expect(Math.abs(after - before)).toBeLessThan(1.01)
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
