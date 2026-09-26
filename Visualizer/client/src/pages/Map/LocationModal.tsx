import { observer } from 'mobx-react-lite';
import { useState } from 'react';
import styled from '@emotion/styled';
import { Alert, Button, CircularProgress } from '@mui/material';
import { Modal, Row, spacingCss } from '@story/ui';
import { modals } from '../../shell';
import { TextField } from '../../components/TextField';
import { LocationForm } from './LocationForm/LocationForm';
import type { MapPageStore } from './MapPageStore';

/** Opens the location modal (double-click on a location, or "Open" in the tooling row). */
export const openLocationModal = (store: MapPageStore, locationId: string) =>
    modals.open((close) => (
        <LocationModal store={store} locationId={locationId} onClose={close} />
    ));

const LocationModal = observer(
    ({
        store,
        locationId,
        onClose,
    }: {
        store: MapPageStore;
        locationId: string;
        onClose: () => void;
    }) => {
        const location = store.locations.get(locationId);
        const readOnly = store.mode === 'view';
        return (
            <Modal
                open
                title={_('Location %s', store.locationName(locationId))}
                onClose={onClose}
            >
                {location ? (
                    <LocationForm
                        location={location}
                        readOnly={readOnly}
                        onSave={(patch, version) =>
                            store.saveLocation(locationId, patch, version)
                        }
                        onSaved={onClose}
                        onCancel={onClose}
                    />
                ) : (
                    <Alert severity="warning">
                        {_(
                            'There is no location file for "%s". Only its shape is on the map; delete it or create the location on the Entities page.',
                            locationId
                        )}
                    </Alert>
                )}
            </Modal>
        );
    }
);

/** "Add location": create a new location entity, or place an existing one that has no shape yet. */
export const openAddLocationModal = (store: MapPageStore) =>
    modals.open((close) => <AddLocationModal store={store} onClose={close} />);

const AddLocationModal = observer(
    ({ store, onClose }: { store: MapPageStore; onClose: () => void }) => {
        const [id, setId] = useState('');
        const [name, setName] = useState('');
        const [busy, setBusy] = useState(false);
        const [error, setError] = useState<string | null>(null);
        const idError = id ? store.validateLocationId(id) : null;
        const unplaced = store.unplacedLocations;

        const create = async () => {
            const invalid = store.validateLocationId(id);
            if (invalid) {
                setError(invalid);
                return;
            }
            setBusy(true);
            setError(null);
            try {
                await store.addLocation({ id, name: name || id });
                onClose();
            } catch (e) {
                setError(e instanceof Error ? e.message : String(e));
            } finally {
                setBusy(false);
            }
        };

        return (
            <Modal open title={_('Add location')} onClose={onClose}>
                <div>
                    <SForm
                        onSubmit={(e) => {
                            e.preventDefault();
                            void create();
                        }}
                    >
                        <TextField
                            label={_('Id')}
                            value={id}
                            onChange={(e) => setId(e.target.value.trim())}
                            error={idError !== null}
                            helperText={
                                idError ??
                                _(
                                    'Becomes data/locations/<id>.location.ts; cannot be renamed later.'
                                )
                            }
                            size="small"
                            autoFocus
                            fullWidth
                        />
                        <TextField
                            label={_('Name')}
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            size="small"
                            fullWidth
                        />
                        {error && <Alert severity="error">{error}</Alert>}
                        <SButtons>
                            <Button color="inherit" onClick={onClose}>
                                {_('Cancel')}
                            </Button>
                            <Button
                                type="submit"
                                variant="contained"
                                disabled={busy || !id || idError !== null}
                            >
                                {busy ? (
                                    <CircularProgress size={18} />
                                ) : (
                                    _('Create')
                                )}
                            </Button>
                        </SButtons>
                    </SForm>
                    {unplaced.length > 0 && (
                        <SPlace>
                            <span>
                                {_(
                                    'Or place an existing location that has no shape yet:'
                                )}
                            </span>
                            <Row style={{ gap: 8, flexWrap: 'wrap' }}>
                                {unplaced.map((l) => (
                                    <Button
                                        key={l.id}
                                        size="small"
                                        variant="outlined"
                                        onClick={() => {
                                            store.placeLocation(l.id);
                                            onClose();
                                        }}
                                    >
                                        {store.locationName(l.id)}
                                    </Button>
                                ))}
                            </Row>
                        </SPlace>
                    )}
                </div>
            </Modal>
        );
    }
);

/** The help button's modal: how to move around the map. */
export const openMapHelpModal = () =>
    modals.open((close) => (
        <Modal open title={_('Map help')} onClose={close}>
            <SHelp>
                <h4>{_('Moving around')}</h4>
                <ul>
                    <li>{_('Scroll to zoom in and out (at the cursor).')}</li>
                    <li>{_('W A S D or the arrow keys move the view.')}</li>
                    <li>
                        {_(
                            'Drag empty space to move the view (in Tiles mode: drag with the right mouse button).'
                        )}
                    </li>
                    <li>{_('Double-click a location to open it.')}</li>
                </ul>
                <h4>{_('Modes')}</h4>
                <ul>
                    <li>{_('View: look only, nothing can be changed.')}</li>
                    <li>
                        {_(
                            'Locations: click a location to select it, drag it to move it, drag its handles to reshape it, double-click an edge to add a point, right-click a point to remove it. Delete removes the selected location.'
                        )}
                    </li>
                    <li>
                        {_(
                            'Tiles: paint tiles with the palette (Shift + scroll changes the brush size), or switch to the select tool to give a tile a label and a description. Zoom in to read the descriptions.'
                        )}
                    </li>
                </ul>
                <p>
                    {_(
                        'Changes are saved automatically about a second after the last edit.'
                    )}
                </p>
            </SHelp>
        </Modal>
    ));

const SForm = styled.form`
    display: flex;
    flex-direction: column;
    gap: ${spacingCss(1.5)};
    padding-top: ${spacingCss(1)};
    color: #fff;
`;

const SButtons = styled(Row)`
    justify-content: flex-end;
    gap: ${spacingCss(1)};
`;

const SPlace = styled.div`
    display: flex;
    flex-direction: column;
    gap: ${spacingCss(1)};
    margin-top: ${spacingCss(2)};
    color: #ddd;
`;

const SHelp = styled.div`
    color: #eee;
    line-height: 1.5;
    & h4 {
        margin: ${spacingCss(1)} 0 0;
    }
    & ul {
        margin: ${spacingCss(0.5)} 0;
    }
`;
