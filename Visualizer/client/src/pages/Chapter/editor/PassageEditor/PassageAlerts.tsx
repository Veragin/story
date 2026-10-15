import { observer } from 'mobx-react-lite';
import { Alert, Button } from '@mui/material';
import { formatDiagnostic } from '../diagnostics';
import type { PassageEditorStore } from '../PassageEditorStore';
import { SList } from './styles';

type TProps = {
    store: PassageEditorStore;
    onClose: () => void;
};

export const PassageAlerts = observer(({ store, onClose }: TProps) => {
    const { conflict, error, diagnosticIndex } = store;
    return (
        <>
            {conflict &&
                (conflict.current ? (
                    <Alert
                        severity="warning"
                        action={
                            <>
                                <Button
                                    color="inherit"
                                    size="small"
                                    onClick={() => store.reloadFromDisk()}
                                >
                                    {_('Reload')}
                                </Button>
                                <Button
                                    color="inherit"
                                    size="small"
                                    onClick={() => void store.keepMine()}
                                >
                                    {_('Keep mine')}
                                </Button>
                            </>
                        }
                    >
                        {_('Changed on disk.')}
                    </Alert>
                ) : (
                    <Alert
                        severity="error"
                        action={
                            <Button
                                color="inherit"
                                size="small"
                                onClick={onClose}
                            >
                                {_('Close')}
                            </Button>
                        }
                    >
                        {_('This passage was deleted on disk.')}
                    </Alert>
                ))}
            {error && <Alert severity="error">{error}</Alert>}
            {diagnosticIndex.unmapped.length > 0 && (
                <Alert severity="error">
                    <SList>
                        {diagnosticIndex.unmapped.map((d, i) => (
                            <li key={i}>{formatDiagnostic(d)}</li>
                        ))}
                    </SList>
                </Alert>
            )}
        </>
    );
});
