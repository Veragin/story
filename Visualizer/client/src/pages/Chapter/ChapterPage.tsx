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
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import {
    api as defaultApi,
    apiEvents,
    type ApiEvents,
    type TVisualizerApi,
} from '../../api';
import { ResizableSplitter } from '../../components/ResizableSplitter';
import { ControlBar, PageContainer, router, useKey } from '../../shell';
import { ChapterGraphStore } from './ChapterGraphStore';
import { openChapterInfoDialog } from './ChapterInfoForm';
import {
    confirmDeletePassage,
    confirmRemoveCharacter,
    openAddCharacter,
    openAddPassage,
    openRemoveCharacter,
} from './dialogs';
import { PassageEditor } from './editor/PassageEditor';
import { ChapterGraphCanvas } from './graph/ChapterGraphCanvas';
import { characterColor } from './graph/colors';

type TProps = {
    chapterId: string;
    api?: TVisualizerApi;
    events?: ApiEvents;
};

/**
 * Chapter view (`#/timeline/chapter/:chapterId`, plan WP6): the Twine-like passage graph on the
 * left, the passage editor (or a chapter overview) on the right, the toolbar in the top bar.
 */
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

        const openInEditor = () =>
            void store
                .openInCodeEditor()
                .catch((e: unknown) => console.error(e));

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
                                ? _('Open passage in editor')
                                : _('Open chapter in editor')
                        }
                        onClick={openInEditor}
                    >
                        <OpenInNewIcon fontSize="small" />
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
                                            passageOptions={store.passages.map(
                                                (p) => ({ id: p.passageId })
                                            )}
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
                                            onOpenInEditor={() =>
                                                void store
                                                    .openInCodeEditor(
                                                        store.editor?.passageId
                                                    )
                                                    .catch((e: unknown) =>
                                                        console.error(e)
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

/** The right panel while no passage is open: characters, counts and how to use the view. */
const ChapterOverview = observer(({ store }: { store: ChapterGraphStore }) => (
    <SOverview>
        <Typography variant="h6">{store.chapterTitle}</Typography>
        <Typography variant="caption" color="text.secondary">
            {store.chapter?.file}
        </Typography>
        <Typography variant="subtitle2" sx={{ mt: 1 }}>
            {_('Characters')}
        </Typography>
        {store.chapterCharacters.length === 0 ? (
            <Alert
                severity="info"
                action={
                    <Button
                        color="inherit"
                        size="small"
                        onClick={() => openAddCharacter(store)}
                    >
                        {_('Add character')}
                    </Button>
                }
            >
                {_('No character has passages in this chapter yet.')}
            </Alert>
        ) : (
            store.chapterCharacters.map((c) => (
                <SCharacter key={c.id}>
                    <SSwatch style={{ borderColor: characterColor(c.id) }} />
                    <span>
                        {c.name} —{' '}
                        {c.passageCount === 1
                            ? _('1 passage')
                            : _('%d passages', c.passageCount)}
                    </span>
                    <Tooltip title={_('Remove %s from this chapter', c.name)}>
                        <IconButton
                            size="small"
                            aria-label={_('Remove character')}
                            onClick={() =>
                                void confirmRemoveCharacter(store, c.id)
                            }
                        >
                            <PersonRemoveIcon fontSize="small" />
                        </IconButton>
                    </Tooltip>
                </SCharacter>
            ))
        )}
        <Typography variant="subtitle2" sx={{ mt: 1 }}>
            {_('How to')}
        </Typography>
        <SHelp>
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
        </SHelp>
    </SOverview>
));

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

const SOverview = styled('div')`
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 12px;
`;

const SCharacter = styled('div')`
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 14px;
`;

const SSwatch = styled('span')`
    display: inline-block;
    width: 14px;
    height: 14px;
    border: 2px solid;
    border-radius: 3px;
`;

const SHelp = styled('ul')`
    margin: 0;
    padding-left: 18px;
    font-size: 13px;
    opacity: 0.8;
`;
