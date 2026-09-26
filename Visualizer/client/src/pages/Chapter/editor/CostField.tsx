import {
    Autocomplete,
    Button,
    IconButton,
    MenuItem,
    styled,
    TextField,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import {
    isDeltaTime,
    type TDeltaTimeDto,
    type TDiagnosticDto,
    type TLinkCostDto,
    type TLinkCostObjectDto,
    type TMaybeCode,
} from '@story/visualizer-protocol';
import {
    CodeField,
    CodeTextArea,
    FieldDiagnostics,
    type TOption,
} from '../../../components/CodeField';
import { quoteString } from '../../../components/codeLiterals';
import { costToCode, deltaToCode, parseDelta } from './costCode';

type TProps = {
    value: TMaybeCode<TLinkCostDto> | undefined;
    onChange: (value: TMaybeCode<TLinkCostDto> | undefined) => void;
    items: TOption[];
    diag: (path: string) => TDiagnosticDto[];
    /** Field path of the cost (`body.0.links.1.cost`). */
    path: string;
};

/** `cost`: a duration, or `{ time?, items?, tools? }`, or a code snippet. */
export const CostField = ({ value, onChange, items, diag, path }: TProps) => (
    <CodeField<TLinkCostDto>
        label={_('Cost')}
        value={value}
        onChange={onChange}
        optional
        emptyLiteral={{ seconds: 600 }}
        toCode={costToCode}
        fromCode={parseDelta}
        diagnostics={diag(path)}
        literal={(cost, change) => (
            <CostLiteral
                cost={cost}
                onChange={change}
                items={items}
                diag={diag}
                path={path}
            />
        )}
    />
);

const MinutesField = ({
    value,
    onChange,
    label = _('Minutes'),
}: {
    value: TDeltaTimeDto;
    onChange: (v: TDeltaTimeDto) => void;
    label?: string;
}) => (
    <TextField
        size="small"
        type="number"
        label={label}
        value={value.seconds / 60}
        onChange={(e) =>
            onChange({ seconds: Math.round(Number(e.target.value || 0) * 60) })
        }
        sx={{ width: 120 }}
    />
);

const CostLiteral = ({
    cost,
    onChange,
    items,
    diag,
    path,
}: {
    cost: TLinkCostDto;
    onChange: (v: TLinkCostDto) => void;
    items: TOption[];
    diag: (path: string) => TDiagnosticDto[];
    path: string;
}) => {
    const simple = isDeltaTime(cost);
    return (
        <SCost>
            <SRow>
                <TextField
                    select
                    size="small"
                    label={_('Kind')}
                    value={simple ? 'time' : 'object'}
                    sx={{ width: 170 }}
                    onChange={(e) =>
                        onChange(
                            e.target.value === 'time'
                                ? simple
                                    ? cost
                                    : isDeltaTime(cost.time)
                                      ? cost.time
                                      : { seconds: 600 }
                                : simple
                                  ? { time: cost }
                                  : cost
                        )
                    }
                >
                    <MenuItem value="time">{_('Time only')}</MenuItem>
                    <MenuItem value="object">
                        {_('Time, items, tools')}
                    </MenuItem>
                </TextField>
                {simple && <MinutesField value={cost} onChange={onChange} />}
            </SRow>
            {!simple && (
                <CostObject
                    cost={cost}
                    onChange={onChange}
                    items={items}
                    diag={diag}
                    path={path}
                />
            )}
        </SCost>
    );
};

const CostObject = ({
    cost,
    onChange,
    items,
    diag,
    path,
}: {
    cost: TLinkCostObjectDto;
    onChange: (v: TLinkCostObjectDto) => void;
    items: TOption[];
    diag: (path: string) => TDiagnosticDto[];
    path: string;
}) => {
    const set = <K extends keyof TLinkCostObjectDto>(
        key: K,
        v: TLinkCostObjectDto[K]
    ) => {
        const next = { ...cost, [key]: v };
        if (v === undefined) delete next[key];
        onChange(next);
    };
    const itemIds = items.map((i) => i.id);
    return (
        <>
            <CodeField<TDeltaTimeDto>
                label={_('Time')}
                value={cost.time}
                onChange={(v) => set('time', v)}
                optional
                emptyLiteral={{ seconds: 600 }}
                toCode={deltaToCode}
                fromCode={parseDelta}
                diagnostics={diag(`${path}.time`)}
                literal={(time, change) => (
                    <MinutesField value={time} onChange={change} />
                )}
            />
            <CodeField<{ id: string; amount: number }[]>
                label={_('Items')}
                value={cost.items}
                onChange={(v) => set('items', v)}
                optional
                emptyLiteral={[]}
                toCode={(list) =>
                    `[${list.map((i) => `{ id: ${quoteString(i.id)}, amount: ${i.amount} }`).join(', ')}]`
                }
                diagnostics={diag(`${path}.items`)}
                literal={(list, change) => (
                    <>
                        {list.map((entry, i) => (
                            <SRow key={i}>
                                <Autocomplete
                                    freeSolo
                                    size="small"
                                    options={itemIds}
                                    value={entry.id}
                                    sx={{ flex: 1 }}
                                    onInputChange={(_e, id) =>
                                        change(
                                            list.map((x, j) =>
                                                j === i ? { ...x, id } : x
                                            )
                                        )
                                    }
                                    renderInput={(params) => (
                                        <TextField
                                            {...params}
                                            label={_('Item')}
                                        />
                                    )}
                                />
                                <TextField
                                    size="small"
                                    type="number"
                                    label={_('Amount')}
                                    value={entry.amount}
                                    sx={{ width: 100 }}
                                    onChange={(e) =>
                                        change(
                                            list.map((x, j) =>
                                                j === i
                                                    ? {
                                                          ...x,
                                                          amount: Number(
                                                              e.target.value ||
                                                                  0
                                                          ),
                                                      }
                                                    : x
                                            )
                                        )
                                    }
                                />
                                <IconButton
                                    size="small"
                                    aria-label={_('Remove')}
                                    onClick={() =>
                                        change(list.filter((_x, j) => j !== i))
                                    }
                                >
                                    <DeleteIcon fontSize="small" />
                                </IconButton>
                            </SRow>
                        ))}
                        <Button
                            size="small"
                            color="inherit"
                            startIcon={<AddIcon fontSize="small" />}
                            onClick={() =>
                                change([
                                    ...list,
                                    { id: itemIds[0] ?? '', amount: 1 },
                                ])
                            }
                            sx={{ alignSelf: 'flex-start' }}
                        >
                            {_('Add item')}
                        </Button>
                    </>
                )}
            />
            <CodeField<string[]>
                label={_('Tools')}
                value={cost.tools}
                onChange={(v) => set('tools', v)}
                optional
                emptyLiteral={[]}
                toCode={(tools) => `[${tools.map(quoteString).join(', ')}]`}
                diagnostics={diag(`${path}.tools`)}
                literal={(tools, change) => (
                    <Autocomplete
                        multiple
                        freeSolo
                        size="small"
                        options={itemIds}
                        value={tools}
                        onChange={(_e, v) => change(v)}
                        renderInput={(params) => (
                            <TextField
                                {...params}
                                placeholder={_('Item ids')}
                            />
                        )}
                    />
                )}
            />
        </>
    );
};

/** A code-only snippet with its diagnostics (whole `body` / `links` when they are code). */
export const CodeBlock = ({
    code,
    onChange,
    diagnostics,
}: {
    code: string;
    onChange: (code: string) => void;
    diagnostics: TDiagnosticDto[];
}) => (
    <>
        <CodeTextArea
            value={code}
            onChange={onChange}
            hasError={diagnostics.length > 0}
            minRows={3}
        />
        <FieldDiagnostics diagnostics={diagnostics} />
    </>
);

const SCost = styled('div')`
    display: flex;
    flex-direction: column;
    gap: 6px;
`;

const SRow = styled('div')`
    display: flex;
    gap: 8px;
    align-items: center;
`;
