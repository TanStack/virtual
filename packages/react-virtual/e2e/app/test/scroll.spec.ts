import { expect, test } from '@playwright/test'

test('scrolls to index 1000', async ({ page }) => {
  await page.goto('/')
  await page.waitForSelector('#scroll-to-1000', { state: 'visible' })
  await page.click('#scroll-to-1000')

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
  console.log('delta:', delta)

  await expect(page.locator('[data-testid="item-1000"]')).toBeVisible()
})
