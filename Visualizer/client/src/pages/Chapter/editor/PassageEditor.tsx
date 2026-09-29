import { observer } from 'mobx-react-lite';
import {
    Alert,
    Button,
    Chip,
    Divider,
    IconButton,
    Paper,
    styled,
    Tooltip,
    Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';
import DeleteIcon from '@mui/icons-material/Delete';
import CodeIcon from '@mui/icons-material/Code';
import {
    isCode,
    type TBodyItemDto,
    type TDiagnosticDto,
    type TLinkDto,
    type TMaybeCode,
    type TPassageDto,
} from '@story/visualizer-protocol';
import {
    BooleanCodeField,
    CodeField,
    IdCodeField,
    NumberCodeField,
    StringCodeField,
    type TOption,
} from '../../../components/CodeField';
import { ImageField } from '../../../components/ImageField';
import type { TVisualizerApi } from '../../../api';
import { useKey } from '../../../shell';
import { formatDiagnostic } from './diagnostics';
import { CodeBlock, CostField } from './CostField';
import type { PassageEditorStore } from './PassageEditorStore';

type TProps = {
    store: PassageEditorStore;
    /** Passage ids offered by the pickers (the chapter's passages). */
    passageOptions: TOption[];
    itemOptions: TOption[];
    onClose: () => void;
    onDelete: () => void;
    /** Open the passage's whole file in the source editor. */
    onEditSource: () => void;
    /** The api the passage's image is loaded / uploaded through (the page's). */
    api?: TVisualizerApi;
};

type TDiag = (path: string) => TDiagnosticDto[];

/**
 * The passage editor side panel (plan WP6): every field of the passage, literal fields as
 * inputs and expression fields as code (`CodeField`). Saves through `PUT /passages/:id`
 * with only the changed fields, shows 422 diagnostics next to their fields (the ones it cannot
 * place at the top) and the "changed on disk — reload / keep mine" banner on 409 or when a
 * live change arrives while the draft is dirty.
 */
export const PassageEditor = observer(
    ({
        store,
        passageOptions,
        itemOptions,
        onClose,
        onDelete,
        onEditSource,
        api,
    }: TProps) => {
        const { draft, base, dirty, saving, conflict, error, diagnosticIndex } =
            store;
        const diag: TDiag = (path) => diagnosticIndex.byField.get(path) ?? [];

        useKey('mod+s', () => (void store.save(), true), {
            allowInInputs: true,
        });

        return (
            <SPanel elevation={0}>
                <SHeader>
                    <STitleRow>
                        <Typography
                            variant="subtitle1"
                            sx={{ fontWeight: 600, wordBreak: 'break-all' }}
                        >
                            {base.passageId}
                        </Typography>
                        <Chip size="small" label={base.type} />
                        {dirty && (
                            <Chip
                                size="small"
                                color="warning"
                                label={_('unsaved')}
                            />
                        )}
                        <SSpacer />
                        <Tooltip title={_('Close')}>
                            <IconButton
                                size="small"
                                onClick={onClose}
                                aria-label={_('Close')}
                            >
                                <CloseIcon fontSize="small" />
                            </IconButton>
                        </Tooltip>
                    </STitleRow>
                    <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ wordBreak: 'break-all' }}
                    >
                        {base.file}
                    </Typography>
                    <SButtons>
                        <Button
                            size="small"
                            variant="contained"
                            disabled={!dirty || saving || conflict !== null}
                            onClick={() => void store.save()}
                        >
                            {saving ? _('Saving…') : _('Save')}
                        </Button>
                        <Button
                            size="small"
                            color="inherit"
                            disabled={!dirty || saving}
                            onClick={() => store.reset()}
                        >
                            {_('Revert')}
                        </Button>
                        <SSpacer />
                        <Tooltip title={_('Edit source')}>
                            <IconButton
                                size="small"
                                onClick={onEditSource}
                                aria-label={_('Edit source')}
                            >
                                <CodeIcon fontSize="small" />
                            </IconButton>
                        </Tooltip>
                        <Tooltip title={_('Delete passage')}>
                            <IconButton
                                size="small"
                                color="error"
                                onClick={onDelete}
                                aria-label={_('Delete passage')}
                            >
                                <DeleteIcon fontSize="small" />
                            </IconButton>
                        </Tooltip>
                    </SButtons>
                </SHeader>

                {conflict &&
                    (conflict.current ? (
                        <Alert
                            severity="warning"
                            action={
                                <>
                                    <Button
                                        color="inherit"
                                        size="small"
                                        onClick={() => store.reloadFromDisk()}
                                    >
                                        {_('Reload')}
                                    </Button>
                                    <Button
                                        color="inherit"
                                        size="small"
                                        onClick={() => void store.keepMine()}
                                    >
                                        {_('Keep mine')}
                                    </Button>
                                </>
                            }
                        >
                            {_('Changed on disk.')}
                        </Alert>
                    ) : (
                        <Alert
                            severity="error"
                            action={
                                <Button
                                    color="inherit"
                                    size="small"
                                    onClick={onClose}
                                >
                                    {_('Close')}
                                </Button>
                            }
                        >
                            {_('This passage was deleted on disk.')}
                        </Alert>
                    ))}
                {error && <Alert severity="error">{error}</Alert>}
                {diagnosticIndex.unmapped.length > 0 && (
                    <Alert severity="error">
                        <SList>
                            {diagnosticIndex.unmapped.map((d, i) => (
                                <li key={i}>{formatDiagnostic(d)}</li>
                            ))}
                        </SList>
                    </Alert>
                )}
                {base.preamble && (
                    <Typography variant="caption" color="text.secondary">
                        {_(
                            'The passage function has statements before its return; they are kept as they are.'
                        )}
                    </Typography>
                )}

                <SFields>
                    <ImageField
                        api={api}
                        owner="passages"
                        id={base.passageId}
                        description={
                            draft.type === 'screen' &&
                            typeof draft.image === 'string'
                                ? draft.image
                                : undefined
                        }
                    />
                    <PassageFields
                        draft={draft}
                        edit={(fn) => store.edit(fn)}
                        diag={diag}
                        passageOptions={passageOptions}
                        itemOptions={itemOptions}
                    />
                </SFields>
            </SPanel>
        );
    }
);

type TFieldsProps = {
    draft: TPassageDto;
    edit: (mutate: (draft: TPassageDto) => void) => void;
    diag: TDiag;
    passageOptions: TOption[];
    itemOptions: TOption[];
};

const PassageFields = observer(
    ({ draft, edit, diag, passageOptions, itemOptions }: TFieldsProps) => {
        if (draft.type === 'transition') {
            return (
                <IdCodeField
                    label={_('Next passage (another chapter)')}
                    value={draft.nextPassageId}
                    onChange={(v) =>
                        edit(
                            (d) =>
                                d.type === 'transition' &&
                                v !== undefined &&
                                (d.nextPassageId = v)
                        )
                    }
                    options={passageOptions}
                    placeholder="<chapter>-<character>-<local>"
                    diagnostics={diag('nextPassageId')}
                />
            );
        }
        if (draft.type === 'linear') {
            return (
                <>
                    <StringCodeField
                        label={_('Description')}
                        multiline
                        value={draft.description}
                        onChange={(v) =>
                            edit(
                                (d) =>
                                    d.type === 'linear' &&
                                    v !== undefined &&
                                    (d.description = v)
                            )
                        }
                        diagnostics={diag('description')}
                    />
                    <IdCodeField
                        label={_('Next passage')}
                        value={draft.nextPassageId}
                        onChange={(v) =>
                            edit(
                                (d) =>
                                    d.type === 'linear' &&
                                    v !== undefined &&
                                    (d.nextPassageId = v)
                            )
                        }
                        options={passageOptions}
                        optional
                        removable={false}
                        diagnostics={diag('nextPassageId')}
                    />
                </>
            );
        }
        return (
            <>
                <StringCodeField
                    label={_('Title')}
                    value={draft.title}
                    onChange={(v) =>
                        edit(
                            (d) =>
                                d.type === 'screen' &&
                                v !== undefined &&
                                (d.title = v)
                        )
                    }
                    diagnostics={diag('title')}
                />
                <StringCodeField
                    label={_('Image description')}
                    value={draft.image}
                    onChange={(v) =>
                        edit(
                            (d) =>
                                d.type === 'screen' &&
                                v !== undefined &&
                                (d.image = v)
                        )
                    }
                    placeholder={_(
                        'what the picture shows; the picture is the .png next to the passage file'
                    )}
                    diagnostics={diag('image')}
                />
                <Divider />
                <Typography variant="subtitle2">{_('Body')}</Typography>
                {isCode(draft.body) ? (
                    <CodeBlock
                        code={draft.body.code}
                        onChange={(code) =>
                            edit(
                                (d) =>
                                    d.type === 'screen' && (d.body = { code })
                            )
                        }
                        diagnostics={diag('body')}
                    />
                ) : (
                    <BodyItems
                        items={draft.body}
                        onChange={(body) =>
                            edit((d) => d.type === 'screen' && (d.body = body))
                        }
                        diag={diag}
                        passageOptions={passageOptions}
                        itemOptions={itemOptions}
                    />
                )}
            </>
        );
    }
);

type TListProps<T> = {
    items: T[];
    onChange: (items: T[]) => void;
    diag: TDiag;
    passageOptions: TOption[];
    itemOptions: TOption[];
};

const replaceAt = <T,>(list: T[], i: number, value: T) =>
    list.map((x, j) => (j === i ? value : x));
const without = <T extends object>(obj: T, key: keyof T): T => {
    const next = { ...obj };
    delete next[key];
    return next;
};
/** Sets an optional field; `undefined` removes the key so it is not written as `key: undefined`. */
const setField = <T extends object, K extends keyof T>(
    obj: T,
    key: K,
    value: T[K] | undefined
): T => (value === undefined ? without(obj, key) : { ...obj, [key]: value });

const BodyItems = ({
    items,
    onChange,
    diag,
    passageOptions,
    itemOptions,
}: TListProps<TBodyItemDto>) => (
    <>
        {items.map((item, i) => {
            const path = `body.${i}`;
            const set = <K extends keyof TBodyItemDto>(
                key: K,
                value: TBodyItemDto[K] | undefined
            ) => onChange(replaceAt(items, i, setField(item, key, value)));
            return (
                <SItem key={i} variant="outlined">
                    <STitleRow>
                        <Typography variant="caption" sx={{ fontWeight: 600 }}>
                            {_('Body item %d', i + 1)}
                        </Typography>
                        <SSpacer />
                        <Tooltip title={_('Remove body item')}>
                            <IconButton
                                size="small"
                                aria-label={_('Remove body item')}
                                onClick={() =>
                                    onChange(items.filter((_x, j) => j !== i))
                                }
                            >
                                <DeleteIcon fontSize="small" />
                            </IconButton>
                        </Tooltip>
                    </STitleRow>
                    <SItemDiagnostics diagnostics={diag(path)} />
                    <BooleanCodeField
                        label={_('Condition')}
                        value={item.condition}
                        onChange={(v) => set('condition', v)}
                        optional
                        diagnostics={diag(`${path}.condition`)}
                    />
                    <IdCodeField
                        label={_('Redirect')}
                        value={item.redirect}
                        onChange={(v) => set('redirect', v)}
                        options={passageOptions}
                        optional
                        diagnostics={diag(`${path}.redirect`)}
                    />
                    <StringCodeField
                        label={_('Text')}
                        multiline
                        value={item.text}
                        onChange={(v) => set('text', v)}
                        optional
                        diagnostics={diag(`${path}.text`)}
                    />
                    <Links
                        value={item.links}
                        onChange={(v) => set('links', v)}
                        path={`${path}.links`}
                        diag={diag}
                        passageOptions={passageOptions}
                        itemOptions={itemOptions}
                    />
                </SItem>
            );
        })}
        <Button
            size="small"
            color="inherit"
            startIcon={<AddIcon fontSize="small" />}
            onClick={() =>
                onChange([...items, { condition: true, text: '', links: [] }])
            }
            sx={{ alignSelf: 'flex-start' }}
        >
            {_('Add body item')}
        </Button>
    </>
);

const Links = ({
    value,
    onChange,
    path,
    diag,
    passageOptions,
    itemOptions,
}: {
    value: TMaybeCode<TLinkDto[]> | undefined;
    onChange: (value: TMaybeCode<TLinkDto[]> | undefined) => void;
    path: string;
    diag: TDiag;
    passageOptions: TOption[];
    itemOptions: TOption[];
}) => {
    if (value === undefined) {
        return (
            <Button
                size="small"
                color="inherit"
                startIcon={<AddIcon fontSize="small" />}
                onClick={() => onChange([])}
                sx={{ alignSelf: 'flex-start' }}
            >
                {_('Links')}
            </Button>
        );
    }
    if (isCode(value)) {
        return (
            <>
                <Typography variant="caption" color="text.secondary">
                    {_('Links (code)')}
                </Typography>
                <CodeBlock
                    code={value.code}
                    onChange={(code) => onChange({ code })}
                    diagnostics={diag(path)}
                />
            </>
        );
    }
    return (
        <>
            <Typography variant="caption" color="text.secondary">
                {_('Links')}
            </Typography>
            <SItemDiagnostics diagnostics={diag(path)} />
            {value.map((link, j) => (
                <LinkEditor
                    key={j}
                    link={link}
                    index={j}
                    path={`${path}.${j}`}
                    onChange={(next) => onChange(replaceAt(value, j, next))}
                    onRemove={() => onChange(value.filter((_x, k) => k !== j))}
                    diag={diag}
                    passageOptions={passageOptions}
                    itemOptions={itemOptions}
                />
            ))}
            <Button
                size="small"
                color="inherit"
                startIcon={<AddIcon fontSize="small" />}
                onClick={() =>
                    onChange([
                        ...value,
                        { text: '', passageId: passageOptions[0]?.id ?? '' },
                    ])
                }
                sx={{ alignSelf: 'flex-start' }}
            >
                {_('Add link')}
            </Button>
        </>
    );
};

const LinkEditor = ({
    link,
    index,
    path,
    onChange,
    onRemove,
    diag,
    passageOptions,
    itemOptions,
}: {
    link: TLinkDto;
    index: number;
    path: string;
    onChange: (link: TLinkDto) => void;
    onRemove: () => void;
    diag: TDiag;
    passageOptions: TOption[];
    itemOptions: TOption[];
}) => {
    const set = <K extends keyof TLinkDto>(
        key: K,
        value: TLinkDto[K] | undefined
    ) => onChange(setField(link, key, value));
    return (
        <SLink>
            <STitleRow>
                <Typography variant="caption" sx={{ fontWeight: 600 }}>
                    {_('Link %d', index + 1)}
                </Typography>
                <SSpacer />
                <Tooltip title={_('Remove link')}>
                    <IconButton
                        size="small"
                        aria-label={_('Remove link')}
                        onClick={onRemove}
                    >
                        <DeleteIcon fontSize="small" />
                    </IconButton>
                </Tooltip>
            </STitleRow>
            <SItemDiagnostics diagnostics={diag(path)} />
            <StringCodeField
                label={_('Text')}
                value={link.text}
                onChange={(v) => set('text', v ?? '')}
                diagnostics={diag(`${path}.text`)}
            />
            <IdCodeField
                label={_('Target passage')}
                value={link.passageId}
                onChange={(v) => set('passageId', v ?? '')}
                options={passageOptions}
                diagnostics={diag(`${path}.passageId`)}
            />
            <NumberCodeField
                label={_('Auto priority')}
                value={link.autoPriortiy}
                onChange={(v) => set('autoPriortiy', v)}
                optional
                diagnostics={diag(`${path}.autoPriortiy`)}
            />
            <CostField
                value={link.cost}
                onChange={(v) => set('cost', v)}
                items={itemOptions}
                diag={diag}
                path={`${path}.cost`}
            />
            <CodeField<never>
                label="onFinish"
                value={link.onFinish}
                onChange={(v) => set('onFinish', v as TLinkDto['onFinish'])}
                optional
                emptyCode="() => {}"
                diagnostics={diag(`${path}.onFinish`)}
            />
        </SLink>
    );
};

const SItemDiagnostics = ({
    diagnostics,
}: {
    diagnostics: TDiagnosticDto[];
}) =>
    diagnostics.length === 0 ? null : (
        <Alert severity="error" sx={{ py: 0 }}>
            <SList>
                {diagnostics.map((d, i) => (
                    <li key={i}>{d.message}</li>
                ))}
            </SList>
        </Alert>
    );

const SPanel = styled(Paper)`
    display: flex;
    flex-direction: column;
    gap: 10px;
    min-height: 100%;
    padding: 12px;
    box-sizing: border-box;
    background: transparent;
`;

const SHeader = styled('div')`
    display: flex;
    flex-direction: column;
    gap: 4px;
`;

const STitleRow = styled('div')`
    display: flex;
    align-items: center;
    gap: 6px;
`;

const SButtons = styled('div')`
    display: flex;
    align-items: center;
    gap: 6px;
`;

const SSpacer = styled('span')`
    flex: 1;
`;

const SFields = styled('div')`
    display: flex;
    flex-direction: column;
    gap: 10px;
`;

const SItem = styled(Paper)`
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 8px 10px;
    background: rgba(255, 255, 255, 0.03);
`;

const SLink = styled('div')`
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 6px 0 6px 10px;
    border-left: 3px solid rgba(100, 181, 246, 0.5);
`;

const SList = styled('ul')`
    margin: 0;
    padding-left: 16px;
`;
