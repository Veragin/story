export type TInventoryItem = { id: string; name: string; amount: number };

export type TItemDetail = { key: string; label: string };

export type TItemGroup<I extends TInventoryItem> = { type: string | undefined; items: I[] };

// item types are story-defined: known ones come first, the rest alphabetically, untyped items last
const TYPE_ORDER = ['weapon', 'tool', 'food', 'resource', 'value'];

const BASE_KEYS = new Set(['id', 'name', 'type', 'amount']);

export const itemType = (item: TInventoryItem): string | undefined =>
    'type' in item && typeof item.type === 'string' ? item.type : undefined;

const humanize = (key: string) => {
    const words = key.replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase();
    return words.charAt(0).toUpperCase() + words.slice(1);
};

const detailLabel = (key: string, value: unknown): string | null => {
    if (value === true) return humanize(key);
    if (typeof value === 'number' || (typeof value === 'string' && value !== '')) return `${humanize(key)}: ${value}`;
    return null;
};

export const itemDetails = (item: TInventoryItem): TItemDetail[] =>
    Object.entries(item)
        .filter(([key]) => !BASE_KEYS.has(key))
        .flatMap(([key, value]) => {
            const label = detailLabel(key, value);
            return label === null ? [] : [{ key, label }];
        });

const typeRank = (type: string | undefined) => {
    if (type === undefined) return TYPE_ORDER.length + 1;
    const known = TYPE_ORDER.indexOf(type);
    return known === -1 ? TYPE_ORDER.length : known;
};

const compareTypes = (a: string | undefined, b: string | undefined) =>
    typeRank(a) - typeRank(b) || (a ?? '').localeCompare(b ?? '');

export const groupItemsByType = <I extends TInventoryItem>(items: readonly I[]): TItemGroup<I>[] => {
    const groups = new Map<string | undefined, I[]>();
    items.forEach((item) => {
        const type = itemType(item);
        groups.set(type, [...(groups.get(type) ?? []), item]);
    });
    return [...groups.entries()]
        .sort(([a], [b]) => compareTypes(a, b))
        .map(([type, grouped]) => ({ type, items: grouped.sort((a, b) => a.name.localeCompare(b.name)) }));
};

export const typeLabel = (type: string | undefined) => (type === undefined ? _('Other') : humanize(type));
