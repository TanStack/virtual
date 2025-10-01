---
'@tanstack/lit-virtual': patch
---

fix(lit-virtual): create Virtualizer instance before hostConnected

When creating an instance of the reactive controller in `connectedCallback`, calling `addController` will synchronously call `hostConnected` on the controller. This means that `this.virtualizer` will still be `undefined`.
