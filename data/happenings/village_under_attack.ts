import { TimeRange } from '@story/shared';
import { THappening } from '@story/types';

export const villageUnderAttackHappening: THappening<'village_under_attack'> = {
    happeningId: 'village_under_attack',
    title: 'Village under attack',
    description: 'The village is under attack by bandits!',
    timeRange: TimeRange.fromDurationString('0.0 0:0', '2h'),
    location: 'village',

    childHappenings: [],

    init: {},
};
