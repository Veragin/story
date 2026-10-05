import { isCode, type TMaybeCode } from '@story/visualizer-protocol';
import { parseStringLiteral } from './codeLiterals';
import { CodeValue } from './CodeValue';
import type { TInputProps, TOption } from './inputTypes';
import { OptionAutocomplete } from './OptionAutocomplete';

type TProps = TInputProps<TMaybeCode<string>, string> & {
    options: readonly TOption[];
    placeholder?: string;
};

export const TypeInput = ({ value, options, ...props }: TProps) =>
    isCode(value) ? (
        <CodeValue
            code={value.code}
            parse={parseStringLiteral}
            fallback={options[0]?.id ?? ''}
            onChange={props.onChange}
            hasError={props.hasError}
            disabled={props.disabled}
            ariaLabel={props.ariaLabel}
        />
    ) : (
        <OptionAutocomplete {...props} value={value} options={options} />
    );
