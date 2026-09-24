import styled from '@emotion/styled';
import AddIcon from '@mui/icons-material/Add';
import AlarmIcon from '@mui/icons-material/Alarm';
import CenterFocusStrongIcon from '@mui/icons-material/CenterFocusStrong';
import DeleteIcon from '@mui/icons-material/Delete';
import SettingsInputComponentIcon from '@mui/icons-material/SettingsInputComponent';
import ZoomInIcon from '@mui/icons-material/ZoomIn';
import ZoomOutIcon from '@mui/icons-material/ZoomOut';
import {
    Alert,
    ButtonGroup,
    CircularProgress,
    IconButton,
    MenuItem,
    Paper,
    Select,
    Tooltip,
    Typography,
} from '@mui/material';
import type { Scene } from '@story/canvas';
import { CanvasHost } from '@story/canvas/react';
import { Time } from '@story/shared';
import { Column, Row, spacingCss } from '@story/ui';
import { observer } from 'mobx-react-lite';
import { useCallback, useEffect, useMemo } from 'react';
import { useVisualizerStore } from '../../context';
import { TimelineStore } from './TimelineStore';

/**
 * The world-events timeline (VISUALIZER_PLAN §7, Phase 8; README § Visualizer's timeline rows).
 *
 * Replaces `ChapterTimeline.tsx` and the `ChapterStore` tree behind it — two canvases, a DOM
 * marker overlay, a five-step zoom table and a bespoke mouse listener — with one `CanvasHost`
 * and a viewport. See `TimelineStore` for why that collapses so far.
 *
 * Renders a toolbar rather than a nav: it is embedded in `Chapters.tsx`, which supplies the
 * page chrome. Two navs stacked on one screen was what the first attempt produced.
 */
export const TimelineView = observer(() => {
    const visualizer = useVisualizerStore();

    const store = useMemo(
        () =>
            new TimelineStore(
                visualizer.agent,
                visualizer.timeManager,
                (chapterId) =>
                    visualizer.setActiveTab({
                        tab: 'chapter',
                        chapterId: chapterId as never,
                    }),
                (chapterId, triggerId) =>
                    visualizer.setActiveTab({
                        tab: 'trigger',
                        chapterId,
                        triggerId,
                    })
            ),
        [visualizer]
    );

    useEffect(() => {
        void store.load();
    }, [store]);

    const onReady = useCallback((scene: Scene) => store.attach(scene), [store]);

    return (
        <STimeline>
            <SToolbar>
                {/* README: "timeline: chapters per character, character selector". */}
                <Select
                    size="small"
                    displayEmpty
                    value={store.characterFilter ?? ''}
                    onChange={(event) =>
                        store.setCharacterFilter(
                            event.target.value === ''
                                ? null
                                : event.target.value
                        )
                    }
                    renderValue={(value) =>
                        value
                            ? (store.characters.find(
                                  (character) => character.id === value
                              )?.name ?? String(value))
                            : _('All characters')
                    }
                    sx={{ minWidth: 170, height: 36 }}
                >
                    <MenuItem value="">{_('All characters')}</MenuItem>
                    {store.characters.map((character) => (
                        <MenuItem key={character.id} value={character.id}>
                            {character.name}
                        </MenuItem>
                    ))}
                </Select>

                <ButtonGroup size="small">
                    <Tooltip
                        title={
                            store.showConnections
                                ? _('Hide connections')
                                : _('Show connections')
                        }
                    >
                        <IconButton
                            size="small"
                            color={
                                store.showConnections ? 'primary' : 'default'
                            }
                            onClick={store.toggleConnections}
                        >
                            <SettingsInputComponentIcon fontSize="small" />
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
                            size="small"
                            color={store.showTriggers ? 'primary' : 'default'}
                            onClick={store.toggleTriggers}
                        >
                            <AlarmIcon fontSize="small" />
                        </IconButton>
                    </Tooltip>
                </ButtonGroup>

                <ButtonGroup size="small">
                    <Tooltip title={_('Zoom in')}>
                        <IconButton
                            size="small"
                            onClick={() => store.zoomBy(1.6)}
                        >
                            <ZoomInIcon fontSize="small" />
                        </IconButton>
                    </Tooltip>
                    <Tooltip title={_('Zoom out')}>
                        <IconButton
                            size="small"
                            onClick={() => store.zoomBy(1 / 1.6)}
                        >
                            <ZoomOutIcon fontSize="small" />
                        </IconButton>
                    </Tooltip>
                    <Tooltip title={_('Fit the whole story')}>
                        <IconButton size="small" onClick={store.fit}>
                            <CenterFocusStrongIcon fontSize="small" />
                        </IconButton>
                    </Tooltip>
                </ButtonGroup>

                <ButtonGroup size="small">
                    <Tooltip title={_('Add a chapter')}>
                        <IconButton
                            size="small"
                            onClick={() =>
                                visualizer.setActiveTab({ tab: 'chapters' })
                            }
                        >
                            <AddIcon fontSize="small" />
                        </IconButton>
                    </Tooltip>
                    <Tooltip title={_('Delete the selected chapter')}>
                        <span>
                            <IconButton
                                size="small"
                                disabled={store.selectedChapter === undefined}
                                onClick={() =>
                                    void store.deleteSelectedChapter()
                                }
                            >
                                <DeleteIcon fontSize="small" />
                            </IconButton>
                        </span>
                    </Tooltip>
                </ButtonGroup>

                <Typography variant="caption" color="text.secondary">
                    {_(
                        'wheel = zoom time · middle-drag = pan · drag a chapter to move it'
                    )}
                </Typography>
            </SToolbar>

            {store.error !== null && (
                <SMessage>
                    <Alert severity="error">{store.error}</Alert>
                    <Alert severity="info">
                        {_(
                            'The timeline is read through the Visualizer server on :8123. Start it with `yarn dev:visualizer-server`.'
                        )}
                    </Alert>
                </SMessage>
            )}

            {store.loading && store.error === null && (
                <SMessage>
                    <CircularProgress />
                </SMessage>
            )}

            <SCanvas>
                <CanvasHost onReady={onReady} />

                {/* README: "description on hover". A DOM tooltip rather than canvas text —
                    it wraps, it selects, and it does not fight the zoom. */}
                {store.hoveredChapter && store.hoverAt && (
                    <SHover
                        elevation={4}
                        style={{
                            left: store.hoverAt.x + 16,
                            top: store.hoverAt.y + 16,
                        }}
                    >
                        <Typography variant="subtitle2">
                            {store.hoveredChapter.title}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                            {store.hoveredChapter.description ||
                                _('No description')}
                        </Typography>
                        {store.hoveredChapter.timeRange && (
                            <Typography
                                variant="caption"
                                color="text.secondary"
                            >
                                {visualizer.timeManager.renderTime(
                                    // `Time` is seconds, and so is the timeline's world x.
                                    Time.fromS(
                                        store.hoveredChapter.timeRange.start
                                    ),
                                    'dateTime'
                                )}
                            </Typography>
                        )}
                    </SHover>
                )}
            </SCanvas>
        </STimeline>
    );
});

const STimeline = styled(Column)`
    flex: 1;
    min-height: 0;
`;

/** Its own surface, so the controls are legible against the canvas behind them. */
const SToolbar = styled(Row)`
    gap: ${spacingCss(1)};
    align-items: center;
    padding: ${spacingCss(0.5)} ${spacingCss(1)};
    flex-wrap: wrap;
    flex: 0 0 auto;
    background-color: rgba(255, 255, 255, 0.06);
    border-bottom: 1px solid rgba(255, 255, 255, 0.12);
`;

const SCanvas = styled('div')`
    flex: 1;
    min-height: 0;
    position: relative;
`;

const SHover = styled(Paper)`
    position: absolute;
    z-index: 20;
    max-width: 320px;
    padding: ${spacingCss(1)} ${spacingCss(1.5)};
    display: flex;
    flex-direction: column;
    gap: ${spacingCss(0.25)};
    pointer-events: none;
`;

const SMessage = styled(Column)`
    gap: ${spacingCss(2)};
    margin: auto;
    align-items: center;
    padding: ${spacingCss(3)};
`;
