import type { TInputProps } from './inputTypes';
import { TextInput } from './TextInput';

export const TimeInput = (props: TInputProps<string>) => (
    <TextInput {...props} placeholder="2.1. 8:00" />
);
