import path from 'node:path';
import { capitalize } from '@story/shared';
import {
    type ArrowFunction,
    type Expression,
    type FunctionDeclaration,
    type FunctionExpression,
    Node,
    type ObjectLiteralExpression,
    type SourceFile,
    type Statement,
} from 'ts-morph';
import { HttpError } from '../http/HttpError';
import {
    asObject,
    ensureNamedImport,
    findExportedObject,
    getPropInit,
    propertyKey,
    relativeModule,
    resolveIdentifierFile,
    stringLiteral,
    stringProp,
    topLevelVariables,
    unwrap,
} from './ast';
import type { SourceProject } from './SourceProject';
import type { TRefResolver, TWriteCtx } from './values';

export const ID_RE = /^[a-z][A-Za-z0-9_]*$/;

export const assertId = (value: unknown, field: string): string => {
    if (typeof value !== 'string' || !ID_RE.test(value)) {
        throw HttpError.badRequest(
            `Field "${field}" must be an identifier starting with a lower-case letter (letters, digits, _; no "-"), got ${JSON.stringify(value)}`
        );
    }
    return value;
};

export type TRegisterSection = 'characters' | 'npcs' | 'chapters' | 'locations' | 'passages';

export const registerFile = (sp: SourceProject) => sp.fileOrThrow(sp.root.paths.register, 'register.ts');

const registerObject = (sf: SourceFile): ObjectLiteralExpression => {
    const decl = sf.getVariableDeclaration('register');
    const obj = asObject(decl?.getInitializer());
    if (!obj) throw new Error('data/register.ts: no `export const register = { … }`');
    return obj;
};

export const registerSection = (sf: SourceFile, section: TRegisterSection): ObjectLiteralExpression => {
    const obj = asObject(getPropInit(registerObject(sf), section));
    if (!obj) throw new Error(`data/register.ts: register.${section} is not an object literal`);
    return obj;
};

export type TRegisterEntry = {
    id: string;
    local: string;
    file?: SourceFile;
    exportName?: string;
};

export const registerEntries = (
    sp: SourceProject,
    section: Exclude<TRegisterSection, 'passages'>
): TRegisterEntry[] => {
    const sf = registerFile(sp);
    const out: TRegisterEntry[] = [];
    for (const p of registerSection(sf, section).getProperties()) {
        const id = propertyKey(p);
        if (!id) continue;
        let local: string | undefined;
        if (Node.isShorthandPropertyAssignment(p)) local = p.getName();
        else if (Node.isPropertyAssignment(p)) {
            const init = unwrap(p.getInitializerOrThrow());
            if (Node.isIdentifier(init)) local = init.getText();
        }
        if (!local) {
            out.push({ id, local: '' });
            continue;
        }
        const resolved = resolveIdentifierFile(sf, local);
        out.push({ id, local, file: resolved?.file, exportName: resolved?.exportName });
    }
    return out;
};

export const chapterIds = (sp: SourceProject): string[] => registerEntries(sp, 'chapters').map((e) => e.id);

export const chapterFile = (sp: SourceProject, chapterId: string): SourceFile => {
    if (!ID_RE.test(chapterId)) throw HttpError.notFound(`No chapter "${chapterId}"`);
    const sf = sp.file(sp.root.paths.chapterFile(chapterId));
    if (!sf) throw HttpError.notFound(`No chapter "${chapterId}"`);
    return sf;
};

export const chapterObject = (sf: SourceFile) => {
    const found = findExportedObject(sf, (obj) => stringProp(obj, 'chapterId') !== undefined);
    if (!found) throw new Error(`${sf.getBaseName()}: no exported chapter object`);
    return found;
};

const chapterIdOfFile = (sp: SourceProject, abs: string): string | undefined => {
    const rel = sp.root.rel(abs);
    const m = /^data\/chapters\/([^/]+)\/([^/]+)\.chapter\.ts$/.exec(rel);
    return m && m[1] === m[2] ? m[1] : undefined;
};

export const chapterCharacterFiles = (sp: SourceProject, chapterId: string): Map<string, SourceFile[]> => {
    const dir = sp.root.paths.chapterDir(chapterId);
    const out = new Map<string, SourceFile[]>();
    for (const sf of sp.filesUnder(dir)) {
        const rel = path.relative(dir, sf.getFilePath()).split(path.sep);
        if (rel.length !== 2 || !rel[0].endsWith('.passages')) continue;
        const characterId = rel[0].slice(0, -'.passages'.length);
        const list = out.get(characterId) ?? [];
        list.push(sf);
        out.set(characterId, list);
    }
    for (const list of out.values()) list.sort((a, b) => a.getFilePath().localeCompare(b.getFilePath()));
    return new Map([...out.entries()].sort(([a], [b]) => a.localeCompare(b)));
};

export const chapterPassagesFile = (sp: SourceProject, chapterId: string) =>
    sp.file(sp.root.paths.chapterPassagesFile(chapterId));

const defaultExportExpr = (sf: SourceFile): Expression | undefined => {
    const def = sf.getExportAssignment((e) => !e.isExportEquals());
    return def ? unwrap(def.getExpression()) : undefined;
};

export const passagesRecord = (sf: SourceFile): ObjectLiteralExpression | undefined => {
    const defExpr = defaultExportExpr(sf);
    if (defExpr && Node.isIdentifier(defExpr)) {
        const obj = asObject(sf.getVariableDeclaration(defExpr.getText())?.getInitializer());
        if (obj) return obj;
    }
    if (defExpr && Node.isObjectLiteralExpression(defExpr)) return defExpr;
    for (const decl of topLevelVariables(sf)) {
        const obj = asObject(decl.getInitializer());
        if (obj && decl.getTypeNode()?.getText().startsWith('Record<')) return obj;
    }
    return undefined;
};

export const registeredPassageIds = (sp: SourceProject): Set<string> => {
    const ids = new Set<string>();
    for (const ch of chapterIds(sp)) {
        const sf = chapterPassagesFile(sp, ch);
        const rec = sf && passagesRecord(sf);
        for (const p of rec?.getProperties() ?? []) {
            const key = propertyKey(p);
            if (key) ids.add(key);
        }
    }
    return ids;
};

export const chapterPassageUnionName = (chapterId: string) => `T${capitalize(chapterId)}PassageId`;
export const characterPassageUnionName = (chapterId: string, characterId: string) =>
    `T${capitalize(chapterId)}${capitalize(characterId)}PassageId`;

type TFn = ArrowFunction | FunctionExpression | FunctionDeclaration;

export type TPassageSource = {
    sf: SourceFile;
    fn: TFn;
    exportName: string;
    obj: ObjectLiteralExpression;
    params: string[];
    preamble: Statement[];
    line: number;
};

const returnedObject = (fn: TFn): { obj: ObjectLiteralExpression; preamble: Statement[] } | undefined => {
    const body = fn.getBody();
    if (!body) return undefined;
    if (!Node.isBlock(body)) {
        const obj = Node.isExpression(body) ? asObject(body) : undefined;
        return obj ? { obj, preamble: [] } : undefined;
    }
    const statements = body.getStatements();
    for (let i = statements.length - 1; i >= 0; i--) {
        const s = statements[i];
        if (Node.isReturnStatement(s)) {
            const obj = asObject(s.getExpression());
            return obj ? { obj, preamble: statements.slice(0, i) } : undefined;
        }
    }
    return undefined;
};

export const passageSource = (sf: SourceFile): TPassageSource | undefined => {
    const defExpr = defaultExportExpr(sf);
    const defaultName = defExpr && Node.isIdentifier(defExpr) ? defExpr.getText() : undefined;
    const candidates: { fn: TFn; name: string; exported: boolean }[] = [];
    for (const decl of topLevelVariables(sf)) {
        const init = decl.getInitializer();
        const e = init ? unwrap(init) : undefined;
        if (e && (Node.isArrowFunction(e) || Node.isFunctionExpression(e))) {
            const exported = decl.getVariableStatement()?.hasExportKeyword() ?? false;
            candidates.push({ fn: e, name: decl.getName(), exported });
        }
    }
    for (const f of sf.getFunctions()) {
        candidates.push({ fn: f, name: f.getName() ?? 'default', exported: f.isExported() });
    }
    candidates.sort(
        (a, b) => Number(b.exported || b.name === defaultName) - Number(a.exported || a.name === defaultName)
    );
    for (const c of candidates) {
        const ret = returnedObject(c.fn);
        if (!ret || (!ret.obj.getProperty('type') && !ret.obj.getProperty('chapterId'))) continue;
        const isDefaultFunction = Node.isFunctionDeclaration(c.fn) && c.fn.isDefaultExport();
        return {
            sf,
            fn: c.fn,
            exportName: c.exported && !isDefaultFunction ? c.name : 'default',
            obj: ret.obj,
            params: c.fn.getParameters().map((p) => p.getName()),
            preamble: ret.preamble,
            line: c.fn.getStartLineNumber(),
        };
    }
    return undefined;
};

const localIdFromFileName = (sf: SourceFile) => sf.getBaseName().split('.')[0];

export const passageLocalId = (src: TPassageSource | undefined, sf: SourceFile): string =>
    (src && stringProp(src.obj, 'id')) ?? localIdFromFileName(sf);

// Chapter and character become path segments, so they must be ids (no `..` or `/`).
export const parsePassageId = (passageId: string) => {
    const m = /^([^-]+)-([^-]+)-(.+)$/.exec(passageId);
    if (!m || !ID_RE.test(m[1]) || !ID_RE.test(m[2])) throw HttpError.notFound(`No passage "${passageId}"`);
    return { chapterId: m[1], characterId: m[2], localId: m[3] };
};

export const findPassageFile = (sp: SourceProject, passageId: string): SourceFile => {
    const { chapterId, characterId, localId } = parsePassageId(passageId);
    const files = sp.file(sp.root.paths.chapterFile(chapterId))
        ? (chapterCharacterFiles(sp, chapterId).get(characterId) ?? [])
        : [];
    const byId = files.find((sf) => passageLocalId(passageSource(sf), sf) === localId);
    if (!byId) throw HttpError.notFound(`No passage "${passageId}"`);
    return byId;
};

export type TTriggerSource = {
    chapterId: string;
    sf: SourceFile;
    exportName: string;
    obj: ObjectLiteralExpression;
    triggerId: string;
};

export const chapterTriggers = (sp: SourceProject, chapterId: string): TTriggerSource[] => {
    const sf = sp.file(sp.root.paths.triggersFile(chapterId));
    if (!sf) return [];
    const out: TTriggerSource[] = [];
    for (const decl of topLevelVariables(sf)) {
        const obj = asObject(decl.getInitializer());
        const triggerId = obj && stringProp(obj, 'id');
        if (!obj || !triggerId) continue;
        out.push({ chapterId, sf, exportName: decl.getName(), obj, triggerId });
    }
    return out;
};

export const allTriggers = (sp: SourceProject): TTriggerSource[] =>
    chapterIds(sp).flatMap((ch) => chapterTriggers(sp, ch));

export const findTrigger = (sp: SourceProject, triggerId: string): TTriggerSource => {
    const t = allTriggers(sp).find((x) => x.triggerId === triggerId);
    if (!t) throw HttpError.notFound(`No trigger "${triggerId}"`);
    return t;
};

const importFrom = (ctx: TWriteCtx, target: SourceFile, exportName: string): string => {
    if (ctx.sf === target) return exportName;
    return ensureNamedImport(ctx.sf, exportName, relativeModule(ctx.sf.getFilePath(), target.getFilePath()));
};

const identifierTarget = (expr: Expression) => {
    const e = unwrap(expr);
    if (!Node.isIdentifier(e)) return undefined;
    return resolveIdentifierFile(e.getSourceFile(), e.getText());
};

export const referencedObjectId = (expr: Expression): string | undefined => {
    const t = identifierTarget(expr);
    if (!t) return undefined;
    return stringProp(asObject(t.file.getVariableDeclaration(t.exportName)?.getInitializer()), 'id');
};

export const chapterRef = (sp: SourceProject): TRefResolver => ({
    what: 'chapter',
    read: (expr) => {
        const t = identifierTarget(expr);
        return t ? chapterIdOfFile(sp, t.file.getFilePath()) : undefined;
    },
    write: (id, ctx) => {
        const sf = sp.file(sp.root.paths.chapterFile(id));
        if (!ID_RE.test(id) || !sf) throw HttpError.badRequest(`Field "${ctx.path}": no chapter "${id}"`);
        return importFrom(ctx, sf, chapterObject(sf).decl.getName());
    },
});

export const triggerRef = (sp: SourceProject): TRefResolver => ({
    what: 'trigger',
    read: referencedObjectId,
    write: (id, ctx) => {
        const t = allTriggers(sp).find((x) => x.triggerId === id);
        if (!t) throw HttpError.badRequest(`Field "${ctx.path}": no trigger "${id}"`);
        return importFrom(ctx, t.sf, t.exportName);
    },
});

export const locationRef = (sp: SourceProject): TRefResolver => ({
    what: 'location',
    read: referencedObjectId,
    write: (id, ctx) => {
        const entry = registerEntries(sp, 'locations').find((e) => e.id === id);
        if (!entry?.file || !entry.exportName) throw HttpError.badRequest(`Field "${ctx.path}": no location "${id}"`);
        return importFrom(ctx, entry.file, entry.exportName);
    },
});

export const displayName = (expr: Expression | undefined, fallback: string): string => {
    if (!expr) return fallback;
    const lit = stringLiteral(expr);
    if (lit !== undefined) return lit || fallback;
    const e = unwrap(expr);
    if (Node.isCallExpression(e) && e.getExpression().getText() === '_') {
        const arg = e.getArguments()[0];
        const s = arg && Node.isExpression(arg) ? stringLiteral(arg) : undefined;
        if (s) return s;
    }
    return fallback;
};
