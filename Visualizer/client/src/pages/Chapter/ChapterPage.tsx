import { useEffect, useState, type ReactNode } from 'react';
import { observer } from 'mobx-react-lite';
import {
    Alert,
    Button,
    IconButton,
    styled,
    Tooltip,
    Typography,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import PersonRemoveIcon from '@mui/icons-material/PersonRemove';
import NoteAddIcon from '@mui/icons-material/NoteAdd';
import EditNoteIcon from '@mui/icons-material/EditNote';
import DeleteIcon from '@mui/icons-material/Delete';
import CodeIcon from '@mui/icons-material/Code';
import {
    api as defaultApi,
    apiEvents,
    type ApiEvents,
    type TVisualizerApi,
} from '../../api';
import { ResizableSplitter } from '../../components/ResizableSplitter';
import { openSourceEditor } from '../../components/openSourceEditor';
import { ControlBar, PageContainer, router, useKey } from '../../shell';
import { ChapterGraphStore } from './ChapterGraphStore';
import { openChapterInfoDialog } from './ChapterInfoForm/openChapterInfoDialog';
import {
    confirmDeletePassage,
    openAddCharacter,
    openAddPassage,
    openRemoveCharacter,
} from './dialogs';
import { PassageEditor } from './editor/PassageEditor/PassageEditor';
import { ChapterGraphCanvas } from './graph/ChapterGraphCanvas';
import { ChapterOverview } from './ChapterOverview';

type TProps = {
    chapterId: string;
    api?: TVisualizerApi;
    events?: ApiEvents;
};

export const ChapterPage = observer(
    ({ chapterId, api = defaultApi, events = apiEvents }: TProps) => {
        const [store] = useState(
            () => new ChapterGraphStore({ chapterId, api, events })
        );

        useEffect(() => {
            store.start();
            void store.load();
            return () => void store.destroy();
        }, [store]);

        useKey('Delete', () => {
            if (!store.selectedId) return false;
            void confirmDeletePassage(store);
            return true;
        });
        useKey('Enter', () => {
            if (!store.selectedId) return false;
            store.openEditor(store.selectedId);
            return true;
        });

        const editSource = (passageId?: string) => {
            const { owner, id } = store.sourceTarget(passageId);
            openSourceEditor(owner, id, api, events);
        };

        return (
            <PageContainer>
                <ControlBar>
                    <STitle variant="body2" title={chapterId}>
                        {store.chapterTitle}
                    </STitle>
                    <SaveStatus store={store} />
                    <ToolButton
                        title={_('Add character')}
                        onClick={() => openAddCharacter(store)}
                    >
                        <PersonAddIcon fontSize="small" />
                    </ToolButton>
                    <ToolButton
                        title={_('Remove character')}
                        disabled={store.chapterCharacters.length === 0}
                        onClick={() => openRemoveCharacter(store)}
                    >
                        <PersonRemoveIcon fontSize="small" />
                    </ToolButton>
                    <ToolButton
                        title={_('Add passage')}
                        onClick={() => openAddPassage(store)}
                    >
                        <NoteAddIcon fontSize="small" />
                    </ToolButton>
                    <ToolButton
                        title={_('Edit chapter info')}
                        onClick={() => openChapterInfoDialog(chapterId, api)}
                    >
                        <EditNoteIcon fontSize="small" />
                    </ToolButton>
                    <ToolButton
                        title={_('Delete selected passage')}
                        disabled={!store.selectedId}
                        onClick={() => void confirmDeletePassage(store)}
                    >
                        <DeleteIcon fontSize="small" />
                    </ToolButton>
                    <ToolButton
                        title={
                            store.selectedId
                                ? _('Edit passage source')
                                : _('Edit chapter source')
                        }
                        onClick={() => editSource()}
                    >
                        <CodeIcon fontSize="small" />
                    </ToolButton>
                    <Button
                        color="inherit"
                        size="small"
                        startIcon={<ArrowBackIcon />}
                        onClick={() => router.navigate({ page: 'timeline' })}
                    >
                        {_('Timeline')}
                    </Button>
                </ControlBar>

                <SContent>
                    {store.status === 'error' ? (
                        <Alert severity="error" sx={{ m: 2 }}>
                            {_(
                                'Could not load chapter %s: %s',
                                chapterId,
                                store.loadError ?? ''
                            )}
                        </Alert>
                    ) : (
                        <ResizableSplitter
                            leftContent={<ChapterGraphCanvas store={store} />}
                            rightContent={
                                <SSide>
                                    {store.editor ? (
                                        <PassageEditor
                                            key={store.editor.passageId}
                                            store={store.editor}
                                            api={store.api}
                                            passageOptions={store.passages.map(
                                                (p) => ({ id: p.passageId })
                                            )}
                                            transitionOptions={
                                                store.transitionOptions
                                            }
                                            itemOptions={(
                                                store.project?.items ?? []
                                            ).map((i) => ({
                                                id: i.id,
                                                label: i.name,
                                            }))}
                                            onClose={() => store.closeEditor()}
                                            onDelete={() =>
                                                void confirmDeletePassage(
                                                    store,
                                                    store.editor?.passageId
                                                )
                                            }
                                            onEditSource={() =>
                                                editSource(
                                                    store.editor?.passageId
                                                )
                                            }
                                        />
                                    ) : (
                                        <ChapterOverview store={store} />
                                    )}
                                </SSide>
                            }
                            initialLeftWidth={65}
                            minLeftWidth={30}
                            maxLeftWidth={85}
                        />
                    )}
                </SContent>
            </PageContainer>
        );
    }
);

const ToolButton = ({
    title,
    disabled,
    onClick,
    children,
}: {
    title: string;
    disabled?: boolean;
    onClick: () => void;
    children: ReactNode;
}) => (
    <Tooltip title={title}>
        <span>
            <IconButton
                color="inherit"
                size="small"
                disabled={disabled}
                onClick={onClick}
                aria-label={title}
            >
                {children}
            </IconButton>
        </span>
    </Tooltip>
);

const SaveStatus = observer(({ store }: { store: ChapterGraphStore }) => {
    const text =
        store.saveStatus === 'pending' || store.saveStatus === 'saving'
            ? _('Saving layout…')
            : store.saveStatus === 'saved'
              ? _('Layout saved')
              : store.saveStatus === 'error'
                ? _('Layout not saved')
                : '';
    if (!text) return null;
    return (
        <Tooltip title={store.saveError ?? ''}>
            <SStatus
                variant="caption"
                data-error={store.saveStatus === 'error' ? 'true' : undefined}
            >
                {text}
            </SStatus>
        </Tooltip>
    );
});

const STitle = styled(Typography)`
    margin-right: 8px;
    max-width: 220px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
`;

const SStatus = styled(Typography)`
    margin-right: 8px;
    opacity: 0.7;
    &[data-error='true'] {
        color: #f44336;
        opacity: 1;
    }
`;

const SContent = styled('div')`
    flex: 1;
    min-height: 0;
    overflow: hidden;
`;

const SSide = styled('div')`
    height: 100%;
    overflow-y: auto;
    background: #1a1a1a;
    color: #fff;
`;
