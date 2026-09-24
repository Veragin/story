import styled from '@emotion/styled';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import {
    Alert,
    Button,
    Chip,
    CircularProgress,
    Divider,
    List,
    ListItemButton,
    ListItemText,
    Switch,
    TextField,
    Tooltip,
    Typography,
} from '@mui/material';
import { Column, Row, spacingCss, WholeContainer } from '@story/ui';
import { observer } from 'mobx-react-lite';
import { useEffect, useState } from 'react';
import type {
    TEntityDetail,
    TEntityKind,
} from '../../../server/src/entity/EntityService';
import { Nav, NavPicker } from '../components/Nav';
import { useVisualizerStore } from '../context';

/**
 * The entities tab — "menu of kinds → list → editor" (VISUALIZER_PLAN §7, Phase 9; README
 * § Visualizer, "entities: menu, per-entity lists, open and edit").
 *
 * One generic editor for every kind of thing in the story rather than six bespoke forms. What
 * makes that safe is that the *server* decides which fields are writable, per kind: this
 * component renders whatever `GET /api/entity/:kind/:id` calls a field, and shows everything
 * else in a read-only list **with the reason**. A read-only field with no explanation reads as
 * a bug; one that says "an id is referenced from register.ts and every file that names it" is a
 * design the author can agree or disagree with.
 */
export const EntitiesView = observer(() => {
    const store = useVisualizerStore();

    const [kinds, setKinds] = useState<TEntityKind[] | null>(null);
    const [selected, setSelected] = useState<{
        kind: string;
        id: string;
    } | null>(null);
    const [detail, setDetail] = useState<TEntityDetail | null>(null);
    const [draft, setDraft] = useState<
        Record<string, string | number | boolean>
    >({});
    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        let cancelled = false;
        void (async () => {
            try {
                const loaded = await store.agent.getEntities();
                if (cancelled) return;
                setKinds(loaded);
                const first = loaded.find((kind) => kind.members.length > 0);
                if (first)
                    setSelected({ kind: first.kind, id: first.members[0].id });
            } catch (caught) {
                if (cancelled) return;
                setError(
                    caught instanceof Error
                        ? caught.message
                        : _('Could not load the entities')
                );
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [store]);

    useEffect(() => {
        if (!selected) return;
        let cancelled = false;
        setDetail(null);

        void (async () => {
            try {
                const loaded = await store.agent.getEntity(
                    selected.kind,
                    selected.id
                );
                if (cancelled) return;
                setDetail(loaded);
                setDraft(
                    Object.fromEntries(
                        loaded.fields.map((field) => [
                            field.name,
                            field.value ?? '',
                        ])
                    )
                );
            } catch (caught) {
                if (cancelled) return;
                setError(
                    caught instanceof Error
                        ? caught.message
                        : _('Could not load the entity')
                );
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [selected, store]);

    const dirty =
        detail !== null &&
        detail.fields.some(
            (field) =>
                String(draft[field.name] ?? '') !== String(field.value ?? '')
        );

    const save = async () => {
        if (!detail || !selected) return;
        setSaving(true);
        setError(null);
        try {
            const updated = await store.agent.updateEntity(
                selected.kind,
                selected.id,
                draft,
                detail.hash ?? undefined
            );
            setDetail(updated);
            setDraft(
                Object.fromEntries(
                    updated.fields.map((field) => [
                        field.name,
                        field.value ?? '',
                    ])
                )
            );
            // The list shows labels derived from the fields just written, so it is refetched.
            setKinds(await store.agent.getEntities());
        } catch (caught) {
            setError(
                caught instanceof Error ? caught.message : _('Could not save')
            );
        } finally {
            setSaving(false);
        }
    };

    return (
        <WholeContainer>
            <Nav>
                <NavPicker />
                <Typography variant="caption" color="text.secondary">
                    {_(
                        'Every entity in the story, and the fields the Visualizer can safely write.'
                    )}
                </Typography>
            </Nav>

            <SBody>
                <SMenu>
                    {kinds === null && error === null && (
                        <CircularProgress size={24} sx={{ margin: 'auto' }} />
                    )}
                    {kinds?.map((kind) => (
                        <Column key={kind.kind} sx={{ gap: spacingCss(0.25) }}>
                            <Row
                                sx={{
                                    gap: spacingCss(1),
                                    alignItems: 'center',
                                    px: 1,
                                    pt: 1,
                                }}
                            >
                                <Typography
                                    variant="overline"
                                    color="text.secondary"
                                >
                                    {kind.label}
                                </Typography>
                                {!kind.editable && (
                                    <Tooltip
                                        title={_(
                                            'This kind has no individually editable fields'
                                        )}
                                    >
                                        <Chip
                                            size="small"
                                            variant="outlined"
                                            label={_('read-only')}
                                        />
                                    </Tooltip>
                                )}
                            </Row>
                            <List dense disablePadding>
                                {kind.members.map((member) => (
                                    <ListItemButton
                                        key={`${kind.kind}/${member.id}`}
                                        selected={
                                            selected?.kind === kind.kind &&
                                            selected.id === member.id
                                        }
                                        onClick={() =>
                                            setSelected({
                                                kind: kind.kind,
                                                id: member.id,
                                            })
                                        }
                                    >
                                        <ListItemText
                                            primary={member.label}
                                            secondary={member.id}
                                        />
                                    </ListItemButton>
                                ))}
                            </List>
                        </Column>
                    ))}
                </SMenu>

                <SEditor>
                    {error !== null && <Alert severity="error">{error}</Alert>}

                    {selected && detail === null && error === null && (
                        <CircularProgress size={24} />
                    )}

                    {detail && (
                        <Column sx={{ gap: spacingCss(2) }}>
                            <Row
                                sx={{
                                    gap: spacingCss(1),
                                    alignItems: 'baseline',
                                }}
                            >
                                <Typography variant="h6">
                                    {detail.label}
                                </Typography>
                                <Typography
                                    variant="caption"
                                    color="text.secondary"
                                >
                                    {detail.kind} · {detail.id}
                                </Typography>
                            </Row>

                            {detail.fields.length === 0 && (
                                <Alert severity="info">
                                    {_(
                                        'This entity has no fields the Visualizer edits directly.'
                                    )}
                                </Alert>
                            )}

                            {detail.fields.map((field) => (
                                <Column
                                    key={field.name}
                                    sx={{ gap: spacingCss(0.5) }}
                                >
                                    {field.kind === 'boolean' ? (
                                        <Row
                                            sx={{
                                                gap: spacingCss(1),
                                                alignItems: 'center',
                                            }}
                                        >
                                            <Switch
                                                checked={Boolean(
                                                    draft[field.name]
                                                )}
                                                onChange={(event) =>
                                                    setDraft({
                                                        ...draft,
                                                        [field.name]:
                                                            event.target
                                                                .checked,
                                                    })
                                                }
                                            />
                                            <Typography variant="body2">
                                                {field.name}
                                            </Typography>
                                        </Row>
                                    ) : (
                                        <TextField
                                            label={field.name}
                                            size="small"
                                            type={
                                                field.kind === 'number'
                                                    ? 'number'
                                                    : 'text'
                                            }
                                            multiline={field.kind === 'text'}
                                            minRows={
                                                field.kind === 'text'
                                                    ? 3
                                                    : undefined
                                            }
                                            value={draft[field.name] ?? ''}
                                            onChange={(event) =>
                                                setDraft({
                                                    ...draft,
                                                    [field.name]:
                                                        field.kind === 'number'
                                                            ? Number(
                                                                  event.target
                                                                      .value
                                                              )
                                                            : event.target
                                                                  .value,
                                                })
                                            }
                                        />
                                    )}
                                </Column>
                            ))}

                            <Row sx={{ gap: spacingCss(1) }}>
                                <Button
                                    variant="contained"
                                    disabled={
                                        !dirty ||
                                        saving ||
                                        detail.fields.length === 0
                                    }
                                    onClick={() => void save()}
                                >
                                    {saving ? _('Saving…') : _('Save')}
                                </Button>
                                {detail.file && (
                                    <Button
                                        startIcon={
                                            <OpenInNewIcon fontSize="small" />
                                        }
                                        onClick={() =>
                                            void store.agent.openEntity(
                                                detail.kind,
                                                detail.id
                                            )
                                        }
                                    >
                                        {_('Open in editor')}
                                    </Button>
                                )}
                            </Row>

                            {detail.readOnly.length > 0 && (
                                <>
                                    <Divider />
                                    <Typography variant="subtitle2">
                                        {_('Not editable here')}
                                    </Typography>
                                    {detail.readOnly.map((field) => (
                                        <Column
                                            key={field.name}
                                            sx={{ gap: spacingCss(0.25) }}
                                        >
                                            <Typography variant="body2">
                                                {field.name}
                                            </Typography>
                                            <Typography
                                                variant="caption"
                                                color="text.secondary"
                                            >
                                                {field.reason}
                                            </Typography>
                                        </Column>
                                    ))}
                                </>
                            )}
                        </Column>
                    )}
                </SEditor>
            </SBody>
        </WholeContainer>
    );
});

const SBody = styled(Row)`
    flex: 1;
    min-height: 0;
`;

const SMenu = styled(Column)`
    width: 280px;
    flex: 0 0 auto;
    overflow-y: auto;
    border-right: 1px solid rgba(255, 255, 255, 0.12);
`;

const SEditor = styled(Column)`
    flex: 1;
    min-width: 0;
    gap: ${spacingCss(2)};
    padding: ${spacingCss(3)};
    overflow-y: auto;
`;
