import { expect, test } from 'vitest'
import { elementUpdated, fixture, html } from '@open-wc/testing'
import { LitElement, type PropertyValues } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import type { ReactiveControllerHost } from 'lit'
import {
  VirtualizerController,
  WindowVirtualizerController,
  observeWindowRect,
  windowScroll,
} from '../src'

function createHost() {
  let requestUpdateCount = 0

  const host: ReactiveControllerHost = {
    addController() {},
    removeController() {},
    requestUpdate() {
      requestUpdateCount++
    },
    get updateComplete() {
      return Promise.resolve(true)
    },
  }

  return {
    host,
    get requestUpdateCount() {
      return requestUpdateCount
    },
  }
}

test('constructor options reach the virtualizer', () => {
  const { host } = createHost()
  const estimateSize = () => 50
  const controller = new VirtualizerController(host, {
    count: 10,
    estimateSize,
    getScrollElement: () => null,
  })

  const virtualizer = controller.getVirtualizer()
  expect(virtualizer.options.count).toBe(10)
  expect(virtualizer.options.estimateSize).toBe(estimateSize)
  expect(virtualizer.getTotalSize()).toBe(500)
})

test('setOptions merges partial updates and ignores undefined', () => {
  const { host } = createHost()
  const estimateSize = () => 50
  const controller = new VirtualizerController(host, {
    count: 10,
    estimateSize,
    getScrollElement: () => null,
  })
  const virtualizer = controller.getVirtualizer()

  controller.setOptions({ count: 20, estimateSize: undefined })

  expect(virtualizer.options.count).toBe(20)
  expect(virtualizer.options.estimateSize).toBe(estimateSize)
  expect(virtualizer.getTotalSize()).toBe(1000)

  const nextEstimate = () => 25
  controller.setOptions({ estimateSize: nextEstimate, paddingEnd: 12 })
  expect(virtualizer.options.count).toBe(20)
  expect(virtualizer.options.estimateSize).toBe(nextEstimate)
  expect(virtualizer.options.paddingEnd).toBe(12)
  expect(virtualizer.getTotalSize()).toBe(1012)
})

test('setOptions keeps the user onChange and the host update wrapper', async () => {
  const harness = createHost()
  const calls: Array<boolean> = []
  const controller = new VirtualizerController(harness.host, {
    count: 4,
    estimateSize: () => 25,
    getScrollElement: () => null,
    onChange: (_instance, sync) => {
      calls.push(sync)
    },
  })

  controller.setOptions({ count: 6 })
  controller
    .getVirtualizer()
    .options.onChange?.(controller.getVirtualizer(), true)

  expect(calls).toEqual([true])
  expect(controller.getVirtualizer().options.count).toBe(6)
  expect(controller.getVirtualizer().getTotalSize()).toBe(150)

  await Promise.resolve()
  expect(harness.requestUpdateCount).toBeGreaterThan(0)
})

test('setOptions requests a host update outside an update, and not again for the same options', async () => {
  const harness = createHost()
  const controller = new VirtualizerController(harness.host, {
    count: 10,
    estimateSize: () => 50,
    getScrollElement: () => null,
  })

  controller.setOptions({ count: 12 })
  await Promise.resolve()
  const afterChange = harness.requestUpdateCount
  expect(afterChange).toBeGreaterThan(0)

  controller.setOptions({ count: 12 })
  await Promise.resolve()
  expect(harness.requestUpdateCount).toBe(afterChange)
})

test('setOptions during a host update does not schedule another update', () => {
  const harness = createHost()
  const controller = new VirtualizerController(harness.host, {
    count: 10,
    estimateSize: () => 50,
    getScrollElement: () => null,
  })

  controller.hostUpdate()
  const before = harness.requestUpdateCount
  controller.setOptions({ count: 15 })
  controller.setOptions({
    getScrollElement: () => null,
  })
  expect(controller.getVirtualizer().options.count).toBe(15)
  expect(controller.getVirtualizer().getTotalSize()).toBe(750)
  expect(harness.requestUpdateCount).toBe(before)
  controller.hostUpdated()
})

test('WindowVirtualizerController.setOptions keeps the window defaults', () => {
  const { host } = createHost()
  const controller = new WindowVirtualizerController(host, {
    count: 2,
    estimateSize: () => 10,
  })
  controller.hostConnected()

  controller.setOptions({ count: 4 })

  const options = controller.getVirtualizer().options
  expect(options.count).toBe(4)
  expect(controller.getVirtualizer().getTotalSize()).toBe(40)
  expect(options.scrollToFn).toBe(windowScroll)
  expect(options.observeElementRect).toBe(observeWindowRect)
  expect(options.getScrollElement()).toBe(window)

  controller.hostDisconnected()
})

@customElement('test-list-set-options')
class ListSetOptions extends LitElement {
  @property({ type: Number })
  count = 10

  private virtualizerController: VirtualizerController<HTMLDivElement, Element>

  constructor() {
    super()
    this.virtualizerController = new VirtualizerController(this, {
      getScrollElement: () => null,
      count: this.count,
      estimateSize: () => 50,
    })
  }

  protected willUpdate(changed: PropertyValues<this>) {
    if (changed.has('count')) {
      this.virtualizerController.setOptions({ count: this.count })
    }
  }

  render() {
    const virtualizer = this.virtualizerController.getVirtualizer()
    return html`<div data-testid="total">${virtualizer.getTotalSize()}</div>`
  }
}

test('a reactive count property updates the rendered total size', async () => {
  const el = await fixture(
    html`<test-list-set-options></test-list-set-options>`,
  )
  await elementUpdated(el)

  // Raising count does not paint a higher index unless the viewport can
  // hold it. The rendered total size is what changes: 10 * 50, then 20 * 50.
  const total = () =>
    el.shadowRoot!.querySelector('[data-testid="total"]')?.textContent

  expect(total()).toBe('500')
  ;(el as ListSetOptions).count = 20
  await elementUpdated(el)

  expect(total()).toBe('1000')
})
