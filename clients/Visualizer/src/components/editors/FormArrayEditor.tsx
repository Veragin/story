import type { ReactNode } from 'react';
import type { TMaybeCode, TTypeRef, TValue } from '@story/protocol';
import { ArrayEditor } from './ArrayEditor';
import type { TDiagnosticsOf } from '../inputs/inputTypes';
import { FormField } from '../form/FormField';
import { splitFormProps, type TFormInputProps } from '../form/formProps';

type TProps = TFormInputProps<TMaybeCode<TValue[]>, TValue[]> & {
    itemType?: TTypeRef;
    renderItem?: (
        item: TValue,
        onChange: (value: TValue) => void,
        index: number
    ) => ReactNode;
    diagnosticsOf?: TDiagnosticsOf;
    newItem?: () => TValue;
};

export const FormArrayEditor = (props: TProps) => {
    const { labelProps, inputProps } = splitFormProps({
        emptyValue: [],
        ...props,
    });
    return (
        <FormField {...labelProps}>
            {inputProps && <ArrayEditor {...inputProps} />}
        </FormField>
    );
};
