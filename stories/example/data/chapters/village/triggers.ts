import { Time } from '@story/shared';
import { TTimeTrigger } from '@story/types';

export const nobleHouseRobberyTrigger: TTimeTrigger = {
    id: 'nobleHouseRobbery',
    name: 'Noble house robbery',
    description: 'Noble house robbery',

    time: Time.fromString('1.12 0:0'),
    condition: () => {
        return true;
    },
    action: () => {},
};
