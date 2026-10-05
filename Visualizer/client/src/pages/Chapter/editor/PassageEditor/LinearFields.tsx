import { observer } from 'mobx-react-lite';
import type { TLinearPassageDto } from '@story/visualizer-protocol';
import { FormStringInput } from '../../../../components/inputs/form/FormStringInput';
import { FormTypeInput } from '../../../../components/inputs/form/FormTypeInput';
import { ExecuteField } from './ExecuteField';
import type { TFieldsProps } from './types';

export const LinearFields = observer(
    ({
        draft,
        edit,
        diag,
        passageOptions,
        preamble,
    }: TFieldsProps<TLinearPassageDto>) => (
        <>
            <ExecuteField
                draft={draft}
                edit={edit}
                diag={diag}
                preamble={preamble}
            />
            <FormStringInput
                label={_('Description')}
                multiline
                value={draft.description}
                onChange={(v) =>
                    edit(
                        (d) => d.type === 'linear' && (d.description = v ?? '')
                    )
                }
                diagnostics={diag('description')}
                dataField="description"
            />
            <FormTypeInput
                label={_('Next passage')}
                value={draft.nextPassageId}
                onChange={(v) =>
                    edit(
                        (d) =>
                            d.type === 'linear' &&
                            v !== undefined &&
                            (d.nextPassageId = v)
                    )
                }
                options={passageOptions}
                // can be added but not removed again
                optional={draft.nextPassageId === undefined}
                diagnostics={diag('nextPassageId')}
                dataField="nextPassageId"
            />
        </>
    )
);
