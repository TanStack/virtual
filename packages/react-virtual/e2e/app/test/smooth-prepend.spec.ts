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

// KNOWN BUG, not a guard on current behaviour — test.fail() asserts this still
// reproduces and turns red the moment it is fixed, at which point drop the
// annotation and keep the assertions.
//
// A prepend that lands while a scrollToIndex is still travelling strands it. The
// anchor sync in _willUpdate writes scrollTop, which cancels the browser's
// smooth animation, and reconcileScroll never resumes the journey because its
// `else` branch only re-asserts when the *target* changed. With uniform rows
// index 0 sits at offset 0 both before and after the prepend, so the target is
// unchanged and the loop just idles. "Jump to the oldest message" therefore dies
// halfway whenever history streams in mid-animation.
//
// Reproduces identically on the commit before the stale-target fix (stranded at
// ~3900 vs ~3500), so it is pre-existing and independent of it. Resuming an
// unfinished scroll needs its own change: reconcileScroll idling is exactly what
// stops it fighting a reader who deliberately scrolls away mid-scroll, so making
// it re-assert is a behavioural decision rather than a local patch.
test.fail()
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
