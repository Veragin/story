import { observer } from 'mobx-react-lite';
import type { TLinearPassageDto } from '@story/protocol';
import { FormMaybeCodeTextInput } from '../../../../components/code/FormMaybeCodeTextInput';
import { FormMaybeCodeAutocompleteInput } from '../../../../components/code/FormMaybeCodeAutocompleteInput';
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
            <FormMaybeCodeTextInput
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
            <FormMaybeCodeAutocompleteInput
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
