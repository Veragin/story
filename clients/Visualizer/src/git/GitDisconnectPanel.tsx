import { useState } from 'react';
import {
    Alert,
    Button,
    FormControlLabel,
    Radio,
    RadioGroup,
    Stack,
} from '@mui/material';

type TProps = {
    busy: boolean;
    onDisconnect: (removeRepo: boolean) => void;
    onCancel: () => void;
};

export const GitDisconnectPanel = ({
    busy,
    onDisconnect,
    onCancel,
}: TProps) => {
    const [removeRepo, setRemoveRepo] = useState(false);

    return (
        <Alert severity="warning" icon={false}>
            <Stack gap={1}>
                {_(
                    'Disconnect removes the remote URL and the token from this story.'
                )}
                <RadioGroup
                    value={removeRepo ? 'delete' : 'keep'}
                    onChange={(e) => setRemoveRepo(e.target.value === 'delete')}
                >
                    <FormControlLabel
                        value="keep"
                        control={<Radio size="small" />}
                        label={_(
                            'Keep the local repository (.git) and its history'
                        )}
                    />
                    <FormControlLabel
                        value="delete"
                        control={<Radio size="small" />}
                        label={_(
                            'Delete the local repository (.git); commits not pushed are lost'
                        )}
                    />
                </RadioGroup>
                <Stack direction="row" gap={1} justifyContent="flex-end">
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
                </Stack>
            </Stack>
        </Alert>
    );
};
