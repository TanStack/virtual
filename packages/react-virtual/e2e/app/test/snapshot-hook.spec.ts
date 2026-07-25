import { expect, test } from '@playwright/test'

const ITEM_SIZE = 40
const COUNT = 1000

test.describe('useVirtualizerSnapshot under React Compiler', () => {
  test('renders items on initial load', async ({ page }) => {
    await page.goto('/snapshot-hook/')

    await expect(page.locator('[data-testid="item-0"]')).toBeVisible()
    await expect(page.locator('[data-testid="item-0"]')).toContainText('Row 0')

    // The sizer height comes from the snapshot's totalSize.
    const inner = page.locator('#inner')
    await expect(inner).toHaveAttribute(
      'style',
      new RegExp(`height:\\s*${COUNT * ITEM_SIZE}px`),
    )
  })

  test('items update after scrolling — the #736 regression, compiled', async ({
    page,
  }) => {
    await page.goto('/snapshot-hook/')

    await expect(page.locator('[data-testid="item-0"]')).toBeVisible()

    await page.click('#scroll-to-500')

    // With `useVirtualizer` a compiled consumer would keep serving the
    // initial items forever. The snapshot hook publishes a new identity, so
    // the compiled component re-derives its output.
    await expect(page.locator('[data-testid="item-500"]')).toBeVisible({
      timeout: 5000,
    })
    const style =
      (await page.locator('[data-testid="item-500"]').getAttribute('style')) ??
      ''
    expect(style).toMatch(/translateY\(20000px\)/)

    // And the initial row is no longer rendered.
    await expect(page.locator('[data-testid="item-0"]')).toHaveCount(0)
  })

  test('re-renders are driven by snapshot changes', async ({ page }) => {
    await page.goto('/snapshot-hook/')
    await expect(page.locator('[data-testid="item-0"]')).toBeVisible()

    const before = Number(
      await page.locator('[data-testid="commit-count"]').textContent(),
    )
    expect(before).toBeGreaterThan(0)

    await page.click('#scroll-to-500')
    await expect(page.locator('[data-testid="item-500"]')).toBeVisible()

    const after = Number(
      await page.locator('[data-testid="commit-count"]').textContent(),
    )
    expect(after).toBeGreaterThan(before)
  })
})
