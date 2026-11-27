import { useEffect, useState } from 'react';
import { Alert, AlertTitle, DialogContentText } from '@mui/material';
import type { TDeleteReferencesDto } from '@story/protocol';
import { errorMessage } from '../../api';
import { clearedText } from '../../components/clearedReferences';
import { AppDialog } from '../../components/dialog/AppDialog';
import { DialogButtons } from '../../components/dialog/DialogButtons';
import { BulletList } from '../../components/feedback/BulletList';
import { EmptyState } from '../../components/feedback/EmptyState';
import { LoadingState } from '../../components/feedback/LoadingState';
import { ReferenceList } from '../../components/feedback/ReferenceList';

type TProps = {
    title: string;
    message: string;
    preview: () => Promise<TDeleteReferencesDto>;
    onDelete: () => void;
    onClose: () => void;
};

type TPreviewState =
    | { status: 'loading' }
    | { status: 'ready'; preview: TDeleteReferencesDto }
    | { status: 'failed'; message: string };

export const DeletePreviewDialog = ({
    title,
    message,
    preview,
    onDelete,
    onClose,
}: TProps) => {
    const [state, setState] = useState<TPreviewState>({ status: 'loading' });

    useEffect(() => {
        let alive = true;
        const load = async () => {
            try {
                const result = await preview();
                if (alive) setState({ status: 'ready', preview: result });
            } catch (e) {
                if (alive)
                    setState({ status: 'failed', message: errorMessage(e) });
            }
        };
        void load();
        return () => {
            alive = false;
        };
    }, [preview]);

    const blocked =
        state.status === 'ready' && state.preview.blocking.length > 0;

    return (
        <AppDialog
            title={title}
            onClose={onClose}
            actions={
                <DialogButtons
                    onClose={onClose}
                    onConfirm={onDelete}
                    label={_('Delete')}
                    danger
                    disabled={state.status === 'loading' || blocked}
                    dataAction="confirm-delete"
                />
            }
        >
            <DialogContentText>{message}</DialogContentText>
            {state.status === 'loading' && <LoadingState />}
            {state.status === 'failed' && (
                <Alert severity="warning">
                    {_('Could not check the references: %s', state.message)}
                </Alert>
            )}
            {state.status === 'ready' && state.preview.cleared.length > 0 && (
                <Alert severity="info" data-preview="cleared">
                    <AlertTitle>
                        {_(
                            'These values will be cleared (%d)',
                            state.preview.cleared.length
                        )}
                    </AlertTitle>
                    <BulletList>
                        {state.preview.cleared.map((ref, i) => (
                            <li key={i}>{clearedText(ref)}</li>
                        ))}
                    </BulletList>
                </Alert>
            )}
            {blocked && (
                <Alert severity="error" data-preview="blocking">
                    <AlertTitle>
                        {_('Still referenced: remove these first')}
                    </AlertTitle>
                    <ReferenceList references={state.preview.blocking} />
                </Alert>
            )}
            {state.status === 'ready' &&
                state.preview.cleared.length === 0 &&
                !blocked && (
                    <EmptyState message={_('Nothing references it.')} />
                )}
        </AppDialog>
    );
};
