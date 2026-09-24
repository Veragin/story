import styled from '@emotion/styled';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import {
    Alert,
    Button,
    Checkbox,
    Chip,
    CircularProgress,
    Divider,
    FormControlLabel,
    IconButton,
    List,
    ListItemButton,
    ListItemText,
    TextField,
    Tooltip,
    Typography,
} from '@mui/material';
import { Column, Row, spacingCss, WholeContainer } from '@story/ui';
import { observer } from 'mobx-react-lite';
import { useEffect, useState } from 'react';
import type { TStructureType } from '../../../server/src/structure/StructureService';
import { Nav, NavPicker } from '../components/Nav';
import { useVisualizerStore } from '../context';

/**
 * The structure tab — editing the author's own type aliases
 * (VISUALIZER_PLAN §7 Phase 10; README § Visualizer, "structure: define/edit entities, edit
 * `types/`").
 *
 * ## What this UI is mostly doing is saying no
 *
 * Every type in `types/` is listed, but only those the server calls `editable` get inputs; the
 * rest show the server's reason. That asymmetry is the feature: §8 risk 6 is "`types/` editing
 * generating invalid TypeScript", and the answer is a reader that declines anything it does not
 * fully understand rather than a form that will try.
 *
 * A save that does not compile is rejected *with the compiler's message*, and the file is rolled
 * back before the response is sent — so the worst outcome of an experiment here is a red box
 * quoting `tsc`, never a story that will not build.
 */
export const StructureView = observer(() => {
    const store = useVisualizerStore();

    const [types, setTypes] = useState<TStructureType[] | null>(null);
    const [selectedName, setSelectedName] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    const [newField, setNewField] = useState({
        name: '',
        type: 'string',
        optional: true,
        doc: '',
    });

    const selected = types?.find((type) => type.name === selectedName) ?? null;

    const reload = async (keep?: string) => {
        const loaded = await store.agent.getStructure();
        setTypes(loaded);
        const next = keep ?? selectedName;
        if (!next || !loaded.some((type) => type.name === next)) {
            setSelectedName(
                loaded.find((type) => type.editable)?.name ??
                    loaded[0]?.name ??
                    null
            );
        }
    };

    useEffect(() => {
        void (async () => {
            try {
                await reload();
            } catch (caught) {
                setError(
                    caught instanceof Error
                        ? caught.message
                        : _('Could not load the structure')
                );
            }
        })();
        // Loaded once; every mutation below refreshes explicitly.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [store]);

    const applyEdits = async (
        edits: Parameters<typeof store.agent.updateStructure>[1]
    ) => {
        if (!selected) return;
        setSaving(true);
        setError(null);
        try {
            await store.agent.updateStructure(
                selected.name,
                edits,
                selected.hash ?? undefined
            );
            await reload(selected.name);
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
                        'Every change is typechecked before it is kept, and rolled back if it does not compile.'
                    )}
                </Typography>
            </Nav>

            <SBody>
                <SMenu>
                    {types === null && error === null && (
                        <CircularProgress size={24} sx={{ margin: 'auto' }} />
                    )}
                    <List dense disablePadding>
                        {types?.map((type) => (
                            <ListItemButton
                                key={`${type.file}#${type.name}`}
                                selected={type.name === selectedName}
                                onClick={() => setSelectedName(type.name)}
                            >
                                <ListItemText
                                    primary={
                                        type.typeParameters.length > 0
                                            ? `${type.name}<${type.typeParameters.join(', ')}>`
                                            : type.name
                                    }
                                    secondary={type.file.replace(
                                        /^types\//,
                                        ''
                                    )}
                                />
                                {!type.editable && (
                                    <Chip
                                        size="small"
                                        variant="outlined"
                                        label={_('read-only')}
                                    />
                                )}
                            </ListItemButton>
                        ))}
                    </List>
                </SMenu>

                <SEditor>
                    {error !== null && (
                        <SError severity="error">{error}</SError>
                    )}

                    {selected && (
                        <Column sx={{ gap: spacingCss(2) }}>
                            <Row
                                sx={{
                                    gap: spacingCss(1),
                                    alignItems: 'baseline',
                                }}
                            >
                                <Typography variant="h6">
                                    {selected.name}
                                </Typography>
                                <Typography
                                    variant="caption"
                                    color="text.secondary"
                                >
                                    {selected.file}:{selected.line}
                                </Typography>
                                <Button
                                    size="small"
                                    startIcon={
                                        <OpenInNewIcon fontSize="small" />
                                    }
                                    onClick={() =>
                                        void store.agent.openStructure(
                                            selected.name
                                        )
                                    }
                                >
                                    {_('Open in editor')}
                                </Button>
                            </Row>

                            {!selected.editable && (
                                <Alert severity="info">{selected.reason}</Alert>
                            )}

                            {selected.fields.map((field) => (
                                <SField key={field.name}>
                                    <Row
                                        sx={{
                                            gap: spacingCss(1),
                                            alignItems: 'center',
                                        }}
                                    >
                                        <Typography
                                            variant="body2"
                                            sx={{ minWidth: 160 }}
                                        >
                                            {field.name}
                                            {field.optional ? '?' : ''}
                                        </Typography>
                                        <Typography
                                            variant="body2"
                                            color="text.secondary"
                                            sx={{ flex: 1 }}
                                        >
                                            {field.type}
                                        </Typography>
                                        {selected.editable && (
                                            <Tooltip
                                                title={_('Remove this field')}
                                            >
                                                <span>
                                                    <IconButton
                                                        size="small"
                                                        disabled={saving}
                                                        onClick={() =>
                                                            void applyEdits([
                                                                {
                                                                    action: 'remove',
                                                                    name: field.name,
                                                                },
                                                            ])
                                                        }
                                                    >
                                                        <DeleteIcon fontSize="small" />
                                                    </IconButton>
                                                </span>
                                            </Tooltip>
                                        )}
                                    </Row>
                                    {field.doc && (
                                        <Typography
                                            variant="caption"
                                            color="text.secondary"
                                        >
                                            {field.doc}
                                        </Typography>
                                    )}
                                </SField>
                            ))}

                            {selected.editable && (
                                <>
                                    <Divider />
                                    <Typography variant="subtitle2">
                                        {_('Add a field')}
                                    </Typography>
                                    <Row
                                        sx={{
                                            gap: spacingCss(1),
                                            alignItems: 'center',
                                            flexWrap: 'wrap',
                                        }}
                                    >
                                        <TextField
                                            size="small"
                                            label={_('Name')}
                                            value={newField.name}
                                            onChange={(event) =>
                                                setNewField({
                                                    ...newField,
                                                    name: event.target.value,
                                                })
                                            }
                                        />
                                        <TextField
                                            size="small"
                                            label={_('Type')}
                                            value={newField.type}
                                            onChange={(event) =>
                                                setNewField({
                                                    ...newField,
                                                    type: event.target.value,
                                                })
                                            }
                                        />
                                        <FormControlLabel
                                            control={
                                                <Checkbox
                                                    checked={newField.optional}
                                                    onChange={(event) =>
                                                        setNewField({
                                                            ...newField,
                                                            optional:
                                                                event.target
                                                                    .checked,
                                                        })
                                                    }
                                                />
                                            }
                                            label={_('Optional')}
                                        />
                                        <TextField
                                            size="small"
                                            label={_('Description')}
                                            sx={{ flex: 1, minWidth: 200 }}
                                            value={newField.doc}
                                            onChange={(event) =>
                                                setNewField({
                                                    ...newField,
                                                    doc: event.target.value,
                                                })
                                            }
                                        />
                                        <Button
                                            variant="contained"
                                            startIcon={
                                                <AddIcon fontSize="small" />
                                            }
                                            disabled={
                                                saving ||
                                                newField.name.trim() === ''
                                            }
                                            onClick={() =>
                                                void applyEdits([
                                                    {
                                                        action: 'add',
                                                        name: newField.name.trim(),
                                                        type: newField.type.trim(),
                                                        optional:
                                                            newField.optional,
                                                        doc:
                                                            newField.doc.trim() ||
                                                            undefined,
                                                    },
                                                ]).then(() =>
                                                    setNewField({
                                                        name: '',
                                                        type: 'string',
                                                        optional: true,
                                                        doc: '',
                                                    })
                                                )
                                            }
                                        >
                                            {saving ? _('Checking…') : _('Add')}
                                        </Button>
                                    </Row>
                                    <Alert severity="info">
                                        {_(
                                            'A new field should usually be optional: every existing entity in data/ lacks it, and a required field would stop the story compiling.'
                                        )}
                                    </Alert>
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

const SField = styled(Column)`
    gap: ${spacingCss(0.25)};
    padding: ${spacingCss(0.5)} 0;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
`;

/** `tsc`'s output is multi-line and monospaced; showing it as prose loses the column markers. */
const SError = styled(Alert)`
    white-space: pre-wrap;
    font-family: ui-monospace, monospace;
    font-size: 0.78rem;
`;
