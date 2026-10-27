import type { TGitBranchDto, TGitChangeDto, TGitChangeKind, TGitCommitDto, TGitLogEntryDto } from '@story/protocol';

export type TPorcelainStatus = {
    oid: string | null;
    head: string | null;
    upstream: string | null;
    ahead: number;
    behind: number;
    changes: TGitChangeDto[];
};

const REMOTE_PREFIX = 'refs/remotes/origin/';
const LOCAL_PREFIX = 'refs/heads/';

const changeKind = (xy: string): TGitChangeKind => {
    if (xy.includes('D')) return 'deleted';
    if (xy.includes('A')) return 'added';
    return 'modified';
};

const parseHeader = (status: TPorcelainStatus, header: string) => {
    const [key, ...rest] = header.split(' ');
    const value = rest.join(' ');
    if (key === 'branch.oid') status.oid = value === '(initial)' ? null : value;
    else if (key === 'branch.head') status.head = value === '(detached)' ? null : value;
    else if (key === 'branch.upstream') status.upstream = value;
    else if (key === 'branch.ab') {
        const match = /^\+(\d+) -(\d+)$/.exec(value);
        if (match) {
            status.ahead = Number(match[1]);
            status.behind = Number(match[2]);
        }
    }
};

const fieldsAfter = (record: string, count: number): [string[], string] => {
    const parts = record.split(' ');
    return [parts.slice(0, count), parts.slice(count).join(' ')];
};

// `git status --porcelain=v2 --branch -z`: a rename's original path is the next NUL-separated record
export const parsePorcelainStatus = (output: string): TPorcelainStatus => {
    const status: TPorcelainStatus = { oid: null, head: null, upstream: null, ahead: 0, behind: 0, changes: [] };
    const records = output.split('\0');
    for (let k = 0; k < records.length; k++) {
        const record = records[k];
        if (record.startsWith('# ')) parseHeader(status, record.slice(2));
        else if (record.startsWith('1 ')) {
            const [[, xy], path] = fieldsAfter(record, 8);
            status.changes.push({ path, kind: changeKind(xy) });
        } else if (record.startsWith('2 ')) {
            const [[, xy], path] = fieldsAfter(record, 9);
            k++;
            status.changes.push({ path, kind: xy.includes('R') ? 'renamed' : changeKind(xy) });
        } else if (record.startsWith('u ')) {
            status.changes.push({ path: fieldsAfter(record, 10)[1], kind: 'modified' });
        } else if (record.startsWith('? ')) {
            status.changes.push({ path: record.slice(2), kind: 'added' });
        }
    }
    return status;
};

export type TRefs = { localBranches: string[]; remoteBranches: string[] };

// `git for-each-ref --format=%(refname) refs/heads refs/remotes/origin`
export const parseRefs = (output: string): TRefs => {
    const refs: TRefs = { localBranches: [], remoteBranches: [] };
    for (const ref of output.split('\n').filter(Boolean)) {
        if (ref.startsWith(LOCAL_PREFIX)) refs.localBranches.push(ref.slice(LOCAL_PREFIX.length));
        else if (ref.startsWith(REMOTE_PREFIX) && ref !== `${REMOTE_PREFIX}HEAD`) {
            refs.remoteBranches.push(ref.slice(REMOTE_PREFIX.length));
        }
    }
    return refs;
};

const RECORD = '\x1e';
const FIELD = '\x1f';

// the fields of LOG_FORMAT and BRANCH_FORMAT, in order
const parseCommit = ([hash, shortHash, author, date, subject]: string[]): TGitCommitDto => ({
    hash,
    shortHash,
    subject: subject ?? '',
    author: author ?? '',
    date: date ? new Date(date).toISOString() : '',
});

export const LOG_FORMAT = `--format=${RECORD}%H${FIELD}%h${FIELD}%an${FIELD}%aI${FIELD}%s`;

// `git log <LOG_FORMAT> --name-only`: each record is the header line, then the changed paths
export const parseLog = (output: string): TGitLogEntryDto[] =>
    output
        .split(RECORD)
        .filter((record) => record.trim() !== '')
        .map((record) => {
            const [header, ...lines] = record.split('\n');
            const files = lines.filter(Boolean);
            return { ...parseCommit(header.split(FIELD)), ...(files.length > 0 && { files }) };
        });

export const BRANCH_FORMAT = `--format=%(refname)${FIELD}%(objectname)${FIELD}%(objectname:short)${FIELD}%(authorname)${FIELD}%(authordate:iso-strict)${FIELD}%(contents:subject)`;

const newestFirst = (a: TGitBranchDto, b: TGitBranchDto) =>
    b.commit.date.localeCompare(a.commit.date) || a.name.localeCompare(b.name);

// `git for-each-ref <BRANCH_FORMAT> refs/heads refs/remotes/origin`: a local branch shows its own tip
export const parseBranches = (output: string, current: string | null): TGitBranchDto[] => {
    const branches = new Map<string, TGitBranchDto>();
    for (const line of output.split('\n').filter(Boolean)) {
        const [ref, ...fields] = line.split(FIELD);
        const commit = parseCommit(fields);
        const local = ref.startsWith(LOCAL_PREFIX);
        if (!local && (!ref.startsWith(REMOTE_PREFIX) || ref === `${REMOTE_PREFIX}HEAD`)) continue;
        const name = ref.slice((local ? LOCAL_PREFIX : REMOTE_PREFIX).length);
        const known = branches.get(name);
        branches.set(name, {
            name,
            current: name === current,
            local: local || (known?.local ?? false),
            remote: !local || (known?.remote ?? false),
            commit: local || !known ? commit : known.commit,
        });
    }
    return [...branches.values()].sort(newestFirst);
};

// `git diff --name-only -z`
export const parsePathList = (output: string): string[] => output.split('\0').filter(Boolean);
