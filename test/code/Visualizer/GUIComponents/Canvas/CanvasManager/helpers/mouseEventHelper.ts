// --- Helper functions ---
export function createMouseEvent(type: string, options: { offsetX?: number, offsetY?: number, button?: number } = {}): MouseEvent {
    const event = new MouseEvent(type);
    Object.defineProperty(event, 'offsetX', { value: options.offsetX || 0, writable: false });
    Object.defineProperty(event, 'offsetY', { value: options.offsetY || 0, writable: false });
    Object.defineProperty(event, 'button', { value: options.button || 0, writable: false });
    return event;
}
