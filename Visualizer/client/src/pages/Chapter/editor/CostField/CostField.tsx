import type { TLinkCostDto, TMaybeCode } from '@story/visualizer-protocol';
import { FormLabel } from '../../../../components/inputs/form/FormLabel';
import {
    splitFormProps,
    type TFormInputProps,
} from '../../../../components/inputs/form/formProps';
import type {
    TDiagnosticsOf,
    TOption,
} from '../../../../components/inputs/inputTypes';
import { DEFAULT_COST_TIME } from '../costCode';
import { CostInput } from './CostInput';

type TProps = TFormInputProps<TMaybeCode<TLinkCostDto>, TLinkCostDto> & {
    items: readonly TOption[];
    diagnosticsOf: TDiagnosticsOf;
    dataField?: string;
};

export const CostField = (props: TProps) => {
    const { labelProps, inputProps } = splitFormProps({
        emptyValue: DEFAULT_COST_TIME,
        ...props,
    });
    return (
        <FormLabel {...labelProps}>
            {inputProps && <CostInput {...inputProps} />}
        </FormLabel>
    );
};
