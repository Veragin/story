import type { TChapterId } from '@story/types';
import { ChapterPage as ChapterView } from './ChapterPage';

// Components only (fast refresh); the store, `openChapterInfoDialog` and the helpers are in
// `./ChapterInfoForm` (its index.ts) and `./ChapterGraphStore`.
export { ChapterInfoDialog, ChapterInfoForm } from './ChapterInfoForm';
export type {
    TChapterInfoFormProps,
    TChapterInfoValue,
} from './ChapterInfoForm';

type Props = {
    chapterId: TChapterId;
};

/**
 * Chapter view (`#/timeline/chapter/:chapterId`): the Twine-like passage graph and editor
 * (plan WP6). The chapter-info form is exported from here for reuse (`ChapterInfoForm`,
 * `ChapterInfoDialog`, `openChapterInfoDialog`).
 */
export default function ChapterPage({ chapterId }: Props) {
    return <ChapterView chapterId={chapterId} />;
}
