import { Time } from '@story/shared';

export type TTimeTrigger = {
    id: string;
    /** Display name on the Visualizer timeline. */
    name: string;
    description: string;

    time: Time;
    condition: () => boolean;
    action: () => void;
};
