import { useState } from 'react';
import {
    Button,
    Checkbox,
    Dialog,
    DialogActions,
    DialogContent,
    DialogContentText,
    DialogTitle,
    FormControlLabel,
    FormGroup,
} from '@mui/material';
import type {
    TDeleteLocationChoice,
    TDeleteLocationRequest,
} from './MapPageStore';

export const DeleteLocationDialog = ({
    request,
    onAnswer,
}: {
    request: TDeleteLocationRequest;
    onAnswer: (choice: TDeleteLocationChoice | null) => void;
}) => {
    const { name, file, hasMap, sublocationIds } = request;
    const hasSublocations = sublocationIds.length > 0;
    const [choice, setChoice] = useState<TDeleteLocationChoice>({
        map: false,
        sublocations: false,
        location: false,
    });
    // a deleted location takes its map and its sublocations with it
    const map = choice.map || choice.location;
    const sublocations = choice.sublocations || choice.location;
    const toggle = (key: keyof TDeleteLocationChoice) =>
        setChoice((c) => ({ ...c, [key]: !c[key] }));

    return (
        <Dialog open onClose={() => onAnswer(null)} maxWidth="xs" fullWidth>
            <DialogTitle>{_('Delete %s', name)}</DialogTitle>
            <DialogContent>
                <DialogContentText>
                    {_('What should be deleted?')}
                </DialogContentText>
                <FormGroup>
                    <FormControlLabel
                        control={
                            <Checkbox
                                checked={hasMap && map}
                                disabled={!hasMap || choice.location}
                                onChange={() => toggle('map')}
                            />
                        }
                        label={
                            hasMap
                                ? _('Delete map')
                                : _('Delete map (there is none)')
                        }
                    />
                    <FormControlLabel
                        control={
                            <Checkbox
                                checked={hasSublocations && sublocations}
                                disabled={!hasSublocations || choice.location}
                                onChange={() => toggle('sublocations')}
                            />
                        }
                        label={
                            hasSublocations
                                ? _(
                                      'Delete sublocations (%s)',
                                      sublocationIds.join(', ')
                                  )
                                : _('Delete sublocations (there are none)')
                        }
                    />
                    <FormControlLabel
                        control={
                            <Checkbox
                                checked={choice.location}
                                onChange={() => toggle('location')}
                            />
                        }
                        label={
                            file
                                ? _('Delete location (%s)', file)
                                : _(
                                      'Delete location (only its shape, there is no file)'
                                  )
                        }
                    />
                </FormGroup>
            </DialogContent>
            <DialogActions>
                <Button color="inherit" onClick={() => onAnswer(null)}>
                    {_('Cancel')}
                </Button>
                <Button
                    variant="contained"
                    color="error"
                    disabled={
                        !(hasMap && map) &&
                        !(hasSublocations && sublocations) &&
                        !choice.location
                    }
                    onClick={() =>
                        onAnswer({
                            map: hasMap && map,
                            sublocations: hasSublocations && sublocations,
                            location: choice.location,
                        })
                    }
                >
                    {_('Delete')}
                </Button>
            </DialogActions>
        </Dialog>
    );
};
