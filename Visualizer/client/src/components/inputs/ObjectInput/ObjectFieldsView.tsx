import { Chip, styled } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { observer } from 'mobx-react-lite';
import { spacingCss } from '@story/ui';
import {
    inferTypeRef,
    typeDefault,
    type TFieldDesc,
    type TValue,
    type TValueRecord,
} from '@story/visualizer-protocol';
import { FormValueInput } from '../form/FormValueInput';
import { nestedDiagnostics, type TDiagnosticsOf } from '../inputTypes';
import { useTypeContext } from '../structureContext';
import { AddFieldRow } from './AddFieldRow';

type TProps = {
    value: TValueRecord;
    onChange: (value: TValueRecord) => void;
    fields?: readonly TFieldDesc[];
    allowCustomFields: boolean;
    diagnosticsOf: TDiagnosticsOf;
    disabled?: boolean;
};

const withoutKey = (record: TValueRecord, key: string): TValueRecord =>
    Object.fromEntries(Object.entries(record).filter(([k]) => k !== key));

export const ObjectFieldsView = observer(
    ({
        value,
        onChange,
        fields = [],
        allowCustomFields,
        diagnosticsOf,
        disabled,
    }: TProps) => {
        const context = useTypeContext();
        const known = new Set(fields.map((field) => field.key));
        const extraKeys = Object.keys(value).filter((key) => !known.has(key));
        const setKey = (key: string) => (next: TValue | undefined) =>
            onChange(
                next === undefined
                    ? withoutKey(value, key)
                    : { ...value, [key]: next }
            );
        const shown = fields.filter(
            (field) => field.key in value || !field.optional
        );
        const missingOptional = fields.filter(
            (field) => field.optional && !(field.key in value)
        );

        return (
            <SFields>
                {shown.map((field) => (
                    <FormValueInput
                        key={field.key}
                        label={field.key}
                        type={field.type}
                        value={value[field.key]}
                        onChange={setKey(field.key)}
                        optional={field.optional && !field.locked}
                        helperText={field.description}
                        diagnostics={diagnosticsOf(field.key)}
                        diagnosticsOf={nestedDiagnostics(
                            diagnosticsOf,
                            field.key
                        )}
                        disabled={disabled}
                    />
                ))}
                {extraKeys.map((key) => (
                    <FormValueInput
                        key={key}
                        label={key}
                        type={inferTypeRef(value[key])}
                        value={value[key]}
                        onChange={setKey(key)}
                        optional
                        warning={
                            allowCustomFields
                                ? undefined
                                : _('Not a field of this type')
                        }
                        diagnostics={diagnosticsOf(key)}
                        diagnosticsOf={nestedDiagnostics(diagnosticsOf, key)}
                        disabled={disabled}
                    />
                ))}
                {missingOptional.length > 0 && (
                    <SChips>
                        {missingOptional.map((field) => (
                            <Chip
                                key={field.key}
                                size="small"
                                variant="outlined"
                                icon={<AddIcon fontSize="small" />}
                                label={field.key}
                                disabled={disabled}
                                data-action="add-optional-field"
                                data-key={field.key}
                                onClick={() =>
                                    setKey(field.key)(
                                        typeDefault(field.type, context)
                                    )
                                }
                            />
                        ))}
                    </SChips>
                )}
                {allowCustomFields && (
                    <AddFieldRow
                        existingKeys={[...known, ...extraKeys]}
                        onAdd={(key, type) =>
                            setKey(key)(typeDefault(type, context))
                        }
                        disabled={disabled}
                    />
                )}
            </SFields>
        );
    }
);

const SFields = styled('div')`
    display: flex;
    flex-direction: column;
    gap: ${spacingCss(1)};
    min-width: 0;
    width: 100%;
`;

const SChips = styled('div')`
    display: flex;
    flex-wrap: wrap;
    gap: ${spacingCss(0.5)};
`;
