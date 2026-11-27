import type { TStoryModule } from '@story/core';
import type { TMentionNameOf } from '@story/shared';

const entryOf = <T>(entries: Readonly<Record<string, T>>, id: string): T | undefined =>
    Object.prototype.hasOwnProperty.call(entries, id) ? entries[id] : undefined;

export const mentionNameOf =
    ({ register, itemInfo }: Pick<TStoryModule, 'register' | 'itemInfo'>): TMentionNameOf =>
    (mentionClass, id) => {
        switch (mentionClass) {
            case 'character':
                return entryOf(register.characters, id)?.name;
            case 'npc':
                return entryOf(register.npcs, id)?.name;
            case 'location':
                return entryOf(register.locations, id)?.name;
            case 'item':
                return entryOf(itemInfo, id)?.name;
            case 'chapter':
                return entryOf(register.chapters, id)?.title;
            case 'passage':
                // passage titles exist only after a chapter's passages run
                return undefined;
        }
    };
