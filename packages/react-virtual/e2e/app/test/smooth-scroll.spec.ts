import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

// A smooth scroll's duration scales with distance (index 1000 is ~50,000px),
// and reconcileScroll may re-drive it as rows measure. On a busy CI runner that
// can outlast a fixed 2s wait — the "index 1000" case has flaked exactly that
// way. Wait for the target row to render and the scroll position to stop
// moving instead.
async function waitForSmoothScroll(page: Page, testId: string) {
  await expect(page.locator(`[data-testid="${testId}"]`)).toBeVisible({
    timeout: 15_000,
  })
  let last = -1
  await expect
    .poll(
      async () => {
        const cur = await page.evaluate(
          () => document.querySelector('#scroll-container')!.scrollTop,
        )
        const settled = cur === last
        last = cur
        return settled
      },
      { timeout: 15_000, intervals: [100] },
    )
    .toBe(true)
}

test('smooth scrolls to index 1000', async ({ page }) => {
  await page.goto('/smooth-scroll/')
  await page.click('#scroll-to-1000')

  await waitForSmoothScroll(page, 'item-1000')

  const delta = await page.evaluate(() => {
    const item = document.querySelector('[data-testid="item-1000"]')
    const container = document.querySelector('#scroll-container')
    if (!item || !container) throw new Error('Elements not found')

    const itemRect = item.getBoundingClientRect()
    const containerRect = container.getBoundingClientRect()
    const scrollTop = container.scrollTop
    const top = itemRect.top + scrollTop - containerRect.top
    const bottom = top + itemRect.height
    const containerBottom = scrollTop + container.clientHeight
    return Math.abs(bottom - containerBottom)
  })
  expect(delta).toBeLessThan(1.01)
})

test('smooth scrolls to index 100', async ({ page }) => {
  await page.goto('/smooth-scroll/')
  await page.click('#scroll-to-100')

  await waitForSmoothScroll(page, 'item-100')
})

test('smooth scrolls to index 0 after scrolling away', async ({ page }) => {
  await page.goto('/smooth-scroll/')

  // First scroll down
  await page.click('#scroll-to-500')
  await waitForSmoothScroll(page, 'item-500')

  // Then smooth scroll back to top
  await page.click('#scroll-to-0')
  await waitForSmoothScroll(page, 'item-0')

  const scrollTop = await page.evaluate(() => {
    const container = document.querySelector('#scroll-container')
    return container?.scrollTop ?? -1
  })
  expect(scrollTop).toBeLessThan(1.01)
})

test('smooth scrolls to index 500 with start alignment', async ({ page }) => {
  await page.goto('/smooth-scroll/')
  await page.click('#scroll-to-500-start')

  await waitForSmoothScroll(page, 'item-500')

  const delta = await page.evaluate(
    ([idx, align]) => {
      const item = document.querySelector(`[data-testid="item-${idx}"]`)
      const container = document.querySelector('#scroll-container')
      if (!item || !container) throw new Error('Elements not found')
      const itemRect = item.getBoundingClientRect()
      const containerRect = container.getBoundingClientRect()
      if (align === 'start') {
        return Math.abs(itemRect.top - containerRect.top)
      }
      return 0
    },
    [500, 'start'] as const,
  )
  expect(delta).toBeLessThan(1.01)
})

test('smooth scrolls to index 500 with center alignment', async ({ page }) => {
  await page.goto('/smooth-scroll/')
  await page.click('#scroll-to-500-center')

  await waitForSmoothScroll(page, 'item-500')

  const delta = await page.evaluate(
    ([idx]) => {
      const item = document.querySelector(`[data-testid="item-${idx}"]`)
      const container = document.querySelector('#scroll-container')
      if (!item || !container) throw new Error('Elements not found')
      const itemRect = item.getBoundingClientRect()
      const containerRect = container.getBoundingClientRect()
      const containerCenter = containerRect.top + containerRect.height / 2
      const itemCenter = itemRect.top + itemRect.height / 2
      return Math.abs(itemCenter - containerCenter)
    },
    [500] as const,
  )
  // Center alignment has slightly more tolerance due to rounding
  expect(delta).toBeLessThan(50)
})

test('smooth scrolls sequentially to multiple targets', async ({ page }) => {
  await page.goto('/smooth-scroll/')

  // Scroll to 100 first
  await page.click('#scroll-to-100')
  await waitForSmoothScroll(page, 'item-100')

  // Then scroll to 500
  await page.click('#scroll-to-500')
  await waitForSmoothScroll(page, 'item-500')

  // Then scroll to 1000
  await page.click('#scroll-to-1000')
  await waitForSmoothScroll(page, 'item-1000')
})

test('interrupting smooth scroll with another smooth scroll', async ({
  page,
}) => {
  await page.goto('/smooth-scroll/')

  // Start scrolling to 1000
  await page.click('#scroll-to-1000')
  // Interrupt mid-animation (before the 500ms animation completes)
  await page.waitForTimeout(200)
  await page.click('#scroll-to-100')

  await waitForSmoothScroll(page, 'item-100')
})
