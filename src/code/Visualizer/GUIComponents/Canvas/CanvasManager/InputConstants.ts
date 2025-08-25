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

export enum KeyCode {
    EQUAL = 'Equal',
    NUMPAD_ADD = 'NumpadAdd',
    KEY_Z = 'KeyZ',
    MINUS = 'Minus',
    NUMPAD_SUBTRACT = 'NumpadSubtract',
    KEY_X = 'KeyX',
    NUMPAD_5 = 'Numpad5',
    NUMPAD_0 = 'Numpad0',
    ARROW_UP = "ARROW_UP",
    KEY_W = "KEY_W",
    NUMPAD_8 = "NUMPAD_8",
    NUMPAD_2 = "NUMPAD_2",
    KEY_S = "KEY_S",
    ARROW_DOWN = "ARROW_DOWN",
    ARROW_LEFT = "ARROW_LEFT",
    ARROW_RIGHT = "ARROW_RIGHT",
    KEY_D = "KEY_D",
    KEY_A = "KEY_A",
    NUMPAD_4 = "NUMPAD_4",
    NUMPAD_6 = "NUMPAD_6",
    KEY_R = "KEY_R",
    HOME = "HOME",
    ESCAPE = "ESCAPE"
}
