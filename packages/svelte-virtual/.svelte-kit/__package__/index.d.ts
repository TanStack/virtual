import { PartialKeys, Virtualizer, VirtualizerOptions } from '@tanstack/virtual-core';
export * from '@tanstack/virtual-core';
import { Readable } from 'svelte/store';
export type SvelteVirtualizer<TScrollElement extends Element | Window, TItemElement extends Element> = Omit<Virtualizer<TScrollElement, TItemElement>, 'setOptions'> & {
    setOptions: (options: Partial<VirtualizerOptions<TScrollElement, TItemElement>>) => void;
};
export declare function createVirtualizer<TScrollElement extends Element, TItemElement extends Element>(options: PartialKeys<VirtualizerOptions<TScrollElement, TItemElement>, 'observeElementRect' | 'observeElementOffset' | 'scrollToFn'>): Readable<SvelteVirtualizer<TScrollElement, TItemElement>>;
export declare function createWindowVirtualizer<TItemElement extends Element>(options: PartialKeys<VirtualizerOptions<Window, TItemElement>, 'getScrollElement' | 'observeElementRect' | 'observeElementOffset' | 'scrollToFn'>): Readable<SvelteVirtualizer<Window, TItemElement>>;
