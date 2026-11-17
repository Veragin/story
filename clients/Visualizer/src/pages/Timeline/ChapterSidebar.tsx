import { observer } from 'mobx-react-lite';
import { styled } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import CodeIcon from '@mui/icons-material/Code';
import DeleteIcon from '@mui/icons-material/Delete';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { TooltipIconButton } from '../../components/buttons/TooltipIconButton';
import { openSourceEditor } from '../../components/code/openSourceEditor';
import { ErrorAlert } from '../../components/feedback/ErrorAlert';
import { LoadingState } from '../../components/feedback/LoadingState';
import { SaveControls } from '../../components/layout/SaveControls';
import { Sidebar } from '../../components/layout/Sidebar';
import { SidebarHeading } from '../../components/layout/SidebarHeading';
import { SidebarMeta } from '../../components/layout/SidebarMeta';
import { SidebarOverlay } from '../../components/layout/SidebarOverlay';
import { SidebarToolbar } from '../../components/layout/SidebarToolbar';
import { StructureContext } from '../../structure/structureContext';
import type { EntityStore } from '../../stores/EntityStore';
import type { StructureStore } from '../../stores/StructureStore';
import { ChapterInfoAlerts } from '../Chapter/ChapterInfoForm/ChapterInfoAlerts';
import { ChapterInfoForm } from '../Chapter/ChapterInfoForm/ChapterInfoForm';
import { useChapterInfoEditor } from '../Chapter/ChapterInfoForm/useChapterInfoEditor';
import { useStructureStores } from '../Chapter/ChapterInfoForm/useStructureStores';
import type { TimelineStore } from './store/TimelineStore';

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
            <SOverlay>
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
                    <SidebarMeta values={[chapterId, editor.chapter?.file]} />
                    <ChapterInfoAlerts store={editor} />
                    <ErrorAlert error={editor.error} />
                    {editor.draft && editor.chapter ? (
                        <StructureContext.Provider value={structure}>
                            <ChapterInfoForm
                                chapterId={chapterId}
                                file={editor.chapter.file}
                                value={editor.draft}
                                onChange={(v) => editor.setDraft(v)}
                                diagnostics={editor.diagnosticsFor}
                                disabled={editor.saving}
                            />
                        </StructureContext.Provider>
                    ) : (
                        !editor.error && <LoadingState />
                    )}
                </Sidebar>
            </SOverlay>
        );
    }
);

const SOverlay = styled(SidebarOverlay)`
    width: min(420px, 90vw);
`;
