import type { TVisualizerApi } from '../../../api';
import { entityStore, structureStore } from '../../../context';
import { modals } from '../../../shell';
import { ChapterInfoDialog } from './ChapterInfoDialog';

export const openChapterInfoDialog = (chapterId: string, api: TVisualizerApi) =>
    modals.open((close) => (
        <ChapterInfoDialog
            chapterId={chapterId}
            api={api}
            structure={structureStore}
            entities={entityStore}
            onClose={close}
        />
    ));
