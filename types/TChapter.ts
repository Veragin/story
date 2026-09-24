import type { TWorldState } from '@story/data';
import { TChapterId, TChapterPassageId } from './ids';
import { TLocationId } from './TLocation';
import { TimeRange, type TPoint } from '@story/shared';
import { TTimeTrigger } from './TTimeTrigger';

export type TChapter<E extends TChapterId> = {
    chapterId: E;
    title: string;
    description: string;

    timeRange: TimeRange;
    location: TLocationId;

    children: {
        condition: string;
        chapter: TChapter<TChapterId>;
    }[];

    triggers: TTimeTrigger[];

    /**
     * Canvas position of each passage in the chapter view (VISUALIZER_PLAN §4.4). Written by
     * the Visualizer; absent until the author has arranged the graph, in which case the view
     * falls back to running a layout.
     *
     * This is the README's "save position of passages to solo file", answered by putting the
     * positions in the chapter file they belong to rather than in a sidecar. It replaces the
     * `localStorage` the graph used to use — which was per-browser, not per-story, and
     * invisible to git.
     *
     * Keyed by the existing `<chapter>-<character>-<passage>` id, so renaming a passage leaves
     * a dangling key; the client ignores keys it does not recognise and the next save prunes
     * them. `Partial` because a chapter's newest passage has no saved position yet.
     */
    layout?: Partial<Record<TChapterPassageId<E>, TPoint>>;

    init: Omit<TWorldState['chapters'][E], 'ref'>;
};
