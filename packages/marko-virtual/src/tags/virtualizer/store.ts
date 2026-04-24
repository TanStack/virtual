import type { Virtualizer } from '@tanstack/virtual-core'

// Instance storage lives in a plain .ts file to avoid Marko LS misparses
// of Map<K, V>() constructor calls in static declarations.
interface Entry {
  v: Virtualizer<Element, Element>
  cleanup: () => void
}

const store = new Map<string, Entry>()

export function setInstance(id: string, entry: Entry): void {
  store.set(id, entry)
}

export function getInstance(id: string): Entry | undefined {
  return store.get(id)
}

export function deleteInstance(id: string): void {
  store.delete(id)
}
