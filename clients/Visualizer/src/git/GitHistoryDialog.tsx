import { useCallback, useEffect, useState } from 'react';
import {
    Alert,
    Button,
    CircularProgress,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    List,
    ListItem,
    ListItemText,
} from '@mui/material';
import { observer } from 'mobx-react-lite';
import type { TGitLogEntryDto } from '@story/protocol';
import { useVisualizerStore } from '../context';
import type { GitStore } from './GitStore';
import { relativeAge } from './relativeAge';

type TProps = {
    store: GitStore;
    onClose: () => void;
};

const PAGE_SIZE = 50;

export const GitHistoryDialog = observer(({ store, onClose }: TProps) => {
    const { timeManager } = useVisualizerStore();
    const [entries, setEntries] = useState<TGitLogEntryDto[]>([]);
    const [hasMore, setHasMore] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const loadPage = useCallback(
        async (before?: string) => {
            setLoading(true);
            setError(null);
            const result = await store.log({ limit: PAGE_SIZE, before });
            setLoading(false);
            if (!result.ok) {
                setError(result.message);
                return;
            }
            setEntries((previous) =>
                before ? [...previous, ...result.value] : result.value
            );
            setHasMore(result.value.length === PAGE_SIZE);
        },
        [store]
    );

    const branch = store.status?.branch;
    useEffect(() => void loadPage(), [loadPage, branch]);

    const last = entries.length > 0 ? entries[entries.length - 1] : undefined;

    return (
        <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
            <DialogTitle>
                {branch ? _('History of %s', branch) : _('History')}
            </DialogTitle>
            <DialogContent dividers>
                {entries.length === 0 && !loading && !error && (
                    <Alert severity="info">{_('No commits yet.')}</Alert>
                )}
                <List dense>
                    {entries.map((entry) => (
                        <ListItem key={entry.hash} disableGutters>
                            <ListItemText
                                primary={entry.subject}
                                secondary={
                                    <span
                                        title={new Date(
                                            entry.date
                                        ).toLocaleString()}
                                    >
                                        {entry.author} ·{' '}
                                        {relativeAge(timeManager, entry.date)} ·{' '}
                                        <code>{entry.shortHash}</code>
                                    </span>
                                }
                            />
                        </ListItem>
                    ))}
                </List>
                {loading && <CircularProgress size={24} />}
                {error && (
                    <Alert severity="error" sx={{ whiteSpace: 'pre-wrap' }}>
                        {error}
                    </Alert>
                )}
            </DialogContent>
            <DialogActions>
                {hasMore && last && (
                    <Button
                        disabled={loading}
                        onClick={() => void loadPage(last.hash)}
                    >
                        {_('Load more')}
                    </Button>
                )}
                <Button color="inherit" onClick={onClose}>
                    {_('Close')}
                </Button>
            </DialogActions>
        </Dialog>
    );
});
