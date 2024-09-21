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

const test = (item: TItemInfo) => {
    void item;
};
Object.values(toolInfo).forEach(test);
