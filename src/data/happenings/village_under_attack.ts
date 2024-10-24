import { TimeRange } from "time/Time";
import { THappening } from "types/THappening";


export const village_under_attackHappening: THappening<'village_under_attack'> = {
    happeningId: 'village_under_attack',
    title: 'Village under attack',
    description: 'The village is under attack by bandits!',
    timeRange: TimeRange.fromDurationString('0.0 0:0', '2h'),
    location: 'village',
    childHappenings: []
}; 