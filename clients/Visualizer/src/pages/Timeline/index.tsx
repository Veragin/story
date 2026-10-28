import { useEffect, useRef, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { styled, ToggleButton, Tooltip } from '@mui/material';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import AlarmIcon from '@mui/icons-material/Alarm';
import { spacingCss } from '@story/ui';
import { api, apiEvents } from '../../api';
import { useVisualizerStore } from '../../context';
import { AddButton } from '../../components/buttons/AddButton';
import { HelpButton } from '../../components/buttons/HelpButton';
import { HintText } from '../../components/feedback/HintText';
import { LoadErrorState } from '../../components/feedback/LoadErrorState';
import { LoadingState } from '../../components/feedback/LoadingState';
import { SelectInput } from '../../components/inputs/SelectInput';
import { ControlBar, modals, PageContainer, router, useKey } from '../../shell';
import { TimelineStore, toastNotify } from './store/TimelineStore';
import { TimelineView, type TTimelineTooltip } from './canvas/TimelineView';
import {
    openAddTimelineItem,
    openTimelineHelp,
    openTrigger,
    showUndeletedReferences,
} from './timelineDialogs';

const ALL = '__all__';

const createStore = () =>
    new TimelineStore(api, apiEvents, {
        confirm: (o) => modals.confirm(o),
        showReferences: showUndeletedReferences,
        notify: toastNotify,
        openChapter: (chapterId) =>
            router.navigate({
                page: 'chapter',
                chapterId,
            }),
    });

export const TimelinePage = observer(() => {
    const { timeManager } = useVisualizerStore();
    const [store] = useState(createStore);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const viewRef = useRef<TimelineView | null>(null);
    const [tooltip, setTooltip] = useState<TTimelineTooltip>(null);

    useEffect(() => {
        void store.load();
        const off = store.start();
        return () => {
            off();
            store.dispose();
        };
    }, [store]);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const view = new TimelineView(canvas, store, {
            timeManager,
            onTooltip: setTooltip,
            onOpenTrigger: (triggerId) => openTrigger(store, triggerId),
        });
        viewRef.current = view;
        return () => {
            view.destroy();
            viewRef.current = null;
        };
    }, [store, timeManager]);

    useKey(['Delete', 'Backspace'], () => {
        if (!store.selected) return false;
        void store.deleteSelected();
        return true;
    });

    const openAdd = () => {
        openAddTimelineItem(store, viewRef.current?.viewCenterTime() ?? 0);
    };

    const unplaced =
        store.unplaced.chapters.length + store.unplaced.triggers.length;

    return (
        <PageContainer>
            <ControlBar>
                <SControls>
                    <SCharacter>
                        <SelectInput
                            ariaLabel={_('Character')}
                            value={store.characterId ?? ALL}
                            onChange={(id) =>
                                store.setCharacter(id === ALL ? null : id)
                            }
                            options={[
                                { id: ALL, label: _('All characters') },
                                ...store.characters.map((c) => ({
                                    id: c.id,
                                    label: c.name,
                                })),
                            ]}
                        />
                    </SCharacter>
                    <AddButton
                        variant="outlined"
                        tone="inherit"
                        disabled={store.status !== 'ready'}
                        onClick={openAdd}
                    />
                    <Tooltip
                        title={
                            store.showConnections
                                ? _('Hide connections')
                                : _('Show connections')
                        }
                    >
                        <ToggleButton
                            value="showConnections"
                            size="small"
                            selected={store.showConnections}
                            onChange={store.toggleConnections}
                        >
                            <AccountTreeIcon fontSize="small" />
                        </ToggleButton>
                    </Tooltip>
                    <Tooltip
                        title={
                            store.showTriggers
                                ? _('Hide time triggers')
                                : _('Show time triggers')
                        }
                    >
                        <ToggleButton
                            value="showTriggers"
                            size="small"
                            selected={store.showTriggers}
                            onChange={store.toggleTriggers}
                        >
                            <AlarmIcon fontSize="small" />
                        </ToggleButton>
                    </Tooltip>
                    <HelpButton onClick={() => openTimelineHelp()} />
                </SControls>
            </ControlBar>
            <SStage>
                <SCanvas ref={canvasRef} />
                {tooltip && (
                    <STooltip style={{ left: tooltip.x, top: tooltip.y }}>
                        <strong>{tooltip.title}</strong>
                        {tooltip.lines.map((line, i) => (
                            <div key={i}>{line}</div>
                        ))}
                    </STooltip>
                )}
                {store.status === 'loading' && (
                    <SStatus>
                        <LoadingState />
                    </SStatus>
                )}
                {store.status === 'error' && (
                    <SStatus>
                        <LoadErrorState
                            message={_(
                                'Could not load the timeline: %s',
                                store.loadError ?? ''
                            )}
                            onRetry={() => void store.load()}
                        />
                    </SStatus>
                )}
                {unplaced > 0 && (
                    <SHint>
                        {_(
                            '%d chapter(s) / trigger(s) have a computed time and are not shown',
                            unplaced
                        )}
                    </SHint>
                )}
            </SStage>
        </PageContainer>
    );
});

const SControls = styled('div')`
    display: flex;
    align-items: center;
    gap: ${spacingCss(1)};
`;

const SCharacter = styled('div')`
    min-width: 170px;
`;

const SStage = styled('div')`
    position: relative;
    flex: 1;
    min-height: 0;
`;

const SCanvas = styled('canvas')`
    display: block;
    width: 100%;
    height: 100%;
`;

const STooltip = styled('div')`
    position: absolute;
    pointer-events: none;
    max-width: 320px;
    padding: 6px 10px;
    border-radius: 6px;
    background: ${({ theme }) => theme.palette.surface.overlay};
    color: ${({ theme }) => theme.palette.text.primary};
    font-size: ${({ theme }) => theme.typography.small.fontSize};
    white-space: pre-wrap;
    z-index: 2;
`;

const SStatus = styled('div')`
    position: absolute;
    top: ${spacingCss(2)};
    left: ${spacingCss(2)};
`;

const SHint = styled(HintText)`
    position: absolute;
    top: ${spacingCss(1)};
    right: ${spacingCss(1)};
    pointer-events: none;
`;
