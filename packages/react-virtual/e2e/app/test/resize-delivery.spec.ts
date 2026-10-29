import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

// Let ResizeObserver delivery and its deferred registrations finish before
// checking errors. No timer or external resource determines the result.
const settleFrames = (page: Page) =>
  page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        let remaining = 5
        const frame = () => {
          if (--remaining === 0) resolve()
          else requestAnimationFrame(frame)
        }
        requestAnimationFrame(frame)
      }),
  )

for (const direction of ['grow', 'shrink'] as const) {
  test(`resizing rows can ${direction} the rendered range without observer loop errors`, async ({
    page,
  }) => {
    await page.addInitScript(() => {
      window.addEventListener('error', (event) => {
        if (event.message.includes('ResizeObserver loop')) {
          const root = document.documentElement
          root.dataset.resizeLoops = String(
            Number(root.dataset.resizeLoops ?? 0) + 1,
          )
        }
      })
    })
    await page.goto('/resize-delivery/')
    const scroll = page.locator('#scroll')
    await expect(page.locator('.row').first()).toBeVisible()
    await scroll.evaluate((element) => {
      element.scrollTop = element.scrollHeight / 2
    })
    await expect
      .poll(() => page.locator('.row').first().getAttribute('data-index'))
      .not.toBe('0')
    await settleFrames(page)

    if (direction === 'grow') {
      // Growing the rendered range requires shrinking rows. Set up taller
      // rows first so both paths start at the same scrolled viewport.
      await page.evaluate(() =>
        document.documentElement.style.setProperty('--scale', '1.25'),
      )
      await settleFrames(page)
    }

    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.evaluate(() => {
      document.documentElement.dataset.resizeLoops = '0'
    })
    const countBefore = await page.locator('.row').count()
    const anchor = await scroll.evaluate((element) => {
      const top = element.getBoundingClientRect().top
      const row = [...element.querySelectorAll<HTMLElement>('.row')].find(
        (item) => {
          const rect = item.getBoundingClientRect()
          return rect.top <= top && rect.bottom > top
        },
      )!
      return row.dataset.index!
    })
    await page.evaluate(
      (scale) => document.documentElement.style.setProperty('--scale', scale),
      direction === 'grow' ? '1' : '1.25',
    )
    await expect.poll(() => page.locator('.row').count()).not.toBe(countBefore)
    await settleFrames(page)
    const countAfter = await page.locator('.row').count()
    if (direction === 'grow') expect(countAfter).toBeGreaterThan(countBefore)
    else expect(countAfter).toBeLessThan(countBefore)

    const anchorBox = await page
      .locator(`.row[data-index="${anchor}"]`)
      .boundingBox()
    const scrollBox = await scroll.boundingBox()
    expect(anchorBox).not.toBeNull()
    expect(anchorBox!.y).toBeLessThanOrEqual(scrollBox!.y + 1)
    expect(anchorBox!.y + anchorBox!.height).toBeGreaterThan(scrollBox!.y)
    expect(await page.locator('html').getAttribute('data-resize-loops')).toBe(
      '0',
    )
    expect(errors).toEqual([])
  })
}
