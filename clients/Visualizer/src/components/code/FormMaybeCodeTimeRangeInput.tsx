import { createFormInput } from '../form/createFormInput';
import { MaybeCodeTimeRangeInput } from './MaybeCodeTimeRangeInput';

export const FormMaybeCodeTimeRangeInput = createFormInput(
    MaybeCodeTimeRangeInput,
    { start: '', end: '' }
);
