import type { TImageOwner } from '@story/protocol';
import {
    describeMentions,
    dirName,
    formatMention,
    imageLinkPath,
    isStoryImageFile,
    parseMentions,
    resolvePath,
    type TMentionClass,
} from '@story/shared';
import { HttpError } from '../../common/HttpError';
import { syntaxDiagnostic } from '../../project/validate';

export type TImageOwnerKind = Exclude<TImageOwner, 'story'>;

export type TImageOwnerRef = { owner: TImageOwnerKind; id: string };

export type TMentionRef = { mentionClass: TMentionClass; id: string };

// an owner's own image, a story file a passage links, or none
export type TImageSource =
    | { kind: 'owner'; owner: TImageOwnerKind; id: string }
    | { kind: 'file'; path: string }
    | null;

// `file`: the passage's story-relative `.ts`; `image`: its saved description
export type TPassageImage = { file: string; image: string };

export type TMentionTarget<TImage> = { name: string; image: TImage | null };

export type TPromptReference<TImage> = { label: string; image: TImage };

export type TImagePrompt<TImage> = { prompt: string; references: TPromptReference<TImage>[] };

export type TImagePromptInput<TImage> = {
    prompt: string;
    owner: TImageOwnerKind;
    targets: ReadonlyMap<string, TMentionTarget<TImage>>;
    maxReferences: number;
};

const MENTION_OWNERS: Readonly<Partial<Record<TMentionClass, TImageOwnerKind>>> = {
    character: 'characters',
    npc: 'npcs',
    location: 'locations',
    passage: 'passages',
};

const REFERENCE_WORDING: Readonly<Record<TMentionClass, { noun: string; their: string }>> = {
    character: { noun: 'a character', their: 'their' },
    npc: { noun: 'a character', their: 'their' },
    location: { noun: 'a location', their: 'its' },
    passage: { noun: 'a scene', their: 'its' },
    item: { noun: 'an item', their: 'its' },
    chapter: { noun: 'a chapter', their: 'its' },
};

const STYLE_LINES: Readonly<Record<TImageOwnerKind, string>> = {
    passages: 'Style: a square illustration of this scene of the story, no text or lettering.',
    characters: 'Style: a square portrait of this character, no text or lettering.',
    npcs: 'Style: a square portrait of this character, no text or lettering.',
    locations: 'Style: a square illustration of this place, no text or lettering.',
};

export const mentionKey = ({ mentionClass, id }: TMentionRef) => formatMention(mentionClass, id);

export const uniqueMentions = (prompt: string): TMentionRef[] => {
    const unique = new Map<string, TMentionRef>();
    for (const { mentionClass, id } of parseMentions(prompt))
        unique.set(formatMention(mentionClass, id), { mentionClass, id });
    return [...unique.values()];
};

const linkedImage = ({ file, image }: TPassageImage): TImageSource | undefined => {
    const link = imageLinkPath(image);
    if (link === undefined) return undefined;
    const target = resolvePath(dirName(file), link);
    return target !== undefined && isStoryImageFile(target) ? { kind: 'file', path: target } : null;
};

// the owner itself keeps its own current image, whatever link its saved description holds
export const imageSourceOf = (
    { mentionClass, id }: TMentionRef,
    imageOwner: TImageOwnerRef,
    passage?: TPassageImage
): TImageSource => {
    const owner = MENTION_OWNERS[mentionClass];
    if (owner === undefined) return null;
    const isOwnerItself = owner === imageOwner.owner && id === imageOwner.id;
    const linked = passage && !isOwnerItself ? linkedImage(passage) : undefined;
    return linked === undefined ? { kind: 'owner', owner, id } : linked;
};

export const invalidPrompt = (message: string) => HttpError.invalid([syntaxDiagnostic('', message, 'prompt')], message);

const referenceLine = (index: number, name: string, mentionClass: TMentionClass) => {
    const { noun, their } = REFERENCE_WORDING[mentionClass];
    return `Image ${index} is ${name}, ${noun}. Keep ${their} look.`;
};

export const buildImagePrompt = <TImage>({
    prompt,
    owner,
    targets,
    maxReferences,
}: TImagePromptInput<TImage>): TImagePrompt<TImage> => {
    const referenced: { mention: TMentionRef; name: string; image: TImage }[] = [];
    for (const mention of uniqueMentions(prompt)) {
        const target = targets.get(mentionKey(mention));
        if (!target) throw invalidPrompt(`Unknown mention ${mentionKey(mention)}: no such ${mention.mentionClass}`);
        if (target.image !== null) referenced.push({ mention, name: target.name, image: target.image });
    }
    if (referenced.length > maxReferences) {
        throw invalidPrompt(
            `The description mentions ${referenced.length} images, at most ${maxReferences} referenced images are allowed`
        );
    }
    const text = describeMentions(prompt, (mentionClass, id) => targets.get(mentionKey({ mentionClass, id }))?.name);
    const lines = referenced.map(({ mention, name }, i) => referenceLine(i + 1, name, mention.mentionClass));
    return {
        prompt: [text.trim(), lines.join('\n'), STYLE_LINES[owner]].filter((part) => part !== '').join('\n\n'),
        references: referenced.map(({ name, image }) => ({ label: name, image })),
    };
};
