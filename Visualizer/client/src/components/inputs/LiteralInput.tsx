import { isCode, type TMaybeCode } from '@story/visualizer-protocol';
import { parseStringLiteral } from './codeLiterals';
import { CodeValue } from './CodeValue';
import type { TInputProps } from './inputTypes';
import { OptionAutocomplete } from './OptionAutocomplete';

type TProps = TInputProps<TMaybeCode<string>, string> & {
    options: readonly string[];
    onCreateOption?: (value: string) => Promise<boolean>;
    placeholder?: string;
};

export const LiteralInput = ({ value, options, ...props }: TProps) =>
    isCode(value) ? (
        <CodeValue
            code={value.code}
            parse={parseStringLiteral}
            fallback={options[0] ?? ''}
            onChange={props.onChange}
            hasError={props.hasError}
            disabled={props.disabled}
            ariaLabel={props.ariaLabel}
        />
    ) : (
        <OptionAutocomplete
            {...props}
            value={value}
            options={options.map((id) => ({ id }))}
        />
    );
