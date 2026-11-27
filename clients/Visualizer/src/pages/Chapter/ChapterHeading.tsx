import { observer } from 'mobx-react-lite';
import { isCode } from '@story/protocol';
import { SidebarHeading } from '../../components/layout/SidebarHeading';
import type { ChapterInfoEditorStore } from './ChapterInfoForm/ChapterInfoEditorStore';

type TProps = {
    editor: ChapterInfoEditorStore;
    fallbackTitle: string;
};

export const ChapterHeading = observer(({ editor, fallbackTitle }: TProps) => {
    const { draft } = editor;
    return draft && !isCode(draft.title) ? (
        <SidebarHeading
            title={draft.title}
            badge={_('chapter')}
            placeholder={editor.chapterId}
            dataField="title"
            onTitleChange={(title) => editor.setDraft({ ...draft, title })}
        />
    ) : (
        <SidebarHeading title={fallbackTitle} badge={_('chapter')} />
    );
});
