import { expect, test } from '@playwright/test'

test('scrolls to index 1000', async ({ page }) => {
  await page.goto('/')
  await page.click('#scroll-to-1000')

  const item = page.locator('[data-testid="item-1000"]')
  await expect(item).toBeVisible()

  await page.waitForTimeout(5_000)

  const container = page.locator('#scroll-container')
  const [itemBox, scrollTop, containerBox] = await Promise.all([
    item.boundingBox(),
    container.evaluate((el) => el.scrollTop),
    container.boundingBox(),
  ])

  if (!itemBox || !containerBox) throw new Error('Missing bounding boxes')

  const itemTopRelativeToScroll = itemBox.y + scrollTop - containerBox.y
  const itemBottomRelativeToScroll = itemTopRelativeToScroll + itemBox.height
  const containerVisibleBottom = scrollTop + containerBox.height

  const delta = Math.abs(itemBottomRelativeToScroll - containerVisibleBottom)
  expect(delta).toBeLessThan(1.01)
})
