import { act } from 'react';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

export const $ = <T extends Element = HTMLElement>(selector: string) =>
    document.querySelector<T & HTMLElement>(selector);

// React tracks the value itself: set it through the native setter, then fire `input`
export const typeInto = (el: HTMLTextAreaElement, value: string) => {
    const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), 'value')?.set;
    act(() => {
        setter?.call(el, value);
        el.dispatchEvent(new Event('input', { bubbles: true }));
    });
};
