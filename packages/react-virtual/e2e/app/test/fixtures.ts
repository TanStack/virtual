import { test as base, expect } from '@playwright/test'

type HookVariant = 'standard' | 'experimental'

export const test = base.extend<{ hookVariant: HookVariant }>({
  hookVariant: ['standard', { option: true }],
  page: async ({ page, hookVariant }, use) => {
    const originalGoto = page.goto.bind(page)
    page.goto = async function (url, options) {
      if (hookVariant === 'experimental') {
        const separator = url.includes('?') ? '&' : '?'
        url = `${url}${separator}hook=experimental`
      }
      return originalGoto(url, options)
    } as typeof page.goto
    await use(page)
  },
})

export { expect }
