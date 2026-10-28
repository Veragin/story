import { DEFAULT_DELTA_TIME } from '../../values/deltaTime';
import { createFormInput } from '../form/createFormInput';
import { MaybeCodeDeltaTimeInput } from './MaybeCodeDeltaTimeInput';

export const FormMaybeCodeDeltaTimeInput = createFormInput(
    MaybeCodeDeltaTimeInput,
    DEFAULT_DELTA_TIME
);
