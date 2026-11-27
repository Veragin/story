import { observer } from 'mobx-react-lite';
import { Link, styled } from '@mui/material';
import { LabeledField, spacingCss } from '@story/ui';
import type { TimelineStore } from './store/TimelineStore';

type TProps = {
    store: TimelineStore;
    chapterId: string;
};

export const ChapterParents = observer(({ store, chapterId }: TProps) => {
    const parentIds = store.parentChapterIds(chapterId);
    if (parentIds.length === 0) return null;
    return (
        <LabeledField label={_('Parent chapters')}>
            <SList data-field="parents">
                {parentIds.map((id) => (
                    <Link
                        key={id}
                        component="button"
                        type="button"
                        underline="hover"
                        data-parent={id}
                        onClick={() => store.select({ kind: 'chapter', id })}
                    >
                        {store.chapterTitle(id)}
                    </Link>
                ))}
            </SList>
        </LabeledField>
    );
});

const SList = styled('div')`
    display: flex;
    flex-wrap: wrap;
    gap: ${spacingCss(0.5)} ${spacingCss(1.5)};
`;
