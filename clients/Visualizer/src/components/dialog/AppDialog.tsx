import type { FormEvent, KeyboardEvent, ReactNode } from 'react';
import {
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    styled,
} from '@mui/material';
import { spacingCss } from '@story/ui';
import { FormFields } from '../form/FormFields';
import { ErrorAlert } from '../feedback/ErrorAlert';

type TDialogSize = 'xs' | 'sm' | 'md' | 'lg';

type TProps = {
    title?: ReactNode;
    titleActions?: ReactNode;
    size?: TDialogSize;
    onClose: () => void;
    onSubmit?: () => void | Promise<void>;
    onKeyDown?: (e: KeyboardEvent) => void;
    error?: string | null;
    actions?: ReactNode;
    children?: ReactNode;
};

export const AppDialog = ({
    title,
    titleActions,
    size = 'sm',
    onClose,
    onSubmit,
    onKeyDown,
    error,
    actions,
    children,
}: TProps) => {
    const content = (
        <>
            <DialogContent>
                <FormFields>
                    {children}
                    <ErrorAlert error={error} />
                </FormFields>
            </DialogContent>
            {actions && <DialogActions>{actions}</DialogActions>}
        </>
    );

    const submit = (e: FormEvent) => {
        e.preventDefault();
        void onSubmit?.();
    };

    return (
        <Dialog
            open
            onClose={onClose}
            maxWidth={size}
            fullWidth
            {...(onKeyDown && { onKeyDown })}
        >
            {title !== undefined && (
                <STitle>
                    <span>{title}</span>
                    {titleActions && (
                        <STitleActions>{titleActions}</STitleActions>
                    )}
                </STitle>
            )}
            {onSubmit ? (
                <SForm noValidate onSubmit={submit}>
                    {content}
                </SForm>
            ) : (
                content
            )}
        </Dialog>
    );
};

const STitle = styled(DialogTitle)`
    display: flex;
    align-items: center;
    gap: ${spacingCss(1)};
`;

const STitleActions = styled('div')`
    display: flex;
    align-items: center;
    margin-left: auto;
`;

// keeps DialogContent the scrolling region, as when it is a direct child of the paper
const SForm = styled('form')`
    display: flex;
    flex-direction: column;
    min-height: 0;
`;
