import { expect, test } from '@playwright/test'
import type { CDPSession, Page } from '@playwright/test'

// Browser gate for the iOS scroll-adjustment deferral. `isIOSWebKit()` keys off
// the user agent, so an iPhone UA plus touch emulation puts Chromium on the iOS
// code path; CDP `Input.dispatchTouchEvent` then drives a real touch gesture.
// This exercises the deferral state machine end to end in a real browser. It
// cannot reproduce WebKit's momentum physics (the reason the deferral exists),
// only the bookkeeping around it.

test.use({
  hasTouch: true,
  userAgent:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
})

const container = '#scroll-container'

async function waitForEnd(page: Page) {
  await expect
    .poll(() =>
      page.evaluate((sel) => {
        const el = document.querySelector(sel)!
        return Math.abs(el.scrollHeight - el.scrollTop - el.clientHeight)
      }, container),
    )
    .toBeLessThan(1.01)
}

const scrollTop = (page: Page) =>
  page.evaluate((sel) => document.querySelector(sel)!.scrollTop, container)

// Screen position of the message row nearest the top of the viewport, so we
// can tell whether the reader's row stayed put across the prepend.
async function topRow(page: Page) {
  return page.evaluate((sel) => {
    const el = document.querySelector(sel)!
    const top = el.getBoundingClientRect().top
    const row = [...el.querySelectorAll<HTMLElement>('[data-message-id]')]
      .map((n) => ({
        id: n.dataset.messageId!,
        y: n.getBoundingClientRect().top - top,
      }))
      .filter((r) => r.y > -1)
      .sort((a, b) => a.y - b.y)[0]!
    return row
  }, container)
}

async function rowY(page: Page, id: string) {
  return page.evaluate(
    ({ sel, id }) => {
      const el = document.querySelector(sel)!
      const n = el.querySelector<HTMLElement>(`[data-message-id="${id}"]`)
      return n
        ? n.getBoundingClientRect().top - el.getBoundingClientRect().top
        : null
    },
    { sel: container, id },
  )
}

async function fingerDown(cdp: CDPSession, x: number, y: number) {
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x, y }],
  })
}
async function fingerMove(cdp: CDPSession, x: number, y: number) {
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: [{ x, y }],
  })
}
async function fingerUp(cdp: CDPSession) {
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchEnd',
    touchPoints: [],
  })
}

test('a prepend landing mid-touch is anchored once the gesture settles, not doubled', async ({
  page,
  browserName,
}) => {
  test.skip(browserName !== 'chromium', 'CDP touch dispatch is Chromium-only')
  await page.goto('/chat/')
  await waitForEnd(page)
  // Reading history: well away from the end so followOnAppend stays out of it.
  await page.evaluate((sel) => {
    document.querySelector(sel)!.scrollTop = 600
  }, container)
  await page.waitForTimeout(200)

  const box = (await page.locator(container).boundingBox())!
  const x = box.x + box.width / 2
  const y = box.y + box.height / 2
  const cdp = await page.context().newCDPSession(page)

  // Finger down and a short drag: the user owns the scroll.
  await fingerDown(cdp, x, y)
  await fingerMove(cdp, x, y + 10)
  await fingerMove(cdp, x, y + 20)
  await page.waitForTimeout(80)
  const before = await topRow(page)
  const stBefore = await scrollTop(page)

  // History lands while the finger is still down: 5 x 50px above the reader.
  await page.evaluate(() => document.getElementById('prepend')!.click())
  await page.waitForTimeout(150)
  // Deferred: no scrollTop write yet, so the DOM still sits where the user left it.
  expect(await scrollTop(page)).toBe(stBefore)

  // Release. The post-touchend tail expires ~150ms later and the deferred
  // delta flushes in one write.
  await fingerUp(cdp)
  await page.waitForTimeout(500)

  // The reader's row is back at the same screen position, offset by exactly
  // one prepend (250px): the deferred delta was applied once, in one write.
  // (The double-count regression with measured rows is covered by the core
  // unit test '#884: ... applies it once'; this page's rows match their
  // estimate, so it exercises the deferral state machine, not that path.)
  const yAfter = await rowY(page, before.id)
  expect(yAfter).not.toBeNull()
  expect(Math.abs(yAfter! - before.y)).toBeLessThan(2)
  expect(await scrollTop(page)).toBe(stBefore + 250)
})

test('a programmatic scroll landing with no touch compensates immediately (iOS UA)', async ({
  page,
  browserName,
}) => {
  test.skip(browserName !== 'chromium', 'CDP touch dispatch is Chromium-only')
  await page.goto('/chat/')
  await waitForEnd(page)
  // scrollToIndex from the app itself: no touch, so nothing may be deferred and
  // the landing is exact on the first frame, even though the write's own
  // scroll event sets isScrolling.
  await page.evaluate((sel) => {
    document.querySelector(sel)!.scrollTop = 600
  }, container)
  await page.waitForTimeout(200)
  await page.click('#scroll-to-end')
  await page.waitForTimeout(50)
  await waitForEnd(page)
})
