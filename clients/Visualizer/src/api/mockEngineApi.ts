import type { TChangeEvent, TEngineSection, TEngineSectionDto, TVersion } from '@story/protocol';
import { invalid } from './mockHelpers';
import type { TVisualizerApi } from './types';

type TMockEngineContext = {
    nextVersion: () => TVersion;
    emit: (event: TChangeEvent) => void;
    reply: <T>(fn: () => T) => Promise<T>;
    checkVersion: (current: { version: TVersion } | undefined, version: TVersion) => void;
};

type TSectionFile = { file: string; exportName: string; stub: string };

export type TMockEngineApi = {
    routes: Pick<TVisualizerApi, 'getEngineSection' | 'updateEngineSection'>;
    load: () => void;
};

const SECTION_FILES: Record<TEngineSection, TSectionFile> = {
    onLinkClick: {
        file: 'data/engine/onLinkClick.ts',
        exportName: 'onLinkClick',
        stub: "import type { TOnLinkClick } from '@story/types';\n\nexport const onLinkClick: TOnLinkClick = () => {};\n",
    },
    topbar: {
        file: 'data/engine/Topbar.tsx',
        exportName: 'Topbar',
        stub: "import { DefaultTopbar } from '@story/ui';\n\nexport const Topbar = DefaultTopbar;\n",
    },
};

const SEED_TOPBAR = {
    description: 'Health of the main character, as a heart icon and a percentage.',
    code: `import { Favorite as FavoriteIcon } from '@mui/icons-material';
import { TopbarStat } from '@story/ui';
import type { TTopbarProps } from '@story/types';

export const Topbar = ({ s }: TTopbarProps) => (
    <TopbarStat
        icon={FavoriteIcon}
        label={_('Health')}
        value={\`\${Math.floor(s.characters[s.mainCharacterId].health)}%\`}
    />
);
`,
};

const missing = (section: TEngineSection): TEngineSectionDto => ({
    section,
    file: SECTION_FILES[section].file,
    exists: false,
    implemented: false,
    version: '',
    description: '',
    code: '',
});

const exportsPrimary = (section: TEngineSection, code: string) =>
    new RegExp(`export\\s+(const|function)\\s+${SECTION_FILES[section].exportName}\\b`).test(code);

export const createMockEngineApi = (ctx: TMockEngineContext): TMockEngineApi => {
    let sections = new Map<TEngineSection, TEngineSectionDto>();

    const sectionOf = (section: TEngineSection) => sections.get(section) ?? missing(section);

    const write = (section: TEngineSection, description: string, code: string): TEngineSectionDto => {
        const { file, stub } = SECTION_FILES[section];
        const text = code.trim() === '' ? stub : code;
        if (!exportsPrimary(section, text)) {
            invalid([
                { file, line: 1, column: 1, message: `The file must export "${SECTION_FILES[section].exportName}"` },
            ]);
        }
        const existed = sections.has(section);
        const next: TEngineSectionDto = {
            section,
            file,
            exists: true,
            implemented: text.trim() !== stub.trim(),
            version: ctx.nextVersion(),
            description,
            code: text,
        };
        sections.set(section, next);
        ctx.emit({ kind: 'engine', id: section, version: next.version, op: existed ? 'updated' : 'created' });
        return next;
    };

    return {
        load: () => {
            sections = new Map();
            sections.set('topbar', {
                ...missing('topbar'),
                exists: true,
                implemented: true,
                version: ctx.nextVersion(),
                ...SEED_TOPBAR,
            });
        },
        routes: {
            getEngineSection: (section) => ctx.reply(() => sectionOf(section)),
            updateEngineSection: (section, body) =>
                ctx.reply(() => {
                    const current = sectionOf(section);
                    ctx.checkVersion(current, body.version);
                    if ('delete' in body) {
                        if (!current.exists) return current;
                        sections.delete(section);
                        ctx.emit({ kind: 'engine', id: section, version: null, op: 'deleted' });
                        return missing(section);
                    }
                    return write(
                        section,
                        body.description ?? current.description,
                        body.code ?? (current.exists ? current.code : '')
                    );
                }),
        },
    };
};
