import { useEffect, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { Button, styled, Typography } from '@mui/material';
import { spacingCss } from '@story/ui';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import PersonRemoveIcon from '@mui/icons-material/PersonRemove';
import NoteAddIcon from '@mui/icons-material/NoteAdd';
import EditNoteIcon from '@mui/icons-material/EditNote';
import CodeIcon from '@mui/icons-material/Code';
import {
    api as defaultApi,
    apiEvents,
    type ApiEvents,
    type TVisualizerApi,
} from '../../api';
import { TooltipIconButton } from '../../components/buttons/TooltipIconButton';
import { DeleteButton } from '../../components/buttons/DeleteButton';
import { ResizableSplitter } from '../../components/layout/ResizableSplitter';
import { SaveStatus } from '../../components/feedback/SaveStatus';
import { ErrorAlert } from '../../components/feedback/ErrorAlert';
import { openSourceEditor } from '../../components/code/openSourceEditor';
import { ControlBar, PageContainer, router, useKey } from '../../shell';
import { ChapterGraphStore } from './ChapterGraphStore';
import {
    confirmDeletePassage,
    openAddCharacter,
    openChapterInfoDialog,
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
                    <SaveStatus
                        status={store.saveStatus}
                        error={store.saveError}
                        labels={{
                            saving: _('Saving layout…'),
                            saved: _('Layout saved'),
                            error: _('Layout not saved'),
                        }}
                    />
                    <TooltipIconButton
                        title={_('Add character')}
                        onClick={() => openAddCharacter(store)}
                        icon={PersonAddIcon}
                        tone="inherit"
                    />
                    <TooltipIconButton
                        title={_('Remove character')}
                        disabled={store.chapterCharacters.length === 0}
                        onClick={() => openRemoveCharacter(store)}
                        icon={PersonRemoveIcon}
                        tone="inherit"
                    />
                    <TooltipIconButton
                        title={_('Add passage')}
                        onClick={() => openAddPassage(store)}
                        icon={NoteAddIcon}
                        tone="inherit"
                    />
                    <TooltipIconButton
                        title={_('Edit chapter info')}
                        onClick={() => openChapterInfoDialog(chapterId, api)}
                        icon={EditNoteIcon}
                        tone="inherit"
                    />
                    <DeleteButton
                        iconOnly
                        label={_('Delete selected passage')}
                        tone="inherit"
                        disabled={!store.selectedId}
                        onClick={() => void confirmDeletePassage(store)}
                    />
                    <TooltipIconButton
                        title={
                            store.selectedId
                                ? _('Edit passage source')
                                : _('Edit chapter source')
                        }
                        onClick={() => editSource()}
                        icon={CodeIcon}
                        tone="inherit"
                    />
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
                        <SErrorAlert
                            error={_(
                                'Could not load chapter %s: %s',
                                chapterId,
                                store.loadError ?? ''
                            )}
                        />
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

const STitle = styled(Typography)`
    margin-right: ${spacingCss(1)};
    max-width: 220px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
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

const SErrorAlert = styled(ErrorAlert)`
    margin: ${spacingCss(2)};
`;
