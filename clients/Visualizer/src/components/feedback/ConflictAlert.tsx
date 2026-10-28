import type { ReactNode } from 'react';
import { Alert, AlertTitle, type AlertProps, Button } from '@mui/material';

type TProps = {
    deleted?: boolean;
    what?: string;
    onReload?: () => void;
    onKeepMine?: () => void | Promise<unknown>;
    disabled?: boolean;
    action?: ReactNode;
    sx?: AlertProps['sx'];
};

export const ConflictAlert = ({
    deleted = false,
    what = _('entry'),
    onReload,
    onKeepMine,
    disabled,
    action,
    sx,
}: TProps) => (
    <Alert
        severity="warning"
        sx={sx}
        data-notice="conflict"
        action={
            <>
                {onReload && (
                    <Button
                        color="inherit"
                        size="small"
                        onClick={onReload}
                        disabled={disabled}
                    >
                        {deleted ? _('Discard mine') : _('Reload')}
                    </Button>
                )}
                {onKeepMine && (
                    <Button
                        color="inherit"
                        size="small"
                        variant="outlined"
                        onClick={() => void onKeepMine()}
                        disabled={disabled}
                    >
                        {deleted ? _('Re-create') : _('Keep mine')}
                    </Button>
                )}
                {action}
            </>
        }
    >
        <AlertTitle>
            {deleted ? _('Deleted on disk') : _('Changed on disk')}
        </AlertTitle>
        {deleted
            ? _(
                  'This %s was deleted outside this form. Your input is still here.',
                  what
              )
            : _(
                  'The file changed since you started editing. Reload it, or keep your changes and save them on top.'
              )}
    </Alert>
);
