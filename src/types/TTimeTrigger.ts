import { Time } from 'time/Time';

export type TTimeTrigger = {
    id: string;
    description: string;

    time: Time;
    condition: () => boolean;
    action: () => void;
};
