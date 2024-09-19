export const foodInfo = {
    berries: {
        name: 'Berries',
        type: 'food',
        hungerValue: 5,
    },
} as const;

type TItemInfo = {
    name: string;
    type: 'food';
    hungerValue: number;
};

const test = (item: TItemInfo) => {
    void item;
};
Object.values(foodInfo).forEach(test);
