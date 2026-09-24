import styled from '@emotion/styled';
import {
    Alert,
    Button,
    Divider,
    MenuItem,
    Select,
    Typography,
} from '@mui/material';
import { Column, Row, spacingCss } from '@story/ui';
import { observer } from 'mobx-react-lite';
import type { MapStore } from '../MapStore';

/**
 * The map's side panel: what is selected, and what can be done with it.
 *
 * It also carries the one piece of flow the canvas cannot express on its own — **a freshly
 * drawn polygon belongs to no location**. `@story/canvas` deliberately has no idea what a
 * location is (design rule 2), so the draw tool produces a shape and this panel is where the
 * author says whose it is. Until they do, the polygon is on screen but would not be saved.
 */
export const LocationPanel = observer(({ store }: { store: MapStore }) => {
    const location = store.selectedLocation;

    const unplaced = store.locations.filter(
        (candidate) =>
            candidate.shape === null || candidate.shape.mapId !== store.map.id
    );

    return (
        <SPanel>
            <Typography variant="subtitle2">{store.map.title}</Typography>
            <Typography variant="caption" color="text.secondary">
                {_(
                    '%s × %s world units',
                    String(store.map.size.width),
                    String(store.map.size.height)
                )}
            </Typography>

            <Divider sx={{ my: 1 }} />

            {store.hasUnassignedPolygon && (
                <Column sx={{ gap: spacingCss(1) }}>
                    <Alert severity="info" sx={{ py: 0 }}>
                        {_('This shape is not a location yet.')}
                    </Alert>
                    <Select
                        size="small"
                        displayEmpty
                        value=""
                        onChange={(event) =>
                            store.assignSelectedPolygonTo(event.target.value)
                        }
                        renderValue={() => _('Assign to a location…')}
                    >
                        {store.locations.map((candidate) => (
                            <MenuItem key={candidate.id} value={candidate.id}>
                                {candidate.name}
                                {candidate.shape?.mapId === store.map.id
                                    ? ` — ${_('replaces its shape')}`
                                    : ''}
                            </MenuItem>
                        ))}
                    </Select>
                </Column>
            )}

            {location && (
                <Column sx={{ gap: spacingCss(0.5) }}>
                    <Typography variant="body2">{location.name}</Typography>
                    <Typography variant="caption" color="text.secondary">
                        {location.description || _('No description')}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                        {_(
                            '%s points',
                            String(location.shape?.points.length ?? 0)
                        )}
                    </Typography>

                    <Row sx={{ gap: spacingCss(1), mt: 1 }}>
                        <Button
                            size="small"
                            variant="outlined"
                            onClick={store.reshapeSelected}
                        >
                            {_('Reshape')}
                        </Button>
                    </Row>
                </Column>
            )}

            {!location && !store.hasUnassignedPolygon && (
                <Typography variant="caption" color="text.secondary">
                    {_(
                        'Nothing selected. Click a location, or draw a new shape.'
                    )}
                </Typography>
            )}

            <Divider sx={{ my: 1 }} />

            <Typography variant="caption" color="text.secondary">
                {_('Not on this map')}
            </Typography>
            {unplaced.length === 0 ? (
                <Typography variant="caption" color="text.secondary">
                    {_('Every location has a shape.')}
                </Typography>
            ) : (
                unplaced.map((candidate) => (
                    <Typography key={candidate.id} variant="caption">
                        {candidate.name}
                    </Typography>
                ))
            )}
        </SPanel>
    );
});

const SPanel = styled(Column)`
    width: 260px;
    flex: 0 0 auto;
    gap: ${spacingCss(0.5)};
    padding: ${spacingCss(1.5)};
    overflow-y: auto;
    border-left: 1px solid rgba(255, 255, 255, 0.12);
`;
