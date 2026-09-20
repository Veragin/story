let lastUniqueId = 1;
export const getUniqueId = () => lastUniqueId++;
export const getUniqueClassName = (name: string) => `${name}-${getUniqueId()}`;

export const capitalize = (str: string) => str.charAt(0).toUpperCase() + str.slice(1);

export const range = (n: number) => new Array(n).fill(0).map((_, i) => i);

export type TFlavor<T, Flavor> = { _flavor?: Flavor } & T;

export const roundToDec = (value: number, dec: number) => Math.round(value * 10 ** dec) / 10 ** dec;
