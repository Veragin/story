import type { ComponentProps } from 'react';
import { TimeInput } from '../inputs/TimeInput';
import { CodeFallback } from './CodeFallback';
import type { TMaybeCodeOf } from './maybeCodeProps';

type TProps = TMaybeCodeOf<ComponentProps<typeof TimeInput>>;

const TIME_RE = /^Time\.fromString\(\s*(['"])(.*)\1\s*\)$/;

const parseTime = (code: string) => TIME_RE.exec(code.trim())?.[2];

export const MaybeCodeTimeInput = ({ value, ...props }: TProps) => (
    <CodeFallback {...props} value={value} parse={parseTime} fallback="">
        {(time) => <TimeInput {...props} value={time} />}
    </CodeFallback>
);
