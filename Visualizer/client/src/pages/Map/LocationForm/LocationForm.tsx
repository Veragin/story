import { useEffect, useState } from 'react';
import styled from '@emotion/styled';
import { Alert, Button, TextField } from '@mui/material';
import { Row, SmallText, spacingCss } from '@story/ui';
import type { TLocationDto } from '@story/visualizer-protocol';
import { ApiError } from '../../../api';
import { FormArrayInput } from '../../../components/inputs/form/FormArrayInput';
import { FormStringInput } from '../../../components/inputs/form/FormStringInput';
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
    onCancel?: () => void;
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
            if (e instanceof ApiError && e.isStale) {
                setConflict((e.current as TLocationDto | null) ?? location);
            } else if (e instanceof ApiError && e.isInvalid) {
                setError(
                    e.diagnostics
                        .map((d) => `${d.file}:${d.line} ${d.message}`)
                        .join('\n')
                );
            } else {
                setError(e instanceof Error ? e.message : String(e));
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
        <SForm
            onSubmit={(e) => {
                e.preventDefault();
                if (!readOnly) void save();
            }}
        >
            <TextField
                label={_('Id')}
                value={location.id}
                slotProps={{ input: { readOnly: true } }}
                helperText={_('The id cannot be changed.')}
                size="small"
                fullWidth
            />
            <SmallText>{location.file}</SmallText>
            <FormStringInput
                label={_('Name')}
                value={draft.name}
                onChange={(name = '') => set({ name })}
                disabled={readOnly}
                dataField="name"
            />
            <FormStringInput
                label={_('Description')}
                multiline
                value={draft.description}
                onChange={(description = '') => set({ description })}
                disabled={readOnly}
                dataField="description"
            />
            <FormArrayInput
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
                <Alert
                    severity="warning"
                    action={
                        <>
                            <Button
                                color="inherit"
                                size="small"
                                onClick={reload}
                            >
                                {_('Reload')}
                            </Button>
                            <Button
                                color="inherit"
                                size="small"
                                onClick={keepMine}
                            >
                                {_('Keep mine')}
                            </Button>
                        </>
                    }
                >
                    {_('Changed on disk.')}
                </Alert>
            )}
            {error && (
                <Alert severity="error" style={{ whiteSpace: 'pre-wrap' }}>
                    {error}
                </Alert>
            )}

            <SButtons>
                {onCancel && (
                    <Button color="inherit" onClick={onCancel}>
                        {readOnly ? _('Close') : _('Cancel')}
                    </Button>
                )}
                {!readOnly && (
                    <Button
                        type="submit"
                        variant="contained"
                        disabled={saving || !dirty || conflict !== null}
                    >
                        {saving ? _('Saving…') : _('Save')}
                    </Button>
                )}
            </SButtons>
        </SForm>
    );
};

const SForm = styled.form`
    display: flex;
    flex-direction: column;
    gap: ${spacingCss(1.5)};
    color: #fff;
    padding-top: ${spacingCss(1)};
`;

const SButtons = styled(Row)`
    justify-content: flex-end;
    gap: ${spacingCss(1)};
`;
