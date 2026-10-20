import {
  Virtualizer,
  elementScroll,
  observeElementOffset,
  observeElementRect,
  observeWindowOffset,
  observeWindowRect,
  windowScroll,
} from '@tanstack/virtual-core'
import type { ReactiveController, ReactiveControllerHost } from 'lit'
import type { PartialKeys, VirtualizerOptions } from '@tanstack/virtual-core'

export * from '@tanstack/virtual-core'

class VirtualizerControllerBase<
  TScrollElement extends Element | Window,
  TItemElement extends Element,
> implements ReactiveController {
  host: ReactiveControllerHost

  private readonly virtualizer: Virtualizer<TScrollElement, TItemElement>

  private options: VirtualizerOptions<TScrollElement, TItemElement>

  private cleanup: () => void = () => {}

  /**
   * True between `hostUpdate` and `hostUpdated`. `willUpdate` runs in that
   * window, before render, so applying options there is already part of the
   * current update.
   */
  private hostIsUpdating = false

  constructor(
    host: ReactiveControllerHost,
    options: VirtualizerOptions<TScrollElement, TItemElement>,
  ) {
    this.host = host
    this.options = { ...options }
    this.virtualizer = new Virtualizer(this.resolveOptions(this.options))
    this.host.addController(this)
  }

  public getVirtualizer() {
    return this.virtualizer
  }

  /**
   * Merge a partial options update into the options this controller already
   * holds, push them to the virtualizer, and re-render the host when this is
   * called outside an update.
   *
   * Keys set to `undefined` are ignored, matching core `setOptions`, so a
   * partial update cannot wipe an option stored earlier. Defaults supplied by
   * `VirtualizerController` / `WindowVirtualizerController` stay in place
   * unless a later call replaces them.
   */
  public setOptions(
    options: Partial<VirtualizerOptions<TScrollElement, TItemElement>>,
  ) {
    if (!this.applyOptions(options)) return

    this.virtualizer.setOptions(this.resolveOptions(this.options))
    this.virtualizer._willUpdate()

    if (!this.hostIsUpdating) {
      this.host.requestUpdate()
    }
  }

  hostUpdate() {
    this.hostIsUpdating = true
  }

  hostConnected() {
    this.cleanup = this.virtualizer._didMount()
  }

  hostUpdated() {
    this.hostIsUpdating = false
    this.virtualizer._willUpdate()
  }

  hostDisconnected() {
    this.cleanup()
  }

  private applyOptions(
    partial: Partial<VirtualizerOptions<TScrollElement, TItemElement>>,
  ): boolean {
    const next: VirtualizerOptions<TScrollElement, TItemElement> = {
      ...this.options,
    }
    let changed = false

    for (const key in partial) {
      if (!Object.prototype.hasOwnProperty.call(partial, key)) continue

      const value = partial[key as keyof typeof partial]
      if (value === undefined) continue

      if (!Object.is(next[key as keyof typeof next], value)) {
        changed = true
        Object.assign(next, { [key]: value })
      }
    }

    if (changed) this.options = next
    return changed
  }

  private resolveOptions(
    options: VirtualizerOptions<TScrollElement, TItemElement>,
  ): VirtualizerOptions<TScrollElement, TItemElement> {
    return {
      ...options,
      onChange: (instance, sync) => {
        this.host.updateComplete.then(() => this.host.requestUpdate())
        options.onChange?.(instance, sync)
      },
    }
  }
}

export class VirtualizerController<
  TScrollElement extends Element,
  TItemElement extends Element,
> extends VirtualizerControllerBase<TScrollElement, TItemElement> {
  constructor(
    host: ReactiveControllerHost,
    options: PartialKeys<
      VirtualizerOptions<TScrollElement, TItemElement>,
      'observeElementRect' | 'observeElementOffset' | 'scrollToFn'
    >,
  ) {
    super(host, {
      observeElementRect: observeElementRect,
      observeElementOffset: observeElementOffset,
      scrollToFn: elementScroll,
      ...options,
    })
  }
}

export class WindowVirtualizerController<
  TItemElement extends Element,
> extends VirtualizerControllerBase<Window, TItemElement> {
  constructor(
    host: ReactiveControllerHost,
    options: PartialKeys<
      VirtualizerOptions<Window, TItemElement>,
      | 'getScrollElement'
      | 'observeElementRect'
      | 'observeElementOffset'
      | 'scrollToFn'
    >,
  ) {
    super(host, {
      getScrollElement: () => (typeof document !== 'undefined' ? window : null),
      observeElementRect: observeWindowRect,
      observeElementOffset: observeWindowOffset,
      scrollToFn: windowScroll,
      initialOffset: () =>
        typeof document !== 'undefined' ? window.scrollY : 0,
      ...options,
    })
  }
}
