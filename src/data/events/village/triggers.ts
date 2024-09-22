import { Time } from 'code/time/Time';
import { TTimeTrigger } from 'types/TTimeTrigger';

export const nobleHouseRobberyTrigger: TTimeTrigger = {
    id: 'nobleHouseRobbery',
    description: 'Noble house robbery',

    time: Time.fromString('1.12 0:0'),
    condition: () => {
        return true;
    },
    action: () => {},
};
