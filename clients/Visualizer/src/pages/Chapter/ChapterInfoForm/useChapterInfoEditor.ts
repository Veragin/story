import { useEffect, useState } from 'react';
import type { ApiEvents, TVisualizerApi } from '../../../api';
import { ChapterInfoEditorStore } from './ChapterInfoEditorStore';

export const useChapterInfoEditor = (chapterId: string, api: TVisualizerApi, events: ApiEvents) => {
    const [store] = useState(() => new ChapterInfoEditorStore(chapterId, api));
    useEffect(() => {
        void store.load();
        return events.subscribe({ kind: 'chapter', id: chapterId }, () => void store.onExternal());
    }, [store, events, chapterId]);
    return store;
};
