import { observer } from 'mobx-react-lite';
import { Button, Chip, IconButton, Tooltip, Typography } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import DeleteIcon from '@mui/icons-material/Delete';
import CodeIcon from '@mui/icons-material/Code';
import type { PassageEditorStore } from '../PassageEditorStore';
import { SButtons, SHeader, SSpacer, STitleRow } from './styles';

type TProps = {
    store: PassageEditorStore;
    onClose: () => void;
    onDelete: () => void;
    /** Open the passage's whole file in the source editor. */
    onEditSource: () => void;
};

/** The panel's header: id, type, unsaved chip, file and the Save / Revert / Edit source / Delete buttons. */
export const PassageHeader = observer(
    ({ store, onClose, onDelete, onEditSource }: TProps) => {
        const { base, dirty, saving, conflict } = store;
        return (
            <SHeader>
                <STitleRow>
                    <Typography
                        variant="subtitle1"
                        sx={{ fontWeight: 600, wordBreak: 'break-all' }}
                    >
                        {base.passageId}
                    </Typography>
                    <Chip size="small" label={base.type} />
                    {dirty && (
                        <Chip
                            size="small"
                            color="warning"
                            label={_('unsaved')}
                        />
                    )}
                    <SSpacer />
                    <Tooltip title={_('Close')}>
                        <IconButton
                            size="small"
                            onClick={onClose}
                            aria-label={_('Close')}
                        >
                            <CloseIcon fontSize="small" />
                        </IconButton>
                    </Tooltip>
                </STitleRow>
                <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ wordBreak: 'break-all' }}
                >
                    {base.file}
                </Typography>
                <SButtons>
                    <Button
                        size="small"
                        variant="contained"
                        disabled={!dirty || saving || conflict !== null}
                        onClick={() => void store.save()}
                    >
                        {saving ? _('Saving…') : _('Save')}
                    </Button>
                    <Button
                        size="small"
                        color="inherit"
                        disabled={!dirty || saving}
                        onClick={() => store.reset()}
                    >
                        {_('Revert')}
                    </Button>
                    <SSpacer />
                    <Tooltip title={_('Edit source')}>
                        <IconButton
                            size="small"
                            onClick={onEditSource}
                            aria-label={_('Edit source')}
                        >
                            <CodeIcon fontSize="small" />
                        </IconButton>
                    </Tooltip>
                    <Tooltip title={_('Delete passage')}>
                        <IconButton
                            size="small"
                            color="error"
                            onClick={onDelete}
                            aria-label={_('Delete passage')}
                        >
                            <DeleteIcon fontSize="small" />
                        </IconButton>
                    </Tooltip>
                </SButtons>
            </SHeader>
        );
    }
);
