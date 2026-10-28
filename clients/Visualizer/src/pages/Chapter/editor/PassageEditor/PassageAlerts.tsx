import { observer } from 'mobx-react-lite';
import { Button } from '@mui/material';
import { ConflictAlert } from '../../../../components/feedback/ConflictAlert';
import { DiagnosticsList } from '../../../../components/feedback/DiagnosticsList';
import { ErrorAlert } from '../../../../components/feedback/ErrorAlert';
import type { PassageEditorStore } from '../PassageEditorStore';

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
                    <ConflictAlert
                        onReload={() => store.reloadFromDisk()}
                        onKeepMine={() => store.keepMine()}
                    />
                ) : (
                    <ConflictAlert
                        deleted
                        what={_('passage')}
                        action={
                            <Button
                                color="inherit"
                                size="small"
                                onClick={onClose}
                            >
                                {_('Close')}
                            </Button>
                        }
                    />
                ))}
            <ErrorAlert error={error} />
            <DiagnosticsList diagnostics={diagnosticIndex.unmapped} />
        </>
    );
});
