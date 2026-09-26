import type { TChapterId } from '@story/types';
import { ChapterPassages } from '../../Chapters/ChapterPassages';

type Props = {
    chapterId: TChapterId;
};

/**
 * Chapter view (`#/timeline/chapter/:chapterId`). For now it renders the existing passage graph;
 * WP6 replaces it with the Twine-like editor.
 */
export default function ChapterPage({ chapterId }: Props) {
    return <ChapterPassages chapterId={chapterId} />;
}
