import { useEffect, useState } from 'react';
import styled from '@emotion/styled';
import { Alert, Button, IconButton, Tooltip, TextField } from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded';
import { Column, Row, SmallText, spacingCss } from '@story/ui';
import type { TLocationDto } from '@story/visualizer-protocol';
import { ApiError } from '../../../api';
import {
    locationPatch,
    newLocalCharacterRow,
    toLocationDraft,
    type TLocationDraft,
    type TLocationPatch,
} from './draft';
import { TextDraftField } from './TextDraftField';
import { SourceField } from './SourceField';

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
        const mine = locationPatch(base, draft);
        const disk = toLocationDraft(against);
        const rebased: TLocationDraft = {
            name: 'name' in mine ? draft.name : disk.name,
            description:
                'description' in mine ? draft.description : disk.description,
            localCharacters:
                'localCharacters' in mine
                    ? draft.localCharacters
                    : disk.localCharacters,
        };
        setBase(against);
        setDraft(rebased);
        setConflict(null);
        void save(against, rebased);
    };

    const set = (p: Partial<TLocationDraft>) =>
        setDraft((d) => ({ ...d, ...p }));
    const chars = draft.localCharacters;

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
            <TextDraftField
                label={_('Name')}
                value={draft.name}
                readOnly={readOnly}
                onChange={(name) => set({ name })}
            />
            <TextDraftField
                label={_('Description')}
                value={draft.description}
                readOnly={readOnly}
                multiline
                onChange={(description) => set({ description })}
            />

            <SSection>
                <SRow>
                    <SmallText>{_('Local characters')}</SmallText>
                    {!readOnly && chars.kind === 'list' && (
                        <Tooltip title={_('Add character')}>
                            <IconButton
                                size="small"
                                color="inherit"
                                aria-label={_('Add character')}
                                onClick={() =>
                                    set({
                                        localCharacters: {
                                            kind: 'list',
                                            rows: [
                                                ...chars.rows,
                                                newLocalCharacterRow(),
                                            ],
                                        },
                                    })
                                }
                            >
                                <AddRoundedIcon fontSize="small" />
                            </IconButton>
                        </Tooltip>
                    )}
                </SRow>
                {chars.kind === 'code' ? (
                    <SourceField
                        label={_('Local characters (code)')}
                        value={chars.code}
                        readOnly={readOnly}
                        onChange={(code) =>
                            set({ localCharacters: { kind: 'code', code } })
                        }
                    />
                ) : chars.rows.length === 0 ? (
                    <SmallText>{_('No local characters.')}</SmallText>
                ) : (
                    chars.rows.map((row, index) => (
                        <SCharRow key={row.key}>
                            <TextDraftField
                                label={_('Name')}
                                value={row.name}
                                readOnly={readOnly}
                                onChange={(name) => {
                                    const rows = [...chars.rows];
                                    rows[index] = { ...row, name };
                                    set({
                                        localCharacters: { kind: 'list', rows },
                                    });
                                }}
                            />
                            <TextDraftField
                                label={_('Description')}
                                value={row.description}
                                readOnly={readOnly}
                                multiline
                                onChange={(description) => {
                                    const rows = [...chars.rows];
                                    rows[index] = { ...row, description };
                                    set({
                                        localCharacters: { kind: 'list', rows },
                                    });
                                }}
                            />
                            {!readOnly && (
                                <Tooltip title={_('Remove character')}>
                                    <IconButton
                                        size="small"
                                        color="error"
                                        aria-label={_('Remove character')}
                                        onClick={() =>
                                            set({
                                                localCharacters: {
                                                    kind: 'list',
                                                    rows: chars.rows.filter(
                                                        (r) => r.key !== row.key
                                                    ),
                                                },
                                            })
                                        }
                                    >
                                        <DeleteRoundedIcon fontSize="small" />
                                    </IconButton>
                                </Tooltip>
                            )}
                        </SCharRow>
                    ))
                )}
            </SSection>

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

const SSection = styled(Column)`
    gap: ${spacingCss(1)};
    align-items: stretch;
`;

const SRow = styled(Row)`
    align-items: center;
    gap: ${spacingCss(1)};
`;

const SCharRow = styled(Row)`
    gap: ${spacingCss(1)};
    align-items: flex-start;
`;

const SButtons = styled(Row)`
    justify-content: flex-end;
    gap: ${spacingCss(1)};
`;
