import { observer } from 'mobx-react-lite';
import type { TFinishPassageDto } from '@story/protocol';
import { FormMaybeCodeAutocompleteInput } from '../../../../components/code/FormMaybeCodeAutocompleteInput';
import { ExecuteField } from './ExecuteField';
import type { TFieldsProps } from './types';

export const FinishFields = observer(
    ({
        draft,
        edit,
        diag,
        finishOptions,
        preamble,
    }: TFieldsProps<TFinishPassageDto>) => (
        <>
            <ExecuteField
                draft={draft}
                edit={edit}
                diag={diag}
                preamble={preamble}
            />
            <FormMaybeCodeAutocompleteInput
                label={_('Next passage (another chapter)')}
                value={draft.nextPassageId}
                onChange={(v) =>
                    edit(
                        (d) =>
                            d.type === 'finish' &&
                            v !== undefined &&
                            (d.nextPassageId = v)
                    )
                }
                options={finishOptions}
                placeholder="<chapter>-<character>-<local>"
                diagnostics={diag('nextPassageId')}
                dataField="nextPassageId"
            />
        </>
    )
);
