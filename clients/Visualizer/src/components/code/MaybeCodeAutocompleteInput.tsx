import type { ComponentProps } from 'react';
import { parseStringLiteral } from '../../values/codeLiterals';
import { AutocompleteInput } from '../inputs/AutocompleteInput';
import { CodeFallback } from './CodeFallback';
import type { TMaybeCodeOf } from './maybeCodeProps';

type TProps = TMaybeCodeOf<ComponentProps<typeof AutocompleteInput>>;

export const MaybeCodeAutocompleteInput = ({ value, ...props }: TProps) => (
    <CodeFallback
        {...props}
        value={value}
        parse={parseStringLiteral}
        fallback={props.options[0]?.id ?? ''}
    >
        {(id) => <AutocompleteInput {...props} value={id} />}
    </CodeFallback>
);
