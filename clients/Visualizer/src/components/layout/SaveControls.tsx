import { observer } from 'mobx-react-lite';
import RestoreIcon from '@mui/icons-material/Restore';
import SaveIcon from '@mui/icons-material/Save';
import { useKey } from '../../shell/keyboard';
import { TooltipIconButton } from '../buttons/TooltipIconButton';
import type { IEditorSource } from './editorSource';
import { UnsavedIndicator } from './UnsavedIndicator';

type TProps = {
    store: IEditorSource;
};

export const SaveControls = observer(({ store }: TProps) => {
    const canSave = store.dirty && !store.saving && !store.stale;

    useKey(
        'mod+s',
        (e) => {
            e.preventDefault();
            if (canSave) void store.save();
            return true;
        },
        { allowInInputs: true }
    );

    return (
        <>
            {store.dirty && <UnsavedIndicator variant="dot" />}
            <TooltipIconButton
                title={_('Discard changes')}
                icon={RestoreIcon}
                tone="inherit"
                disabled={!store.dirty || store.saving}
                onClick={() => store.discard()}
                data-action="discard"
            />
            <TooltipIconButton
                title={
                    store.stale
                        ? _('Resolve the conflict first')
                        : _('Save changes (Ctrl+S)')
                }
                icon={SaveIcon}
                tone="inherit"
                busy={store.saving}
                disabled={!canSave}
                onClick={() => void store.save()}
                data-action="save"
            />
        </>
    );
});
