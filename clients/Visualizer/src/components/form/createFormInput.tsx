import type { ComponentType } from 'react';
import type { TInputProps } from '../inputs/inputTypes';
import { FormField } from './FormField';
import { splitFormProps, type TFormInputProps } from './formProps';

type TEmptyValue<C, E> = C | ((props: E) => C);

const isEmptyOf = <C, E>(
    emptyValue: TEmptyValue<C, E>
): emptyValue is (props: E) => C => typeof emptyValue === 'function';

const FORM_ONLY_KEYS = [
    'label',
    'diagnostics',
    'optional',
    'actions',
    'helperText',
    'warning',
    'error',
] satisfies (keyof TFormInputProps<unknown>)[];

type TInputExtra<P> = Omit<P, keyof TInputProps<unknown>>;

// P is only read to find the input's own extra props (E)
export const createFormInput = <
    P extends object,
    V,
    C extends V,
    E extends object = TInputExtra<P>,
>(
    Input: ComponentType<P> & ComponentType<TInputProps<V, C> & NoInfer<E>>,
    emptyValue: TEmptyValue<C, E>
) => {
    const Pure: ComponentType<TInputProps<V, C> & E> = Input;
    const FormInput = (props: TFormInputProps<V, C> & E) => {
        const { labelProps, inputProps } = splitFormProps<V, C, E>({
            ...props,
            emptyValue: isEmptyOf(emptyValue) ? emptyValue(props) : emptyValue,
        });
        if (!inputProps) return <FormField {...labelProps} />;
        const passed = { ...props, ...inputProps };
        // the input gets only its own props; the label ones stay on the field
        for (const key of FORM_ONLY_KEYS) Reflect.deleteProperty(passed, key);
        return (
            <FormField {...labelProps}>
                <Pure {...passed} />
            </FormField>
        );
    };
    return FormInput;
};
