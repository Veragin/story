import { EMPTY_VERSION, ENGINE_SECTIONS, type TEngineSection, type TEngineSectionDto } from '@story/protocol';
import type { FunctionDeclaration, SourceFile, VariableStatement } from 'ts-morph';
import { version } from '../../events/version';
import { jsDocEdit, readJsDoc } from '../ast';
import type { SourceProject } from '../SourceProject';

export const ENGINE_DIR = 'data/engine';
export const ENGINE_INDEX_FILE = `${ENGINE_DIR}/index.ts`;
export const ENGINE_EXPORT = 'engine';

type TEngineSectionFile = {
    fileName: string;
    exportName: string;
    // a component loads lazily, so node (MultiEngine) never imports React
    lazy: boolean;
    stub: string;
};

export const ENGINE_SECTION_FILES: Readonly<Record<TEngineSection, TEngineSectionFile>> = {
    onLinkClick: {
        fileName: 'onLinkClick.ts',
        exportName: 'onLinkClick',
        lazy: false,
        stub: "import type { TOnLinkClick } from '@story/types';\n\nexport const onLinkClick: TOnLinkClick = () => {};\n",
    },
    topbar: {
        fileName: 'Topbar.tsx',
        exportName: 'Topbar',
        lazy: true,
        stub: "import { DefaultTopbar } from '@story/ui';\n\nexport const Topbar = DefaultTopbar;\n",
    },
};

export const engineSectionOfFile = (fileName: string): TEngineSection | undefined =>
    ENGINE_SECTIONS.find((section) => ENGINE_SECTION_FILES[section].fileName === fileName);

export const engineSectionPath = (sp: SourceProject, section: TEngineSection): string =>
    sp.root.abs(ENGINE_DIR, ENGINE_SECTION_FILES[section].fileName);

export const findPrimaryExport = (
    sf: SourceFile,
    name: string
): VariableStatement | FunctionDeclaration | undefined => {
    const variable = sf.getVariableStatement(name);
    if (variable?.isExported()) return variable;
    const fn = sf.getFunction(name);
    return fn?.isExported() ? fn : undefined;
};

const splitDescription = (sf: SourceFile, exportName: string): { description: string; code: string } => {
    const text = sf.getFullText();
    const primary = findPrimaryExport(sf, exportName);
    if (!primary) return { description: '', code: text };
    const removal = jsDocEdit(primary, undefined);
    return {
        description: readJsDoc(primary) ?? '',
        code: removal ? text.slice(0, removal.start) + text.slice(removal.end) : text,
    };
};

export const isEngineStub = (section: TEngineSection, code: string) =>
    code.trim() === ENGINE_SECTION_FILES[section].stub.trim();

export const readEngineSection = (sp: SourceProject, section: TEngineSection): TEngineSectionDto => {
    const abs = engineSectionPath(sp, section);
    const file = sp.root.rel(abs);
    const sf = sp.file(abs);
    if (!sf) {
        return { section, file, exists: false, implemented: false, version: EMPTY_VERSION, description: '', code: '' };
    }
    const { description, code } = splitDescription(sf, ENGINE_SECTION_FILES[section].exportName);
    return {
        section,
        file,
        exists: true,
        implemented: !isEngineStub(section, code),
        version: version(sf.getFullText()),
        description,
        code,
    };
};
