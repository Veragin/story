import type { TVisualizerApi } from '../../../api';
import { modals } from '../../../shell';
import { ChapterInfoDialog } from './ChapterInfoDialog';

export const openChapterInfoDialog = (chapterId: string, api: TVisualizerApi) =>
    modals.open((close) => (
        <ChapterInfoDialog chapterId={chapterId} api={api} onClose={close} />
    ));
