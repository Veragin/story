import { useState } from 'react';
import { Alert, Button } from '@mui/material';
import { FormFields } from '../components/form/FormFields';
import { FormRadioInput } from '../components/form/FormRadioInput';
import { ActionRow } from '../components/layout/ActionRow';

type TProps = {
    busy: boolean;
    onDisconnect: (removeRepo: boolean) => void;
    onCancel: () => void;
};

const repoOptions = () => [
    {
        id: 'keep',
        label: _('Keep the local repository (.git) and its history'),
    },
    {
        id: 'delete',
        label: _(
            'Delete the local repository (.git); commits not pushed are lost'
        ),
    },
];

export const GitDisconnectPanel = ({
    busy,
    onDisconnect,
    onCancel,
}: TProps) => {
    const [removeRepo, setRemoveRepo] = useState(false);

    return (
        <Alert severity="warning" icon={false}>
            <FormFields>
                {_(
                    'Disconnect removes the remote URL and the token from this story.'
                )}
                <FormRadioInput
                    label={_('Local repository')}
                    value={removeRepo ? 'delete' : 'keep'}
                    onChange={(next) => setRemoveRepo(next === 'delete')}
                    options={repoOptions()}
                    dataField="removeRepo"
                />
                <ActionRow>
                    <Button color="inherit" size="small" onClick={onCancel}>
                        {_('Cancel')}
                    </Button>
                    <Button
                        color="error"
                        variant="contained"
                        size="small"
                        disabled={busy}
                        onClick={() => onDisconnect(removeRepo)}
                    >
                        {_('Disconnect')}
                    </Button>
                </ActionRow>
            </FormFields>
        </Alert>
    );
};
