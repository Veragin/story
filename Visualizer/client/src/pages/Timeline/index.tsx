import { useEffect, useRef, useState } from 'react';
import { observer } from 'mobx-react-lite';
import {
    Button,
    IconButton,
    MenuItem,
    styled,
    TextField,
    Tooltip,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import AlarmIcon from '@mui/icons-material/Alarm';
import { spacingCss } from '@story/ui';
import type { TChapterId } from '@story/types';
import { api, apiEvents } from '../../api';
import { useVisualizerStore } from '../../context';
import { ControlBar, modals, PageContainer, router, useKey } from '../../shell';
import { TimelineStore, toastNotify } from './store/TimelineStore';
import { TimelineView, type TTimelineTooltip } from './canvas/TimelineView';
import { AddModal, ReferencesModal, TriggerModal } from './TimelineModals';

const ALL = '__all__';

const toggleSx = (on: boolean) => ({ color: on ? '#ffc107' : '#ffffff55' });

const createStore = () =>
    new TimelineStore(api, apiEvents, {
        confirm: (o) => modals.confirm(o),
        showReferences: (title, references) =>
            modals.open((close) => (
                <ReferencesModal
                    title={title}
                    references={references}
                    close={close}
                />
            )),
        notify: toastNotify,
        openChapter: (chapterId) =>
            router.navigate({
                page: 'chapter',
                chapterId: chapterId as TChapterId,
            }),
    });

/**
 * Timeline page (`#/timeline`, plan WP5): chapters as boxes on the time axis, time triggers on the
 * strip, a character filter, "Add", and toggles for the chapter connections and the triggers.
 */
const TimelinePage = observer(() => {
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
        const openTrigger = (triggerId: string) =>
            modals.open((close) => (
                <TriggerModal
                    store={store}
                    triggerId={triggerId}
                    close={close}
                />
            ));
        const view = new TimelineView(canvas, store, {
            timeManager,
            onTooltip: setTooltip,
            onOpenTrigger: openTrigger,
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
        const time = viewRef.current?.viewCenterTime() ?? 0;
        modals.open((close) => (
            <AddModal store={store} time={time} close={close} />
        ));
    };

    const unplaced =
        store.unplaced.chapters.length + store.unplaced.triggers.length;

    return (
        <PageContainer>
            <ControlBar>
                <SControls>
                    <TextField
                        select
                        size="small"
                        aria-label={_('Character')}
                        value={store.characterId ?? ALL}
                        onChange={(e) =>
                            store.setCharacter(
                                e.target.value === ALL ? null : e.target.value
                            )
                        }
                        sx={{ minWidth: 170 }}
                    >
                        <MenuItem value={ALL}>{_('All characters')}</MenuItem>
                        {store.characters.map((c) => (
                            <MenuItem key={c.id} value={c.id}>
                                {c.name}
                            </MenuItem>
                        ))}
                    </TextField>
                    <Button
                        variant="outlined"
                        color="inherit"
                        size="small"
                        startIcon={<AddIcon />}
                        disabled={store.status !== 'ready'}
                        onClick={openAdd}
                    >
                        {_('Add')}
                    </Button>
                    <Tooltip
                        title={
                            store.showConnections
                                ? _('Hide connections')
                                : _('Show connections')
                        }
                    >
                        <IconButton
                            onClick={store.toggleConnections}
                            sx={toggleSx(store.showConnections)}
                            aria-pressed={store.showConnections}
                        >
                            <AccountTreeIcon />
                        </IconButton>
                    </Tooltip>
                    <Tooltip
                        title={
                            store.showTriggers
                                ? _('Hide time triggers')
                                : _('Show time triggers')
                        }
                    >
                        <IconButton
                            onClick={store.toggleTriggers}
                            sx={toggleSx(store.showTriggers)}
                            aria-pressed={store.showTriggers}
                        >
                            <AlarmIcon />
                        </IconButton>
                    </Tooltip>
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
                    <SStatus>{_('Loading…')}</SStatus>
                )}
                {store.status === 'error' && (
                    <SStatus>
                        {_(
                            'Could not load the timeline: %s',
                            store.loadError ?? ''
                        )}{' '}
                        <Button size="small" onClick={() => void store.load()}>
                            {_('Retry')}
                        </Button>
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

export default TimelinePage;

const SControls = styled('div')`
    display: flex;
    align-items: center;
    gap: ${spacingCss(1)};
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
    background: #2b2f36ee;
    color: #fff;
    font-size: 13px;
    white-space: pre-wrap;
    z-index: 2;
`;

const SStatus = styled('div')`
    position: absolute;
    top: ${spacingCss(2)};
    left: ${spacingCss(2)};
    color: #fff;
    background: #222c;
    padding: ${spacingCss(1)} ${spacingCss(2)};
    border-radius: 6px;
`;

const SHint = styled('div')`
    position: absolute;
    top: ${spacingCss(1)};
    right: ${spacingCss(1)};
    color: #fff9;
    font-size: 12px;
    pointer-events: none;
`;
