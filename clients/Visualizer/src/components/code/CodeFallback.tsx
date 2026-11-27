import type { ReactNode } from 'react';
import { isCode, type TMaybeCode } from '@story/protocol';
import type { TInputProps } from '../inputs/inputTypes';
import { CodeValue } from './CodeValue';

type TProps<T> = TInputProps<TMaybeCode<T>, T> & {
    parse: (code: string) => T | undefined;
    fallback?: T;
    convertLabel?: string;
    children: (value: T) => ReactNode;
};

export const CodeFallback = <T,>({
    value,
    onChange,
    parse,
    fallback,
    convertLabel,
    hasError,
    disabled,
    ariaLabel,
    children,
}: TProps<T>) =>
    isCode(value) ? (
        <CodeValue
            code={value.code}
            parse={parse}
            fallback={fallback}
            convertLabel={convertLabel}
            onChange={onChange}
            hasError={hasError}
            disabled={disabled}
            ariaLabel={ariaLabel}
        />
    ) : (
        children(value)
    );
