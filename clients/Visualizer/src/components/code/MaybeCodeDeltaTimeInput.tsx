import type { ComponentProps } from 'react';
import { DEFAULT_DELTA_TIME, parseDelta } from '../../values/deltaTime';
import { DeltaTimeInput } from '../inputs/DeltaTimeInput';
import { CodeFallback } from './CodeFallback';
import type { TMaybeCodeOf } from './maybeCodeProps';

type TProps = TMaybeCodeOf<ComponentProps<typeof DeltaTimeInput>>;

export const MaybeCodeDeltaTimeInput = ({ value, ...props }: TProps) => (
    <CodeFallback
        {...props}
        value={value}
        parse={parseDelta}
        fallback={DEFAULT_DELTA_TIME}
    >
        {(delta) => <DeltaTimeInput {...props} value={delta} />}
    </CodeFallback>
);
