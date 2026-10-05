import { describe, expect, it } from 'vitest';
import type { TFieldDesc, TTypeDefaultContext } from '@story/visualizer-protocol';
import { chapterFieldPaths, migrateInit, type TChapterInfoValue } from '../ChapterInfoForm/chapterInfo';

const ctx: TTypeDefaultContext = { literalValues: () => [], idsOf: () => ['village'] };

const field = (key: string, optional = false): TFieldDesc => ({ key, type: { t: 'number' }, optional });

describe('migrateInit', () => {
    it('renames keys, drops removed ones and fills defaults of new required fields', () => {
        const previous = [field('a'), field('b'), field('gone')];
        const next = [
            field('a'),
            field('renamed'),
            field('added'),
            field('maybe', true),
            {
                key: 'where',
                type: { t: 'ref', name: 'TLocation' },
                optional: false,
            } satisfies TFieldDesc,
        ];
        expect(migrateInit({ a: 1, b: 2, gone: 3, free: 4 }, previous, next, { b: 'renamed' }, ctx)).toEqual({
            a: 1,
            renamed: 2,
            free: 4,
            added: 0,
            where: 'village',
        });
    });

    it('follows a nested rename and removal, telling a rename from a move by position', () => {
        const nested = (fields: TFieldDesc[]): TFieldDesc[] => [
            { key: 'stats', type: { t: 'object', fields }, optional: false },
        ];
        const before = nested([field('hp'), field('mp')]);
        const migrate = (after: TFieldDesc[]) => migrateInit({ stats: { hp: 3, mp: 4 } }, before, after, {}, ctx);
        expect(migrate(nested([field('health'), field('mp')]))).toEqual({ stats: { health: 3, mp: 4 } });
        expect(migrate(nested([field('mp'), field('hp')]))).toEqual({ stats: { hp: 3, mp: 4 } });
        expect(migrate(nested([field('mp')]))).toEqual({ stats: { mp: 4 } });
    });

    it('fills new required fields of nested objects, keeping the nested values', () => {
        const nested = (fields: TFieldDesc[]): TFieldDesc[] => [
            { key: 'stats', type: { t: 'object', fields }, optional: false },
        ];
        expect(
            migrateInit({ stats: { hp: 3 } }, nested([field('hp')]), nested([field('hp'), field('mp')]), {}, ctx)
        ).toEqual({ stats: { hp: 3, mp: 0 } });
    });

    it('leaves code alone', () => {
        expect(migrateInit({ code: 'makeInit()' }, [], [field('a')], {}, ctx)).toEqual({ code: 'makeInit()' });
    });
});

describe('chapterFieldPaths', () => {
    it('lists the nested paths of children and init so diagnostics land on the right input', () => {
        const value: TChapterInfoValue = {
            title: 't',
            description: '',
            location: 'village',
            timeRange: { start: '1.1. 8:00', end: '2.1. 8:00' },
            children: [{ chapterId: 'kingdom', condition: 'x' }],
            init: { mojePromena: { time: 0 } },
        };
        const paths = chapterFieldPaths(value);
        for (const path of ['children.0.chapterId', 'children.0.condition', 'init.mojePromena.time', 'timeRange.end']) {
            expect(paths.has(path)).toBe(true);
        }
    });
});
