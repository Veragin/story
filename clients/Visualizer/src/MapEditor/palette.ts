import type { TMapDocument } from './types';

type TPalette = TMapDocument['palette'];

const normalizeName = (name: string) => name.trim().toLowerCase();

export const isPaletteNameTaken = (palette: TPalette, name: string, exceptId?: string): boolean =>
    Object.entries(palette).some(([id, entry]) => id !== exceptId && normalizeName(entry.name) === normalizeName(name));

export const createColorId = (palette: TPalette, name: string): string => {
    const base =
        normalizeName(name)
            .replace(/[^a-z0-9]+/g, '_')
            .replace(/^_+|_+$/g, '') || 'tile';
    let id = base;
    for (let n = 2; id in palette; n++) id = `${base}_${n}`;
    return id;
};
