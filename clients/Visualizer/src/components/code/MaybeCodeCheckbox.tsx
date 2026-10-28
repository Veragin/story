import type { ComponentProps } from 'react';
import { isBoolean, parseAs } from '../../values/valueSource';
import { Checkbox } from '../inputs/Checkbox';
import { CodeFallback } from './CodeFallback';
import type { TMaybeCodeOf } from './maybeCodeProps';

type TProps = TMaybeCodeOf<ComponentProps<typeof Checkbox>>;

const parseBoolean = parseAs(isBoolean);

export const MaybeCodeCheckbox = ({ value, ...props }: TProps) => (
    <CodeFallback
        {...props}
        value={value}
        parse={parseBoolean}
        fallback={false}
    >
        {(checked) => <Checkbox {...props} value={checked} />}
    </CodeFallback>
);
