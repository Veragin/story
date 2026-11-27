import { AutocompleteInput } from '../inputs/AutocompleteInput';
import { createFormInput } from './createFormInput';

export const FormAutocompleteInput = createFormInput(
    AutocompleteInput,
    ({ options }) => options[0]?.id ?? ''
);
