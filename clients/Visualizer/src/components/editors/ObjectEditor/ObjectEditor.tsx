import { styled } from '@mui/material';
import { spacingCss } from '@story/ui';
import {
    code,
    isCode,
    type TFieldDesc,
    type TMaybeCode,
    type TValueRecord,
} from '@story/protocol';
import {
    noDiagnosticsOf,
    type TDiagnosticsOf,
    type TInputProps,
} from '../../inputs/inputTypes';
import { ObjectCodeView } from './ObjectCodeView';
import { ObjectFieldsView } from './ObjectFieldsView';
import { ObjectViewToggle } from './ObjectViewToggle';
import { ActionRow } from '../../layout/ActionRow';

type TProps = TInputProps<TMaybeCode<TValueRecord>> & {
    fields?: readonly TFieldDesc[];
    allowCustomFields?: boolean;
    diagnosticsOf?: TDiagnosticsOf;
    hideViewToggle?: boolean;
};

export const ObjectEditor = ({
    value,
    onChange,
    fields,
    allowCustomFields = !fields,
    diagnosticsOf = noDiagnosticsOf,
    hideViewToggle,
    hasError,
    disabled,
    ariaLabel,
    dataField,
}: TProps) => (
    <SObject
        data-field={dataField}
        data-view={isCode(value) ? 'code' : 'inputs'}
    >
        {!hideViewToggle && (
            <ActionRow>
                <ObjectViewToggle
                    value={value}
                    onChange={onChange}
                    disabled={disabled}
                    ariaLabel={ariaLabel}
                />
            </ActionRow>
        )}
        {isCode(value) ? (
            <ObjectCodeView
                code={value.code}
                onChange={(source) => onChange(code(source))}
                fields={fields}
                allowCustomFields={allowCustomFields}
                hasError={hasError}
                disabled={disabled}
                ariaLabel={ariaLabel}
            />
        ) : (
            <ObjectFieldsView
                value={value}
                onChange={onChange}
                fields={fields}
                allowCustomFields={allowCustomFields}
                diagnosticsOf={diagnosticsOf}
                disabled={disabled}
            />
        )}
    </SObject>
);

const SObject = styled('div')`
    display: flex;
    flex-direction: column;
    gap: ${spacingCss(0.5)};
    min-width: 0;
    width: 100%;
    padding-left: ${spacingCss(1)};
    border-left: 2px solid ${({ theme }) => theme.palette.border.subtle};
`;
