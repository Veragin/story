import { useState } from 'react';
import { observer } from 'mobx-react-lite';
import { Alert, Button, styled } from '@mui/material';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import { isPassageType, PASSAGE_TYPES, type TPassageType } from '@story/shared';
import { FormAutocompleteInput } from '../../components/form/FormAutocompleteInput';
import { TitleIdInput } from '../../components/form/TitleIdInput';
import { useTitleId } from '../../components/form/useTitleId';
import { AppDialog } from '../../components/dialog/AppDialog';
import { DialogButtons } from '../../components/dialog/DialogButtons';
import { useDialogSubmit } from '../../components/dialog/useDialogSubmit';
import type { ChapterGraphStore } from './ChapterGraphStore';
import { idError } from './dialogUtils';

const PASSAGE_TYPE_LABELS: Record<TPassageType, () => string> = {
    start: () => _('start — entry point of the chapter'),
    screen: () => _('screen — text with links'),
    linear: () => _('linear — description, then next'),
    redirect: () => _('redirect — automatic, by condition'),
    finish: () => _('finish — leave to another chapter'),
};

type TProps = {
    store: ChapterGraphStore;
    onClose: () => void;
    onAddCharacter: (onAdded: (characterId: string) => void) => void;
};

export const AddPassageDialog = observer(
    ({ store, onClose, onAddCharacter }: TProps) => {
        const characters = store.chapterCharacters;
        const [characterId, setCharacterId] = useState(characters[0]?.id ?? '');
        const [type, setType] = useState<TPassageType>('screen');
        const idPrefix = `${store.chapterId}-${characterId}-`;
        const isTaken = (id: string) =>
            store.passages.some((p) => p.passageId === idPrefix + id);
        const titleId = useTitleId('passage', isTaken);
        const localId = titleId.id;
        const localError = localId === '' ? null : idError(localId);
        const exists = isTaken(localId);
        const canSubmit =
            characters.length > 0 &&
            !!localId &&
            localError === null &&
            !exists;

        const addCharacter = () => onAddCharacter(setCharacterId);

        const { busy, error, submit } = useDialogSubmit(
            async () => {
                const passage = await store.createPassage({
                    characterId,
                    localId,
                    type,
                    title: titleId.title.trim(),
                });
                onClose();
                store.openEditor(passage.passageId);
            },
            { canSubmit }
        );

        return (
            <AppDialog
                title={_('Add passage')}
                size="xs"
                onClose={onClose}
                onSubmit={submit}
                error={error}
                actions={
                    <DialogButtons
                        onClose={onClose}
                        label={_('Create')}
                        busyLabel={_('Creating…')}
                        busy={busy}
                        disabled={!canSubmit}
                        submit
                    />
                }
            >
                {characters.length === 0 ? (
                    <Alert
                        severity="info"
                        action={
                            <Button
                                color="inherit"
                                size="small"
                                onClick={addCharacter}
                            >
                                {_('Add character')}
                            </Button>
                        }
                    >
                        {_(
                            'This chapter has no characters yet. Use "Add character" first.'
                        )}
                    </Alert>
                ) : (
                    <>
                        <FormAutocompleteInput
                            label={_('Character')}
                            value={characterId}
                            onChange={(next) => setCharacterId(next ?? '')}
                            options={characters.map((c) => ({
                                id: c.id,
                                label: c.name,
                            }))}
                            dataField="characterId"
                        />
                        <SAddCharacterButton
                            size="small"
                            startIcon={<PersonAddIcon />}
                            onClick={addCharacter}
                        >
                            {_('Add character')}
                        </SAddCharacterButton>
                        <TitleIdInput
                            state={titleId}
                            label={_('Title')}
                            autoFocus
                            idPrefix={idPrefix}
                            idError={
                                localError ??
                                (exists
                                    ? _('This passage already exists')
                                    : null)
                            }
                        />
                        <FormAutocompleteInput
                            label={_('Type')}
                            value={type}
                            onChange={(next) => {
                                if (next && isPassageType(next)) setType(next);
                            }}
                            options={PASSAGE_TYPES.map((passageType) => ({
                                id: passageType,
                                label: PASSAGE_TYPE_LABELS[passageType](),
                            }))}
                            dataField="type"
                        />
                    </>
                )}
            </AppDialog>
        );
    }
);

const SAddCharacterButton = styled(Button)`
    align-self: flex-start;
`;
