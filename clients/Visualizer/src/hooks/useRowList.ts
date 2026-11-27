import { useRef } from 'react';

export type TRowList<T> = {
    keys: readonly number[];
    set: (index: number, item: T) => void;
    add: (item: T) => void;
    move: (from: number, to: number) => void;
    remove: (index: number) => void;
};

export const useRowList = <T>(items: readonly T[], onChange: (items: T[]) => void): TRowList<T> => {
    const next = useRef(0);
    const keys = useRef<number[]>([]);
    const fresh = () => next.current++;
    if (keys.current.length !== items.length) {
        keys.current = Array.from({ length: items.length }, (_item, i) => keys.current[i] ?? fresh());
    }
    const swap = <U>(list: readonly U[], a: number, b: number) => {
        const swapped = [...list];
        [swapped[a], swapped[b]] = [swapped[b], swapped[a]];
        return swapped;
    };
    return {
        keys: keys.current,
        set: (index, item) => onChange(items.map((old, i) => (i === index ? item : old))),
        add: (item) => {
            keys.current = [...keys.current, fresh()];
            onChange([...items, item]);
        },
        move: (from, to) => {
            keys.current = swap(keys.current, from, to);
            onChange(swap(items, from, to));
        },
        remove: (index) => {
            keys.current = keys.current.filter((_key, i) => i !== index);
            onChange(items.filter((_item, i) => i !== index));
        },
    };
};
