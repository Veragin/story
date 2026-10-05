import type { ReactNode } from 'react';
import type { TMaybeCode, TTypeRef, TValue } from '@story/visualizer-protocol';
import { ArrayInput } from '../ArrayInput';
import type { TDiagnosticsOf } from '../inputTypes';
import { FormLabel } from './FormLabel';
import { splitFormProps, type TFormInputProps } from './formProps';

type TProps = TFormInputProps<TMaybeCode<TValue[]>, TValue[]> & {
    itemType?: TTypeRef;
    renderItem?: (
        item: TValue,
        onChange: (value: TValue) => void,
        index: number
    ) => ReactNode;
    diagnosticsOf?: TDiagnosticsOf;
    newItem?: () => TValue;
    dataField?: string;
};

export const FormArrayInput = (props: TProps) => {
    const { labelProps, inputProps } = splitFormProps({
        emptyValue: [],
        ...props,
    });
    return (
        <FormLabel {...labelProps}>
            {inputProps && <ArrayInput {...inputProps} />}
        </FormLabel>
    );
};
