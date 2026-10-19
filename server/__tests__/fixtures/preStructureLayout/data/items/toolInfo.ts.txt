export const toolInfo = {
    axe: {
        name: 'Axe',
        type: 'tool',
        dmg: 10,
    },
} as const;

type TItemInfo = {
    name: string;
    type: 'tool';
};
// test
Object.values(toolInfo).forEach((item: TItemInfo) => void item);
