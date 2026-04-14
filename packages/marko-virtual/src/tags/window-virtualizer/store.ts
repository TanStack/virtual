import type { Virtualizer } from "@tanstack/virtual-core"

interface Entry {
  v: Virtualizer<Window, Element>
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