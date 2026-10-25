import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { TEngineSection, TEngineSectionDto, TUpdateEngineSectionBody } from '@story/protocol';
import type { ObjectLiteralExpression, SourceFile } from 'ts-morph';
import { version } from '../../events/version';
import { TEMPLATE_ROOT } from '../../stories/templateRoot';
import { HttpError } from '../../common/HttpError';
import { applyTextEdits, ensureNamedImport, findExportedObject, jsDocEdit } from '../ast';
import {
    ENGINE_EXPORT,
    ENGINE_INDEX_FILE,
    ENGINE_SECTION_FILES,
    engineSectionPath,
    findPrimaryExport,
    readEngineSection,
} from '../readers/engine';
import type { EditSession } from '../SourceProject';
import { syntaxDiagnostic } from '../validate';
import { asBody, assertCurrentVersion, optionalText, type TWriter } from './common';
import { syntaxErrors } from './source';

const DATA_INDEX_FILE = 'data/index.ts';
const ENGINE_MODULE = './engine';
const TYPES_INDEX_FILE = 'types/index.ts';
const ENGINE_TYPES_FILE = 'types/TEngine.ts';
const ENGINE_TYPES_MODULE = './TEngine';

const ENGINE_INDEX_TEXT = `import type { TEngineSettings } from '@story/types';

export const ${ENGINE_EXPORT}: TEngineSettings = {};
`;

type TEngineChange = { delete: true } | { description?: string; code?: string };

const parseBody = (rawBody: TUpdateEngineSectionBody): { version: string; change: TEngineChange } => {
    const body = asBody(rawBody);
    if (typeof body.version !== 'string') throw HttpError.badRequest('Field "version" must be a string');
    if (body.delete !== undefined) {
        if (body.delete !== true) throw HttpError.badRequest('Field "delete" must be true');
        return { version: body.version, change: { delete: true } };
    }
    return {
        version: body.version,
        change: { description: optionalText(body, 'description'), code: optionalText(body, 'code') },
    };
};

const engineObject = (sf: SourceFile): ObjectLiteralExpression => {
    const found = findExportedObject(sf, (_obj, decl) => decl.getName() === ENGINE_EXPORT);
    if (!found) throw HttpError.badRequest(`${ENGINE_INDEX_FILE}: "${ENGINE_EXPORT}" is not an object literal`);
    return found.obj;
};

const moduleOf = (section: TEngineSection) => `./${ENGINE_SECTION_FILES[section].fileName.replace(/\.tsx?$/, '')}`;

const editEngineIndex = (s: EditSession): SourceFile => {
    const abs = s.sp.root.abs(ENGINE_INDEX_FILE);
    return s.sp.file(abs) ? s.edit(abs) : s.create(abs, ENGINE_INDEX_TEXT);
};

const ensureBarrelLine = (s: EditSession, file: string, moduleSpecifier: string) => {
    const sf = s.edit(s.sp.root.abs(file), file);
    if (sf.getExportDeclaration((d) => d.getModuleSpecifierValue() === moduleSpecifier)) return;
    sf.addExportDeclaration({ moduleSpecifier });
};

const readTemplateEngineTypes = () => readFile(path.join(TEMPLATE_ROOT, ENGINE_TYPES_FILE), 'utf8');

const ensureEngineTypes = (s: EditSession, templateText: string | undefined) => {
    if (templateText !== undefined) s.create(s.sp.root.abs(ENGINE_TYPES_FILE), templateText);
    ensureBarrelLine(s, TYPES_INDEX_FILE, ENGINE_TYPES_MODULE);
};

const addIndexEntry = (s: EditSession, section: TEngineSection) => {
    const sf = editEngineIndex(s);
    const obj = engineObject(sf);
    const { exportName, lazy } = ENGINE_SECTION_FILES[section];
    if (obj.getProperty(exportName)) return;
    if (lazy) {
        obj.addPropertyAssignment({ name: exportName, initializer: `() => import('${moduleOf(section)}')` });
        return;
    }
    const local = ensureNamedImport(sf, exportName, moduleOf(section));
    if (local === exportName) obj.addShorthandPropertyAssignment({ name: exportName });
    else obj.addPropertyAssignment({ name: exportName, initializer: local });
};

const removeIndexEntry = (s: EditSession, section: TEngineSection) => {
    const abs = s.sp.root.abs(ENGINE_INDEX_FILE);
    if (!s.sp.file(abs)) return;
    engineObject(s.edit(abs)).getProperty(ENGINE_SECTION_FILES[section].exportName)?.remove();
};

const missingExport = (file: string, exportName: string) =>
    HttpError.invalid(
        [syntaxDiagnostic(file, `The file must export "${exportName}"`)],
        'The primary export is missing'
    );

// an empty `code` resets the file to the stub
const sectionCode = (section: TEngineSection, current: TEngineSectionDto, code: string | undefined): string => {
    const { stub } = ENGINE_SECTION_FILES[section];
    if (code === undefined) return current.exists ? current.code : stub;
    return code.trim() === '' ? stub : code;
};

const writeSection = (
    s: EditSession,
    section: TEngineSection,
    current: TEngineSectionDto,
    { description, code }: { description?: string; code?: string },
    engineTypesText: string | undefined
) => {
    const { exportName } = ENGINE_SECTION_FILES[section];
    const text = sectionCode(section, current, code);
    const errors = syntaxErrors(current.file, text);
    if (errors.length > 0) throw HttpError.invalid(errors, 'The file does not parse');

    const abs = engineSectionPath(s.sp, section);
    s.apply(() => {
        const sf = current.exists ? s.edit(abs) : s.create(abs, text);
        if (current.exists) sf.replaceWithText(text);
        const primary = findPrimaryExport(sf, exportName);
        if (!primary) throw missingExport(current.file, exportName);
        const jsDoc = jsDocEdit(primary, description ?? current.description);
        if (jsDoc) applyTextEdits(sf, [jsDoc]);
        addIndexEntry(s, section);
        // stories created before engine settings existed lack these files and barrel lines
        ensureBarrelLine(s, DATA_INDEX_FILE, ENGINE_MODULE);
        ensureEngineTypes(s, engineTypesText);
    });
    return abs;
};

export const updateEngineSection = ({ sp, bus }: TWriter, section: TEngineSection, rawBody: TUpdateEngineSectionBody) =>
    sp.run(async (): Promise<TEngineSectionDto> => {
        const body = parseBody(rawBody);
        const current = readEngineSection(sp, section);
        assertCurrentVersion(body, current);
        const s = sp.session();

        if ('delete' in body.change) {
            if (!current.exists) return current;
            s.apply(() => {
                removeIndexEntry(s, section);
                s.delete(engineSectionPath(sp, section));
            });
            await s.commit(bus, () => ({ kind: 'engine', id: section, version: null, op: 'deleted' }));
            return readEngineSection(sp, section);
        }

        const hasEngineTypes = sp.file(sp.root.abs(ENGINE_TYPES_FILE)) !== undefined;
        const engineTypesText = hasEngineTypes ? undefined : await readTemplateEngineTypes();
        const abs = writeSection(s, section, current, body.change, engineTypesText);
        await s.commit(bus, (texts) => ({
            kind: 'engine',
            id: section,
            version: version(texts.get(abs) ?? sp.text(abs)),
            op: current.exists ? 'updated' : 'created',
        }));
        return readEngineSection(sp, section);
    });
