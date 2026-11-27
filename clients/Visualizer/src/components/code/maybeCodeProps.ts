import type { TMaybeCode } from '@story/protocol';

export type TMaybeCodeOf<P extends { value: unknown }> = Omit<P, 'value'> & {
    value: TMaybeCode<P['value']>;
};
