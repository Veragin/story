import type { TItemId } from '@story/types';
import { displayText } from '../../../../api';
import { sampleSeed } from './sampleStory';

/**
 * Legacy lookup behind the old passage form's cost inputs. Reads the sample story
 * (`sampleStory.ts`), not `@story/data`; replaced by `api.listEntities('items')` in WP6.
 */
export class ItemResolver {
    static getItemsForSelect(): Array<{ value: TItemId; label: string; type: string }> {
        return sampleSeed.items.map((item) => ({
            value: item.id as TItemId,
            label: displayText(item.name, item.id),
            type: item.type,
        }));
    }

    static getToolsForSelect(): Array<{ value: TItemId; label: string }> {
        return this.getItemsForSelect()
            .filter((item) => item.type === 'tool')
            .map(({ value, label }) => ({ value, label }));
    }

    static formatItemType(type: string): string {
        return type.charAt(0).toUpperCase() + type.slice(1);
    }
}
