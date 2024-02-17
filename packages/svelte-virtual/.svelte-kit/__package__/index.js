import { elementScroll, observeElementOffset, observeElementRect, observeWindowOffset, observeWindowRect, Virtualizer, windowScroll, } from '@tanstack/virtual-core';
export * from '@tanstack/virtual-core';
import { derived, writable } from 'svelte/store';
function createVirtualizerBase(initialOptions) {
    const virtualizer = new Virtualizer(initialOptions);
    const originalSetOptions = virtualizer.setOptions;
    let virtualizerWritable;
    const setOptions = (options) => {
        const resolvedOptions = {
            ...virtualizer.options,
            ...options,
            onChange: options.onChange,
        };
        originalSetOptions({
            ...resolvedOptions,
            onChange: (instance, sync) => {
                virtualizerWritable.set(instance);
                resolvedOptions.onChange?.(instance, sync);
            },
        });
        virtualizer._willUpdate();
    };
    virtualizerWritable = writable(virtualizer, () => {
        setOptions(initialOptions);
        return virtualizer._didMount();
    });
    return derived(virtualizerWritable, (instance) => Object.assign(instance, { setOptions }));
}
export function createVirtualizer(options) {
    return createVirtualizerBase({
        observeElementRect: observeElementRect,
        observeElementOffset: observeElementOffset,
        scrollToFn: elementScroll,
        ...options,
    });
}
export function createWindowVirtualizer(options) {
    return createVirtualizerBase({
        getScrollElement: () => (typeof document !== 'undefined' ? window : null),
        observeElementRect: observeWindowRect,
        observeElementOffset: observeWindowOffset,
        scrollToFn: windowScroll,
        initialOffset: typeof document !== 'undefined' ? window.scrollY : undefined,
        ...options,
    });
}
