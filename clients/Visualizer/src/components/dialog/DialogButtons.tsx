import { Button } from '@mui/material';

type TCloseOnlyProps = {
    closeOnly: true;
    onClose: () => void;
    closeLabel?: string;
};

type TConfirmProps = {
    closeOnly?: false;
    onClose: () => void;
    onConfirm?: () => void;
    label: string;
    busyLabel?: string;
    cancelLabel?: string;
    danger?: boolean;
    busy?: boolean;
    disabled?: boolean;
    submit?: boolean;
    autoFocus?: boolean;
    dataAction?: string;
};

type TProps = TCloseOnlyProps | TConfirmProps;

export const DialogButtons = (props: TProps) => {
    if (props.closeOnly) {
        return (
            <Button color="inherit" onClick={props.onClose} autoFocus>
                {props.closeLabel ?? _('Close')}
            </Button>
        );
    }
    const {
        onClose,
        onConfirm,
        label,
        busyLabel,
        cancelLabel,
        danger = false,
        busy = false,
        disabled = false,
        submit = false,
        autoFocus = false,
        dataAction,
    } = props;
    return (
        <>
            <Button color="inherit" onClick={onClose}>
                {cancelLabel ?? _('Cancel')}
            </Button>
            <Button
                variant="contained"
                color={danger ? 'error' : 'primary'}
                type={submit ? 'submit' : 'button'}
                onClick={onConfirm}
                disabled={busy || disabled}
                autoFocus={danger || autoFocus}
                data-action={dataAction}
            >
                {busy ? (busyLabel ?? `${label}…`) : label}
            </Button>
        </>
    );
};
