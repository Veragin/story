import { useState } from 'react';
import { DialogContentText } from '@mui/material';
import { AppDialog } from '../../components/dialog/AppDialog';
import { DialogButtons } from '../../components/dialog/DialogButtons';
import { FormCheckbox } from '../../components/form/FormCheckbox';
import type {
    TDeleteLocationChoice,
    TDeleteLocationRequest,
} from './MapPageStore';

type TProps = {
    request: TDeleteLocationRequest;
    onDelete: (choice: TDeleteLocationChoice) => void;
    onClose: () => void;
};

export const DeleteLocationDialog = ({
    request,
    onDelete,
    onClose,
}: TProps) => {
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
    const set = (key: keyof TDeleteLocationChoice) => (value?: boolean) =>
        setChoice((c) => ({ ...c, [key]: value ?? false }));
    const answer: TDeleteLocationChoice = {
        map: hasMap && map,
        sublocations: hasSublocations && sublocations,
        location: choice.location,
    };

    return (
        <AppDialog
            title={_('Delete %s', name)}
            size="xs"
            onClose={onClose}
            actions={
                <DialogButtons
                    onClose={onClose}
                    onConfirm={() => onDelete(answer)}
                    label={_('Delete')}
                    danger
                    disabled={
                        !answer.map && !answer.sublocations && !answer.location
                    }
                />
            }
        >
            <DialogContentText>
                {_('What should be deleted?')}
            </DialogContentText>
            <FormCheckbox
                label={
                    hasMap ? _('Delete map') : _('Delete map (there is none)')
                }
                value={answer.map}
                onChange={set('map')}
                disabled={!hasMap || choice.location}
                dataField="map"
            />
            <FormCheckbox
                label={
                    hasSublocations
                        ? _(
                              'Delete sublocations (%s)',
                              sublocationIds.join(', ')
                          )
                        : _('Delete sublocations (there are none)')
                }
                value={answer.sublocations}
                onChange={set('sublocations')}
                disabled={!hasSublocations || choice.location}
                dataField="sublocations"
            />
            <FormCheckbox
                label={
                    file
                        ? _('Delete location (%s)', file)
                        : _(
                              'Delete location (only its shape, there is no file)'
                          )
                }
                value={choice.location}
                onChange={set('location')}
                dataField="location"
            />
        </AppDialog>
    );
};
