import { useState } from 'react';
import { observer } from 'mobx-react-lite';
import { FormAutocompleteInput } from '../../components/form/FormAutocompleteInput';
import { AppDialog } from '../../components/dialog/AppDialog';
import { DialogButtons } from '../../components/dialog/DialogButtons';
import type { ChapterGraphStore } from './ChapterGraphStore';

type TProps = {
    store: ChapterGraphStore;
    onPick: (id: string) => void;
    onClose: () => void;
};

export const PickCharacterDialog = observer(
    ({ store, onPick, onClose }: TProps) => {
        const options = store.chapterCharacters;
        const [characterId, setCharacterId] = useState(options[0]?.id ?? '');
        const pick = () => {
            if (!characterId) return;
            onClose();
            onPick(characterId);
        };
        return (
            <AppDialog
                title={_('Remove character from %s', store.chapterTitle)}
                size="xs"
                onClose={onClose}
                onSubmit={pick}
                actions={
                    <DialogButtons
                        onClose={onClose}
                        label={_('Remove…')}
                        danger
                        disabled={!characterId}
                        submit
                    />
                }
            >
                <FormAutocompleteInput
                    label={_('Character')}
                    value={characterId}
                    onChange={(next) => setCharacterId(next ?? '')}
                    options={options.map((c) => ({
                        id: c.id,
                        label: _('%s (%d passages)', c.name, c.passageCount),
                    }))}
                    dataField="characterId"
                />
            </AppDialog>
        );
    }
);
