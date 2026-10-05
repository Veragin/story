import { useEffect, useState } from 'react';
import {
    Alert,
    AlertTitle,
    Button,
    CircularProgress,
    Dialog,
    DialogActions,
    DialogContent,
    DialogContentText,
    DialogTitle,
    Stack,
    styled,
} from '@mui/material';
import { spacingCss } from '@story/ui';
import type { TDeleteReferencesDto } from '@story/visualizer-protocol';
import { errorMessage } from '../../api';
import { clearedText } from '../../components/clearedReferences';

type TProps = {
    title: string;
    message: string;
    preview: () => Promise<TDeleteReferencesDto>;
    onAnswer: (answer: boolean) => void;
};

type TPreviewState =
    | { status: 'loading' }
    | { status: 'ready'; preview: TDeleteReferencesDto }
    | { status: 'failed'; message: string };

export const DeletePreviewDialog = ({
    title,
    message,
    preview,
    onAnswer,
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
        <Dialog open onClose={() => onAnswer(false)} maxWidth="sm" fullWidth>
            <DialogTitle>{title}</DialogTitle>
            <DialogContent>
                <Stack gap={2}>
                    <DialogContentText>{message}</DialogContentText>
                    {state.status === 'loading' && (
                        <CircularProgress size={20} />
                    )}
                    {state.status === 'failed' && (
                        <Alert severity="warning">
                            {_(
                                'Could not check the references: %s',
                                state.message
                            )}
                        </Alert>
                    )}
                    {state.status === 'ready' &&
                        state.preview.cleared.length > 0 && (
                            <Alert severity="info" data-preview="cleared">
                                <AlertTitle>
                                    {_(
                                        'These values will be cleared (%d)',
                                        state.preview.cleared.length
                                    )}
                                </AlertTitle>
                                <SList>
                                    {state.preview.cleared.map((ref, i) => (
                                        <li key={i}>{clearedText(ref)}</li>
                                    ))}
                                </SList>
                            </Alert>
                        )}
                    {blocked && (
                        <Alert severity="error" data-preview="blocking">
                            <AlertTitle>
                                {_('Still referenced: remove these first')}
                            </AlertTitle>
                            <SList>
                                {state.preview.blocking.map((ref, i) => (
                                    <li key={i}>
                                        <code>
                                            {ref.file}:{ref.line}
                                        </code>{' '}
                                        {ref.text}
                                    </li>
                                ))}
                            </SList>
                        </Alert>
                    )}
                    {state.status === 'ready' &&
                        state.preview.cleared.length === 0 &&
                        !blocked && (
                            <DialogContentText>
                                {_('Nothing references it.')}
                            </DialogContentText>
                        )}
                </Stack>
            </DialogContent>
            <DialogActions>
                <Button color="inherit" onClick={() => onAnswer(false)}>
                    {_('Cancel')}
                </Button>
                <Button
                    variant="contained"
                    color="error"
                    disabled={state.status === 'loading' || blocked}
                    onClick={() => onAnswer(true)}
                    data-action="confirm-delete"
                >
                    {_('Delete')}
                </Button>
            </DialogActions>
        </Dialog>
    );
};

const SList = styled('ul')`
    margin: 0;
    padding-left: ${spacingCss(2)};
    & code {
        font-size: 12px;
    }
`;
