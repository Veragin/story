import { observer } from 'mobx-react-lite';
import CodeIcon from '@mui/icons-material/Code';
import EditIcon from '@mui/icons-material/Edit';
import type { ApiEvents } from '../../api';
import { TooltipIconButton } from '../../components/buttons/TooltipIconButton';
import { FormSection } from '../../components/form/FormSection';
import { ErrorAlert } from '../../components/feedback/ErrorAlert';
import { HintText } from '../../components/feedback/HintText';
import { BulletList } from '../../components/feedback/BulletList';
import { DescriptionInput } from '../../components/inputs/DescriptionInput';
import type { IEditorSource } from '../../components/layout/editorSource';
import { SaveControls } from '../../components/layout/SaveControls';
import { Sidebar } from '../../components/layout/Sidebar';
import { SidebarMeta } from '../../components/layout/SidebarMeta';
import { SidebarToolbar } from '../../components/layout/SidebarToolbar';
import type { ChapterGraphStore } from './ChapterGraphStore';
import { ChapterCharacters } from './ChapterCharacters';
import { ChapterHeading } from './ChapterHeading';
import { ChapterInfoAlerts } from './ChapterInfoForm/ChapterInfoAlerts';
import { useChapterInfoEditor } from './ChapterInfoForm/useChapterInfoEditor';

type TProps = {
    store: ChapterGraphStore;
    events: ApiEvents;
    onEditInfo: () => void;
    onEditSource: () => void;
};

export const ChapterOverview = observer(
    ({ store, events, onEditInfo, onEditSource }: TProps) => {
        const editor = useChapterInfoEditor(store.chapterId, store.api, events);
        const { draft } = editor;

        const source: IEditorSource = {
            dirty: editor.dirty,
            saving: editor.saving,
            stale: editor.conflict,
            discard: () => editor.reset(),
            save: () => editor.save(),
        };

        return (
            <Sidebar label={_('Chapter %s', store.chapterId)}>
                <SidebarToolbar
                    start={
                        <>
                            <TooltipIconButton
                                title={_('Edit chapter info')}
                                icon={EditIcon}
                                tone="inherit"
                                onClick={onEditInfo}
                                data-action="edit-info"
                            />
                            <TooltipIconButton
                                title={_('Edit chapter source')}
                                icon={CodeIcon}
                                tone="inherit"
                                onClick={onEditSource}
                                data-action="edit-source"
                            />
                        </>
                    }
                    end={<SaveControls store={source} />}
                />
                <ChapterHeading
                    editor={editor}
                    fallbackTitle={store.chapterTitle}
                />
                <SidebarMeta values={[store.chapterId, store.chapter?.file]} />
                {draft && (
                    <DescriptionInput
                        value={draft.docComment ?? ''}
                        onChange={(docComment) =>
                            editor.setDraft({ ...draft, docComment })
                        }
                    />
                )}
                <ChapterInfoAlerts store={editor} />
                <ErrorAlert error={editor.error} />
                <ChapterCharacters store={store} />
                <FormSection title={_('How to')}>
                    <HintText size="small">
                        <BulletList>
                            <li>
                                {_(
                                    'Drag a box to move it; positions are saved to the chapter layout file.'
                                )}
                            </li>
                            <li>
                                {_(
                                    'Double-click a box (or select it and press Enter) to edit the passage.'
                                )}
                            </li>
                            <li>
                                {_(
                                    'Delete removes the selected passage (after a confirmation).'
                                )}
                            </li>
                            <li>
                                {_(
                                    'Drag the background, or use WASD / arrows, to move; scroll to zoom.'
                                )}
                            </li>
                            <li>
                                {_(
                                    'Dashed arrows are conditional links; red ones point to passages that do not exist.'
                                )}
                            </li>
                        </BulletList>
                    </HintText>
                </FormSection>
            </Sidebar>
        );
    }
);
