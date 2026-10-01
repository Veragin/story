export function assert(value: boolean, msg: string): asserts value {
    if (!value) {
        console.error('Assert', msg);

        throw new Error(msg);
    }
}

export function assertNotNullish<T>(value: T, msg: string = 'Value is nullish'): asserts value is NonNullable<T> {
    assert(!isNullish(value), msg);
}

export const isNullish = <T>(value: T | undefined | null): value is undefined | null =>
    value === null || value === undefined;

export const isOneOf = <T extends readonly unknown[]>(value: unknown, array: T): value is T[number] =>
    array.includes(value);
