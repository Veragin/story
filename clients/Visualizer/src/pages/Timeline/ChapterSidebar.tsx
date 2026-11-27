import { observer } from 'mobx-react-lite';
import CloseIcon from '@mui/icons-material/Close';
import CodeIcon from '@mui/icons-material/Code';
import DeleteIcon from '@mui/icons-material/Delete';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { TooltipIconButton } from '../../components/buttons/TooltipIconButton';
import { openSourceEditor } from '../../components/code/openSourceEditor';
import { ErrorAlert } from '../../components/feedback/ErrorAlert';
import { SaveControls } from '../../components/layout/SaveControls';
import { Sidebar } from '../../components/layout/Sidebar';
import { SidebarHeading } from '../../components/layout/SidebarHeading';
import { SidebarMeta } from '../../components/layout/SidebarMeta';
import { SideDrawer } from '../../components/layout/SideDrawer';
import { SidebarToolbar } from '../../components/layout/SidebarToolbar';
import type { EntityStore } from '../../stores/EntityStore';
import type { StructureStore } from '../../stores/StructureStore';
import { ChapterInfoAlerts } from '../Chapter/ChapterInfoForm/ChapterInfoAlerts';
import { ChapterInfoEditorForm } from '../Chapter/ChapterInfoForm/ChapterInfoEditorForm';
import { useChapterInfoEditor } from '../Chapter/ChapterInfoForm/useChapterInfoEditor';
import { useStructureStores } from '../Chapter/ChapterInfoForm/useStructureStores';
import type { TimelineStore } from './store/TimelineStore';
import { ChapterParents } from './ChapterParents';

type TProps = {
    store: TimelineStore;
    chapterId: string;
    entities: EntityStore;
    structure: StructureStore;
};

export const ChapterSidebar = observer(
    ({ store, chapterId, entities, structure }: TProps) => {
        useStructureStores(entities, structure);
        const editor = useChapterInfoEditor(chapterId, store.api, store.events);
        const title = store.chapterTitle(chapterId);

        return (
            <SideDrawer>
                <Sidebar
                    label={_('Chapter %s', title)}
                    data-testid="chapter-sidebar"
                >
                    <SidebarToolbar
                        start={
                            <>
                                <TooltipIconButton
                                    title={_('Delete chapter')}
                                    icon={DeleteIcon}
                                    tone="error"
                                    disabled={editor.saving}
                                    onClick={() => void store.deleteSelected()}
                                    data-action="delete"
                                />
                                <TooltipIconButton
                                    title={_('Open passages')}
                                    icon={OpenInNewIcon}
                                    tone="inherit"
                                    onClick={() => store.openChapter(chapterId)}
                                    data-action="open"
                                />
                                <TooltipIconButton
                                    title={_('Edit chapter source')}
                                    icon={CodeIcon}
                                    tone="inherit"
                                    onClick={() =>
                                        openSourceEditor(
                                            'chapter',
                                            chapterId,
                                            store.api,
                                            store.events
                                        )
                                    }
                                    data-action="edit-source"
                                />
                            </>
                        }
                        end={
                            <>
                                <SaveControls store={editor} />
                                <TooltipIconButton
                                    title={_('Close')}
                                    icon={CloseIcon}
                                    tone="inherit"
                                    onClick={() => store.select(null)}
                                    data-action="close"
                                />
                            </>
                        }
                    />
                    <SidebarHeading title={title} badge={_('chapter')} />
                    <SidebarMeta values={[chapterId]} />
                    <ChapterInfoAlerts store={editor} />
                    <ErrorAlert error={editor.error} />
                    <ChapterInfoEditorForm
                        store={editor}
                        structure={structure}
                        parents={
                            <ChapterParents
                                store={store}
                                chapterId={chapterId}
                            />
                        }
                    />
                </Sidebar>
            </SideDrawer>
        );
    }
);
