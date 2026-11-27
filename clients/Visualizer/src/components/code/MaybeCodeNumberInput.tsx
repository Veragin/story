import type { ComponentProps } from 'react';
import { isNumber, parseAs } from '../../values/valueSource';
import { NumberInput } from '../inputs/NumberInput';
import { CodeFallback } from './CodeFallback';
import type { TMaybeCodeOf } from './maybeCodeProps';

type TProps = TMaybeCodeOf<ComponentProps<typeof NumberInput>>;

const parseNumber = parseAs(isNumber);

export const MaybeCodeNumberInput = ({ value, ...props }: TProps) => (
    <CodeFallback {...props} value={value} parse={parseNumber} fallback={0}>
        {(number) => <NumberInput {...props} value={number} />}
    </CodeFallback>
);
