import { describe, test, expect, beforeEach } from 'vitest'
import { elementUpdated, fixture, html, waitUntil } from '@open-wc/testing'
import { LitElement } from 'lit'
import { VirtualizerController } from '../src'
import { createRef, ref, Ref } from 'lit/directives/ref.js'
import { repeat } from 'lit/directives/repeat.js'
import { customElement } from 'lit/decorators.js'

const width = 400
const height = 400
const count = 50

@customElement('test-list')
class List extends LitElement {
  private scrollElementRef: Ref<HTMLDivElement> = createRef()

  private virtualizerController: VirtualizerController<HTMLDivElement, Element>

  constructor() {
    super()
    this.virtualizerController = new VirtualizerController(this, {
      getScrollElement: () => this.scrollElementRef.value,
      count,
      estimateSize: () => 50,
      observeElementRect: (_, cb) => {
        cb({ height, width })
      },
    })
  }

  render() {
    const virtualizer = this.virtualizerController.getVirtualizer()
    const virtualRows = virtualizer.getVirtualItems()

    return html`
      <div>
        <button
          @click=${() => {
            virtualizer.scrollToIndex(count - 1)
            console.log('scrolled down!')
          }}
        >
          scroll to the end
        </button>
        <div class="list scroll-container" ${ref(this.scrollElementRef)}>
          <div
            style="position: relative; height: ${virtualizer.getTotalSize()}px; width: 100%;"
          >
            <div
              style="position:absolute;top:0;left:0;width:100%;transform:translateY(${virtualRows[0]
                ? virtualRows[0].start
                : 0}px);"
            >
              ${repeat(
                virtualRows,
                (virtualRow) => virtualRow.key,
                (virtualRow) =>
                  html` <div
                    data-index="${virtualRow.index}"
                    ${ref(virtualizer.measureElement)}
                    class="${virtualRow.index % 2 === 0
                      ? 'list-item-even'
                      : 'list-item-odd'}"
                  >
                    <div style="padding: 10px 0;">
                      <div>Row ${virtualRow.index}</div>
                      <div>Item ${virtualRow.index}</div>
                    </div>
                  </div>`,
              )}
            </div>
          </div>
        </div>
      </div>
      <style>
        .list {
          border: 1px solid #e6e4dc;
          max-width: 100%;
        }

        .list-item-even,
        .list-item-odd {
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .list-item-even {
          background-color: #e6e4dc;
        }

        .scroll-container {
          height: ${height}px;
          width: ${width}px;
          overflow-y: auto;
        }
      </style>
    `
  }
}

test('should render', async () => {
  const el = await fixture(html`<test-list></test-list>`)
  await elementUpdated(el)
  expect(el).toBeTruthy()
})

test('should render virtual items', async () => {
  const el = await fixture(html`<test-list></test-list>`)
  await elementUpdated(el)
  await waitUntil(
    () => el.shadowRoot.querySelector('[data-index="4"]'),
    'Element did not render virtual items',
  )
})

@customElement('reconnect-list')
class ReconnectList extends LitElement {
  private scrollElementRef: Ref<HTMLDivElement> = createRef()

  private virtualizerController: VirtualizerController<HTMLDivElement, Element>

  constructor() {
    super()
    this.virtualizerController = new VirtualizerController(this, {
      getScrollElement: () => this.scrollElementRef.value,
      count,
      estimateSize: () => 50,
      observeElementRect: (_, cb) => {
        cb({ height, width })
      },
    })
  }

  render() {
    const virtualizer = this.virtualizerController.getVirtualizer()

    return html`
      <div class="scroll-container" ${ref(this.scrollElementRef)}>
        ${repeat(
          virtualizer.getVirtualItems(),
          (virtualRow) => virtualRow.key,
          (virtualRow) =>
            html`<div data-index="${virtualRow.index}">
              Row ${virtualRow.index}
            </div>`,
        )}
      </div>
    `
  }
}

test('keeps updating after the host is removed and reinserted', async () => {
  const el = await fixture(html`<reconnect-list></reconnect-list>`)
  await elementUpdated(el)
  await waitUntil(
    () => el.shadowRoot.querySelector('[data-index="0"]'),
    'Element did not render the initial rows',
  )
  // Let the rect observer's follow-up update finish so the host has no
  // pending change when it is removed. A pending update would call
  // `hostUpdated` after reinsertion and hide the bug.
  await (el as ReconnectList).updateComplete
  await (el as ReconnectList).updateComplete
  expect(el.shadowRoot.querySelector('[data-index="20"]')).toBeNull()

  const parent = el.parentNode
  if (parent == null) {
    throw new Error('host has no parent')
  }
  const next = el.nextSibling
  el.remove()
  parent.insertBefore(el, next)
  await (el as ReconnectList).updateComplete

  const scroller = el.shadowRoot.querySelector('.scroll-container')
  if (!(scroller instanceof HTMLElement)) {
    throw new Error('scroll container was not rendered')
  }
  scroller.scrollTop = 1000
  scroller.dispatchEvent(new Event('scroll'))

  await waitUntil(
    () => el.shadowRoot.querySelector('[data-index="20"]'),
    'Virtualizer did not update after the host was reattached',
  )
  expect(el.shadowRoot.querySelector('[data-index="0"]')).toBeNull()
})
