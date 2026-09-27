import type { TCharacterId, TNpcId } from '@story/types';

/**
 * Story art, found by convention: **an image is the `.png` next to the `.ts` file that defines
 * its owner, with the same basename.** No import to add, no registry to edit, and the story's
 * own `image` fields are free to hold a text description of the art instead of a key.
 *
 *  - passage `data/chapters/kingdom/annie.passages/palace.ts` → `…/annie.passages/palace.png`
 *    (`visit.screen.ts` → `visit.screen.png`: the first dot-segment is the passage's local id)
 *  - character `data/characters/thomas.ts` → `data/characters/thomas.png`
 *  - npc `data/npcs/Franta.ts` → `data/npcs/Franta.png` (npc files are named after the export)
 *
 * The files go through the bundler (`import.meta.glob`), so they get hashed, cache-busted URLs
 * and a missing one simply means "no image" (`undefined`), never a 404.
 */
const files = import.meta.glob('../../data/**/*.png', {
    eager: true,
    query: '?url',
    import: 'default',
}) as Record<string, string>;

/**
 * Every image under `data/`, keyed by its path relative to `data/` up to the first `.` of the
 * file name: `chapters/village/thomas.passages/intro`, `characters/thomas`, `npcs/franta`. The
 * last segment is lower-cased at its first letter, the way ids relate to npc file names.
 */
const images: Record<string, string> = Object.fromEntries(
    Object.entries(files).map(([path, url]) => {
        const rel = path.replace(/^(\.\.\/)+data\//, '');
        const slash = rel.lastIndexOf('/');
        const base = rel.slice(slash + 1).split('.')[0];
        return [`${rel.slice(0, slash + 1)}${lowerFirst(base)}`, url];
    })
);

function lowerFirst(s: string) {
    return s.charAt(0).toLowerCase() + s.slice(1);
}

/** The image of a passage (`<chapter>/<character>.passages/<id>.png`), if the story has one. */
export const passageImage = (passage: { chapterId: string; characterId: string; id: string }): string | undefined =>
    images[`chapters/${passage.chapterId}/${passage.characterId}.passages/${lowerFirst(passage.id)}`];

/** The portrait of a playable character (`data/characters/<id>.png`), if the story has one. */
export const characterImage = (id: TCharacterId): string | undefined => images[`characters/${lowerFirst(id)}`];

/** The portrait of an npc (`data/npcs/<Id>.png`), if the story has one. */
export const npcImage = (id: TNpcId): string | undefined => images[`npcs/${lowerFirst(id)}`];
