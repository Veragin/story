import type { TCharacterId, TNpcId } from '@story/types';

// keyed like ids: npc files are named after their PascalCase export
const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

let images: Record<string, string> = {};

export const setStoryImages = (files: Record<string, string>) => {
    images = Object.fromEntries(
        Object.entries(files).map(([rel, url]) => {
            const slash = rel.lastIndexOf('/');
            const base = rel.slice(slash + 1).split('.')[0];
            return [`${rel.slice(0, slash + 1)}${lowerFirst(base)}`, url];
        })
    );
};

export const storyIcon = (): string | undefined => images['assets/story'];

export const passageImage = (passage: { chapterId: string; characterId: string; id: string }): string | undefined =>
    images[`chapters/${passage.chapterId}/${passage.characterId}.passages/${lowerFirst(passage.id)}`];

export const characterImage = (id: TCharacterId): string | undefined => images[`characters/${lowerFirst(id)}`];

export const npcImage = (id: TNpcId): string | undefined => images[`npcs/${lowerFirst(id)}`];
