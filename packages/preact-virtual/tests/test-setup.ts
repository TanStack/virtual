import { afterEach } from 'vitest'

afterEach(() => {
  document.body.innerHTML = ''
})

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

global.ResizeObserver = ResizeObserverMock as unknown as typeof ResizeObserver
