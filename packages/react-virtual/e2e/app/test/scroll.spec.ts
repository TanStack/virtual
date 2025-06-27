import { expect, test } from '@playwright/test'

test('scrolls to index 1000', async ({ page }) => {
  await page.goto('/')
  await page.click('#scroll-to-1000')

  await expect(page.locator('[data-testid="item-1000"]')).toBeVisible()

  const delta = await page.evaluate(() => {
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
  })

  expect(delta).toBeLessThan(1.01)
})
