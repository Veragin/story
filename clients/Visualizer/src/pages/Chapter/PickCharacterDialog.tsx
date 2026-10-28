import { useState } from 'react';
import { observer } from 'mobx-react-lite';
import {
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
} from '@mui/material';
import { FormTypeInput } from '../../components/form/FormTypeInput';
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
                    <FormTypeInput
                        label={_('Character')}
                        value={characterId}
                        onChange={(next) => setCharacterId(next ?? '')}
                        options={options.map((c) => ({
                            id: c.id,
                            label: _(
                                '%s (%d passages)',
                                c.name,
                                c.passageCount
                            ),
                        }))}
                        dataField="characterId"
                    />
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
