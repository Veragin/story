import {
    isCode,
    isValueRecord,
    typeDefault,
    type TChapterDto,
    type TFieldDesc,
    type TMaybeCode,
    type TTypeDefaultContext,
    type TValue,
    type TValueRecord,
} from '@story/visualizer-protocol';

export type TChapterInfoValue = Pick<
    TChapterDto,
    'title' | 'description' | 'location' | 'timeRange' | 'children' | 'init' | 'dataType'
>;

export const CHAPTER_INFO_FIELDS = [
    'title',
    'description',
    'location',
    'timeRange',
    'children',
    'init',
    'dataType',
] as const;

export const chapterInfoOf = (c: TChapterInfoValue): TChapterInfoValue => ({
    title: c.title,
    description: c.description,
    location: c.location,
    timeRange: c.timeRange,
    children: c.children,
    init: c.init,
    dataType: c.dataType,
});

// containers are included so a diagnostic about a whole item shows at that item
const addValuePaths = (paths: Set<string>, prefix: string, value: TValue) => {
    paths.add(prefix);
    if (Array.isArray(value)) value.forEach((item, i) => addValuePaths(paths, `${prefix}.${i}`, item));
    else if (isValueRecord(value)) {
        Object.entries(value).forEach(([key, item]) => addValuePaths(paths, `${prefix}.${key}`, item));
    }
};

export const chapterFieldPaths = (value: TChapterInfoValue | null): Set<string> => {
    const paths = new Set<string>(CHAPTER_INFO_FIELDS);
    paths.add('timeRange.start').add('timeRange.end');
    if (value) {
        addValuePaths(paths, 'children', value.children);
        addValuePaths(paths, 'init', value.init);
    }
    return paths;
};

const objectFields = (fields: readonly TFieldDesc[], key: string): readonly TFieldDesc[] => {
    const type = fields.find((field) => field.key === key)?.type;
    return type?.t === 'object' ? type.fields : [];
};

const originalKey = (renames: Record<string, string>, key: string) =>
    Object.keys(renames).find((from) => renames[from] === key) ?? key;

// one edit changes one row, so a single key that differs at the same position is that row's rename
const positionalRenames = (previous: readonly TFieldDesc[], next: readonly TFieldDesc[]): Record<string, string> => {
    if (previous.length !== next.length) return {};
    const changed = previous.flatMap((field, i) => (field.key === next[i].key ? [] : [[field.key, next[i].key]]));
    return changed.length === 1 ? Object.fromEntries(changed) : {};
};

const migrateRecord = (
    record: TValueRecord,
    previous: readonly TFieldDesc[],
    next: readonly TFieldDesc[],
    renames: Record<string, string>,
    ctx: TTypeDefaultContext
): TValueRecord => {
    const kept = new Set(next.map((field) => field.key));
    const removed = new Set(previous.map((field) => field.key).filter((key) => !kept.has(key) && !(key in renames)));
    const migrated: TValueRecord = {};
    for (const [key, value] of Object.entries(record)) {
        if (!removed.has(key)) migrated[renames[key] ?? key] = value;
    }
    for (const field of next) {
        const value = migrated[field.key];
        if (value === undefined) {
            if (!field.optional) migrated[field.key] = typeDefault(field.type, ctx);
        } else if (field.type.t === 'object' && isValueRecord(value)) {
            const nested = objectFields(previous, originalKey(renames, field.key));
            migrated[field.key] = migrateRecord(
                value,
                nested,
                field.type.fields,
                positionalRenames(nested, field.type.fields),
                ctx
            );
        }
    }
    return migrated;
};

// `init` is exactly the data type, so it follows the data type's edits as the server does for instances
export const migrateInit = (
    init: TMaybeCode<TValueRecord>,
    previous: readonly TFieldDesc[],
    next: readonly TFieldDesc[],
    renames: Record<string, string>,
    ctx: TTypeDefaultContext
): TMaybeCode<TValueRecord> => (isCode(init) ? init : migrateRecord(init, previous, next, renames, ctx));
