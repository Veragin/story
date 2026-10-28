import type { TDeltaTimeDto, TMaybeCode } from '@story/protocol';
import { FormLabel } from '../../../../components/form/FormLabel';
import {
    splitFormProps,
    type TFormInputProps,
} from '../../../../components/form/formProps';
import { DEFAULT_COST_TIME } from '../costCode';
import { DeltaTimeInput } from './DeltaTimeInput';

type TProps = TFormInputProps<TMaybeCode<TDeltaTimeDto>, TDeltaTimeDto> & {
    dataField?: string;
};

export const FormDeltaTimeInput = (props: TProps) => {
    const { labelProps, inputProps } = splitFormProps({
        emptyValue: DEFAULT_COST_TIME,
        ...props,
    });
    return (
        <FormLabel {...labelProps}>
            {inputProps && <DeltaTimeInput {...inputProps} />}
        </FormLabel>
    );
};
