import { expect, test } from '@playwright/test'

const check = () => {
  const item = document.querySelector('[data-testid="item-1000"]')
  const container = document.querySelector('#scroll-container')

  if (!item || !container) throw new Error('Elements not found')

  const itemRect = item.getBoundingClientRect()
  const containerRect = container.getBoundingClientRect()
  const scrollTop = container.scrollTop

  const top = itemRect.top + scrollTop - containerRect.top
  const botttom = top + itemRect.height

  const containerBottom = scrollTop + container.clientHeight

  return Math.abs(botttom - containerBottom)
}

test('scrolls to index 1000', async ({ page }) => {
  await page.goto('/scroll/')
  await page.click('#scroll-to-1000')

  // Wait for scroll effect (including retries)
  await page.waitForTimeout(1000)

  await expect(page.locator('[data-testid="item-1000"]')).toBeVisible()

  const delta = await page.evaluate(check)
  expect(delta).toBeLessThan(1.01)
})

test('scrolls to last item', async ({ page }) => {
  await page.goto('/scroll/')
  await page.click('#scroll-to-last')

  await page.waitForTimeout(1000)

  // Last item (index 1001) should be visible
  await expect(page.locator('[data-testid="item-1001"]')).toBeVisible()

  // Container should be scrolled to the very bottom
  const atBottom = await page.evaluate(() => {
    const container = document.querySelector('#scroll-container')
    if (!container) throw new Error('Container not found')
    return Math.abs(
      container.scrollTop + container.clientHeight - container.scrollHeight,
    )
  })
  expect(atBottom).toBeLessThan(1.01)
})

test('scrolls to index 0', async ({ page }) => {
  await page.goto('/scroll/')

  // First scroll down
  await page.click('#scroll-to-1000')
  await page.waitForTimeout(1000)

  // Then scroll to first item
  await page.click('#scroll-to-0')
  await page.waitForTimeout(1000)

  await expect(page.locator('[data-testid="item-0"]')).toBeVisible()

  const scrollTop = await page.evaluate(() => {
    const container = document.querySelector('#scroll-container')
    return container?.scrollTop ?? -1
  })
  expect(scrollTop).toBeLessThan(1.01)
})
