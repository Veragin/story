import { TChapter } from 'types/TChapter';
import { TChapterId } from 'types/TIds';
import { ChapterStore } from '../ChapterStore';
import { ChapterNodeBox } from './ChapterNodeBox';

export class ChapterNode<E extends TChapterId> {
    box: ChapterNodeBox<E>;
    rowIndexInLocation: number = 0;

    constructor(public chapter: TChapter<E>) {
        this.box = new ChapterNodeBox(chapter);
    }

    updateNodeByChapter = (store: ChapterStore) => {
        const x = (this.chapter.timeRange.start.s - store.timelineStartTime.s) * store.durationHelper.timeToLengthFactor;
        const width =
            (this.chapter.timeRange.end.s - this.chapter.timeRange.start.s) * store.durationHelper.timeToLengthFactor;

        this.box.update({ x, width, title: this.chapter.title });
    };

    updateChapterFromPosition = (store: ChapterStore) => {
        const start = store.durationHelper.getTimestampFromDistance(this.box.start);
        const end = store.durationHelper.getTimestampFromDistance(this.box.end);

        this.chapter.timeRange.start = start;
        this.chapter.timeRange.end = end;
    };
}
