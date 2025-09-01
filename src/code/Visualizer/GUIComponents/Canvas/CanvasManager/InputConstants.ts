// Constants for mouse buttons and key codes

export const MouseButton = {
    LEFT: 0,
    MIDDLE: 1,
    RIGHT: 2
} as const;

export type MouseButtonType = typeof MouseButton[keyof typeof MouseButton];

export type KeyCodeType = string; // e.g., 'KeyA', 'ArrowLeft', etc.

// Validation function (can be extended to filter specific keys if needed)
export function isValidKeyCode(key: string): boolean {
    return Object.values(KeyCode).includes(key as KeyCode);
}

export function validateKeyCode(key: string): void {
    if (!isValidKeyCode(key))
        throw new Error(`Invalid key code: ${key}`);
}

export enum KeyCode {
    EQUAL = 'Equal',
    NUMPAD_ADD = 'NumpadAdd',
    KEY_Z = 'KeyZ',
    MINUS = 'Minus',
    NUMPAD_SUBTRACT = 'NumpadSubtract',
    KEY_X = 'KeyX',
    NUMPAD_5 = 'Numpad5',
    NUMPAD_0 = 'Numpad0',
    ARROW_UP = "ArrowUp",
    KEY_W = "KeyW",
    NUMPAD_8 = "Numpad8",
    NUMPAD_2 = "Numpad2",
    KEY_S = "KeyS",
    ARROW_DOWN = "ArrowDown",
    ARROW_LEFT = "ArrowLeft",
    ARROW_RIGHT = "ArrowRight",
    KEY_D = "KeyD",
    KEY_A = "KeyA",
    NUMPAD_4 = "Numpad4",
    NUMPAD_6 = "Numpad6",
    KEY_R = "KeyR",
    HOME = "Home",
    ESCAPE = "Escape",
    Numpad0 = "Numpad0",
    KEY0 = "Key0"
}
