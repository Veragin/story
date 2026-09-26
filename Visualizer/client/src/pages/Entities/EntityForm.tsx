import { useEffect, useState } from 'react';
import {
    Button,
    Chip,
    CircularProgress,
    MenuItem,
    TextField,
    Tooltip,
    styled,
} from '@mui/material';
import { Delete, Restore, Save } from '@mui/icons-material';
import { observer } from 'mobx-react-lite';
import { spacingCss } from '@story/ui';
import {
    isCode,
    type TCharacterDto,
    type TDataTypeDto,
    type TEntityDto,
    type TItemDto,
    type TLocationDto,
    type TNpcDto,
    type TValueRecord,
} from '@story/visualizer-protocol';
import { modals, router, useKey } from '../../shell';
import {
    CodeOnlyField,
    MaybeCodeField,
    SField,
    SLabel,
    SLabelRow,
} from './CodeField';
import type { EntitiesStore } from './EntitiesStore';
import {
    displayName,
    ITEM_TYPE_PROPS,
    itemTypesForSource,
} from './entityFields';
import {
    IdField,
    IdMultiPicker,
    LocalCharactersField,
    RecordEditor,
    StringField,
    type TKnownField,
} from './inputs';
import { Notices } from './Notices';

const KIND_LABEL = {
    characters: () => _('character'),
    npcs: () => _('NPC'),
    locations: () => _('location'),
    items: () => _('item'),
};

const CHARACTER_INIT: TKnownField[] = [
    { key: 'health', label: 'health', kind: 'number', always: true },
    { key: 'stamina', label: 'stamina', kind: 'number', always: true },
    { key: 'hunger', label: 'hunger', kind: 'number', always: true },
    { key: 'location', label: 'location', kind: 'location' },
    { key: 'inventory', label: 'inventory', kind: 'inventory', always: true },
];

const NPC_INIT: TKnownField[] = [
    { key: 'location', label: 'location', kind: 'location', always: true },
    { key: 'isDead', label: 'isDead', kind: 'boolean', always: true },
    { key: 'inventory', label: 'inventory', kind: 'inventory', always: true },
];

const isRecord = (v: unknown): v is TValueRecord =>
    typeof v === 'object' && v !== null && !Array.isArray(v) && !isCode(v);

const isStringArray = (v: unknown): v is string[] =>
    Array.isArray(v) && v.every((x) => typeof x === 'string');

/** The right-hand form of the selected entity. */
export const EntityForm = observer(({ store }: { store: EntitiesStore }) => {
    const { draft, base } = store;

    useKey(
        'mod+s',
        (e) => {
            e.preventDefault();
            if (store.dirty && !store.stale) void store.save();
            return true;
        },
        { allowInInputs: true, enabled: !!draft }
    );

    if (store.loading && !draft)
        return (
            <SCenter>
                <CircularProgress size={24} />
            </SCenter>
        );
    if (store.notFound) {
        return (
            <SCenter>
                <div>
                    {_(
                        '"%s" does not exist (any more).',
                        store.selectedId ?? ''
                    )}
                </div>
                <Notices store={store} />
            </SCenter>
        );
    }
    if (!draft || !base) {
        return (
            <SCenter>
                <div>{_('Select an entity on the left, or add one.')}</div>
                <Notices store={store} />
            </SCenter>
        );
    }

    const onDelete = async () => {
        const ok = await modals.confirm({
            title: _('Delete %s "%s"?', KIND_LABEL[base.kind](), base.id),
            message: _(
                'This removes it from %s and from the registry. It is refused while anything still references it.',
                base.file
            ),
            danger: true,
        });
        if (!ok) return;
        if (await store.remove())
            router.navigate(
                { page: 'entities', kind: base.kind },
                { replace: true }
            );
    };

    const errorsOf = (field: string) =>
        store
            .fieldDiagnostics(field)
            .map((d) => `${d.line}:${d.column} ${d.message}`);

    return (
        <SForm>
            <SHeader>
                <STitle>
                    {displayName((draft as { name?: unknown }).name, draft.id)}
                </STitle>
                {store.dirty && (
                    <Chip size="small" color="warning" label={_('unsaved')} />
                )}
                <SSpacer />
                <Tooltip title={_('Discard unsaved input')}>
                    <span>
                        <Button
                            size="small"
                            color="inherit"
                            startIcon={<Restore />}
                            disabled={!store.dirty || store.saving}
                            onClick={store.discard}
                        >
                            {_('Discard')}
                        </Button>
                    </span>
                </Tooltip>
                <Button
                    size="small"
                    color="error"
                    startIcon={<Delete />}
                    onClick={() => void onDelete()}
                    disabled={store.saving}
                >
                    {_('Delete')}
                </Button>
                <Tooltip
                    title={
                        store.stale ? _('Resolve the conflict first') : 'Ctrl+S'
                    }
                >
                    <span>
                        <Button
                            size="small"
                            variant="contained"
                            startIcon={
                                store.saving ? (
                                    <CircularProgress
                                        size={14}
                                        color="inherit"
                                    />
                                ) : (
                                    <Save />
                                )
                            }
                            disabled={
                                !store.dirty || store.saving || !!store.stale
                            }
                            onClick={() => void store.save()}
                        >
                            {_('Save')}
                        </Button>
                    </span>
                </Tooltip>
            </SHeader>
            <SMeta>
                <span>
                    {_('id')}: <code>{draft.id}</code>
                </span>
                <span>
                    <code>
                        {base.file}
                        {base.line ? `:${base.line}` : ''}
                    </code>
                </span>
            </SMeta>
            <Notices store={store} />
            <SFields>
                <KindFields store={store} draft={draft} errorsOf={errorsOf} />
            </SFields>
        </SForm>
    );
});

type TFieldsProps = {
    store: EntitiesStore;
    draft: TEntityDto;
    errorsOf: (field: string) => string[];
};

const KindFields = observer(({ store, draft, errorsOf }: TFieldsProps) => {
    const set = store.setField;
    const locationIds = store.idsOf('locations');
    const itemIds = store.idsOf('items');
    const nestedErrors = (field: string) => (key: string) =>
        errorsOf(`${field}.${key}`);

    const initField = (known: TKnownField[]) => (
        <MaybeCodeField<TValueRecord>
            label="init"
            value={(draft as { init: TValueRecord }).init}
            onChange={(v) => set('init', v)}
            accept={isRecord}
            fallback={{}}
            errors={store
                .fieldDiagnostics('init')
                .filter((d) => d.field === 'init')
                .map((d) => d.message)}
            block
            renderLiteral={(value, onChange) => (
                <RecordEditor
                    label="init"
                    value={value}
                    onChange={onChange}
                    known={known}
                    locationIds={locationIds}
                    itemIds={itemIds}
                    errorsOf={nestedErrors('init')}
                />
            )}
        />
    );

    const common = (descriptionOptional: boolean) => (
        <>
            <StringField
                label={_('name')}
                value={(draft as TNpcDto).name}
                onChange={(v) => set('name', v)}
                errors={errorsOf('name')}
            />
            <StringField
                label={
                    descriptionOptional
                        ? _('description (optional)')
                        : _('description')
                }
                value={(draft as TNpcDto).description}
                onChange={(v) => set('description', v)}
                multiline
                errors={errorsOf('description')}
            />
        </>
    );

    switch (draft.kind) {
        case 'characters': {
            const c = draft as TCharacterDto;
            return (
                <>
                    {common(true)}
                    <StartPassageField
                        store={store}
                        character={c}
                        errors={errorsOf('startPassageId')}
                    />
                    {initField(CHARACTER_INIT)}
                    <DataTypeField
                        store={store}
                        draft={draft}
                        suffix="Character"
                        errors={errorsOf('dataType')}
                    />
                </>
            );
        }
        case 'npcs':
            return (
                <>
                    {common(false)}
                    {initField(NPC_INIT)}
                    <DataTypeField
                        store={store}
                        draft={draft}
                        suffix="Npc"
                        errors={errorsOf('dataType')}
                    />
                </>
            );
        case 'locations': {
            const l = draft as TLocationDto;
            return (
                <>
                    {common(false)}
                    <LocalCharactersField
                        value={l.localCharacters}
                        onChange={(v) => set('localCharacters', v)}
                        errors={errorsOf('localCharacters')}
                    />
                    <MaybeCodeField<string[]>
                        label={_('sublocations (optional)')}
                        value={l.sublocations}
                        onChange={(v) => set('sublocations', v)}
                        accept={isStringArray}
                        fallback={[]}
                        errors={errorsOf('sublocations')}
                        renderLiteral={(v, s) => (
                            <IdMultiPicker
                                value={v}
                                onChange={s}
                                options={locationIds.filter(
                                    (id) => id !== l.id
                                )}
                                placeholder={_('location ids')}
                            />
                        )}
                    />
                    <StringField
                        label={_('mapId (optional)')}
                        value={l.mapId}
                        onChange={(v) => set('mapId', v)}
                        errors={errorsOf('mapId')}
                        placeholder="global"
                    />
                    {initField([])}
                    <DataTypeField
                        store={store}
                        draft={draft}
                        suffix="Location"
                        errors={errorsOf('dataType')}
                    />
                    <SNote>
                        {_('The location polygon is edited on the')}{' '}
                        <a href={router.href({ page: 'map' })}>
                            {_('Map page')}
                        </a>
                        .
                    </SNote>
                </>
            );
        }
        case 'items':
            return (
                <ItemFields
                    store={store}
                    item={draft as TItemDto}
                    errorsOf={errorsOf}
                />
            );
    }
});

const ItemFields = observer(
    ({
        store,
        item,
        errorsOf,
    }: {
        store: EntitiesStore;
        item: TItemDto;
        errorsOf: (f: string) => string[];
    }) => {
        const types = itemTypesForSource(item.source);
        if (!types.includes(item.type)) types.push(item.type);
        const known: TKnownField[] = (ITEM_TYPE_PROPS[item.type] ?? []).map(
            (p) => ({
                key: p.key,
                label: p.key,
                kind: p.kind,
                always: true,
            })
        );
        return (
            <>
                <SMeta>
                    <span>
                        {_('in')} <code>{item.source}</code>
                    </span>
                </SMeta>
                <StringField
                    label={_('name')}
                    value={item.name}
                    onChange={(v) => store.setField('name', v)}
                    errors={errorsOf('name')}
                />
                <SField>
                    <SLabelRow>
                        <SLabel>{_('type')}</SLabel>
                    </SLabelRow>
                    <TextField
                        select
                        size="small"
                        value={item.type}
                        onChange={(e) => store.setField('type', e.target.value)}
                        helperText={
                            types.length === 1
                                ? _(
                                      'Items in %s are always of this type.',
                                      item.source
                                  )
                                : _(
                                      'Moving an item to another file (food, tool) is not supported here.'
                                  )
                        }
                        sx={{ maxWidth: 260 }}
                    >
                        {types.map((t) => (
                            <MenuItem key={t} value={t}>
                                {t}
                            </MenuItem>
                        ))}
                    </TextField>
                </SField>
                <SField>
                    <SLabelRow>
                        <SLabel>{_('properties')}</SLabel>
                    </SLabelRow>
                    <SBlock>
                        <RecordEditor
                            label={_('properties')}
                            value={item.props}
                            onChange={(v) => store.setField('props', v)}
                            known={known}
                            locationIds={store.idsOf('locations')}
                            itemIds={store.idsOf('items')}
                            errorsOf={(key) => errorsOf(`props.${key}`)}
                        />
                    </SBlock>
                </SField>
            </>
        );
    }
);

const StartPassageField = observer(
    ({
        store,
        character,
        errors,
    }: {
        store: EntitiesStore;
        character: TCharacterDto;
        errors: string[];
    }) => {
        const [options, setOptions] = useState<string[]>([]);
        const projectVersion = store.project?.version;
        useEffect(() => {
            let alive = true;
            void store.passageIdsOf(character.id).then((ids) => {
                if (alive) setOptions(ids);
            });
            return () => {
                alive = false;
            };
        }, [store, character.id, projectVersion]);
        return (
            <IdField
                label={_('startPassageId (optional)')}
                value={character.startPassageId}
                onChange={(v) => store.setField('startPassageId', v)}
                options={options}
                errors={errors}
                placeholder={`<chapter>-${character.id}-intro`}
            />
        );
    }
);

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** `export type T<Name><Suffix>Data = { … }` next to the entity — always code. */
const DataTypeField = observer(
    ({
        store,
        draft,
        suffix,
        errors,
    }: {
        store: EntitiesStore;
        draft: TEntityDto;
        suffix: string;
        errors: string[];
    }) => {
        const dataType = (draft as { dataType?: TDataTypeDto }).dataType;
        if (!dataType) {
            return (
                <SField>
                    <SLabelRow>
                        <SLabel>{_('data type')}</SLabel>
                    </SLabelRow>
                    <div>
                        <Button
                            size="small"
                            onClick={() =>
                                store.setField('dataType', {
                                    name: `T${capitalize(draft.id)}${suffix}Data`,
                                    code: '{}',
                                })
                            }
                        >
                            {_('Add a data type')}
                        </Button>
                    </div>
                </SField>
            );
        }
        return (
            <CodeOnlyField
                label={
                    <span>
                        {_('data type')}{' '}
                        <code style={{ textTransform: 'none' }}>
                            {dataType.name}
                        </code>
                    </span>
                }
                value={dataType.code}
                onChange={(code) =>
                    store.setField('dataType', {
                        ...dataType,
                        code,
                    } satisfies TDataTypeDto)
                }
                errors={errors}
                placeholder="{ knowsMagic: boolean }"
            />
        );
    }
);

const SForm = styled('div')`
    display: flex;
    flex-direction: column;
    gap: ${spacingCss(1.5)};
    padding: ${spacingCss(2)} ${spacingCss(3)} ${spacingCss(6)};
    max-width: 920px;
`;

const SHeader = styled('div')`
    display: flex;
    align-items: center;
    gap: ${spacingCss(1)};
    position: sticky;
    top: 0;
    z-index: 2;
    padding: ${spacingCss(1)} 0;
    background: ${({ theme }) => theme.palette.background.default};
`;

const STitle = styled('h2')`
    margin: 0;
    font-size: 20px;
    font-weight: 600;
`;

const SSpacer = styled('div')`
    flex: 1;
`;

const SMeta = styled('div')`
    display: flex;
    gap: ${spacingCss(2)};
    font-size: 12px;
    color: ${({ theme }) => theme.palette.text.secondary};
    & code {
        color: ${({ theme }) => theme.palette.text.primary};
    }
`;

const SFields = styled('div')`
    display: flex;
    flex-direction: column;
    gap: ${spacingCss(2)};
`;

const SBlock = styled('div')`
    padding-left: ${spacingCss(1)};
    border-left: 2px solid rgba(255, 255, 255, 0.12);
`;

const SNote = styled('div')`
    font-size: 13px;
    color: ${({ theme }) => theme.palette.text.secondary};
    & a {
        color: ${({ theme }) => theme.palette.primary.main};
    }
`;

const SCenter = styled('div')`
    display: flex;
    flex-direction: column;
    gap: ${spacingCss(2)};
    align-items: center;
    justify-content: center;
    padding: ${spacingCss(6)};
    color: ${({ theme }) => theme.palette.text.secondary};
`;
