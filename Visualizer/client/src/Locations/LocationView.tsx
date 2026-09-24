import styled from '@emotion/styled';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import {
    Alert,
    Button,
    CircularProgress,
    Divider,
    TextField,
    Typography,
} from '@mui/material';
import { area, centroid, isClockwise } from '@story/canvas';
import { Column, Row, spacingCss, WholeContainer } from '@story/ui';
import { observer } from 'mobx-react-lite';
import { useEffect, useState } from 'react';
import type { TLocationSummary } from '../../../server/src/story/types';
import { Nav, NavPicker } from '../components/Nav';
import { useVisualizerStore } from '../context';

/**
 * The location view — what double-clicking a location on the map opens
 * (README § Visualizer, "location view: form"; VISUALIZER_PLAN §6's table, phases 6 and 9).
 *
 * Phase 6 wires the route and the fields the map cares about; Phase 9 grows it into the full
 * entity editor. The geometry summary is deliberately here rather than in the map's side panel:
 * it is the answer to "is this shape sane?", and it is most wanted right after the author has
 * finished drawing and double-clicked to see what they made.
 */
export const LocationView = observer(
    ({ locationId }: { locationId: string }) => {
        const store = useVisualizerStore();
        const [location, setLocation] = useState<TLocationSummary | null>(null);
        const [error, setError] = useState<string | null>(null);
        const [name, setName] = useState('');
        const [description, setDescription] = useState('');
        const [saving, setSaving] = useState(false);

        useEffect(() => {
            let cancelled = false;
            setLocation(null);
            setError(null);

            void (async () => {
                try {
                    const loaded = await store.agent.getLocation(locationId);
                    if (cancelled) return;
                    setLocation(loaded);
                    setName(loaded.name);
                    setDescription(loaded.description);
                } catch (caught) {
                    if (cancelled) return;
                    setError(
                        caught instanceof Error
                            ? caught.message
                            : _('Could not load the location')
                    );
                }
            })();

            return () => {
                cancelled = true;
            };
        }, [locationId, store]);

        const save = async () => {
            if (!location) return;
            setSaving(true);
            try {
                // The hash from the read is the `If-Match` for the write (§5.3): if the author also
                // edited the file in their editor since opening this form, the save is refused
                // rather than silently overwriting what they typed.
                const updated = await store.agent.updateLocation(
                    locationId,
                    { name, description },
                    location.hash ?? undefined
                );
                setLocation(updated);
            } catch (caught) {
                setError(
                    caught instanceof Error
                        ? caught.message
                        : _('Could not save the location')
                );
            } finally {
                setSaving(false);
            }
        };

        const shape = location?.shape ?? null;
        const dirty =
            location !== null &&
            (name !== location.name || description !== location.description);

        return (
            <WholeContainer>
                <Nav>
                    <NavPicker />
                    <Button
                        size="small"
                        onClick={() =>
                            store.setActiveTab({
                                tab: 'map',
                                mapId: shape?.mapId ?? 'global',
                            })
                        }
                    >
                        {_('Back to the map')}
                    </Button>
                </Nav>

                <SBody>
                    {error !== null && <Alert severity="error">{error}</Alert>}
                    {location === null && error === null && (
                        <CircularProgress />
                    )}

                    {location && (
                        <Column sx={{ gap: spacingCss(2) }}>
                            <Row
                                sx={{
                                    gap: spacingCss(1),
                                    alignItems: 'center',
                                }}
                            >
                                <Typography variant="h6">
                                    {location.name}
                                </Typography>
                                <Typography
                                    variant="caption"
                                    color="text.secondary"
                                >
                                    {location.id}
                                </Typography>
                            </Row>

                            <TextField
                                label={_('Name')}
                                size="small"
                                value={name}
                                onChange={(event) =>
                                    setName(event.target.value)
                                }
                            />
                            <TextField
                                label={_('Description')}
                                size="small"
                                multiline
                                minRows={3}
                                value={description}
                                onChange={(event) =>
                                    setDescription(event.target.value)
                                }
                            />

                            <Row sx={{ gap: spacingCss(1) }}>
                                <Button
                                    variant="contained"
                                    disabled={!dirty || saving}
                                    onClick={() => void save()}
                                >
                                    {saving ? _('Saving…') : _('Save')}
                                </Button>
                                <Button
                                    startIcon={
                                        <OpenInNewIcon fontSize="small" />
                                    }
                                    onClick={() =>
                                        void store.agent.openLocation(
                                            locationId
                                        )
                                    }
                                >
                                    {_('Open in editor')}
                                </Button>
                            </Row>

                            <Divider />

                            <Typography variant="subtitle2">
                                {_('Shape')}
                            </Typography>
                            {shape === null ? (
                                <Typography
                                    variant="caption"
                                    color="text.secondary"
                                >
                                    {_(
                                        'This location is not drawn on any map.'
                                    )}
                                </Typography>
                            ) : (
                                <Column sx={{ gap: spacingCss(0.5) }}>
                                    <SFact>
                                        {_('Map')}: {shape.mapId}
                                    </SFact>
                                    <SFact>
                                        {_('Points')}:{' '}
                                        {String(shape.points.length)}
                                    </SFact>
                                    <SFact>
                                        {_('Area')}:{' '}
                                        {String(Math.round(area(shape.points)))}{' '}
                                        {_('world units²')}
                                    </SFact>
                                    <SFact>
                                        {_('Centre')}:{' '}
                                        {String(
                                            Math.round(centroid(shape.points).x)
                                        )}
                                        ,{' '}
                                        {String(
                                            Math.round(centroid(shape.points).y)
                                        )}
                                    </SFact>
                                    <SFact>
                                        {_('Winding')}:{' '}
                                        {isClockwise(shape.points)
                                            ? _('clockwise (normal)')
                                            : _('counter-clockwise')}
                                    </SFact>
                                    <SFact>
                                        {_('Colour')}: {shape.color}
                                    </SFact>
                                </Column>
                            )}
                        </Column>
                    )}
                </SBody>
            </WholeContainer>
        );
    }
);

const SBody = styled(Column)`
    gap: ${spacingCss(2)};
    padding: ${spacingCss(3)};
    width: 620px;
    margin: 0 auto;
    overflow-y: auto;
`;

const SFact = styled(Typography)`
    font-size: 0.8rem;
    opacity: 0.85;
`;
