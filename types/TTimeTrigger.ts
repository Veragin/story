import { Time } from '@story/shared';

export type TTimeTrigger = {
    id: string;
    description: string;

    time: Time;
    condition: () => boolean;
    action: () => void;
};
