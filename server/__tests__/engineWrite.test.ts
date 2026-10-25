import { existsSync } from 'node:fs';
import { readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ProjectRoot } from '../src/project/ProjectRoot';
import { readEngineSection } from '../src/project/readers/engine';
import { SourceProject } from '../src/project/SourceProject';
import { changedFiles, snapshot, startSourceApp, tscTemp } from './helpers/sourceHelpers';

let t: Awaited<ReturnType<typeof startSourceApp>>;

beforeEach(async () => {
    t = await startSourceApp();
});
afterEach(async () => {
    await t.close();
});

const ON_LINK_CLICK_URL = '/api/stories/example/engine/onLinkClick';
const TOPBAR_URL = '/api/stories/example/engine/topbar';
const ON_LINK_CLICK_FILE = 'data/engine/onLinkClick.ts';
const TOPBAR_FILE = 'data/engine/Topbar.tsx';
const ENGINE_INDEX_FILE = 'data/engine/index.ts';

const HEAL_CODE = `import type { TOnLinkClick } from '@story/types';

export const onLinkClick: TOnLinkClick = ({ characterId }, s) => {
    s.characters[characterId].health = Math.min(100, s.characters[characterId].health + 1);
};
`;

const read = (rel: string) => readFile(path.join(t.project.root, rel), 'utf8');
const exists = (rel: string) => existsSync(path.join(t.project.root, rel));

const expectTsc = async () => {
    const tsc = await tscTemp(t.project.root);
    expect(tsc.output).toBe('');
    expect(tsc.ok).toBe(true);
};

const put = async (url: string, body: Record<string, unknown>) => {
    const current = (await t.get(url)).body;
    const res = await t.put(url, { version: current.version, ...body });
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    return res.body;
};

const fromDisk = async () => {
    const sp = new SourceProject(new ProjectRoot(t.project.root));
    await sp.sync();
    return sp;
};

describe('engine sections', () => {
    it('reads a missing section, then creates it with its index entry', async () => {
        const missing = await t.get(ON_LINK_CLICK_URL);
        expect(missing.status).toBe(200);
        expect(missing.body).toEqual({
            section: 'onLinkClick',
            file: ON_LINK_CLICK_FILE,
            exists: false,
            implemented: false,
            version: '',
            description: '',
            code: '',
        });

        const res = await t.put(ON_LINK_CLICK_URL, {
            version: '',
            description: 'Every taken link heals a little.',
            code: HEAL_CODE,
        });
        expect(res.status, JSON.stringify(res.body)).toBe(200);
        expect(res.body).toMatchObject({
            exists: true,
            implemented: true,
            description: 'Every taken link heals a little.',
            code: HEAL_CODE,
        });
        expect(await read(ON_LINK_CLICK_FILE)).toBe(
            HEAL_CODE.replace(
                'export const onLinkClick',
                '/** Every taken link heals a little. */\nexport const onLinkClick'
            )
        );
        const index = await read(ENGINE_INDEX_FILE);
        expect(index).toContain("import { onLinkClick } from './onLinkClick';");
        expect(index).toMatch(/engine: TEngineSettings = \{[^}]*\n {4}onLinkClick,\n\};/);
        expect(t.events).toContainEqual({
            kind: 'engine',
            id: 'onLinkClick',
            version: res.body.version,
            op: 'created',
        });
        expect((await t.get(ON_LINK_CLICK_URL)).body).toEqual(res.body);
        expect(readEngineSection(await fromDisk(), 'onLinkClick')).toEqual(res.body);
        await expectTsc();
    }, 60_000);

    it('saves only a description: writes the stub, not implemented', async () => {
        const dto = await put(ON_LINK_CLICK_URL, { description: 'Drains stamina.' });
        expect(dto).toMatchObject({ exists: true, implemented: false, description: 'Drains stamina.' });
        expect(await read(ON_LINK_CLICK_FILE)).toBe(
            "import type { TOnLinkClick } from '@story/types';\n\n" +
                '/** Drains stamina. */\nexport const onLinkClick: TOnLinkClick = () => {};\n'
        );

        const next = await put(ON_LINK_CLICK_URL, { description: 'Drains stamina\nand hunger.' });
        expect(next).toMatchObject({ implemented: false, description: 'Drains stamina\nand hunger.' });
        expect(await read(ON_LINK_CLICK_FILE)).toContain('/**\n * Drains stamina\n * and hunger.\n */\nexport const');
        await expectTsc();
    }, 60_000);

    it('updates only the code and keeps the description', async () => {
        await put(ON_LINK_CLICK_URL, { description: 'Heals a little.' });
        const dto = await put(ON_LINK_CLICK_URL, { code: HEAL_CODE });
        expect(dto).toMatchObject({ implemented: true, description: 'Heals a little.', code: HEAL_CODE });
        expect(await read(ON_LINK_CLICK_FILE)).toContain('/** Heals a little. */\nexport const onLinkClick');
    }, 60_000);

    it('updates the code and the description together', async () => {
        await put(ON_LINK_CLICK_URL, { description: 'Old.' });
        const code = `import type { TOnLinkClick } from '@story/types';

const HEAL = 2;

export const onLinkClick: TOnLinkClick = ({ characterId }, s) => {
    s.characters[characterId].health += HEAL;
};
`;
        const dto = await put(ON_LINK_CLICK_URL, { code, description: 'Heals by two.' });
        expect(dto).toMatchObject({ implemented: true, description: 'Heals by two.', code });
        expect(await read(ON_LINK_CLICK_FILE)).toBe(
            code.replace('export const onLinkClick', '/** Heals by two. */\nexport const onLinkClick')
        );
        await expectTsc();
    }, 60_000);

    it('deletes the file and its index entry', async () => {
        const indexBefore = await read(ENGINE_INDEX_FILE);
        const created = await put(ON_LINK_CLICK_URL, { description: 'Heals.', code: HEAL_CODE });
        t.events.length = 0;

        const res = await t.put(ON_LINK_CLICK_URL, { version: created.version, delete: true });
        expect(res.status, JSON.stringify(res.body)).toBe(200);
        expect(res.body).toMatchObject({ exists: false, version: '', description: '', code: '' });
        expect(exists(ON_LINK_CLICK_FILE)).toBe(false);
        expect(await read(ENGINE_INDEX_FILE)).toBe(indexBefore);
        expect(t.events).toEqual([{ kind: 'engine', id: 'onLinkClick', version: null, op: 'deleted' }]);
        await expectTsc();
    }, 60_000);

    it('rejects a stale version with 409 and changes nothing', async () => {
        await put(ON_LINK_CLICK_URL, { description: 'Heals.' });
        const before = await snapshot(t.project.root);
        const res = await t.put(ON_LINK_CLICK_URL, { version: 'stale', description: 'Other.' });
        expect(res.status).toBe(409);
        expect(res.body.error).toBe('stale');
        expect(res.body.current).toMatchObject({ description: 'Heals.' });
        expect(changedFiles(before, await snapshot(t.project.root))).toEqual([]);
    }, 60_000);

    it('answers 422 for a syntax error, a type error and a missing export; nothing is written', async () => {
        const before = await snapshot(t.project.root);

        const syntax = await t.put(ON_LINK_CLICK_URL, {
            version: '',
            code: "import type { TOnLinkClick } from '@story/types';\n\nexport const onLinkClick: TOnLinkClick = () => {\n",
        });
        expect(syntax.status).toBe(422);
        expect(syntax.body.diagnostics[0]).toMatchObject({ file: ON_LINK_CLICK_FILE, line: 4 });

        const typeError = await t.put(ON_LINK_CLICK_URL, {
            version: '',
            code: "import type { TOnLinkClick } from '@story/types';\n\nexport const onLinkClick: TOnLinkClick = (_click, s) => {\n    s.time = 'noon';\n};\n",
        });
        expect(typeError.status).toBe(422);
        expect(typeError.body.diagnostics.length).toBeGreaterThan(0);

        const noExport = await t.put(ON_LINK_CLICK_URL, {
            version: '',
            code: 'export const somethingElse = () => {};\n',
        });
        expect(noExport.status).toBe(422);
        expect(noExport.body.diagnostics[0].message).toContain('"onLinkClick"');

        expect(changedFiles(before, await snapshot(t.project.root))).toEqual([]);
        expect((await t.get(ON_LINK_CLICK_URL)).body.exists).toBe(false);
    }, 60_000);

    it('creates data/engine/ and the data barrel line for a story without them', async () => {
        await rm(path.join(t.project.root, 'data/engine'), { recursive: true });
        const dataIndex = await read('data/index.ts');
        const barrelLine = "export * from './engine';\n";
        expect(dataIndex).toContain(barrelLine);
        await writeFile(path.join(t.project.root, 'data/index.ts'), dataIndex.replace(barrelLine, ''));

        const dto = await put(ON_LINK_CLICK_URL, { description: 'Heals.' });
        expect(dto).toMatchObject({ exists: true, implemented: false });
        expect(await read(ENGINE_INDEX_FILE)).toBe(
            "import type { TEngineSettings } from '@story/types';\nimport { onLinkClick } from './onLinkClick';\n\n" +
                'export const engine: TEngineSettings = {\n    onLinkClick,\n};\n'
        );
        expect(await read('data/index.ts')).toContain("export * from './engine';");
        await expectTsc();
    }, 60_000);

    it('adds types/TEngine.ts and its types barrel line for a story created before engine settings', async () => {
        await rm(path.join(t.project.root, 'data/engine'), { recursive: true });
        await rm(path.join(t.project.root, 'types/TEngine.ts'));
        const dataIndex = await read('data/index.ts');
        await writeFile(
            path.join(t.project.root, 'data/index.ts'),
            dataIndex.replace("export * from './engine';\n", '')
        );
        const typesIndex = await read('types/index.ts');
        const typesBarrelLine = "export * from './TEngine';";
        expect(typesIndex).toContain(typesBarrelLine);
        await writeFile(path.join(t.project.root, 'types/index.ts'), typesIndex.replace(typesBarrelLine, ''));

        const dto = await put(ON_LINK_CLICK_URL, { description: 'Heals.' });
        expect(dto).toMatchObject({ exists: true, implemented: false });
        expect(await read('types/TEngine.ts')).toBe(
            await readFile(path.join(import.meta.dirname, '../template/types/TEngine.ts'), 'utf8')
        );
        expect(await read('types/index.ts')).toContain(typesBarrelLine);
        await expectTsc();
    }, 60_000);

    it('answers 404 for an unknown section', async () => {
        expect((await t.get('/api/stories/example/engine/bogus')).status).toBe(404);
    });
});

describe('topbar section', () => {
    it('saves a description only as the DefaultTopbar stub with a lazy index entry', async () => {
        const current = (await t.get(TOPBAR_URL)).body;
        if (current.exists) await put(TOPBAR_URL, { delete: true });

        const dto = await put(TOPBAR_URL, { description: 'Health, stamina and hunger.' });
        expect(dto).toMatchObject({
            section: 'topbar',
            file: TOPBAR_FILE,
            exists: true,
            implemented: false,
            description: 'Health, stamina and hunger.',
        });
        expect(await read(TOPBAR_FILE)).toBe(
            "import { DefaultTopbar } from '@story/ui';\n\n" +
                '/** Health, stamina and hunger. */\nexport const Topbar = DefaultTopbar;\n'
        );
        expect(await read(ENGINE_INDEX_FILE)).toContain("Topbar: () => import('./Topbar')");
        expect(readEngineSection(await fromDisk(), 'topbar')).toEqual(dto);
        await expectTsc();

        const deleted = await put(TOPBAR_URL, { delete: true });
        expect(deleted.exists).toBe(false);
        expect(await read(ENGINE_INDEX_FILE)).not.toContain('Topbar');
    }, 60_000);

    it('writes JSX code', async () => {
        const code = `import { TopbarStat } from '@story/ui';
import { Favorite as FavoriteIcon } from '@mui/icons-material';
import type { TTopbarProps } from '@story/types';

export const Topbar = ({ s }: TTopbarProps) => (
    <TopbarStat icon={FavoriteIcon} label="Health" value={\`\${s.characters[s.mainCharacterId].health}%\`} />
);
`;
        const dto = await put(TOPBAR_URL, { code, description: 'Health only.' });
        expect(dto).toMatchObject({ implemented: true, description: 'Health only.' });
        expect(await read(TOPBAR_FILE)).toContain(
            '/** Health only. */\nexport const Topbar = ({ s }: TTopbarProps) =>'
        );
        await expectTsc();
    }, 60_000);

    it('formats JSX by the .tsx extension', async () => {
        const code = `import { Bolt as BoltIcon, Favorite as FavoriteIcon } from '@mui/icons-material';
import { TopbarStat } from '@story/ui';
import type { TTopbarProps } from '@story/types';

const percent = <T,>(value: T) => \`\${value}%\`;

export const Topbar = ({ s }: TTopbarProps) => <><TopbarStat icon={FavoriteIcon} label="Health" value={percent(s.characters[s.mainCharacterId].health)} /><TopbarStat icon={BoltIcon} label="Health again" value={percent(s.characters[s.mainCharacterId].health)} /></>;
`;
        await put(TOPBAR_URL, { code, description: 'Health twice.' });
        expect(await read(TOPBAR_FILE)).toContain(
            'const percent = <T,>(value: T) => `${value}%`;\n\n' +
                '/** Health twice. */\nexport const Topbar = ({ s }: TTopbarProps) => (\n    <>\n        <TopbarStat icon='
        );
        await expectTsc();
    }, 60_000);
});
