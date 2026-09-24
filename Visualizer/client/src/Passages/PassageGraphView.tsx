import styled from '@emotion/styled';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import CenterFocusStrongIcon from '@mui/icons-material/CenterFocusStrong';
import DeleteIcon from '@mui/icons-material/Delete';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import SaveIcon from '@mui/icons-material/Save';
import StopIcon from '@mui/icons-material/Stop';
import {
    Alert,
    Button,
    ButtonGroup,
    Chip,
    CircularProgress,
    IconButton,
    Tooltip,
    Typography,
} from '@mui/material';
import type { Scene } from '@story/canvas';
import { CanvasHost } from '@story/canvas/react';
import { Column, Row, spacingCss } from '@story/ui';
import { observer } from 'mobx-react-lite';
import { useCallback, useEffect, useMemo } from 'react';
import { useVisualizerStore } from '../context';
import { PassageGraphStore } from './PassageGraphStore';

/**
 * The chapter view's passage graph (VISUALIZER_PLAN §7, Phase 7).
 *
 * Replaces `Passages/ChapterPassagesGraph.tsx`, which drove the home-grown `CanvasManager` and
 * a `GraphAnimationHandler` that ran a force layout forever. The layout is a button now: a
 * graph that never settles cannot have its positions saved, which is most of why the old one
 * kept them in `localStorage`.
 */
export const PassageGraphView = observer(
    ({ chapterId }: { chapterId: string }) => {
        const visualizer = useVisualizerStore();

        // One store per chapter. Keyed on the id so switching chapters builds a new one rather
        // than mutating the current one underneath a mounted scene.
        const store = useMemo(
            () =>
                new PassageGraphStore(
                    visualizer.agent,
                    chapterId,
                    (passage) =>
                        void visualizer.agent.openPassage(
                            passage.id,
                            passage.type
                        )
                ),
            [visualizer, chapterId]
        );

        useEffect(() => {
            void store.load();
        }, [store]);

        const onReady = useCallback(
            (scene: Scene) => store.attach(scene),
            [store]
        );

        if (store.error !== null) {
            return (
                <SMessage>
                    <Alert severity="error">{store.error}</Alert>
                    <Alert severity="info">
                        {_(
                            'Passages are read through the Visualizer server on :8123. Start it with `yarn dev:visualizer-server`.'
                        )}
                    </Alert>
                </SMessage>
            );
        }

        return (
            <SGraph>
                <SToolbar>
                    <ButtonGroup size="small">
                        <Tooltip title={_('Arrange the passages')}>
                            <IconButton
                                size="small"
                                onClick={() => store.runLayout()}
                            >
                                <AutoFixHighIcon fontSize="small" />
                            </IconButton>
                        </Tooltip>
                        <Tooltip
                            title={
                                store.animating
                                    ? _('Stop the live layout')
                                    : _('Run the live layout')
                            }
                        >
                            <IconButton
                                size="small"
                                onClick={() =>
                                    store.setAnimating(!store.animating)
                                }
                            >
                                {store.animating ? (
                                    <StopIcon fontSize="small" />
                                ) : (
                                    <PlayArrowIcon fontSize="small" />
                                )}
                            </IconButton>
                        </Tooltip>
                        <Tooltip title={_('Fit the graph on screen')}>
                            <IconButton size="small" onClick={store.fit}>
                                <CenterFocusStrongIcon fontSize="small" />
                            </IconButton>
                        </Tooltip>
                        <Tooltip title={_('Delete the selected passage')}>
                            <span>
                                <IconButton
                                    size="small"
                                    disabled={
                                        store.selectedPassage === undefined
                                    }
                                    onClick={() =>
                                        void store.deleteSelectedPassage()
                                    }
                                >
                                    <DeleteIcon fontSize="small" />
                                </IconButton>
                            </span>
                        </Tooltip>
                    </ButtonGroup>

                    <Tooltip
                        title={_('Write the positions into the chapter file')}
                    >
                        <span>
                            <Button
                                size="small"
                                variant={
                                    store.layoutDirty ? 'contained' : 'outlined'
                                }
                                startIcon={<SaveIcon fontSize="small" />}
                                // Enabled whenever there is a layout to write, not only after a
                                // move: an author who likes the arrangement the view suggested
                                // should be able to keep it without first nudging something.
                                disabled={!store.canSave}
                                onClick={() => void store.saveLayout()}
                            >
                                {store.saving ? _('Saving…') : _('Save layout')}
                            </Button>
                        </span>
                    </Tooltip>

                    {store.layoutDirty && (
                        <Chip
                            size="small"
                            color="warning"
                            variant="outlined"
                            label={_('unsaved positions')}
                        />
                    )}

                    {store.selectedPassage && (
                        <Typography variant="caption" color="text.secondary">
                            {store.selectedPassage.id} ·{' '}
                            {store.selectedPassage.file}
                        </Typography>
                    )}
                </SToolbar>

                {store.loading && (
                    <SMessage>
                        <CircularProgress />
                    </SMessage>
                )}

                {!store.loading && store.passages.length === 0 && (
                    <SMessage>
                        <Alert severity="info">
                            {_('This chapter has no passages yet.')}
                        </Alert>
                    </SMessage>
                )}

                <SCanvas hidden={store.loading}>
                    <CanvasHost onReady={onReady} />
                </SCanvas>
            </SGraph>
        );
    }
);

const SGraph = styled(Column)`
    flex: 1;
    min-height: 0;
`;

/**
 * The toolbar sits directly on the graph's background, so it needs its own surface — without
 * one, dark icon buttons on a dark canvas are invisible, which is exactly how it first shipped.
 */
const SToolbar = styled(Row)`
    gap: ${spacingCss(1)};
    align-items: center;
    padding: ${spacingCss(0.5)} ${spacingCss(1)};
    flex-wrap: wrap;
    flex: 0 0 auto;
    background-color: rgba(255, 255, 255, 0.06);
    border-bottom: 1px solid rgba(255, 255, 255, 0.12);
`;

const SCanvas = styled('div')<{ hidden: boolean }>`
    flex: 1;
    min-height: 0;
    visibility: ${({ hidden }) => (hidden ? 'hidden' : 'visible')};
`;

const SMessage = styled(Column)`
    gap: ${spacingCss(2)};
    margin: auto;
    align-items: center;
    padding: ${spacingCss(3)};
`;
