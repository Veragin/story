import { useEffect, useState } from 'react';
import type { TLocationDto } from '@story/protocol';
import { errorMessage, isLocationDto, isStaleError } from '../../../api';
import { DialogButtons } from '../../../components/dialog/DialogButtons';
import { ConflictAlert } from '../../../components/feedback/ConflictAlert';
import { ErrorAlert } from '../../../components/feedback/ErrorAlert';
import { HintText } from '../../../components/feedback/HintText';
import { FormFields } from '../../../components/form/FormFields';
import { FormTextInput } from '../../../components/form/FormTextInput';
import { ActionRow } from '../../../components/layout/ActionRow';
import { FormArrayEditor } from '../../../components/editors/FormArrayEditor';
import { FormMaybeCodeTextInput } from '../../../components/code/FormMaybeCodeTextInput';
import { LOCAL_CHARACTER_TYPE } from '../../../typeRefs';
import {
    locationPatch,
    rebaseDraft,
    toLocalCharacters,
    toLocationDraft,
    type TLocationDraft,
    type TLocationPatch,
} from './draft';

export type TLocationFormProps = {
    location: TLocationDto;
    readOnly?: boolean;
    onSave: (patch: TLocationPatch, version: string) => Promise<TLocationDto>;
    onSaved?: (dto: TLocationDto) => void;
    onCancel: () => void;
};

export const LocationForm = ({
    location,
    readOnly,
    onSave,
    onSaved,
    onCancel,
}: TLocationFormProps) => {
    const [base, setBase] = useState(location);
    const [draft, setDraft] = useState<TLocationDraft>(() =>
        toLocationDraft(location)
    );
    const [conflict, setConflict] = useState<TLocationDto | null>(null);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const patch = locationPatch(base, draft);
    const dirty = Object.keys(patch).length > 0;

    // live refresh: follow the file silently while there is no input, otherwise ask
    useEffect(() => {
        if (location.version === base.version) return;
        if (dirty) {
            setConflict(location);
        } else {
            setBase(location);
            setDraft(toLocationDraft(location));
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps -- only when the DTO changes
    }, [location]);

    const save = async (
        against: TLocationDto = base,
        input: TLocationDraft = draft
    ) => {
        const body = locationPatch(against, input);
        if (Object.keys(body).length === 0) {
            onSaved?.(against);
            return;
        }
        setSaving(true);
        setError(null);
        try {
            const saved = await onSave(body, against.version);
            setBase(saved);
            setDraft(toLocationDraft(saved));
            setConflict(null);
            onSaved?.(saved);
        } catch (e) {
            if (isStaleError(e, isLocationDto)) {
                setConflict(e.current ?? location);
            } else {
                setError(errorMessage(e));
            }
        } finally {
            setSaving(false);
        }
    };

    const reload = () => {
        if (!conflict) return;
        setBase(conflict);
        setDraft(toLocationDraft(conflict));
        setConflict(null);
    };

    const keepMine = () => {
        if (!conflict) return;
        const against = conflict;
        const rebased = rebaseDraft(base, draft, against);
        setBase(against);
        setDraft(rebased);
        setConflict(null);
        void save(against, rebased);
    };

    const set = (p: Partial<TLocationDraft>) =>
        setDraft((d) => ({ ...d, ...p }));

    return (
        <FormFields
            as="form"
            onSubmit={(e) => {
                e.preventDefault();
                if (!readOnly) void save();
            }}
        >
            <FormTextInput
                label={_('Id')}
                value={location.id}
                onChange={() => undefined}
                readOnly
                helperText={_('The id cannot be changed.')}
                dataField="id"
            />
            <HintText>{location.file}</HintText>
            <FormMaybeCodeTextInput
                label={_('Name')}
                value={draft.name}
                onChange={(name = '') => set({ name })}
                disabled={readOnly}
                dataField="name"
            />
            <FormMaybeCodeTextInput
                label={_('Description')}
                multiline
                value={draft.description}
                onChange={(description = '') => set({ description })}
                disabled={readOnly}
                dataField="description"
            />
            <FormArrayEditor
                label={_('Local characters')}
                itemType={LOCAL_CHARACTER_TYPE}
                value={draft.localCharacters}
                onChange={(items = []) =>
                    set({ localCharacters: toLocalCharacters(items) })
                }
                disabled={readOnly}
                dataField="localCharacters"
            />

            {conflict && (
                <ConflictAlert
                    what={_('location')}
                    onReload={reload}
                    onKeepMine={keepMine}
                    disabled={saving}
                />
            )}
            <ErrorAlert error={error} />

            <ActionRow>
                {readOnly ? (
                    <DialogButtons closeOnly onClose={onCancel} />
                ) : (
                    <DialogButtons
                        onClose={onCancel}
                        label={_('Save')}
                        busyLabel={_('Saving…')}
                        busy={saving}
                        disabled={!dirty || conflict !== null}
                        submit
                    />
                )}
            </ActionRow>
        </FormFields>
    );
};
