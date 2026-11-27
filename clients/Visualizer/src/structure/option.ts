export type TOption = { id: string; label?: string };

export const optionsOf = (ids: readonly string[]): TOption[] => ids.map((id) => ({ id }));
