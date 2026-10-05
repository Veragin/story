import { observer } from 'mobx-react-lite';
import type { TTransitionPassageDto } from '@story/visualizer-protocol';
import { FormTypeInput } from '../../../../components/inputs/form/FormTypeInput';
import { ExecuteField } from './ExecuteField';
import type { TFieldsProps } from './types';

export const TransitionFields = observer(
    ({
        draft,
        edit,
        diag,
        transitionOptions,
        preamble,
    }: TFieldsProps<TTransitionPassageDto>) => (
        <>
            <ExecuteField
                draft={draft}
                edit={edit}
                diag={diag}
                preamble={preamble}
            />
            <FormTypeInput
                label={_('Next passage (another chapter)')}
                value={draft.nextPassageId}
                onChange={(v) =>
                    edit(
                        (d) =>
                            d.type === 'transition' &&
                            v !== undefined &&
                            (d.nextPassageId = v)
                    )
                }
                options={transitionOptions}
                placeholder="<chapter>-<character>-<local>"
                diagnostics={diag('nextPassageId')}
                dataField="nextPassageId"
            />
        </>
    )
);
