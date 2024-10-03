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

// test
Object.values(foodInfo).forEach((item: TItemInfo) => void item);
