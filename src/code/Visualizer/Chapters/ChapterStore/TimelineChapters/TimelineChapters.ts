import { CanvasManager } from 'code/Visualizer/Graphs/CanvasManager';
import { ChapterStore } from '../ChapterStore';
import { register } from 'data/register';
import { TChapterId } from 'types/TIds';
import { TChapter } from 'types/TChapter';
import { ChapterNode } from './ChapterNode';
import { TLocationId } from 'types/TLocation';
import { Graph } from 'code/Visualizer/Graphs/Graph';

type TLocationLayout = {
    chapters: TChapter<TChapterId>[];
    rowCount: number;
    rowCountFromTop: number;
    color: string;
};

export class TimelineChapters {
    locationLayout: Partial<Record<TLocationId, TLocationLayout>> = {};
    mapping = new Map<TChapterId, ChapterNode<TChapterId>>();

    graph: Graph;

    constructor(
        public store: ChapterStore,
        private canvasManager: CanvasManager,
        private openChapter: (id: TChapterId) => void,
        private openModal: (chapter: TChapter<TChapterId>) => void
    ) {
        this.graph = new Graph(canvasManager);
        const chapterList = Object.values(register.chapters) as TChapter<TChapterId>[];
        chapterList.forEach((chapter) => this.addChapter(chapter));
        this.mapping.forEach((chapter) => {
            chapter.box.setUpEdges(this.graph);
        });
        this.recompueLocationLayout();
    }

    private recompueLocationLayout = () => {
        const old = this.locationLayout;
        this.locationLayout = {};
        const chapterList = Object.values(register.chapters) as TChapter<TChapterId>[];

        chapterList.forEach((chapter) => {
            const data = this.locationLayout[chapter.location];
            let node = this.mapping.get(chapter.chapterId);
            if (node === undefined) {
                node = this.addChapter(chapter);
            }

            if (data === undefined) {
                node.rowIndexInLocation = 0;
                this.locationLayout[chapter.location] = {
                    chapters: [chapter],
                    rowCount: 1,
                    rowCountFromTop: 0,
                    color: old[chapter.location]?.color ?? getRandomColor(),
                };
                return;
            }

            const cropChapters = data.chapters.filter((e) => areChaptersOverLaping(e, chapter));
            const maxRow = cropChapters.reduce(
                (max, e) => Math.max(max, this.mapping.get(e.chapterId)?.rowIndexInLocation ?? 0),
                -1
            );

            node.rowIndexInLocation = maxRow + 1;
            data.chapters.push(chapter);
            data.rowCount = Math.max(data.rowCount, maxRow + 2);
        });

        const locations = Object.values(this.locationLayout) as TLocationLayout[];
        let top = 0;
        locations.forEach((location) => {
            location.rowCountFromTop = top;
            top += location.rowCount;
        });

        this.mapping.forEach((chapter) => {
            const data = this.locationLayout[chapter.chapter.location];
            if (data) {
                const row = data.rowCountFromTop + chapter.rowIndexInLocation;
                chapter.box.updateRow(row, data.color);
            }
        });
    };

    addChapter = (chapter: TChapter<TChapterId>) => {
        const node = new ChapterNode(chapter);
        node.box.setupNodes(
            this.graph,
            () => {
                node.updateChapterFromPosition(this.store);
                this.recompueLocationLayout();
            },
            this.openModal,
            this.openChapter
        );

        this.mapping.set(chapter.chapterId, node);
        return node;
    };

    removeChapter = (chapterId: TChapterId) => {
        const node = this.mapping.get(chapterId);
        if (node) {
            node.box.destroyNodes(this.graph);
            this.mapping.delete(chapterId);
        }
    };

    render = () => {
        this.mapping.forEach((node) => {
            node.updateNodeByChapter(this.store);
        });
        this.canvasManager.draw();
    };

    destroy = () => {
        this.canvasManager.destroy();
        this.mapping.forEach((node) => {
            node.box.destroyNodes(this.graph);
        });
        this.mapping.clear();
    };
}

const areChaptersOverLaping = (chapter1: TChapter<TChapterId>, chapter2: TChapter<TChapterId>) => {
    return (
        !chapter1.timeRange.start.isAfter(chapter2.timeRange.end) && !chapter2.timeRange.start.isAfter(chapter1.timeRange.end)
    );
};

const getRandomColor = () => {
    const red = Math.floor(Math.random() * 128) + 128;
    const green = Math.floor(Math.random() * 128) + 128;
    const blue = Math.floor(Math.random() * 128) + 128;
    return `rgb(${red},${green},${blue})`;
};
