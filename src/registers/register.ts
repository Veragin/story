import startPassage from '../passages/start';

const register1 = {
    start: startPassage,
} as const;

export type TRegisterPassage = keyof typeof register1;
