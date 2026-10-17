import { describe, expect, it } from 'vitest';
import { LOG_FORMAT, parseLog, parsePorcelainStatus, parseRefs } from '../src/git/gitStatus';

const z = (...records: string[]) => records.join('\0') + '\0';

const OID = 'a'.repeat(40);
const HASHES = `${'1'.repeat(40)} ${'2'.repeat(40)}`;

describe('parsePorcelainStatus', () => {
    it('reads the branch headers and every kind of change, renames included', () => {
        const status = parsePorcelainStatus(
            z(
                `# branch.oid ${OID}`,
                '# branch.head main',
                '# branch.upstream origin/main',
                '# branch.ab +2 -3',
                `1 .M N... 100644 100644 100644 ${HASHES} data/a file.ts`,
                `1 .D N... 100644 100644 000000 ${HASHES} data/gone.ts`,
                `1 A. N... 000000 100644 100644 ${HASHES} data/staged.ts`,
                `2 R. N... 100644 100644 100644 ${HASHES} R100 data/new name.ts`,
                'data/old name.ts',
                `u UU N... 100644 100644 100644 100644 ${HASHES} ${'3'.repeat(40)} data/both.ts`,
                '? data/untracked.ts'
            )
        );
        expect(status).toEqual({
            oid: OID,
            head: 'main',
            upstream: 'origin/main',
            ahead: 2,
            behind: 3,
            changes: [
                { path: 'data/a file.ts', kind: 'modified' },
                { path: 'data/gone.ts', kind: 'deleted' },
                { path: 'data/staged.ts', kind: 'added' },
                { path: 'data/new name.ts', kind: 'renamed' },
                { path: 'data/both.ts', kind: 'modified' },
                { path: 'data/untracked.ts', kind: 'added' },
            ],
        });
    });

    it('detached HEAD, no upstream, no commits', () => {
        expect(parsePorcelainStatus(z(`# branch.oid ${OID}`, '# branch.head (detached)'))).toMatchObject({
            oid: OID,
            head: null,
            upstream: null,
            ahead: 0,
            behind: 0,
        });
        expect(parsePorcelainStatus(z('# branch.oid (initial)', '# branch.head main'))).toMatchObject({
            oid: null,
            head: 'main',
            changes: [],
        });
    });
});

describe('parseRefs', () => {
    it('splits local and origin branches, without origin/HEAD', () => {
        const output = ['refs/heads/main', 'refs/heads/feat/x', 'refs/remotes/origin/HEAD', 'refs/remotes/origin/main']
            .map((ref) => `${ref}\n`)
            .join('');
        expect(parseRefs(output)).toEqual({ localBranches: ['main', 'feat/x'], remoteBranches: ['main'] });
    });
});

describe('parseLog', () => {
    it('reads the records of LOG_FORMAT with their files', () => {
        expect(LOG_FORMAT).toContain('%H');
        const output =
            `\x1e${'b'.repeat(40)}\x1fbbbbbbb\x1fAnn\x1f2026-01-02T03:04:05+01:00\x1fSecond: a, b\n\ndata/x.ts\ndata/y.ts\n` +
            `\x1e${'c'.repeat(40)}\x1fccccccc\x1fBob\x1f2026-01-01T00:00:00+00:00\x1fFirst\n`;
        expect(parseLog(output)).toEqual([
            {
                hash: 'b'.repeat(40),
                shortHash: 'bbbbbbb',
                author: 'Ann',
                date: '2026-01-02T02:04:05.000Z',
                subject: 'Second: a, b',
                files: ['data/x.ts', 'data/y.ts'],
            },
            {
                hash: 'c'.repeat(40),
                shortHash: 'ccccccc',
                author: 'Bob',
                date: '2026-01-01T00:00:00.000Z',
                subject: 'First',
            },
        ]);
        expect(parseLog('')).toEqual([]);
    });
});
