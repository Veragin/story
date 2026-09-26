import { isCode, type TMaybeCode, type TTimeRangeDto } from '@story/visualizer-protocol';
import { Time, TimeRange } from '@story/shared';
import type { TChapter, TChapterId } from '@story/types';
import { createMockSeed, displayText } from '../../../../api';

/**
 * **Legacy, synchronous** view of the sample story for the pre-WP1 code that still wants plain
 * objects right away (the resolvers behind the old forms, the old timeline). It reads the
 * `mockApi` seed, *not* `@story/data` — the client must never run the story (plan §3 "Live
 * refresh"). It goes away with its consumers: WP5 (timeline), WP6 (chapter view), WP7 (entities)
 * load everything through `api` instead.
 */
export const sampleSeed = createMockSeed();

const toTime = (value: TMaybeCode<string>) => {
    if (isCode(value)) return Time.fromS(0);
    return Time.fromString(value as Parameters<typeof Time.fromString>[0]);
};

const toTimeRange = (range: TMaybeCode<TTimeRangeDto>) =>
    isCode(range) ? new TimeRange(Time.fromS(0), Time.fromS(0)) : new TimeRange(toTime(range.start), toTime(range.end));

/**
 * The sample chapters as runtime `TChapter` objects (with `Time` instances), the shape the old
 * timeline was written against. `init` and `triggers` are left empty — the timeline never read them.
 */
export const sampleChapters = (): TChapter<TChapterId>[] => {
    const byId = new Map<string, TChapter<TChapterId>>();
    for (const dto of sampleSeed.chapters) {
        byId.set(dto.chapterId, {
            chapterId: dto.chapterId as TChapterId,
            title: displayText(dto.title, dto.chapterId),
            description: displayText(dto.description, ''),
            timeRange: toTimeRange(dto.timeRange),
            location: displayText(dto.location, '') as TChapter<TChapterId>['location'],
            children: [],
            triggers: [],
            init: {},
        } as unknown as TChapter<TChapterId>);
    }
    for (const dto of sampleSeed.chapters) {
        if (isCode(dto.children)) continue;
        const chapter = byId.get(dto.chapterId);
        for (const child of dto.children) {
            const target = typeof child.chapterId === 'string' ? byId.get(child.chapterId) : undefined;
            if (chapter && target) {
                chapter.children.push({ condition: displayText(child.condition, ''), chapter: target });
            }
        }
    }
    return [...byId.values()];
};
