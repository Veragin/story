import { useEffect, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { ButtonBase, styled, Tooltip } from '@mui/material';
import { spacingCss } from '@story/ui';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import NoteAddIcon from '@mui/icons-material/NoteAdd';
import CodeIcon from '@mui/icons-material/Code';
import {
    api as defaultApi,
    apiEvents,
    type ApiEvents,
    type TVisualizerApi,
} from '../../api';
import { TooltipIconButton } from '../../components/buttons/TooltipIconButton';
import { ResizableSplitter } from '../../components/layout/ResizableSplitter';
import { SaveStatus } from '../../components/feedback/SaveStatus';
import { ErrorAlert } from '../../components/feedback/ErrorAlert';
import { openSourceEditor } from '../../components/code/openSourceEditor';
import { ControlBar, PageContainer, router, useKey } from '../../shell';
import { ChapterGraphStore } from './ChapterGraphStore';
import {
    confirmDeletePassage,
    openChapterInfoDialog,
    openAddPassage,
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
                    <TooltipIconButton
                        title={_('Timeline')}
                        onClick={() => router.navigate({ page: 'timeline' })}
                        icon={ArrowBackIcon}
                        tone="inherit"
                    />
                    <Tooltip
                        title={_('Edit chapter info (%s)', chapterId)}
                        describeChild
                    >
                        <STitle
                            onClick={() =>
                                openChapterInfoDialog(chapterId, api)
                            }
                        >
                            {store.chapterTitle}
                        </STitle>
                    </Tooltip>
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
                        title={_('Add passage')}
                        onClick={() => openAddPassage(store)}
                        icon={NoteAddIcon}
                        tone="inherit"
                    />
                    <TooltipIconButton
                        title={_('Edit chapter source')}
                        onClick={() => editSource()}
                        icon={CodeIcon}
                        tone="inherit"
                    />
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
                                            finishOptions={store.finishOptions}
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

const STitle = styled(ButtonBase)`
    font-size: ${({ theme }) => theme.typography.body2.fontSize};
    display: block;
    margin-right: ${spacingCss(1)};
    padding: ${spacingCss(0.5)};
    border-radius: ${({ theme }) => theme.shape.borderRadius}px;
    max-width: 220px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;

    &:hover {
        background: ${({ theme }) => theme.palette.action.hover};
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

const SErrorAlert = styled(ErrorAlert)`
    margin: ${spacingCss(2)};
`;
