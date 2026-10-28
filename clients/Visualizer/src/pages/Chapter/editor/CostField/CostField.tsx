import { createFormInput } from '../../../../components/form/createFormInput';
import { DEFAULT_DELTA_TIME } from '../../../../values/deltaTime';
import { CostInput } from './CostInput';

export const CostField = createFormInput(CostInput, DEFAULT_DELTA_TIME);
