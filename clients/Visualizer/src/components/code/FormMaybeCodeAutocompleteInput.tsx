import { createFormInput } from '../form/createFormInput';
import { MaybeCodeAutocompleteInput } from './MaybeCodeAutocompleteInput';

export const FormMaybeCodeAutocompleteInput = createFormInput(
    MaybeCodeAutocompleteInput,
    ({ options }) => options[0]?.id ?? ''
);
