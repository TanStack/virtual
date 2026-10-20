<div align="center">
  <picture>
    <source
      media="(prefers-color-scheme: dark)"
      srcset="https://tanstack.com/api/readme/virtual.png?framework=lit&theme=dark"
    />
    <source
      media="(prefers-color-scheme: light)"
      srcset="https://tanstack.com/api/readme/virtual.png?framework=lit"
    />
    <img
      src="https://tanstack.com/api/readme/virtual.png?framework=lit"
      alt="TanStack Lit Virtual"
      width="900"
    />
  </picture>
</div>
# @tanstack/lit-virtual

Efficiently virtualize only the visible DOM nodes within massive scrollable elements using Lit, while maintaining complete control over markup and styles.

## `VirtualizerController`

`@tanstack/lit-virtual` utilizes [Reactive Controllers](https://lit.dev/docs/composition/controllers/) to create the virtualizer and integrate it with the element lifecycle:

```ts
import { LitElement } from 'lit'
import { VirtualizerController } from '@tanstack/lit-virtual'
import { Ref, createRef } from 'lit/directives/ref.js'

class MyVirtualElement extends LitElement {
  private virtualizerController: VirtualizerController<HTMLDivElement, Element>
  private scrollElementRef: Ref<HTMLDivElement> = createRef()

  constructor() {
    super()
    this.virtualizerController = new VirtualizerController(this, {
      getScrollElement: () => this.scrollElementRef.value,
      count: 10000,
      estimateSize: () => 35,
      overscan: 5,
    })
  }

  render() {
    const virtualizer = this.virtualizerController.getVirtualizer()
    const virtualItems = virtualizer.getVirtualItems()

    return html`
      <div class="list scroll-container" ${ref(this.scrollElementRef)}>
        ${virtualItems.map(
          (item) => html`<div class="item">${item.index}</div>`,
        )}
      </div>
    `
  }
}
```

Note that a [Ref](https://lit.dev/docs/templates/directives/#ref) is attached to the scrolling container to allow the virtualizer to interact with it.

Options passed to the constructor are captured once. When a reactive property changes, merge the new values in `willUpdate` with `setOptions`. The same method exists on `WindowVirtualizerController`.

```ts
protected willUpdate(changed: PropertyValues<this>) {
  if (changed.has('count')) {
    this.virtualizerController.setOptions({ count: this.count })
  }
}
```

`setOptions` merges a partial update over the controller's current options and keeps the `onChange` wrapper that re-renders the host. `undefined` values are ignored. Use the controller method rather than `getVirtualizer().setOptions(...)`, which replaces options wholesale and drops that wrapper.

## `WindowVirtualizerController`

You can also create a virtualizer controller that attaches to the Window:

```ts
import { WindowVirtualizerController } from '@tanstack/lit-virtual'

class MyWindowVirtualElement extends LitElement {
  private windowVirtualizerController: WindowVirtualizerController

  constructor() {
    super()
    this.windowVirtualizerController = new WindowVirtualizerController(this, {
      count: this.data.length,
      estimateSize: () => 350,
      overscan: 5,
    })
  }

  // Implement render and other lifecycle methods as needed
}
```

For more examples and detailed usage, visit the [official documentation](https://tanstack.com/virtual/latest).
