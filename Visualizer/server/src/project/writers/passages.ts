import path from 'node:path';
import type {
    TCreatePassageBody,
    TDeletePassageBody,
    TOkDto,
    TPassageDto,
    TPassageType,
    TUpdatePassageBody,
} from '@story/visualizer-protocol';
import { version as hash } from '../../events/version';
import { HttpError } from '../../http/HttpError';
import { removePassagePositions } from '../../json';
import { siblingPng } from '../images';
import { capitalize } from '@story/shared';
import { quote } from '../ast';
import { PASSAGE_FIELDS, PASSAGE_OPTIONAL, passageType, readPassage, readPassageFile } from '../readers/passages';
import { diagnosticsAsReferences, findStringReferences, passagesAddPassage, passagesRemovePassage } from '../registry';
import {
    assertId,
    chapterCharacterFiles,
    chapterFile,
    characterPassageUnionName,
    findPassageFile,
    passageSource,
} from '../story';
import { applyPartial } from '../values';
import { asBody, assertCurrentVersion, DERIVED_FIELDS, optionalText, type TWriter } from './common';

const PASSAGE_TYPES: TPassageType[] = ['screen', 'linear', 'transition'];

const isPassageType = (value: unknown): value is TPassageType => PASSAGE_TYPES.some((t) => t === value);

const PASSAGE_DERIVED = [
    ...DERIVED_FIELDS,
    'passageId',
    'chapterId',
    'characterId',
    'localId',
    'params',
    'preamble',
    'type',
];

export const newPassageText = (
    chapterId: string,
    characterId: string,
    localId: string,
    type: TPassageType,
    title: string
) => {
    const union = characterPassageUnionName(chapterId, characterId);
    const fields =
        type === 'screen'
            ? `    type: 'screen',\n    title: ${quote(title)},\n    image: '',\n\n    body: [],\n`
            : type === 'linear'
              ? `    type: 'linear',\n    description: ${quote(title)},\n`
              : // points at itself so it type-checks until the author retargets it
                `    type: 'transition',\n    nextPassageId: ${quote(`${chapterId}-${characterId}-${localId}`)},\n`;
    return `import { TPassage } from '@story/types';
import { ${union} } from '../${chapterId}.passages';

export const ${localId}Passage = (): TPassage<'${chapterId}', '${characterId}', ${union}> => ({
    chapterId: '${chapterId}',
    characterId: '${characterId}',
    id: '${localId}',

${fields}});
`;
};

export const createPassage = ({ sp, bus }: TWriter, chapterId: string, rawBody: TCreatePassageBody) =>
    sp.run(async (): Promise<TPassageDto> => {
        const body = asBody(rawBody);
        chapterFile(sp, chapterId);
        const characterId = assertId(body.characterId, 'characterId');
        const localId = assertId(body.localId, 'localId');
        const type = body.type;
        if (!isPassageType(type)) throw HttpError.badRequest(`Field "type" must be one of ${PASSAGE_TYPES.join(', ')}`);
        const title = optionalText(body, 'title') ?? capitalize(localId);
        if (!chapterCharacterFiles(sp, chapterId).has(characterId)) {
            throw HttpError.badRequest(
                `Character "${characterId}" is not in chapter "${chapterId}" — add the character to the chapter first`
            );
        }
        const passageId = `${chapterId}-${characterId}-${localId}`;
        try {
            findPassageFile(sp, passageId);
            throw HttpError.exists(`Passage "${passageId}" already exists`);
        } catch (e) {
            if (!(e instanceof HttpError) || e.status !== 404) throw e;
        }
        const file = path.join(sp.root.paths.characterPassagesDir(chapterId, characterId), `${localId}.ts`);
        const s = sp.session();
        s.apply(() => {
            s.create(file, newPassageText(chapterId, characterId, localId, type, title));
            passagesAddPassage(s, chapterId, characterId, passageId, file, `${localId}Passage`);
        });
        await s.commit(bus, (texts) => ({
            kind: 'passage',
            id: passageId,
            chapterId,
            version: versionOf(texts.get(file)),
            op: 'created',
        }));
        return readPassage(sp, passageId);
    });

const versionOf = (text: string | null | undefined) => (text ? hash(text) : null);

export const updatePassage = ({ sp, bus }: TWriter, passageId: string, rawBody: TUpdatePassageBody) =>
    sp.run(async (): Promise<TPassageDto> => {
        const body = asBody(rawBody);
        const sf = findPassageFile(sp, passageId);
        const current = readPassageFile(sp, sf);
        assertCurrentVersion(body, current);
        if (body.type !== undefined && body.type !== current.type) {
            throw HttpError.badRequest(`Field "type" is read-only (the passage is a ${current.type} passage)`);
        }
        const abs = sf.getFilePath();
        const s = sp.session();
        s.apply(() => {
            const file = s.edit(abs);
            const src = passageSource(file);
            if (!src) throw new Error(`${sp.root.rel(abs)}: no passage function returning an object`);
            const type = passageType(src) ?? 'screen';
            applyPartial(src.obj, body, PASSAGE_FIELDS[type], file, {
                skip: PASSAGE_DERIVED,
                optional: PASSAGE_OPTIONAL[type],
            });
        });
        await s.commit(
            bus,
            (texts) => ({
                kind: 'passage',
                id: passageId,
                chapterId: current.chapterId,
                version: hash(texts.get(abs) ?? sf.getFullText()),
                op: 'updated',
            }),
            { fields: { file: abs } }
        );
        return readPassage(sp, passageId);
    });

export const deletePassage = ({ sp, bus }: TWriter, passageId: string, rawBody: TDeletePassageBody) =>
    sp.run(async (): Promise<TOkDto> => {
        const body = asBody(rawBody);
        const sf = findPassageFile(sp, passageId);
        const current = readPassageFile(sp, sf);
        assertCurrentVersion(body, current);
        const abs = sf.getFilePath();
        const passagesFile = sp.root.paths.chapterPassagesFile(current.chapterId);
        const refs = findStringReferences(sp, new Set([passageId]), (f) => f === abs || f === passagesFile);
        if (refs.length > 0) throw HttpError.referenced(refs, `Passage "${passageId}" is still referenced`);
        const s = sp.session();
        s.apply(() => {
            s.delete(abs);
            passagesRemovePassage(s, current.chapterId, current.characterId, passageId, abs);
        });
        s.after((tx) => removePassagePositions(tx, current.chapterId, [passageId]));
        s.after((tx) => tx.deleteFile(siblingPng(abs)));
        await s.commit(
            bus,
            () => ({ kind: 'passage', id: passageId, chapterId: current.chapterId, version: null, op: 'deleted' }),
            { asReferences: (d) => diagnosticsAsReferences(sp, d) }
        );
        return { ok: true };
    });
