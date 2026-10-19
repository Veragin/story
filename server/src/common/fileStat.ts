import type { Stats } from 'node:fs';
import { lstat } from 'node:fs/promises';

export const lstatOrNull = (file: string): Promise<Stats | null> => lstat(file).catch(() => null);

export const exists = async (file: string): Promise<boolean> => (await lstatOrNull(file)) !== null;
