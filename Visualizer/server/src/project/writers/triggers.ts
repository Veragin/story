import type {
    TCreateTriggerBody,
    TDeleteTriggerBody,
    TOkDto,
    TTriggerDto,
    TUpdateTriggerBody,
} from '@story/visualizer-protocol';
import { Node } from 'ts-morph';
import { assertVersion, version } from '../../events/version';
import { HttpError } from '../../http/HttpError';
import { removeTimelineEntries } from '../../json';
import {
    asArray,
    ensureNamedImport,
    getProp,
    isIdentifierUsed,
    quote,
    relativeModule,
    removeImportOf,
    removeStatement,
    unwrap,
} from '../ast';
import { readTrigger, readTriggerSource, TRIGGER_FIELDS } from '../readers/triggers';
import { referenceAt } from '../registry';
import { allTriggers, assertId, chapterFile, chapterObject, findTrigger } from '../story';
import { applyPartial } from '../values';
import { asBody, DERIVED_FIELDS, optionalText, requireText, type TWriter } from './common';

const TRIGGER_DERIVED = [...DERIVED_FIELDS, 'triggerId', 'chapterId'];

const TRIGGERS_HEADER = `import { Time } from '@story/shared';
import { TTimeTrigger } from '@story/types';
`;

export const updateTrigger = ({ sp, bus }: TWriter, triggerId: string, rawBody: TUpdateTriggerBody) =>
    sp.run(async (): Promise<TTriggerDto> => {
        const body = asBody(rawBody);
        const current = readTrigger(sp, triggerId);
        await assertVersion(body.version as string, current.version, () => current);
        const abs = sp.root.paths.triggersFile(current.chapterId);
        const s = sp.session();
        s.apply(() => {
            s.edit(abs);
            const t = findTrigger(sp, triggerId);
            applyPartial(t.obj, body, TRIGGER_FIELDS, t.sf, { skip: TRIGGER_DERIVED });
        });
        await s.commit(
            bus,
            (texts) => ({
                kind: 'trigger',
                id: triggerId,
                chapterId: current.chapterId,
                version: version(texts.get(abs) ?? sp.text(abs)),
                op: 'updated',
            }),
            { fields: { file: abs } }
        );
        return readTrigger(sp, triggerId);
    });

export const createTrigger = ({ sp, bus }: TWriter, chapterId: string, rawBody: TCreateTriggerBody) =>
    sp.run(async (): Promise<TTriggerDto> => {
        const body = asBody(rawBody);
        chapterFile(sp, chapterId);
        const triggerId = assertId(body.triggerId, 'triggerId');
        const name = requireText(body, 'name');
        const description = optionalText(body, 'description') ?? '';
        const time = requireText(body, 'time');
        if (allTriggers(sp).some((t) => t.triggerId === triggerId)) {
            throw HttpError.exists(`Trigger "${triggerId}" already exists`);
        }
        const abs = sp.root.paths.triggersFile(chapterId);
        const exportName = `${triggerId}Trigger`;
        const s = sp.session();
        s.apply(() => {
            const sf = sp.file(abs) ? s.edit(abs) : s.create(abs, TRIGGERS_HEADER);
            if (sf.getVariableDeclaration(exportName))
                throw HttpError.exists(`${exportName} already exists in triggers.ts`);
            const timeLocal = ensureNamedImport(sf, 'Time', '@story/shared');
            ensureNamedImport(sf, 'TTimeTrigger', '@story/types');
            sf.addStatements(`
export const ${exportName}: TTimeTrigger = {
    id: ${quote(triggerId)},
    name: ${quote(name)},
    description: ${quote(description)},

    time: ${timeLocal}.fromString(${quote(time)}),
    condition: () => true,
    action: () => {},
};
`);
            const chapterSf = s.edit(sp.root.paths.chapterFile(chapterId));
            const list = asArray(getProp(chapterObject(chapterSf).obj, 'triggers')?.getInitializer());
            if (!list) throw HttpError.badRequest(`${chapterId}.chapter.ts: "triggers" is not an array literal`);
            const local = ensureNamedImport(chapterSf, exportName, relativeModule(chapterSf.getFilePath(), abs));
            list.addElement(local);
        });
        await s.commit(
            bus,
            (texts) => ({
                kind: 'trigger',
                id: triggerId,
                chapterId,
                version: version(texts.get(abs) ?? sp.text(abs)),
                op: 'created',
            }),
            { fields: { file: abs } }
        );
        return readTrigger(sp, triggerId);
    });

export const deleteTrigger = ({ sp, bus }: TWriter, triggerId: string, rawBody: TDeleteTriggerBody) =>
    sp.run(async (): Promise<TOkDto> => {
        const body = asBody(rawBody);
        const t = findTrigger(sp, triggerId);
        const current = readTriggerSource(sp, t);
        await assertVersion(body.version as string, current.version, () => current);
        const abs = t.sf.getFilePath();
        const chapterAbs = sp.root.paths.chapterFile(t.chapterId);
        // anything but the owning chapter's `triggers: [...]` that imports the trigger
        const refs = sp
            .storyFiles()
            .filter((sf) => sf.getFilePath() !== abs && sf.getFilePath() !== chapterAbs)
            .flatMap((sf) =>
                sf
                    .getImportDeclarations()
                    .filter(
                        (d) =>
                            d.getModuleSpecifierSourceFile()?.getFilePath() === abs &&
                            d.getNamedImports().some((n) => n.getName() === t.exportName)
                    )
                    .map((d) => referenceAt(sp, sf, d.getStartLineNumber()))
            );
        if (refs.length > 0) throw HttpError.referenced(refs, `Trigger "${triggerId}" is still referenced`);
        const s = sp.session();
        s.apply(() => {
            const chapterSf = s.edit(chapterAbs);
            const list = asArray(getProp(chapterObject(chapterSf).obj, 'triggers')?.getInitializer());
            const imported = chapterSf
                .getImportDeclarations()
                .find((d) => d.getModuleSpecifierSourceFile()?.getFilePath() === abs)
                ?.getNamedImports()
                .find((n) => n.getName() === t.exportName);
            const local = imported ? (imported.getAliasNode()?.getText() ?? imported.getName()) : undefined;
            if (list && local) {
                const elements = list.getElements();
                for (let i = elements.length - 1; i >= 0; i--) {
                    const e = unwrap(elements[i]);
                    if (Node.isIdentifier(e) && e.getText() === local) list.removeElement(i);
                }
            }
            if (local && !isIdentifierUsed(chapterSf, local)) removeImportOf(chapterSf, local);
            const sf = s.edit(abs);
            const stmt = sf.getVariableStatement(t.exportName);
            if (stmt) removeStatement(stmt);
        });
        s.after((tx) => removeTimelineEntries(tx, { triggers: [triggerId] }));
        await s.commit(bus, () => ({
            kind: 'trigger',
            id: triggerId,
            chapterId: t.chapterId,
            version: null,
            op: 'deleted',
        }));
        return { ok: true };
    });
