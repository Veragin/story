import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { eventIds } from '@story/protocol';
import { Node, type SourceFile, SyntaxKind } from 'ts-morph';
import type { EventBus } from '../../events/EventBus';
import { isHttpError } from '../../common/HttpError';
import { TEMPLATE_ROOT } from '../../stories/templateRoot';
import { readStructure, TYPES_INDEX_FILE } from '../readers/structure';
import type { SourceProject } from '../SourceProject';

const PASSAGE_FILE = 'types/TPassage.ts';
const BINDING_EXPORTS: ReadonlySet<string> = new Set([
    'TChapterPassage',
    'TPassage',
    'TPassageStart',
    'TPassageScreen',
    'TPassageLinear',
    'TPassageRedirect',
    'TPassageFinish',
    'TLink',
    'TLinkCost',
    'TChapterPassageType',
    'getWholePassageId',
]);

const OLD_INDEX_HEADER = [
    ' * Depends on `@story/shared` only (for `Time` / `DeltaTime` / `TimeRange` / `TPassageIdFor`).',
    ' *',
    ' * Engine types the author never edits are NOT here — they are exports of `@story/shared`:',
    ' * `TPoint` / `TSize` / `TVec` (geometry) and `TPassageId` / `TPassageIdFor` (the id format).',
].join('\n');

const NEW_INDEX_HEADER = [
    ' * Depends on `@story/shared` only (time, the passage-id format and the passage structure).',
    ' *',
    ' * Engine types the author never edits are NOT here — they are exports of `@story/shared`:',
    ' * `TPoint` / `TSize` / `TVec` (geometry), `TPassageId` / `TPassageIdFor` (the id format) and the',
    " * passage structure (`PASSAGE_TYPES`, `TPassageScreen`, `TLink`, …), which `./TPassage` binds to the story's ids.",
].join('\n');

const log = (message: string) => console.warn(`[server] passage structure migration: ${message}`);

// the binding only instantiates `@story/shared` generics; object type literals mean the structure is still here
const declaresStructure = (sf: SourceFile) =>
    sf.getTypeAliases().some((alias) => {
        const node = alias.getTypeNode();
        return Node.isTypeLiteral(node) || node?.getFirstDescendantByKind(SyntaxKind.TypeLiteral) !== undefined;
    });

const declaredNames = (sf: SourceFile): string[] => [
    ...sf.getTypeAliases().map((a) => a.getName()),
    ...sf.getInterfaces().map((i) => i.getName()),
    ...sf.getVariableDeclarations().map((v) => v.getName()),
    ...sf.getFunctions().flatMap((f) => f.getName() ?? []),
];

// a result that does not type-check, e.g. a story that extended the structure, is logged and not written
export const migratePassageStructure = async (sp: SourceProject, bus: EventBus): Promise<boolean> => {
    const abs = sp.root.abs(PASSAGE_FILE);
    const current = sp.file(abs);
    if (!current || !declaresStructure(current)) return false;
    const extra = declaredNames(current).filter((name) => !BINDING_EXPORTS.has(name));
    if (extra.length > 0) {
        log(`${PASSAGE_FILE} also declares ${extra.join(', ')}; left alone`);
        return false;
    }
    const s = sp.session();
    try {
        const binding = await readFile(path.join(TEMPLATE_ROOT, PASSAGE_FILE), 'utf8');
        s.apply(() => {
            s.edit(abs).replaceWithText(binding);
            const indexAbs = sp.root.abs(TYPES_INDEX_FILE);
            const index = sp.file(indexAbs);
            if (index?.getFullText().includes(OLD_INDEX_HEADER)) {
                s.edit(indexAbs).replaceWithText(index.getFullText().replace(OLD_INDEX_HEADER, NEW_INDEX_HEADER));
            }
        });
        await s.commit(bus, () => ({
            kind: 'structure',
            id: eventIds.structure,
            version: readStructure(sp).version,
            op: 'updated',
        }));
        return true;
    } catch (e) {
        s.rollback();
        const diagnostics = isHttpError(e) ? (e.body.diagnostics ?? []) : [];
        const details = diagnostics.map((d) => `\n  ${d.file}:${d.line} ${d.message}`).join('');
        log(`${sp.root.storyId} not migrated: ${e instanceof Error ? e.message : String(e)}${details}`);
        return false;
    }
};
