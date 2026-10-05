import { Checkbox } from '@mui/material';
import { isCode, type TMaybeCode } from '@story/visualizer-protocol';
import { CodeValue } from './CodeValue';
import type { TInputProps } from './inputTypes';
import { isBoolean, parseAs } from './valueSource';

const parseBoolean = parseAs(isBoolean);

export const BooleanInput = ({
    value,
    onChange,
    hasError,
    disabled,
    ariaLabel,
    dataField,
}: TInputProps<TMaybeCode<boolean>, boolean>) =>
    isCode(value) ? (
        <CodeValue
            code={value.code}
            parse={parseBoolean}
            fallback={false}
            onChange={onChange}
            hasError={hasError}
            disabled={disabled}
            ariaLabel={ariaLabel}
        />
    ) : (
        <Checkbox
            size="small"
            checked={value}
            color={hasError ? 'error' : 'primary'}
            disabled={disabled}
            inputProps={{ 'aria-label': ariaLabel }}
            data-field={dataField}
            onChange={(e) => onChange(e.target.checked)}
            sx={{ alignSelf: 'flex-start', p: 0.5 }}
        />
    );
