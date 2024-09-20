import { Time } from 'code/time/Time';

export type TTimeTrigger = {
    id: string;
    description: string;

    time: Time;
    condition: () => boolean;
    trigger: () => void;
};
