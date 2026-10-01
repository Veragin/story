export type TToastVariant = 'default' | 'error' | 'success' | 'warning' | 'info';

export type TToastOptions = {
    variant?: TToastVariant;
};

export type TToastHandler = (message: string, options?: TToastOptions) => void;

let handler: TToastHandler = () => {};

/** Registers the UI's toast renderer; until then `showToast` is a no-op (headless hosts). */
export const setToastHandler = (newHandler: TToastHandler) => {
    handler = newHandler;
};

export const showToast: TToastHandler = (message, options) => handler(message, options);
