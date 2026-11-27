import { RadioInput } from '../inputs/RadioInput';
import { createFormInput } from './createFormInput';

export const FormRadioInput = createFormInput(
    RadioInput,
    ({ options }) => options[0]?.id ?? ''
);
