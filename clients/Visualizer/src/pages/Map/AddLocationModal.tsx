import { observer } from 'mobx-react-lite';
import { useState } from 'react';
import styled from '@emotion/styled';
import { Alert, Button, CircularProgress, InputAdornment } from '@mui/material';
import { LabeledTextField, Modal, Row, spacingCss } from '@story/ui';
import { modals } from '../../shell';
import type { MapPageStore } from './MapPageStore';
import { locationIdFromName } from './locationTree';

export const openAddLocationModal = (store: MapPageStore) =>
    modals.open((close) => <AddLocationModal store={store} onClose={close} />);

const AddLocationModal = observer(
    ({ store, onClose }: { store: MapPageStore; onClose: () => void }) => {
        const [name, setName] = useState('');
        const [customId, setCustomId] = useState<string | null>(null);
        const localId = customId ?? locationIdFromName(name);
        const prefix = store.locationIdPrefix;
        const id = localId && prefix + localId;
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
                        <LabeledTextField
                            label={_('Name')}
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            autoFocus
                        />
                        <LabeledTextField
                            label={_('Id')}
                            value={localId}
                            onChange={(e) =>
                                setCustomId(e.target.value.trim() || null)
                            }
                            error={idError}
                            helperText={_(
                                'Becomes data/locations/<id>.location.ts; cannot be renamed later.'
                            )}
                            slotProps={{
                                input: {
                                    startAdornment: prefix ? (
                                        <InputAdornment position="start">
                                            {prefix}
                                        </InputAdornment>
                                    ) : undefined,
                                },
                            }}
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
