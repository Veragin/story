import type { ComponentProps } from 'react';
import { codeToText } from '../../values/codeLiterals';
import { TextInput } from '../inputs/TextInput';
import { CodeFallback } from './CodeFallback';
import type { TMaybeCodeOf } from './maybeCodeProps';

type TProps = TMaybeCodeOf<ComponentProps<typeof TextInput>>;

export const MaybeCodeTextInput = ({ value, ...props }: TProps) => (
    <CodeFallback
        {...props}
        value={value}
        parse={codeToText}
        convertLabel={_('Convert to text')}
    >
        {(text) => <TextInput {...props} value={text} />}
    </CodeFallback>
);
