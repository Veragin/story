import path from 'node:path';
import type { TDiagnosticDto, TSourceDto, TSourceOwner, TUpdateSourceBody } from '@story/visualizer-protocol';
import { ts } from 'ts-morph';
import { version } from '../../events/version';
import { HttpError } from '../../http/HttpError';
import { chapterVersion } from '../readers/chapters';
import type { SourceProject } from '../SourceProject';
import { chapterFile, findPassageFile, parsePassageId } from '../story';
import { parseSource } from '../validate';
import { asBody, assertCurrentVersion, type TWriter } from './common';

const fileOf = (sp: SourceProject, owner: TSourceOwner, id: string): string => {
    const abs = owner === 'chapter' ? chapterFile(sp, id).getFilePath() : findPassageFile(sp, id).getFilePath();
    assertEditable(sp, abs);
    return abs;
};

const assertEditable = (sp: SourceProject, abs: string) => {
    const { dataDir } = sp.root;
    const inData = abs.startsWith(dataDir + path.sep);
    if (!inData || !abs.endsWith('.ts') || !sp.isStoryFile(abs)) {
        throw HttpError.notFound(`${sp.root.rel(abs)} cannot be edited`);
    }
};

const toDto = (sp: SourceProject, abs: string): TSourceDto => {
    const text = sp.text(abs);
    if (text === null) throw HttpError.notFound(`No file ${sp.root.rel(abs)}`);
    return { file: sp.root.rel(abs), text, version: version(text) };
};

// Positioned, unlike the prettier message `commit` would report.
const syntaxErrors = (file: string, text: string): TDiagnosticDto[] => {
    const sf = parseSource(text, file);
    return (sf.parseDiagnostics ?? []).map((d) => {
        const pos = sf.getLineAndCharacterOfPosition(d.start ?? 0);
        return {
            file,
            line: pos.line + 1,
            column: pos.character + 1,
            message: ts.flattenDiagnosticMessageText(d.messageText, '\n'),
            code: d.code,
        };
    });
};

export const readSource = (sp: SourceProject, owner: TSourceOwner, id: string) =>
    sp.run((): TSourceDto => toDto(sp, fileOf(sp, owner, id)));

export const updateSource = ({ sp, bus }: TWriter, owner: TSourceOwner, id: string, rawBody: TUpdateSourceBody) =>
    sp.run(async (): Promise<TSourceDto> => {
        const body = asBody(rawBody);
        if (typeof body.version !== 'string') throw HttpError.badRequest('Field "version" must be a string');
        if (typeof body.text !== 'string') throw HttpError.badRequest('Field "text" must be a string');
        const text = body.text;
        const abs = fileOf(sp, owner, id);
        const current = toDto(sp, abs);
        assertCurrentVersion(body, current);

        const errors = syntaxErrors(current.file, text);
        if (errors.length > 0) throw HttpError.invalid(errors, 'The file does not parse');

        const s = sp.session();
        s.apply(() => s.edit(abs).replaceWithText(text));
        await s.commit(bus, (texts) =>
            owner === 'chapter'
                ? { kind: 'chapter', id, version: chapterVersion(sp, id), op: 'updated' }
                : {
                      kind: 'passage',
                      id,
                      chapterId: parsePassageId(id).chapterId,
                      version: version(texts.get(abs) ?? null),
                      op: 'updated',
                  }
        );
        // By path, not id: the edit may have changed the passage's `id` literal.
        return toDto(sp, abs);
    });
