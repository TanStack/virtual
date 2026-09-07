import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  afterNextRender,
  afterRenderEffect,
  inject,
  signal,
  viewChild,
  viewChildren,
} from '@angular/core'
import { injectVirtualizer } from '@tanstack/angular-virtual'
import type { ElementRef } from '@angular/core'

type Message = {
  id: string
  author: 'user' | 'assistant'
  text: string
}

const replies = [
  'I can break that into the smallest next step and keep the current viewport pinned while this answer grows.',
  'Older messages are loaded above the viewport. The visible row keeps the same screen position after the prepend.',
  'When the thread is not at the bottom, new output waits below without pulling the reader away from history.',
]

const makeMessage = (index: number): Message => ({
  id: `message-${index}`,
  author: index % 4 === 0 ? 'user' : 'assistant',
  text:
    index % 4 === 0
      ? `Can you check item ${index}?`
      : `Message ${index}: ${replies[Math.abs(index) % replies.length]}`,
})

const initialMessages = Array.from({ length: 45 }, (_, index) =>
  makeMessage(index),
)

@Component({
  selector: 'app-root',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="App">
      <div class="Toolbar">
        <div class="ToolbarGroup">
          <button type="button" (click)="prependHistory()">Load older</button>
          <button type="button" (click)="appendMessage()">Add message</button>
          <button type="button" (click)="streamReply()">Stream reply</button>
          <button type="button" (click)="virtualizer.scrollToEnd()">
            Latest
          </button>
        </div>
        <div class="Status">
          @if (loadingHistory()) {
            Loading history
          } @else if (virtualizer.isAtEnd(80)) {
            At latest
          } @else {
            Reading history
          }
        </div>
      </div>

      <div class="Shell">
        <div #scrollElement class="Messages" (scroll)="onScroll()">
          <div
            class="MessagesSizer"
            [style.height.px]="virtualizer.getTotalSize()"
          >
            @for (row of virtualizer.getVirtualItems(); track row.key) {
              <div
                #virtualItem
                class="MessageRow"
                [attr.data-index]="row.index"
                [style.transform]="'translateY(' + row.start + 'px)'"
              >
                <div
                  class="Bubble"
                  [class.Bubble-user]="messages()[row.index].author === 'user'"
                  [class.Bubble-assistant]="
                    messages()[row.index].author === 'assistant'
                  "
                >
                  <div class="Meta">{{ messages()[row.index].author }}</div>
                  {{ messages()[row.index].text || '...' }}
                </div>
              </div>
            }
          </div>
        </div>
      </div>
    </div>
  `,
})
export class AppComponent {
  readonly messages = signal(initialMessages)
  readonly loadingHistory = signal(false)

  readonly scrollElement =
    viewChild<ElementRef<HTMLDivElement>>('scrollElement')
  readonly virtualItems =
    viewChildren<ElementRef<HTMLDivElement>>('virtualItem')

  private firstMessageIndex = 0
  private nextMessageIndex = initialMessages.length
  private autoHistoryTimer: number | undefined
  private streamTimer: number | undefined
  private autoHistoryEnabled = false

  // Register before the virtualizer so item measurement runs before its
  // post-render scroll reconciliation, matching React refs before layout effects.
  private readonly measureItems = afterRenderEffect({
    mixedReadWrite: () => this.measureVirtualItems(),
  })

  readonly virtualizer = injectVirtualizer<HTMLDivElement, HTMLDivElement>(
    () => ({
      scrollElement: this.scrollElement(),
      count: this.messages().length,
      estimateSize: () => 74,
      getItemKey: (index) => this.messages()[index].id,
      anchorTo: 'end',
      followOnAppend: true,
      scrollEndThreshold: 80,
      overscan: 6,
      useApplicationRefTick: false,
    }),
  )

  private measureVirtualItems(): void {
    this.virtualItems().forEach((element) => {
      this.virtualizer.measureElement(element.nativeElement)
    })
  }

  constructor() {
    const destroyRef = inject(DestroyRef)

    afterNextRender(() => {
      this.virtualizer.scrollToEnd()
      this.autoHistoryTimer = window.setTimeout(() => {
        this.autoHistoryEnabled = true
      }, 250)
    })

    destroyRef.onDestroy(() => {
      if (this.autoHistoryTimer !== undefined) {
        window.clearTimeout(this.autoHistoryTimer)
      }
      if (this.streamTimer !== undefined) {
        window.clearInterval(this.streamTimer)
      }
    })
  }

  prependHistory(): void {
    if (this.loadingHistory() || this.firstMessageIndex <= -90) return

    this.loadingHistory.set(true)
    window.setTimeout(() => {
      const start = this.firstMessageIndex - 12
      this.firstMessageIndex = start
      this.messages.update((current) => [
        ...Array.from({ length: 12 }, (_, offset) =>
          makeMessage(start + offset),
        ),
        ...current,
      ])
      this.loadingHistory.set(false)
    }, 180)
  }

  appendMessage(): void {
    const next = this.nextMessageIndex
    this.nextMessageIndex += 1
    this.messages.update((current) => [...current, makeMessage(next)])
  }

  streamReply(): void {
    if (this.streamTimer !== undefined) return

    const id = `stream-${Date.now()}`
    const chunks = [
      'Thinking through the failure mode.',
      ' The list should follow only when it was already pinned.',
      ' Prepends should keep the reader anchored to the same message.',
      ' Streaming output should grow without drifting off the bottom.',
    ]
    let chunkIndex = 0

    this.messages.update((current) => [
      ...current,
      { id, author: 'assistant', text: '' },
    ])

    this.streamTimer = window.setInterval(() => {
      this.messages.update((current) =>
        current.map((message) =>
          message.id === id
            ? {
                ...message,
                text: chunks.slice(0, chunkIndex + 1).join(''),
              }
            : message,
        ),
      )

      chunkIndex += 1
      if (chunkIndex === chunks.length) {
        window.clearInterval(this.streamTimer)
        this.streamTimer = undefined
      }
    }, 280)
  }

  onScroll(): void {
    const scrollElement = this.scrollElement()?.nativeElement
    if (
      !scrollElement ||
      !this.autoHistoryEnabled ||
      this.virtualizer.isAtEnd(80)
    ) {
      return
    }

    if (scrollElement.scrollTop < 120) this.prependHistory()
  }
}
