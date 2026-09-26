import type { TLocationId } from '@story/types';
import { displayText } from '../../../../api';
import { sampleSeed } from './sampleStory';

type TLocationInfo = { id: TLocationId; name: string; description: string };

/**
 * Legacy lookup behind the old chapter form's location picker. Reads the sample story
 * (`sampleStory.ts`), not `@story/data`; replaced by `api.getProject()` in WP5 / WP6.
 */
export class LocationResolver {
    static getAllLocations(): TLocationInfo[] {
        return sampleSeed.locations.map((l) => ({
            id: l.id as TLocationId,
            name: displayText(l.name, l.id),
            description: displayText(l.description, ''),
        }));
    }
}
