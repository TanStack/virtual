import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

const scrollTop = (page: Page) =>
  page.evaluate(() => {
    const container = document.querySelector('#scroll-container')
    if (!container) throw new Error('Container not found')
    return container.scrollTop
  })

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

// Regression guard: a prepend that lands while a smooth scrollToIndex is still
// travelling must not strand it. The end-anchor prepend sync in _willUpdate
// used to write scrollTop instantly, which cancels the browser's smooth
// animation; Chromium then drops a smooth request re-issued in the very next
// frame, so reconcileScroll could not recover the journey and "Jump to the
// oldest message" died halfway whenever history streamed in mid-animation.
// Core now skips that sync while a smooth programmatic scroll is in flight
// (its index-based target recomputes against the new layout), so the
// animation simply continues to the top.
test('a prepend mid-flight does not abandon a smooth scrollToIndex', async ({
  page,
}) => {
  await page.goto('/smooth-prepend/')
  await waitForEnd(page)

  const start = await scrollTop(page)
  expect(start).toBeGreaterThan(9000) // 200 x 50 - 300

  // Ask for index 0 and catch the animation in flight — well clear of both
  // ends, so this asserts on a genuinely mid-scroll prepend.
  await page.click('#smooth-to-0')
  await expect
    .poll(() => scrollTop(page), { timeout: 5000 })
    .toBeLessThan(start - 1000)
  expect(await scrollTop(page)).toBeGreaterThan(500)

  // History arrives while we are still moving.
  await page.click('#prepend')

  // The requested scroll should still complete. Index 0 sits at offset 0 both
  // before and after the prepend (uniform 50px rows), so the destination is
  // unambiguous: the top.
  await expect.poll(() => scrollTop(page), { timeout: 3000 }).toBeLessThan(1.01)
})
