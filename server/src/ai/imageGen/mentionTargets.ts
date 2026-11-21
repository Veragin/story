import { isHttpError } from '../../common/HttpError';
import { getProp, stringProp } from '../../project/ast';
import { readImageFile, readStoryImageFile } from '../../project/images';
import { readProjectChapter } from '../../project/readers/chapters';
import { entitySources, itemNodes } from '../../project/readers/entities';
import type { SourceProject } from '../../project/SourceProject';
import { chapterIds, displayName, findPassageFile, passageSource } from '../../project/story';
import {
    imageSourceOf,
    mentionKey,
    type TImageOwnerRef,
    type TImageSource,
    type TMentionRef,
    type TMentionTarget,
} from './imagePrompt';

type TFoundMention = { name: string; source: TImageSource };

const NOT_FOUND_STATUS = 404;

const isNotFound = (e: unknown) => isHttpError(e) && e.status === NOT_FOUND_STATUS;

const entityName = (sp: SourceProject, kind: 'characters' | 'npcs' | 'locations', id: string) => {
    const entity = entitySources(sp, kind).find((source) => source.id === id);
    return entity && displayName(getProp(entity.obj, 'name')?.getInitializer(), id);
};

const findEntity = (
    sp: SourceProject,
    kind: 'characters' | 'npcs' | 'locations',
    mention: TMentionRef,
    imageOwner: TImageOwnerRef
): TFoundMention | undefined => {
    const name = entityName(sp, kind, mention.id);
    return name === undefined ? undefined : { name, source: imageSourceOf(mention, imageOwner) };
};

const passageFileOrUndefined = (sp: SourceProject, passageId: string) => {
    try {
        return findPassageFile(sp, passageId);
    } catch (e) {
        if (isNotFound(e)) return undefined;
        throw e;
    }
};

const findPassage = (
    sp: SourceProject,
    mention: TMentionRef,
    imageOwner: TImageOwnerRef
): TFoundMention | undefined => {
    const sf = passageFileOrUndefined(sp, mention.id);
    if (!sf) return undefined;
    const src = passageSource(sf);
    const name = displayName(src && getProp(src.obj, 'title')?.getInitializer(), mention.id);
    const passage = { file: sp.root.rel(sf.getFilePath()), image: stringProp(src?.obj, 'image') ?? '' };
    return { name, source: imageSourceOf(mention, imageOwner, passage) };
};

const findItem = (sp: SourceProject, id: string): TFoundMention | undefined => {
    const item = itemNodes(sp).find((node) => node.id === id);
    return item && { name: displayName(getProp(item.item, 'name')?.getInitializer(), id), source: null };
};

const findChapter = (sp: SourceProject, id: string): TFoundMention | undefined => {
    const chapter = chapterIds(sp).includes(id) ? readProjectChapter(sp, id) : undefined;
    return chapter && { name: chapter.name, source: null };
};

const findMention = (sp: SourceProject, mention: TMentionRef, imageOwner: TImageOwnerRef) => {
    switch (mention.mentionClass) {
        case 'character':
            return findEntity(sp, 'characters', mention, imageOwner);
        case 'npc':
            return findEntity(sp, 'npcs', mention, imageOwner);
        case 'location':
            return findEntity(sp, 'locations', mention, imageOwner);
        case 'passage':
            return findPassage(sp, mention, imageOwner);
        case 'item':
            return findItem(sp, mention.id);
        case 'chapter':
            return findChapter(sp, mention.id);
    }
};

const readOwnImage = async (sp: SourceProject, source: Extract<TImageSource, { kind: 'owner' }>) => {
    try {
        return (await readImageFile(sp, source.owner, source.id)).bytes;
    } catch (e) {
        if (isNotFound(e)) return null;
        throw e;
    }
};

const readSource = (sp: SourceProject, source: TImageSource): Promise<Buffer | null> | null => {
    if (source === null) return null;
    return source.kind === 'file' ? readStoryImageFile(sp, source.path) : readOwnImage(sp, source);
};

// only this story's files; unknown mentions are left out
export const readMentionTargets = async (
    sp: SourceProject,
    imageOwner: TImageOwnerRef,
    mentions: readonly TMentionRef[]
): Promise<Map<string, TMentionTarget<Buffer>>> => {
    const found = await sp.run(() =>
        mentions.flatMap((mention) => {
            const target = findMention(sp, mention, imageOwner);
            return target ? [{ key: mentionKey(mention), ...target }] : [];
        })
    );
    const targets = new Map<string, TMentionTarget<Buffer>>();
    for (const { key, name, source } of found) targets.set(key, { name, image: await readSource(sp, source) });
    return targets;
};
