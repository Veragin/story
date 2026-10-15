import { useState } from 'react';
import { observer } from 'mobx-react-lite';
import {
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    MenuItem,
    TextField,
} from '@mui/material';
import type { ChapterGraphStore } from './ChapterGraphStore';

export const PickCharacterDialog = observer(
    ({
        store,
        onPick,
        onClose,
    }: {
        store: ChapterGraphStore;
        onPick: (id: string) => void;
        onClose: () => void;
    }) => {
        const options = store.chapterCharacters;
        const [characterId, setCharacterId] = useState(options[0]?.id ?? '');
        return (
            <Dialog open onClose={onClose} maxWidth="xs" fullWidth>
                <DialogTitle>
                    {_('Remove character from %s', store.chapterTitle)}
                </DialogTitle>
                <DialogContent>
                    <TextField
                        select
                        fullWidth
                        size="small"
                        label={_('Character')}
                        value={characterId}
                        sx={{ mt: 1 }}
                        onChange={(e) => setCharacterId(e.target.value)}
                    >
                        {options.map((c) => (
                            <MenuItem key={c.id} value={c.id}>
                                {_('%s (%d passages)', c.name, c.passageCount)}
                            </MenuItem>
                        ))}
                    </TextField>
                </DialogContent>
                <DialogActions>
                    <Button color="inherit" onClick={onClose}>
                        {_('Cancel')}
                    </Button>
                    <Button
                        variant="contained"
                        color="error"
                        disabled={!characterId}
                        onClick={() => {
                            onClose();
                            onPick(characterId);
                        }}
                    >
                        {_('Remove…')}
                    </Button>
                </DialogActions>
            </Dialog>
        );
    }
);
