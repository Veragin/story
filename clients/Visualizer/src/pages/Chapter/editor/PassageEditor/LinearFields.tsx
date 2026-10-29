import { observer } from 'mobx-react-lite';
import type { TDescribedPassageDto, TPassageDto } from '@story/protocol';
import { FormMaybeCodeTextInput } from '../../../../components/code/FormMaybeCodeTextInput';
import { FormMaybeCodeAutocompleteInput } from '../../../../components/code/FormMaybeCodeAutocompleteInput';
import { ExecuteField } from './ExecuteField';
import type { TFieldsProps } from './types';

const isDescribed = (d: TPassageDto): d is TDescribedPassageDto =>
    d.type === 'start' || d.type === 'linear';

export const LinearFields = observer(
    ({
        draft,
        edit,
        diag,
        passageOptions,
        preamble,
    }: TFieldsProps<TDescribedPassageDto>) => (
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
                    edit((d) => isDescribed(d) && (d.description = v ?? ''))
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
                            isDescribed(d) &&
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
