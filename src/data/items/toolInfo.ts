export const toolInfo = {
    axe: {
        name: 'Axe',
        type: 'tool',
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
